// The app runs in India; pin the zone so a timestamp's local day is checkable.
process.env.TZ = 'Asia/Kolkata';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DAY_TAG_LABEL, DAY_TAG_ORDER, buildTodos, canRegularise, dayKind, nextDirection, shiftTimes, untaggedDayLabel } from '../home.ts';
import type { QueuedPunch } from '../offlineQueue.ts';

const TODAY = '2026-10-26';
const asDay = (iso: string) => iso.slice(0, 10);

describe('to-dos', () => {
  it('lists only what needs the person, urgent first', () => {
    const todos = buildTodos({
      today: TODAY,
      tasks: [
        { id: 't1', title: 'Buddy introduction', status: 'pending', due_date: '2026-10-20', is_overdue: true, employee_name: 'Sana Iqbal' } as never,
        { id: 't2', title: 'Done already', status: 'done', due_date: '2026-10-20', is_overdue: false } as never,
      ],
      surveys: [
        { id: 's1', name: 'eNPS, Q3', is_open_now: true, has_responded: true, closes_on: '2026-11-07' } as never,
        { id: 's2', name: 'Pulse', is_open_now: true, has_responded: false, closes_on: '2026-11-07' } as never,
      ],
      documents: [
        { id: 'd1', title: 'Handbook', document_type: 'Policy', requires_acknowledgement: true, acknowledged_by_me: null } as never,
        { id: 'd2', title: 'Mediclaim', document_type: 'Insurance', requires_acknowledgement: false, acknowledged_by_me: null } as never,
      ],
      assets: { current: [{ id: 'a1', asset_name: 'Monitor', category_name: 'Monitor', asset_tag: 'AM-1', requires_acknowledgement: true, acknowledged_at: null, is_open: true }] } as never,
      appraisals: [{ appraisal_id: 'r1', cycle_name: 'Mid-year', waiting_on_me: false, days_overdue: 0 } as never],
      taxWindows: [{ id: 'w1', window_type: 'declaration', is_open: true, closes_at: '2026-12-31' } as never],
    });
    assert.deepEqual(
      todos.map((t) => t.key),
      ['task-t1', 'survey-s2', 'doc-d1', 'asset-a1'],
      'tax window more than 30 days off, reviews not waiting, answered surveys and done tasks are left out',
    );
    assert.equal(todos[0]!.urgent, true);
    assert.match(todos[0]!.subtitle, /For Sana Iqbal · due 20 Oct · overdue/);
  });

  it('flags a tax deadline inside 30 days', () => {
    const [todo] = buildTodos({ today: '2026-12-26', taxWindows: [{ id: 'w', window_type: 'declaration', is_open: true, closes_at: '2026-12-31' } as never] });
    assert.equal(todo?.title, 'Submit your tax declarations');
    assert.equal(todo?.urgent, true);
    assert.match(todo?.subtitle ?? '', /5 days left/);
  });

  it('turns an unsent punch into a regularisation to-do with its real time', () => {
    const punch = { id: 'p1', direction: 'in', punchedAt: '2026-10-26T03:40:00.000Z', state: 'stale' } as QueuedPunch;
    const [todo] = buildTodos({ today: TODAY, unsentPunches: [punch] });
    assert.equal(todo?.route, 'Regularise');
    assert.deepEqual(todo?.params, { date: '2026-10-26', punchId: 'p1', direction: 'in', at: '2026-10-26T03:40:00.000Z' });
  });

  it('files an after-midnight punch under the local day, not the UTC one', () => {
    // 00:30 IST on the 27th is 19:00 UTC on the 26th.
    const punch = { id: 'p2', direction: 'out', punchedAt: '2026-10-26T19:00:00.000Z', state: 'stale' } as QueuedPunch;
    const [todo] = buildTodos({ today: '2026-10-27', unsentPunches: [punch] });
    assert.equal(todo?.params?.date, '2026-10-27');
  });

  it('is empty when nothing loaded', () => {
    assert.deepEqual(buildTodos({ today: TODAY }), []);
  });
});

describe('punch direction', () => {
  it('starts the day with "in" and alternates', () => {
    assert.equal(nextDirection(TODAY, [], [], asDay), 'in');
    const inPunch = { punched_at: '2026-10-26T03:40:00Z', direction: 'in' } as never;
    assert.equal(nextDirection(TODAY, [inPunch], [], asDay), 'out');
  });

  it('ignores yesterday', () => {
    const yesterday = { punched_at: '2026-10-25T03:40:00Z', direction: 'in' } as never;
    assert.equal(nextDirection(TODAY, [yesterday], [], asDay), 'in');
  });

  it('counts a punch still on the device, but not one that failed for good', () => {
    const queued = { punchedAt: '2026-10-26T04:00:00Z', direction: 'in', state: 'queued' } as QueuedPunch;
    const stale = { punchedAt: '2026-10-26T04:00:00Z', direction: 'in', state: 'stale' } as QueuedPunch;
    assert.equal(nextDirection(TODAY, [], [queued], asDay), 'out');
    assert.equal(nextDirection(TODAY, [], [stale], asDay), 'in');
  });
});

