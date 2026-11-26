/** Session, account security and sign-out. */

import { api } from '../lib/api';
import type { Session } from '../core/types';

export const sessionApi = {
  /** Who is signed in, their role, manager flag, employee link and workspace modules. */
  get: () => api<Session>('/auth/session'),
  /**
   * The company's public sign-in page: its name and logo (the logo an admin
   * sets in the portal, under Settings → Company). Public, as the sign-in
   * page is; `logo_url` is a path on the API, null when there is no logo.
   */
  workspace: (slug: string) => api<WorkspaceBrand>(`/public/workspaces/${encodeURIComponent(slug)}`),
};

export interface WorkspaceBrand {
  name: string;
  workspace: string;
  logo_url: string | null;
}

export interface MfaStatus {
  enabled: boolean;
  required?: boolean;
  [key: string]: unknown;
}

export const securityApi = {
  mfaStatus: () => api<MfaStatus>('/auth/mfa'),
  mfaSetup: () => api<{ secret: string; otpauth_url?: string; uri?: string; [key: string]: unknown }>('/auth/mfa/setup', { method: 'POST' }),
  mfaEnable: (code: string) => api<Record<string, unknown>>('/auth/mfa/enable', { method: 'POST', body: { code } }),
  mfaDisable: (password: string, code: string) =>
    api<void>('/auth/mfa/disable', { method: 'POST', body: { password, code } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<void>('/auth/change-password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
    }),
};
