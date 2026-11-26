/**
 * Field checks for Indian identifiers and contact details, run as the person
 * types so a mistake is said next to the field, not after a round trip.
 *
 * Each returns an error message, or null when the value is fine. An empty
 * optional value is fine; `required` is checked separately.
 */

export type Check = (value: string) => string | null;

const strip = (value: string) => value.replace(/\s+/g, '');

export const checks = {
  pan: (value: string) =>
    /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(strip(value).toUpperCase()) ? null : 'A PAN is 10 characters, like ABCDE1234F.',
  ifsc: (value: string) =>
    /^[A-Z]{4}0[A-Z0-9]{6}$/.test(strip(value).toUpperCase()) ? null : 'An IFSC is 11 characters, like HDFC0001234.',
  pincode: (value: string) => (/^[1-9][0-9]{5}$/.test(strip(value)) ? null : 'A PIN code is 6 digits.'),
  aadhaar: (value: string) => (/^[2-9][0-9]{11}$/.test(strip(value)) ? null : 'An Aadhaar number is 12 digits.'),
  uan: (value: string) => (/^[0-9]{12}$/.test(strip(value)) ? null : 'A UAN is 12 digits.'),
  accountNumber: (value: string) => (/^[0-9]{6,18}$/.test(strip(value)) ? null : 'Enter the account number, 6 to 18 digits.'),
  phone: (value: string) => {
    const digits = value.replace(/[\s()-]/g, '');
    return /^(\+91)?[6-9][0-9]{9}$/.test(digits) || /^\+[1-9][0-9]{7,14}$/.test(digits)
      ? null
      : 'Enter a 10-digit mobile number, or an international number starting with +.';
  },
  email: (value: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? null : 'Enter an email address like name@example.com.'),
  year: (value: string) => {
    const year = Number(value);
    return /^\d{4}$/.test(value) && year >= 1950 && year <= new Date().getFullYear() + 6 ? null : 'Enter a year like 2018.';
  },
  percent: (value: string) => {
    const n = Number(value);
    return value.trim() !== '' && Number.isFinite(n) && n > 0 && n <= 100 ? null : 'Enter a share from 1 to 100.';
  },
} satisfies Record<string, Check>;

export type CheckName = keyof typeof checks;

/** Run a field's check, treating empty as fine unless required. */
export function validateField(value: string | null | undefined, options: { required?: boolean; check?: CheckName; maxLength?: number } = {}): string | null {
  const text = (value ?? '').trim();
  if (!text) return options.required ? 'This is needed.' : null;
  if (options.maxLength && text.length > options.maxLength) return `Keep it under ${options.maxLength} characters.`;
  return options.check ? checks[options.check](text) : null;
}

/** Normalise an identifier for sending: upper-case and no spaces where that is how it is written. */
export function normaliseId(check: CheckName | undefined, value: string): string {
  if (check === 'pan' || check === 'ifsc') return strip(value).toUpperCase();
  if (check === 'aadhaar' || check === 'uan' || check === 'pincode' || check === 'accountNumber') return strip(value);
  return value.trim();
}

/** Nominee shares for one purpose must add up to 100. */
export function sharesProblem(items: { purpose: string; share_percent: string | number }[]): string | null {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.purpose, (totals.get(item.purpose) ?? 0) + Number(item.share_percent || 0));
  for (const [purpose, total] of totals) {
    if (Math.abs(total - 100) > 0.001) return `Shares for ${purpose.toUpperCase()} add up to ${total}%; they must add up to 100%.`;
  }
  return null;
}

/** The server's password rules (schemas/auth.py): 10+ characters, a letter and a digit. */
export function passwordProblem(value: string): string | null {
  if (value.length < 10) return 'Use at least 10 characters.';
  if (!/[A-Za-z]/.test(value)) return 'Include a letter.';
  if (!/\d/.test(value)) return 'Include a digit.';
  return null;
}
