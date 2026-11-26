/**
 * Device preferences: theme, language, biometric unlock.
 *
 * Kept in AsyncStorage — these are conveniences, not secrets. Read once at
 * launch; a missing or unreadable value falls back to the default rather than
 * blocking the app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setLanguage } from './i18n';
import type { Language } from '../core/i18n';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePreference;
  language: Language;
  /** Ask for a fingerprint or face when the app reopens. */
  biometric: boolean;
}

const DEFAULTS: Settings = { theme: 'system', language: 'en', biometric: true };
const KEY = 'askmira.settings.v1';

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULTS,
  ready: false,
  update: () => {},
});

export async function readSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
      language: parsed.language === 'hi' ? 'hi' : 'en',
      biometric: parsed.biometric !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void readSettings().then((stored) => {
      setLanguage(stored.language);
      setSettings(stored);
      setReady(true);
    });
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      if (patch.language) setLanguage(patch.language);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {
        // A preference that fails to save is applied for this session only.
      });
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
