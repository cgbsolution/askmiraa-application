/**
 * Sign-in.
 *
 * Two steps, as on the portal: the person types their work email or mobile
 * number and the app learns which company it belongs to (`/auth/identify` —
 * name, logo, single sign-on); then a password, and a 2-step code when the
 * workspace asks for one.
 *
 * SSO runs in the **system browser** via expo-web-browser, never an embedded
 * WebView. Three reasons, each sufficient on its own:
 *
 *   1. An embedded WebView lets the host app read what the user types into
 *      their identity provider. Every major IdP treats that as a
 *      credential-harvesting pattern and several actively block it.
 *   2. The system browser already holds the corporate SSO session, so someone
 *      signed in to Entra ID on their phone is not asked again.
 *   3. Platform authenticators and hardware keys only work there.
 *
 * Biometric unlock guards *re-entry*, not the first sign-in: the tokens are
 * already in the Keystore, and the fingerprint gates reading them back.
 */

import * as AuthSession from 'expo-auth-session';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';

import { API_ROOT, readDetail } from './api';
import { clearSession, isFresh, loadSession, saveSession, type StoredSession } from './secureTokens';

WebBrowser.maybeCompleteAuthSession();

export interface Workspace {
  name: string;
  workspace: string;
  logo_url: string | null;
  sso: unknown;
  login_kind: 'email' | 'mobile';
}

export interface DiscoverResult {
  ssoAvailable: boolean;
  ssoRequired: boolean;
  providerId?: string;
  providerName?: string;
}

export type LoginOutcome =
  | { kind: 'signed_in'; session: StoredSession }
  | { kind: 'mfa'; mfaToken: string; message: string | null };

export class SignInError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'SignInError';
    this.status = status;
  }
}

async function post(path: string, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SignInError(0, 'No connection. Check your signal and try again.');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429) {
      throw new SignInError(429, 'Too many attempts. Wait a minute and try again.');
    }
    throw new SignInError(response.status, readDetail(response.status, payload).message);
  }
  return payload;
}

/** Step one: which company a login belongs to. */
export async function identify(login: string): Promise<Workspace> {
  return (await post('/auth/identify', { login: login.trim() })) as Workspace;
}

/** Whether this email's workspace offers (or enforces) single sign-on. */
export async function discover(email: string): Promise<DiscoverResult> {
  try {
    const body = (await post('/sso/discover', { email })) as {
      sso_available: boolean;
      sso_required?: boolean;
      provider_id?: string | null;
      provider_name?: string | null;
    };
    return {
      ssoAvailable: body.sso_available,
      ssoRequired: Boolean(body.sso_required),
      providerId: body.provider_id ?? undefined,
      providerName: body.provider_name ?? undefined,
    };
  } catch {
    return { ssoAvailable: false, ssoRequired: false };
  }
}

function sessionFrom(auth: { access_token: string; refresh_token: string; expires_in: number }): StoredSession {
  return {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + auth.expires_in,
  };
}

async function finish(payload: unknown): Promise<LoginOutcome> {
  const body = payload as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    mfa_required?: boolean;
    mfa_token?: string;
    message?: string;
  };
  if (body.mfa_token && !body.access_token) {
    return { kind: 'mfa', mfaToken: body.mfa_token, message: body.message ?? null };
  }
  const session = sessionFrom(body as { access_token: string; refresh_token: string; expires_in: number });
  await saveSession(session);
  return { kind: 'signed_in', session };
}

/** Password sign-in, for workspaces that have not enforced SSO. */
export async function signInWithPassword(login: string, password: string, workspace?: string): Promise<LoginOutcome> {
  const trimmed = login.trim();
  const body = trimmed.includes('@')
    ? { email: trimmed, password, workspace: workspace ?? null }
    : { login: trimmed, password, workspace: workspace ?? null };
  return finish(await post('/auth/login', body));
}

/** The second step when the workspace asks for a 2-step code. */
export async function completeMfa(mfaToken: string, code: string): Promise<LoginOutcome> {
  return finish(await post('/auth/login/mfa', { mfa_token: mfaToken, code: code.replace(/\s/g, '') }));
}

export async function requestPasswordReset(email: string): Promise<void> {
  await post('/auth/forgot-password', { email: email.trim() });
}

/**
 * Start SSO in the system browser and store the resulting session.
 *
 * The Expo auth proxy is deliberately not used: it routes the callback through
 * Expo's servers, which is convenient in development and unacceptable for a
 * production identity flow.
 */
export async function signInWithSso(providerId: string): Promise<LoginOutcome> {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'askmira', path: 'auth' });

  let started: Response;
  try {
    started = await fetch(`${API_ROOT}/sso/start/${providerId}?redirect_uri=${encodeURIComponent(redirectUri)}`);
  } catch {
    throw new SignInError(0, 'No connection. Check your signal and try again.');
  }
  if (!started.ok) throw new SignInError(started.status, 'Could not start single sign-on for this workspace.');
  const { authorization_url: authorizationUrl } = await started.json();

  // openAuthSessionAsync is Chrome Custom Tabs / SFSafariViewController — the
  // system browser, not a WebView this app controls.
  const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUri);
  if (result.type !== 'success' || !result.url) throw new SignInError(0, 'Sign-in was cancelled.');

  const params = queryParams(result.url);
  if (!params.code || !params.state) {
    throw new SignInError(0, 'The identity provider did not return an authorization code.');
  }

  const exchange = await fetch(`${API_ROOT}/sso/oidc/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `code=${encodeURIComponent(params.code)}&state=${encodeURIComponent(params.state)}`,
  });
  const payload = await exchange.json().catch(() => null);
  if (!exchange.ok) throw new SignInError(exchange.status, readDetail(exchange.status, payload).message);
  return finish(payload);
}

/** The query parameters of a redirect URL, without relying on a URL polyfill. */
function queryParams(url: string): Record<string, string> {
  const query = url.split('#')[0]?.split('?')[1] ?? '';
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key = '', value = ''] = pair.split('=');
    out[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
  }
  return out;
}

/** Whether the device can do biometric unlock at all. */
export async function biometricAvailable(): Promise<boolean> {
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

/**
 * Unlock an existing session with a fingerprint or face.
 *
 * Falls through to the stored session when the device has no enrolled
 * biometric, or the person switched the gate off in Settings. Refusing entry
 * there would lock out exactly the low-end Android handsets this market runs
 * on, many of which have no reader at all.
 */
export async function unlockWithBiometrics(required: boolean): Promise<StoredSession | null | 'cancelled'> {
  const stored = await loadSession();
  if (!stored) return null;
  if (!required || !(await biometricAvailable())) return stored;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock AskMiraa',
    fallbackLabel: 'Use passcode',
    disableDeviceFallback: false,
  });
  return result.success ? stored : 'cancelled';
}

/** End the session on the server (best effort) and forget the tokens. */
export async function signOut(): Promise<void> {
  const stored = await loadSession();
  if (stored) {
    try {
      await fetch(`${API_ROOT}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${stored.accessToken}` },
      });
    } catch {
      // Offline sign-out still forgets the tokens on this device.
    }
  }
  await clearSession();
}

export { isFresh, loadSession };