describe('attendance days', () => {
  it('maps statuses to calendar kinds', () => {
    assert.equal(dayKind('present'), 'present');
    assert.equal(dayKind('present', 12), 'late');
    assert.equal(dayKind('lop'), 'absent');
    assert.equal(dayKind('week_off'), 'off');
    assert.equal(dayKind('needs_regularisation'), 'attention');
    assert.equal(dayKind(undefined), 'none');
  });

  it('allows regularising past days in an open period only', () => {
    assert.equal(canRegularise('2026-10-20', TODAY, false), true);
    assert.equal(canRegularise(TODAY, TODAY, false), true);
    assert.equal(canRegularise('2026-10-27', TODAY, false), false);
    assert.equal(canRegularise('2026-10-20', TODAY, true), false);
  });

  it('shows shift times without seconds', () => {
    assert.equal(shiftTimes({ start_time: '09:30:00', end_time: '18:30:00' }), '09:30 – 18:30');
    assert.equal(shiftTimes(null), null);
  });
});

describe('weekly offs', () => {
  it('reads ISO weekday numbers, Sunday as 7', async () => {
    const { weeklyOffNames } = await import('../home.ts');
    assert.deepEqual(weeklyOffNames([6, 7]), ['Sat', 'Sun']);
    assert.deepEqual(weeklyOffNames([7]), ['Sun']);
    assert.deepEqual(weeklyOffNames(null), []);
  });
});

describe('attendance calendar tags', () => {
  it('lists all eight tags once, in the legend order HR teams know', () => {
    assert.deepEqual(DAY_TAG_ORDER, ['absent', 'week_off', 'unapproved_leave', 'partial', 'holiday', 'approved_leave', 'full_day', 'optional_holiday']);
    assert.deepEqual([...DAY_TAG_ORDER].sort(), Object.keys(DAY_TAG_LABEL).sort());
    assert.equal(DAY_TAG_LABEL.absent, 'Absent / Missed punch');
  });

  it('says what a blank day is', () => {
    assert.equal(untaggedDayLabel(TODAY, TODAY), 'Today — in progress');
    assert.equal(untaggedDayLabel('2026-10-29', TODAY), 'Working day');
    assert.equal(untaggedDayLabel('2026-10-20', TODAY), 'Not worked out yet');
    assert.equal(untaggedDayLabel('2026-10-20', TODAY, '2026-10-22'), 'Before joining');
    assert.equal(untaggedDayLabel('2026-10-22', TODAY, '2026-10-22'), 'Not worked out yet', 'the joining day itself counts');
  });
});

describe('worked today', () => {
  it('adds each in-out pair and an open in up to now', async () => {
    const { workedMinutes } = await import('../home.ts');
    const punches = [
      { punched_at: '2026-10-26T04:00:00Z', direction: 'in' as const },
      { punched_at: '2026-10-26T07:30:00Z', direction: 'out' as const },
      { punched_at: '2026-10-26T08:00:00Z', direction: 'in' as const },
    ];
    // 3h30 closed + 1h open until 09:00Z.
    assert.equal(workedMinutes(punches, '2026-10-26T09:00:00Z'), 270);
    assert.equal(workedMinutes([], '2026-10-26T09:00:00Z'), 0);
  });

  it('reads doubled and stray punches the way the server does', async () => {
    const { workedMinutes } = await import('../home.ts');
    const punches = [
      { punched_at: '2026-10-26T03:00:00Z', direction: 'out' as const },
      { punched_at: '2026-10-26T04:00:00Z', direction: 'in' as const },
      { punched_at: '2026-10-26T04:30:00Z', direction: 'in' as const },
      { punched_at: '2026-10-26T05:00:00Z', direction: 'out' as const },
    ];
    // The stray first out is ignored; the second in does not restart the stretch.
    assert.equal(workedMinutes(punches, '2026-10-26T09:00:00Z'), 60);
  });

  it('extends the stretch when out is tapped twice', async () => {
    const { workedMinutes } = await import('../home.ts');
    const punches = [
      { punched_at: '2026-10-26T04:00:00Z', direction: 'in' as const },
      { punched_at: '2026-10-26T04:05:00Z', direction: 'out' as const },
      { punched_at: '2026-10-26T08:00:00Z', direction: 'out' as const },
    ];
    assert.equal(workedMinutes(punches, '2026-10-26T09:00:00Z'), 240);
  });

  it('measures a shift, including one past midnight', async () => {
    const { shiftMinutes } = await import('../home.ts');
    assert.equal(shiftMinutes({ start_time: '09:30:00', end_time: '18:30:00' }), 540);
    assert.equal(shiftMinutes({ start_time: '22:00:00', end_time: '06:00:00' }), 480);
    assert.equal(shiftMinutes({ start_time: '00:00:00', end_time: '00:00:00' }), null);
    assert.equal(shiftMinutes(null), null);
  });
});
