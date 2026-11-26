/**
 * What a token refresh's answer means for the session.
 *
 * Only the server refusing the refresh token (401, 403) ends it. No signal
 * (`null`), a timeout, a busy or restarting server (429, 5xx) leave the person
 * signed in: the next request tries again. Signing someone out because their
 * phone lost signal in a lift is a bug.
 */
export type RefreshVerdict = 'ok' | 'refused' | 'unavailable';

export function refreshVerdict(status: number | null): RefreshVerdict {
  if (status === null) return 'unavailable';
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401 || status === 403) return 'refused';
  return 'unavailable';
}
