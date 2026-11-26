/**
 * Token storage.
 *
 * Keychain on iOS, Keystore on Android, via expo-secure-store. Never
 * AsyncStorage: that is an unencrypted file readable by anything with access to
 * the app sandbox, and on a rooted or jailbroken device readable by anything at
 * all. An access token in there is a session anyone can take.
 *
 * The module deliberately exposes no "dump everything" helper and no debug
 * print — the fewer routes a token has to a log, the better.
 */

import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN = 'askmira.access_token';
const REFRESH_TOKEN = 'askmira.refresh_token';
const EXPIRES_AT = 'askmira.expires_at';

/**
 * Require the device to be unlocked before the value is readable, and keep it
 * off backups — a token restored onto a different handset is a session that
 * outlived its device.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN, session.accessToken, OPTIONS),
    SecureStore.setItemAsync(REFRESH_TOKEN, session.refreshToken, OPTIONS),
    SecureStore.setItemAsync(EXPIRES_AT, String(session.expiresAt), OPTIONS),
  ]);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN, OPTIONS),
    SecureStore.getItemAsync(REFRESH_TOKEN, OPTIONS),
    SecureStore.getItemAsync(EXPIRES_AT, OPTIONS),
  ]);

  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, expiresAt: Number(expiresAt ?? 0) };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN, OPTIONS),
    SecureStore.deleteItemAsync(REFRESH_TOKEN, OPTIONS),
    SecureStore.deleteItemAsync(EXPIRES_AT, OPTIONS),
  ]);
}

/** Whether the stored access token is still within its lifetime. */
export function isFresh(session: StoredSession | null, skewSeconds = 60): boolean {
  if (!session) return false;
  return session.expiresAt * 1000 > Date.now() + skewSeconds * 1000;
}
