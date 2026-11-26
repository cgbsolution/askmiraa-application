/**
 * The app's `t()`.
 *
 * The language lives in a module variable set by SettingsProvider, so `t()`
 * works anywhere — a component, a toast, a hook — without threading context.
 * Changing the language remounts the navigator (see App), which re-renders
 * every screen in the new language.
 */

import { translate, type Language, type Params } from '../core/i18n';

let current: Language = 'en';

export function setLanguage(language: Language): void {
  current = language;
}

export function currentLanguage(): Language {
  return current;
}

export function t(text: string, params?: Params): string {
  return translate(current, text, params);
}

/**
 * A counted phrase in the right number: `tn(1, '{count} vote', '{count} votes')`.
 * Both forms go through `t()`, so each can be translated on its own.
 */
export function tn(count: number, one: string, many: string, params?: Params): string {
  return t(count === 1 ? one : many, { count, ...params });
}
