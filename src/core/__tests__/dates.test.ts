// The app runs in India; pin the zone so a timestamp's local day is checkable.
process.env.TZ = 'Asia/Kolkata';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addDays,
  addMonths,
  diffDays,
  financialYear,
  formatDate,
  formatDateShort,
  formatMinutes,
  formatRange,
  greetingFor,
  lastOfMonth,
  localDay,
  monthGrid,
  parseISODate,
  readableDates,
  relativeDay,
  startOfWeek,
  weekday,
} from '../dates.ts';
import { interpolate, placeholderMismatches, translate } from '../i18n.ts';

describe('calendar dates', () => {
  it('never shifts a date through time zones', () => {
    // new Date('2026-10-26') is the 25th west of UTC; these are pure numbers.
    assert.equal(formatDate('2026-10-26'), '26 Oct 2026');
    assert.equal(weekday('2026-10-26'), 1, 'a Monday');
  });

  it('gives a timestamp its local day, not the UTC one', () => {
    // 20:30 UTC on the 25th is 02:00 on the 26th in India.
    assert.equal(formatDate('2026-10-25T20:30:00Z'), '26 Oct 2026');
    assert.equal(formatDate('2026-10-25T20:30:00.123456+00:00'), '26 Oct 2026');
    assert.equal(localDay('2026-10-25T20:30:00Z'), '2026-10-26');
    assert.equal(localDay('2026-10-26T03:40:00Z'), '2026-10-26');
    assert.equal(localDay('2026-10-26'), '2026-10-26', 'a plain date is left alone');
    assert.equal(localDay('2026-10-26junk'), null);
    assert.equal(weekday('2026-10-25T20:30:00Z'), 1, 'Monday in India');
  });

  it('rejects impossible dates', () => {
    assert.equal(parseISODate('2026-02-30'), null);
    assert.equal(parseISODate('nonsense'), null);
    assert.equal(formatDate(null), '—');
  });

  it('adds days and months across boundaries', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(diffDays('2026-10-01', '2026-10-26'), 25);
    assert.equal(lastOfMonth('2028-02-10'), '2028-02-29');
  });

  it('starts weeks on Monday', () => {
    assert.equal(startOfWeek('2026-10-26'), '2026-10-26');
    assert.equal(startOfWeek('2026-11-01'), '2026-10-26', 'a Sunday belongs to the week before');
  });

  it('builds full weeks for a month grid', () => {
    const grid = monthGrid(2026, 10);
    assert.ok(grid.every((week) => week.length === 7));
    assert.equal(grid[0]![0]!.date, '2026-09-28');
    assert.ok(grid.flat().filter((c) => c.inMonth).length === 31);
  });

  it('starts weeks on Sunday when asked, for the attendance calendar', () => {
    const grid = monthGrid(2026, 10, 0);
    assert.ok(grid.every((week) => week.length === 7));
    assert.equal(grid[0]![0]!.date, '2026-09-27', 'the Sunday before 1 Oct');
    assert.equal(grid[0]![4]!.date, '2026-10-01', '1 Oct 2026 is a Thursday');
    assert.equal(grid.at(-1)!.at(-1)!.date, '2026-10-31', '31 Oct is a Saturday, the last cell');
    assert.equal(grid.length, 5);
    // A month that starts on a Sunday begins with it.
    assert.equal(monthGrid(2026, 11, 0)[0]![0]!.date, '2026-11-01');
  });

  it('formats ranges, minutes and relative days', () => {
    const now = new Date(2026, 9, 26, 10, 0);
    assert.equal(formatRange('2026-10-27', '2026-10-29', now), '27 Oct – 29 Oct');
    assert.equal(formatRange('2026-10-27', '2026-10-27', now), '27 Oct');
    assert.equal(formatDateShort('2025-03-01', now), '1 Mar 2025');
    assert.equal(formatMinutes(450), '7h 30m');
    assert.equal(formatMinutes(60), '1h');
    assert.equal(formatMinutes(5), '5m');
    assert.equal(relativeDay(new Date(2026, 9, 25, 18).toISOString(), now), 'Yesterday');
    assert.equal(relativeDay(new Date(2026, 9, 26, 8).toISOString(), now), 'Today');
  });

  it('greets by the time of day', () => {
    assert.equal(greetingFor(new Date(2026, 9, 26, 8)), 'Good morning');
    assert.equal(greetingFor(new Date(2026, 9, 26, 13)), 'Good afternoon');
    assert.equal(greetingFor(new Date(2026, 9, 26, 19)), 'Good evening');
  });

  it('names the financial year the way each module spells it', () => {
    assert.equal(financialYear('2026-10-26'), '2026-27');
    assert.equal(financialYear('2027-03-31'), '2026-27');
    assert.equal(financialYear('2026-04-01', 'long'), '2026-2027');
  });
});

describe('translation', () => {
  it('returns English text unchanged, with placeholders filled', () => {
    assert.equal(translate('en', 'Apply leave'), 'Apply leave');
    assert.equal(translate('en', '{count} waiting', { count: 3 }), '3 waiting');
  });

  it('translates to Hindi and falls back to English for the rest', () => {
    assert.equal(translate('hi', 'Home'), 'होम');
    assert.equal(translate('hi', 'Some new string'), 'Some new string');
    assert.equal(translate('hi', 'Message {name}…', { name: 'Miraa' }), 'Miraa को संदेश…');
  });

  it('keeps a missing placeholder visible so a test can catch it', () => {
    assert.equal(interpolate('Hi {name}', {}), 'Hi {name}');
  });

  it('has the same placeholders in every Hindi string as in its English key', () => {
    assert.deepEqual(placeholderMismatches(), []);
  });
});

describe('dates in server messages', () => {
  it('turns ISO dates into the way people read them', () => {
    assert.equal(
      readableDates('There is already a pending request for 2026-10-26. Withdraw it first.'),
      'There is already a pending request for 26 Oct 2026. Withdraw it first.',
    );
    assert.equal(readableDates('Leave from 2026-10-30 to 2026-11-03'), 'Leave from 30 Oct 2026 to 3 Nov 2026');
  });

  it('leaves references, timestamps and impossible dates alone', () => {
    assert.equal(readableDates('Request LR-2026-10-261 is closed'), 'Request LR-2026-10-261 is closed');
    assert.equal(readableDates('at 2026-10-26T09:00:00Z'), 'at 2026-10-26T09:00:00Z');
    assert.equal(readableDates('on 2026-13-40'), 'on 2026-13-40');
    assert.equal(readableDates('No dates here.'), 'No dates here.');
  });
});

describe('clock', () => {
  it('reads like the portal punch card', async () => {
    const { formatClock } = await import('../dates.ts');
    assert.equal(formatClock(new Date(2026, 9, 28, 23, 13, 57)), '11:13:57 pm');
    assert.equal(formatClock(new Date(2026, 9, 28, 0, 5, 9)), '12:05:09 am');
    assert.equal(formatClock(new Date(2026, 9, 28, 12, 0, 0), false), '12:00 pm');
    assert.equal(formatClock(null), '—');
    assert.equal(formatClock('not a date'), '—');
  });
});
