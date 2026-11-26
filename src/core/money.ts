/**
 * Money, without floating point.
 *
 * The backend sends amounts as decimal strings ("123456.50") from `Numeric`
 * columns. They stay strings here: parsing "0.1" + "0.2" through `Number`
 * gives 0.30000000000000004, and a payslip is the last place to discover that.
 * Arithmetic, where a screen needs a total, runs on BigInt paise.
 */

const DECIMAL = /^\s*(-)?(\d*)(?:\.(\d*))?\s*$/;

/** Whether a value is a decimal string (or a safe number) we can format. */
export function isDecimal(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  const match = DECIMAL.exec(value);
  return Boolean(match && ((match[2] ?? '') !== '' || (match[3] ?? '') !== ''));
}

/**
 * A decimal value as BigInt units of 10^-scale (paise at scale 2), rounded
 * half away from zero. `null` for anything that is not a decimal.
 */
export function toUnits(value: string | number | null | undefined, scale = 2): bigint | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === 'number' ? numberToPlain(value) : value;
  if (!isDecimal(text)) return null;
  const match = DECIMAL.exec(text)!;
  const negative = Boolean(match[1]);
  const whole = match[2] || '0';
  const fraction = match[3] ?? '';
  const kept = (fraction + '0'.repeat(scale)).slice(0, scale);
  const next = fraction.charAt(scale);
  let units = BigInt(whole) * 10n ** BigInt(scale) + BigInt(kept || '0');
  if (next !== '' && Number(next) >= 5) units += 1n;
  if (units === 0n) return 0n;
  return negative ? -units : units;
}

/** BigInt units back to a plain decimal string, e.g. 12345n at scale 2 -> "123.45". */
export function fromUnits(units: bigint, scale = 2): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const base = 10n ** BigInt(scale);
  const whole = (abs / base).toString();
  const fraction = scale > 0 ? (abs % base).toString().padStart(scale, '0') : '';
  return `${negative ? '-' : ''}${whole}${scale > 0 ? '.' + fraction : ''}`;
}

/** Sum decimal strings exactly. Non-decimals are skipped. */
export function sumDecimals(values: (string | number | null | undefined)[], scale = 2): string {
  let total = 0n;
  for (const value of values) {
    const units = toUnits(value, scale);
    if (units !== null) total += units;
  }
  return fromUnits(total, scale);
}

/** -1, 0 or 1. Non-decimals compare as null (returns null). */
export function compareDecimals(a: string | number, b: string | number, scale = 2): -1 | 0 | 1 | null {
  const x = toUnits(a, scale);
  const y = toUnits(b, scale);
  if (x === null || y === null) return null;
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Whether a decimal string is more than zero (false for junk). */
export function isPositiveAmount(value: string | number | null | undefined): boolean {
  return value !== null && value !== undefined && compareDecimals(value, 0) === 1;
}

/** Group an integer string the Indian way: 1,23,45,678. */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return `${groups.join(',')},${last3}`;
}

export interface MoneyOptions {
  /** Decimal places shown. Default 2 — "₹1,23,456.00". */
  decimals?: number;
  /** Prefix with ₹. Default true. */
  symbol?: boolean;
  /** Drop ".00" on whole amounts. Default false. */
  trimZeros?: boolean;
}

/**
 * Format an amount as Indian rupees: `formatINR("123456")` -> "₹1,23,456.00".
 * Returns "—" for a missing or malformed value rather than "₹NaN".
 */
export function formatINR(value: string | number | null | undefined, options: MoneyOptions = {}): string {
  const { decimals = 2, symbol = true, trimZeros = false } = options;
  const units = toUnits(value ?? null, decimals);
  if (units === null) return '—';
  const plain = fromUnits(units, decimals);
  const negative = plain.startsWith('-');
  const [whole = '0', fraction = ''] = plain.replace('-', '').split('.');
  const showFraction = decimals > 0 && !(trimZeros && /^0+$/.test(fraction));
  const body = groupIndian(whole) + (showFraction ? `.${fraction}` : '');
  return `${negative ? '-' : ''}${symbol ? '₹' : ''}${body}`;
}

/** Group a plain number (a count) the Indian way, without decimals. */
export function formatCount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const units = toUnits(value, 0);
  if (units === null) return '—';
  const text = units.toString();
  return text.startsWith('-') ? '-' + groupIndian(text.slice(1)) : groupIndian(text);
}

/** A decimal string of days ("1.5", "2.00") shown as "1.5 days" / "2 days" / "1 day". */
export function formatDays(value: string | number | null | undefined): string {
  const units = toUnits(value ?? null, 2);
  if (units === null) return '—';
  const plain = fromUnits(units, 2).replace(/\.?0+$/, '');
  return `${plain} ${plain === '1' || plain === '-1' ? 'day' : 'days'}`;
}

/** A decimal string without trailing zeros: "2.50" -> "2.5", "3.00" -> "3". */
export function plainDecimal(value: string | number | null | undefined): string {
  const units = toUnits(value ?? null, 2);
  if (units === null) return '—';
  return fromUnits(units, 2).replace(/\.?0+$/, '') || '0';
}

/** The mask shown over a salary or bank figure until it is tapped. */
export const MASK = '₹ ••••••';

/** Mask a bank account number, keeping the last four digits. */
export function maskAccount(value: string | null | undefined): string {
  if (!value) return '—';
  const digits = value.replace(/\s/g, '');
  if (digits.length <= 4) return '••••';
  return '•••• ' + digits.slice(-4);
}

function numberToPlain(value: number): string {
  if (!Number.isFinite(value)) return 'x';
  // toFixed avoids exponent notation for the magnitudes money uses.
  return Math.abs(value) < 1e21 ? value.toFixed(6) : 'x';
}
