/**
 * Amount input, filtered as it is typed.
 *
 * CLAUDE.md: amount fields must refuse non-numeric input as it is typed, not
 * only on save. `acceptAmountInput` is called with every change event; it
 * returns the text to keep, so a letter, a minus sign, an "e" or a third
 * decimal simply does not appear.
 */

import { formatINR } from './money.ts';

export interface AmountRules {
  /** Decimal places allowed. Default 2. 0 for whole numbers only. */
  decimals?: number;
  /** Digits allowed before the point. Default 10 (₹999 crore). */
  maxIntegerDigits?: number;
}

/**
 * The text an amount field should show after a change.
 *
 * - Pasted grouping is forgiven: "1,23,456.78" and "₹ 1 234" become digits.
 * - Anything else that is not a digit or one decimal point is refused, and
 *   the previous text is kept.
 * - Leading zeros collapse ("007" -> "7"); "." becomes "0.".
 * - Extra decimals and extra integer digits are refused.
 */
export function acceptAmountInput(previous: string, next: string, rules: AmountRules = {}): string {
  const { decimals = 2, maxIntegerDigits = 10 } = rules;
  // Forgive what a paste or a keyboard adds around a number.
  const cleaned = next.replace(/[\s,₹]/g, '');
  if (cleaned === '') return '';
  const pattern = decimals > 0 ? /^\d*\.?\d*$/ : /^\d*$/;
  if (!pattern.test(cleaned)) return previous;

  let [whole = '', fraction] = cleaned.split('.') as [string, string | undefined];
  if (fraction !== undefined && fraction.length > decimals) return previous;

  whole = whole.replace(/^0+(?=\d)/, '');
  if (whole === '' && fraction !== undefined) whole = '0';
  if (whole.length > maxIntegerDigits) return previous;

  return fraction === undefined ? whole : `${whole}.${fraction}`;
}

/** Whether a finished amount may be submitted: a number, above zero (unless allowed), within rules. */
export function validateAmount(
  text: string,
  { allowZero = false, max, maxLabel }: { allowZero?: boolean; max?: string; /** How to say the limit; rupees by default. */ maxLabel?: string } = {},
): string | null {
  const value = text.trim();
  if (value === '') return 'Enter an amount.';
  if (!/^\d+(\.\d+)?$/.test(value.replace(/\.$/, ''))) return 'Enter a number, like 1250 or 1250.50.';
  const numeric = value.replace(/\.$/, '');
  if (!allowZero && /^0+(\.0+)?$/.test(numeric)) return 'The amount must be more than zero.';
  if (max !== undefined && compareDecimalStrings(numeric, max) > 0) {
    return `The amount cannot be more than ${maxLabel ?? formatINR(max)}.`;
  }
  return null;
}

/** The amount as the API wants it: a plain decimal string, no trailing point. */
export function normaliseAmount(text: string): string {
  return text.trim().replace(/\.$/, '');
}

function compareDecimalStrings(a: string, b: string): number {
  const [aw = '0', af = ''] = a.split('.');
  const [bw = '0', bf = ''] = b.split('.');
  const width = Math.max(af.length, bf.length);
  const x = BigInt(aw + af.padEnd(width, '0'));
  const y = BigInt(bw + bf.padEnd(width, '0'));
  return x < y ? -1 : x > y ? 1 : 0;
}
