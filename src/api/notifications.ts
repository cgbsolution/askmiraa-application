/** The in-app notification list, read state, preferences and push devices. */

import { api } from '../lib/api';
import type {
  ConsentRead,
  NotificationRead,
  PreferenceItem,
  PreferenceRead,
} from '../core/types';

export const notificationsApi = {
  list: (options: { unread?: boolean; limit?: number } = {}) =>
    api<NotificationRead[]>('/notifications', { query: { unread: options.unread, limit: options.limit ?? 50 } }),
  unreadCount: () => api<Record<string, number>>('/notifications/unread-count'),
  markRead: (id: string) => api<NotificationRead>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => api<Record<string, number>>('/notifications/read-all', { method: 'POST' }),
  preferences: () => api<PreferenceRead[]>('/notifications/preferences'),
  savePreferences: (preferences: PreferenceItem[]) =>
    api<PreferenceRead[]>('/notifications/preferences', { method: 'PATCH', body: { preferences } }),
  events: () => api<{ event_key: string; urgent: boolean; defaults: Record<string, string> }[]>('/notifications/events'),
  registerDevice: (pushToken: string, platform: string) =>
    api<Record<string, unknown>>('/notifications/devices', {
      method: 'POST',
      body: { push_token: pushToken, platform },
    }),
  unregisterDevice: (pushToken: string, platform: string) =>
    api<void>('/notifications/devices/unregister', {
      method: 'POST',
      body: { push_token: pushToken, platform },
    }),
  whatsappConsent: () => api<ConsentRead | null>('/notifications/whatsapp/consent'),
  setWhatsappConsent: (phone: string, optedIn: boolean) =>
    api<ConsentRead>('/notifications/whatsapp/consent', {
      method: 'PUT',
      body: { phone_e164: phone, opted_in: optedIn, source: 'mobile_app' },
    }),
};

/** The unread count from GET /notifications/unread-count, whatever its key is called. */
export function unreadFrom(payload: Record<string, number> | undefined): number {
  if (!payload) return 0;
  const value = payload.unread ?? payload.count ?? Object.values(payload)[0];
  return typeof value === 'number' ? value : 0;
}
