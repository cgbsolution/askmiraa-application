/**
 * Notification preferences, grouped for a phone: one card per area (Leave,
 * Pay...) with a switch per channel, instead of ~60 event-by-channel switches.
 *
 * `GET /notifications/preferences` returns the effective set: every
 * event-and-channel pair that is delivered, with its digest. A pair it does
 * not return is not delivered, so it counts as off. A channel shows as on
 * only when every event of the area has it on.
 */

export interface Preference {
  event_key: string;
  channel: string;
  enabled: boolean;
  /** immediate, daily, weekly or off. Kept as the server sent it. */
  digest_mode?: string;
}

export interface PreferenceGroup {
  key: string;
  label: string;
  events: string[];
  channels: { channel: string; on: boolean; mixed: boolean }[];
}

const LABELS: Record<string, string> = {
  assets: 'Assets',
  attendance: 'Attendance',
  auth: 'Sign-in and security',
  culture: 'Culture',
  documents: 'Letters and documents',
  helpdesk: 'Helpdesk',
  leave: 'Leave',
  onboarding: 'Onboarding',
  payroll: 'Pay',
  performance: 'Performance',
  expenses: 'Expenses',
  exits: 'Exit',
  learning: 'Learning',
  tax: 'Tax',
  privacy: 'Privacy',
  rewards: 'Rewards',
  recruiting: 'Hiring',
};

export const CHANNEL_ORDER = ['in_app', 'push', 'email', 'whatsapp'];

const isOn = (p: Preference | undefined) => Boolean(p && p.enabled && p.digest_mode !== 'off');

/** Every area, with a switch for each channel offered (WhatsApp only once the person has opted in). */
export function groupPreferences(prefs: Preference[], offered: string[] = CHANNEL_ORDER): PreferenceGroup[] {
  const byArea = new Map<string, string[]>();
  for (const p of prefs) {
    const area = p.event_key.split('.')[0] ?? p.event_key;
    const events = byArea.get(area) ?? [];
    if (!events.includes(p.event_key)) events.push(p.event_key);
    byArea.set(area, events);
  }
  return [...byArea.entries()]
    .map(([area, events]) => ({
      key: area,
      label: LABELS[area] ?? area.charAt(0).toUpperCase() + area.slice(1),
      events,
      channels: CHANNEL_ORDER.filter((c) => offered.includes(c)).map((channel) => {
        const on = events.filter((e) => isOn(prefs.find((p) => p.event_key === e && p.channel === channel))).length;
        return { channel, on: on === events.length, mixed: on > 0 && on < events.length };
      }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The rows to save when one area's channel is switched: for every event of
 * the area, every channel it is delivered on, with only the switched one
 * changed and every digest kept. Saving the whole set for an event means the
 * stored choice is complete, so nothing the person did not touch changes.
 */
export function toggleGroup(prefs: Preference[], group: PreferenceGroup, channel: string, enabled: boolean): Preference[] {
  const rows: Preference[] = [];
  for (const event of group.events) {
    const current = prefs.filter((p) => p.event_key === event);
    for (const p of current) {
      if (p.channel !== channel) rows.push({ ...p });
    }
    const existing = current.find((p) => p.channel === channel);
    if (enabled) {
      const mode = existing && existing.digest_mode && existing.digest_mode !== 'off' ? existing.digest_mode : 'immediate';
      rows.push({ event_key: event, channel, enabled: true, digest_mode: mode });
    } else if (existing) {
      rows.push({ ...existing, enabled: false });
    }
  }
  return rows;
}

/** The effective set after saving `rows`, for showing the switch at once. */
export function applyRows(prefs: Preference[], rows: Preference[]): Preference[] {
  const key = (p: Preference) => `${p.event_key}|${p.channel}`;
  const changed = new Map(rows.map((r) => [key(r), r]));
  const kept = prefs.map((p) => changed.get(key(p)) ?? p);
  const added = rows.filter((r) => !prefs.some((p) => key(p) === key(r)));
  return [...kept, ...added];
}
