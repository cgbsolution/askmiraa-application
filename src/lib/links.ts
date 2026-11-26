/**
 * Opening a link from the server: a portal path goes to the matching screen
 * in the app (core/webToMobileRoute.ts); a linked product or a page the app
 * does not have opens in the system browser.
 */

import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import type { RouteName } from '../core/routes';
import { webToMobileRoute } from '../core/webToMobileRoute';
import { toast } from '../components/Toast';
import { t } from './i18n';

export function webAppUrl(): string | null {
  const extra = Constants.expoConfig?.extra as { webAppUrl?: unknown } | undefined;
  // Unset, the manifest can carry `{}` here rather than null: only text is an address.
  const raw = extra?.webAppUrl;
  const value = typeof raw === 'string' ? raw.trim() : '';
  return /^https?:\/\//i.test(value) ? value.replace(/\/+$/, '') : null;
}

/** Open a portal path (or full URL) in the system browser. */
export async function openInBrowser(pathOrUrl: string): Promise<void> {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : webAppUrl() ? `${webAppUrl()}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}` : null;
  if (!url) {
    toast.info(t('This opens on the AskMiraa website. Sign in there on a computer to see it.'));
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    toast.error(t('Could not open the browser.'));
  }
}

/** Follow a link from a Miraa card or the approvals inbox. */
export function followLink(href: string | null | undefined, go: (route: RouteName, params?: Record<string, string>) => void): void {
  const target = webToMobileRoute(href);
  if (target.kind === 'external') void openInBrowser(target.path);
  else go(target.route, target.params);
}
