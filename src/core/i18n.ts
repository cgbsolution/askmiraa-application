/**
 * Translation, gettext style.
 *
 * Every user-facing string goes through `t()`, keyed by its English text:
 * `t('Apply leave')`, `t('{count} waiting on you', { count })`. English needs
 * no dictionary — the key is the text — so a screen reads naturally and no
 * string can be "missing" in English. Other languages map the English text to
 * theirs; anything not yet translated falls back to English rather than
 * showing a key.
 *
 * Pure TypeScript, so the interpolation and fallback rules are tested in Node.
 */

import { hi } from '../i18n/hi.ts';

export type Language = 'en' | 'hi';

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
];

const DICTIONARIES: Record<Language, Record<string, string>> = {
  en: {},
  hi,
};

export type Params = Record<string, string | number | null | undefined>;

/** Replace `{name}` placeholders. A missing value leaves the placeholder visible, which a test catches. */
export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? whole : String(value);
  });
}

export function translate(language: Language, text: string, params?: Params): string {
  const dictionary = DICTIONARIES[language] ?? {};
  return interpolate(dictionary[text] ?? text, params);
}

/** "1 request", "3 requests". English plural only; Hindi entries carry their own form. */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Hindi entries whose English key no longer matches its placeholders. Tested to be empty. */
export function placeholderMismatches(): string[] {
  const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  return Object.entries(hi)
    .filter(([english, hindi]) => names(english) !== names(hindi))
    .map(([english]) => english);
}
