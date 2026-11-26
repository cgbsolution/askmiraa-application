/**
 * API client.
 *
 * Every request goes through `api()` (JSON), `upload()` (multipart) or
 * `download()` (a file to the device). All three share the token refresh, so
 * a person who left the app open overnight is not bounced to sign-in for no
 * reason, and a refresh that fails signs them out cleanly.
 *
 * Response shapes come from `src/core/types.ts` (generated from the backend's
 * own schemas). Screens never call `api()` with a raw path: each module has a
 * typed client in `src/api/`.
 */

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';

import { readableDates } from '../core/dates';
import { refreshVerdict } from '../core/refresh';
import { isFresh, loadSession, saveSession, type StoredSession } from './secureTokens';

function configuredBase(): string {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  const fromConfig = extra?.apiBaseUrl;
  return (fromConfig && fromConfig.trim()) || 'http://localhost:8000';
}

export const API_BASE: string = configuredBase().replace(/\/+$/, '');
export const API_ROOT = `${API_BASE}/api/v1`;

export class ApiError extends Error {
  readonly status: number;
  /** Field errors from a 422, keyed by field name. */
  readonly fields: Record<string, string>;

  constructor(status: number, detail: string, fields: Record<string, string> = {}) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

/** Thrown when the device has no connectivity. Callers show an offline state. */
export class OfflineError extends Error {
  constructor() {
    super('No connection.');
    this.name = 'OfflineError';
  }
}

/** Thrown when the session cannot be refreshed. The app returns to sign-in. */
export class SessionExpiredError extends ApiError {
  constructor() {
    super(401, 'Your session expired. Please sign in again.');
    this.name = 'SessionExpiredError';
  }
}

type Listener = () => void;
const expiredListeners = new Set<Listener>();

/** Called when a refresh fails: App signs the person out. */
export function onSessionExpired(listener: Listener): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

/**
 * The outcome of a refresh. Only the server refusing the refresh token ends
 * the session. No signal, a timeout or a server error leaves it alone: being
 * signed out for walking into a lift is not acceptable, and the next request
 * simply tries again.
 */
type RefreshOutcome = { kind: 'ok'; session: StoredSession } | { kind: 'refused' } | { kind: 'unavailable'; error: Error };

let refreshing: Promise<RefreshOutcome> | null = null;

async function refreshOnce(session: StoredSession): Promise<RefreshOutcome> {
  // One refresh at a time: ten parallel requests with an expired token must
  // not spend the refresh token ten times.
  if (!refreshing) {
    refreshing = (async (): Promise<RefreshOutcome> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20_000);
        let response: Response;
        try {
          response = await fetch(`${API_ROOT}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refreshToken }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        const verdict = refreshVerdict(response.status);
        if (verdict === 'refused') return { kind: 'refused' };
        if (verdict === 'unavailable') {
          const payload = await response.json().catch(() => null);
          return { kind: 'unavailable', error: new ApiError(response.status, readDetail(response.status, payload).message) };
        }
        const auth = await response.json();
        const next: StoredSession = {
          accessToken: auth.access_token,
          refreshToken: auth.refresh_token,
          expiresAt: Math.floor(Date.now() / 1000) + auth.expires_in,
        };
        await saveSession(next);
        return { kind: 'ok', session: next };
      } catch {
        return { kind: 'unavailable', error: new OfflineError() };
      } finally {
        setTimeout(() => {
          refreshing = null;
        }, 0);
      }
    })();
  }
  return refreshing;
}

function endSession(): never {
  expiredListeners.forEach((listener) => listener());
  throw new SessionExpiredError();
}

/** A usable access token, refreshing first if needed (or `force`d, after a 401). */
async function currentSession(force = false): Promise<StoredSession | null> {
  const session = await loadSession();
  if (!session) return null;
  if (!force && isFresh(session)) return session;
  const outcome = await refreshOnce(session);
  if (outcome.kind === 'ok') return outcome.session;
  if (outcome.kind === 'refused') endSession();
  throw outcome.error;
}

/** FastAPI's `detail`: a string, or a list of field errors from a 422. */
export function readDetail(status: number, payload: unknown): { message: string; fields: Record<string, string> } {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return { message: readableDates(detail), fields: {} };
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {};
    const messages: string[] = [];
    for (const item of detail as { loc?: unknown[]; msg?: string }[]) {
      const loc = (item.loc ?? []).filter((part) => part !== 'body' && part !== 'query');
      const field = loc.length ? String(loc[loc.length - 1]) : '';
      const msg = (item.msg ?? 'Invalid value').replace(/^Value error, /, '');
      if (field && !fields[field]) fields[field] = msg;
      messages.push(field ? `${humanise(field)}: ${msg}` : msg);
    }
    return { message: messages.join('\n') || `Request failed (${status}).`, fields };
  }
  if (status === 404) return { message: 'Not found. It may have been removed.', fields: {} };
  if (status === 403) return { message: 'You do not have access to this.', fields: {} };
  if (status >= 500) return { message: 'The server had a problem. Please try again in a moment.', fields: {} };
  return { message: `Request failed (${status}).`, fields: {} };
}

function humanise(field: string): string {
  const words = field.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
  skipAuth?: boolean;
  signal?: AbortSignal;
}

export function withQuery(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  if (!parts.length) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${parts.join('&')}`;
}

/** One JSON request. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await request<T>(path, options, false);
  } catch (error) {
    // The token looked fresh here but not to the server (a phone clock that
    // is off, or a token revoked elsewhere): refresh once and try again. A
    // refused refresh ends the session inside currentSession.
    if (error instanceof UnauthorizedError && !options.skipAuth) return request<T>(path, options, true);
    throw error;
  }
}

/** A 401 on a request that sent a token, before any refresh was tried. */
class UnauthorizedError extends ApiError {
  constructor(message: string) {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

async function request<T>(path: string, options: RequestOptions, retried: boolean): Promise<T> {
  const { method = 'GET', body, query, timeoutMs = 20_000, skipAuth = false, signal } = options;
  const session = skipAuth ? null : await currentSession(retried);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${withQuery(path, query)}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    // A network failure and a timeout are the same thing to a user on a
    // factory floor, and both mean "show the offline state".
    throw new OfflineError();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  if (response.status === 401 && session && !retried) {
    const payload = await response.json().catch(() => null);
    throw new UnauthorizedError(readDetail(401, payload).message);
  }
  return handle<T>(response, Boolean(session));
}

/** `authed`: the request carried a token, so a 401 means the session is over. */
async function handle<T>(response: Response, authed: boolean): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && authed) endSession();
    const { message, fields } = readDetail(response.status, payload);
    throw new ApiError(response.status, message, fields);
  }
  return payload as T;
}

/** A file to send in a multipart request. */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * A multipart request (receipts, attachments, photos), with the same auth and
 * refresh as `api()`. Uploads get a longer timeout: a photo on a slow
 * connection takes time.
 */
export async function upload<T>(
  path: string,
  fields: Record<string, string | number | boolean | UploadFile | UploadFile[] | null | undefined>,
  options: { method?: 'POST' | 'PUT'; timeoutMs?: number } = {},
): Promise<T> {
  const { method = 'POST', timeoutMs = 90_000 } = options;
  const session = await currentSession();
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (typeof item === 'object') {
        // React Native's FormData takes { uri, name, type } for a file.
        form.append(key, item as unknown as Blob);
      } else {
        form.append(key, String(item));
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_ROOT}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: form,
      signal: controller.signal,
    });
    return await handle<T>(response, Boolean(session));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new OfflineError();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Download a file (a payslip PDF, a letter) into the app's cache and return
 * its local uri. The caller opens or shares it.
 */
export async function download(path: string, filename: string): Promise<string> {
  return (await downloadFile(path, filename)).uri;
}

/** Download to the cache; also says what type the server sent. */
export async function downloadFile(path: string, filename: string): Promise<{ uri: string; mime: string | null }> {
  const session = await currentSession();
  const safeName = filename.replace(/[^A-Za-z0-9._-]+/g, '_');
  const target = `${FileSystem.cacheDirectory ?? ''}${safeName}`;
  try {
    const result = await FileSystem.downloadAsync(`${API_ROOT}${path}`, target, {
      headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
    });
    if (result.status >= 400) {
      const text = await FileSystem.readAsStringAsync(result.uri).catch(() => '');
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
      let payload: unknown = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
      if (result.status === 401) endSession();
      throw new ApiError(result.status, readDetail(result.status, payload).message);
    }
    const headers = result.headers ?? {};
    const type = headers['Content-Type'] ?? headers['content-type'] ?? null;
    return { uri: result.uri, mime: type ? (type.split(';')[0] ?? '').trim() || null : null };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new OfflineError();
  }
}

/** Headers for an authenticated image (a profile photo). */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const session = await currentSession();
    return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
  } catch {
    return {};
  }
}
