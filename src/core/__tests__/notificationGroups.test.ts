import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyRows, groupPreferences, toggleGroup, type Preference } from '../notificationGroups.ts';

const prefs: Preference[] = [
  { event_key: 'leave.approval.decided', channel: 'in_app', enabled: true, digest_mode: 'immediate' },
  { event_key: 'leave.approval.decided', channel: 'email', enabled: true, digest_mode: 'immediate' },
  { event_key: 'leave.approval.requested', channel: 'in_app', enabled: true, digest_mode: 'immediate' },
  { event_key: 'leave.approval.requested', channel: 'push', enabled: true, digest_mode: 'immediate' },
  { event_key: 'leave.approval.requested', channel: 'email', enabled: false, digest_mode: 'immediate' },
  { event_key: 'culture.shoutout.posted', channel: 'email', enabled: true, digest_mode: 'daily' },
  { event_key: 'culture.shoutout.posted', channel: 'in_app', enabled: true, digest_mode: 'immediate' },
];

describe('notification preferences', () => {
  it('shows every offered channel per area; a pair the server does not deliver counts as off', () => {
    const groups = groupPreferences(prefs, ['in_app', 'push', 'email']);
    assert.deepEqual(groups.map((g) => g.label), ['Culture', 'Leave']);
    const leave = groups[1]!;
    assert.deepEqual(leave.channels, [
      { channel: 'in_app', on: true, mixed: false },
      { channel: 'push', on: false, mixed: true },
      { channel: 'email', on: false, mixed: true },
    ]);
    const culture = groups[0]!;
    assert.deepEqual(culture.channels.find((c) => c.channel === 'push'), { channel: 'push', on: false, mixed: false });
  });

  it('offers WhatsApp only when asked to', () => {
    assert.ok(!groupPreferences(prefs, ['in_app', 'push', 'email'])[0]!.channels.some((c) => c.channel === 'whatsapp'));
    assert.ok(groupPreferences(prefs)[0]!.channels.some((c) => c.channel === 'whatsapp'));
  });

  it('reads a digest switched off as off', () => {
    const groups = groupPreferences([{ event_key: 'culture.poll.opened', channel: 'email', enabled: true, digest_mode: 'off' }], ['email']);
    assert.equal(groups[0]!.channels[0]!.on, false);
  });

  it('saves the whole set for each event of the area, changing only the switched channel', () => {
    const leave = groupPreferences(prefs, ['in_app', 'push', 'email']).find((g) => g.key === 'leave')!;
    const rows = toggleGroup(prefs, leave, 'email', false);
    assert.deepEqual(rows, [
      { event_key: 'leave.approval.decided', channel: 'in_app', enabled: true, digest_mode: 'immediate' },
      { event_key: 'leave.approval.decided', channel: 'email', enabled: false, digest_mode: 'immediate' },
      { event_key: 'leave.approval.requested', channel: 'in_app', enabled: true, digest_mode: 'immediate' },
      { event_key: 'leave.approval.requested', channel: 'push', enabled: true, digest_mode: 'immediate' },
      { event_key: 'leave.approval.requested', channel: 'email', enabled: false, digest_mode: 'immediate' },
    ]);
  });

  it('switching a channel on adds it where it was missing and keeps every digest', () => {
    const culture = groupPreferences(prefs, ['in_app', 'push', 'email']).find((g) => g.key === 'culture')!;
    const rows = toggleGroup(prefs, culture, 'push', true);
    assert.deepEqual(rows, [
      { event_key: 'culture.shoutout.posted', channel: 'email', enabled: true, digest_mode: 'daily' },
      { event_key: 'culture.shoutout.posted', channel: 'in_app', enabled: true, digest_mode: 'immediate' },
      { event_key: 'culture.shoutout.posted', channel: 'push', enabled: true, digest_mode: 'immediate' },
    ]);
    const after = applyRows(prefs, rows);
    assert.equal(groupPreferences(after, ['push']).find((g) => g.key === 'culture')!.channels[0]!.on, true);
    assert.equal(after.length, prefs.length + 1);
  });

  it('switching a digest-off channel back on makes it immediate, not still off', () => {
    const off: Preference[] = [{ event_key: 'culture.poll.opened', channel: 'email', enabled: false, digest_mode: 'off' }];
    const group = groupPreferences(off, ['email'])[0]!;
    assert.deepEqual(toggleGroup(off, group, 'email', true), [
      { event_key: 'culture.poll.opened', channel: 'email', enabled: true, digest_mode: 'immediate' },
    ]);
  });
});
