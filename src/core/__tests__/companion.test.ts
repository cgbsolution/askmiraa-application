import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cellText,
  chartSeries,
  composerState,
  groupConversations,
  hasMore,
  modeLabel,
  nextPageMessage,
  pageLabel,
  reasonCopy,
  searchConversations,
  singleValue,
  suggestions,
  tableLayout,
} from '../companion.ts';
import type { Conversation, ReportResult } from '../types.ts';

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString();
const conversation = (id: string, when: string, title = id): Conversation => ({
  id,
  title,
  last_message_at: when,
  created_at: when,
});

describe('conversation history', () => {
  const now = new Date(2026, 9, 26, 12);

  it('groups by Today, Yesterday and Earlier, newest first', () => {
    const groups = groupConversations(
      [
        conversation('old', at(2026, 10, 1)),
        conversation('today-early', at(2026, 10, 26, 8)),
        conversation('today-late', at(2026, 10, 26, 11)),
        conversation('yesterday', at(2026, 10, 25)),
      ],
      now,
    );
    assert.deepEqual(groups.map((g) => g.title), ['Today', 'Yesterday', 'Earlier']);
    assert.deepEqual(groups[0]!.items.map((c) => c.id), ['today-late', 'today-early']);
  });

  it('leaves out empty groups', () => {
    assert.deepEqual(groupConversations([conversation('a', at(2026, 10, 1))], now).map((g) => g.title), ['Earlier']);
    assert.deepEqual(groupConversations([], now), []);
  });

  it('searches titles, case-insensitively', () => {
    const list = [conversation('1', at(2026, 10, 1), 'Leave balance'), conversation('2', at(2026, 10, 1), 'Payslip')];
    assert.deepEqual(searchConversations(list, 'LEAVE').map((c) => c.id), ['1']);
    assert.equal(searchConversations(list, '  ').length, 2);
  });
});

describe('composer', () => {
  const status = { daily_limit: 60, sent_today: 10 };

  it('sends a non-empty message online', () => {
    assert.equal(composerState(status, 'hi', true, false).canSend, true);
    assert.equal(composerState(status, '   ', true, false).canSend, false);
  });

  it('never sends while a turn is in flight (no double send)', () => {
    assert.equal(composerState(status, 'hi', true, true).canSend, false);
  });

  it('sends an attached receipt with no words, but never offline or at the limit', () => {
    assert.equal(composerState(status, '', true, false, 1).canSend, true);
    assert.equal(composerState(status, '', true, false, 0).canSend, false);
    assert.equal(composerState(status, '', false, false, 1).canSend, false);
    assert.equal(composerState({ daily_limit: 60, sent_today: 60 }, '', true, false, 1).canSend, false);
    assert.equal(composerState(status, '', true, true, 1).canSend, false);
  });

  it('refuses offline and says it will not queue', () => {
    const state = composerState(status, 'hi', false, false);
    assert.equal(state.canSend, false);
    assert.match(state.blocked ?? '', /not saved to send later/);
  });

  it('stops at the daily limit with the reset time', () => {
    const state = composerState({ daily_limit: 60, sent_today: 60 }, 'hi', true, false);
    assert.equal(state.canSend, false);
    assert.match(state.blocked ?? '', /midnight/);
    assert.equal(state.remainingToday, 0);
  });

  it('counts characters near the 2,000 limit and refuses 2,001', () => {
    assert.equal(composerState(status, 'a'.repeat(100), true, false).counter, null);
    assert.equal(composerState(status, 'a'.repeat(1850), true, false).counter, '1,850 / 2,000');
    const over = composerState(status, 'a'.repeat(2001), true, false);
    assert.equal(over.canSend, false);
    assert.match(over.blocked ?? '', /2,000/);
  });
});

describe('status copy', () => {
  it('labels the mode', () => {
    assert.equal(modeLabel({ mode: 'ai' }), 'AI');
    assert.equal(modeLabel({ mode: 'direct' }), 'On-device lookup');
  });

  it('explains each reason honestly, and nothing in AI mode', () => {
    assert.match(reasonCopy('no_consent', 'Miraa')!.message, /Privacy/);
    assert.match(reasonCopy('disabled', 'Miraa')!.message, /switched AI off/);
    assert.match(reasonCopy('not_configured', 'Miraa')!.message, /no AI provider/);
    assert.equal(reasonCopy(null, 'Miraa'), null);
  });

  it('suggests only questions for tools the person has', () => {
    const direct = suggestions({ tools: [{ key: 'my_record', title: 'Your record' }], examples: ['How many leaves do I have left?'] });
    assert.deepEqual(direct, ['How many leaves do I have left?']);
    const ai = suggestions({ tools: [{ key: 'policy_question', title: 'Policies' }], examples: [] });
    assert.deepEqual(ai, ['What is the work-from-home policy?']);
  });
});

describe('cards', () => {
  it('stacks narrow tables and scrolls wide ones', () => {
    assert.equal(tableLayout(['Name', 'Days']), 'stacked');
    assert.equal(tableLayout(['A', 'B', 'C']), 'stacked');
    assert.equal(tableLayout(['A', 'B', 'C', 'D']), 'scroll');
  });

  it('never prints null', () => {
    assert.equal(cellText(null), '—');
    assert.equal(cellText(''), '—');
    assert.equal(cellText(false), 'No');
    assert.equal(cellText(3), '3');
  });

  it('says which rows of how many', () => {
    assert.equal(pageLabel({ number: 1, size: 20, total: 134 }, 20), 'Showing 1–20 of 134');
    assert.equal(pageLabel({ number: 7, size: 20, total: 134 }, 14), 'Showing 121–134 of 134');
    assert.equal(pageLabel(undefined, 5), null);
    assert.equal(hasMore({ number: 1, size: 20, total: 134 }), true);
    assert.equal(hasMore({ number: 7, size: 20, total: 134 }), false);
    assert.equal(nextPageMessage({ title: 'My tickets', page: { number: 1 } }), 'Show page 2 of my tickets');
  });

  const result = (columns: string[], rows: unknown[][]): ReportResult => ({
    run_id: 'r',
    columns: columns.map((label, i) => ({ key: `c${i}`, label, data_type: 'text', aggregation: null, sensitivity: 'public' })),
    rows,
    total_rows: rows.length,
    returned_rows: rows.length,
    max_sensitivity: 'public',
    row_scope: 'all',
    notes: [],
    denied_fields: [],
    duration_ms: 1,
  });

  it('shows a one-value report as a big number', () => {
    assert.equal(singleValue(result(['Joiners'], [[12]])), '12');
    assert.equal(singleValue(result(['A', 'B'], [[1, 2]])), null);
  });

  it('charts the first numeric column against the first column', () => {
    const series = chartSeries(result(['Department', 'Head', 'Headcount'], [['Eng', 'Ravi', 9], ['Sales', 'Asha', '4']]));
    assert.deepEqual(series, { labels: ['Eng', 'Sales'], values: [9, 4], valueLabel: 'Headcount' });
    assert.equal(chartSeries(result(['Only'], [[1]])), null);
  });
});
