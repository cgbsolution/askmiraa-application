import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lateLabel, oneOnOneStatus, teamState, teamSummary } from '../team.ts';

describe('team today', () => {
  it('summarises only the states someone is in, in a fixed order, without the late count', () => {
    const summary = teamSummary({ not_in: 5, in: 1, late: 1, on_leave: 0 });
    assert.deepEqual(
      summary.map((s) => [s.state, s.count]),
      [
        ['in', 1],
        ['not_in', 5],
      ],
    );
  });

  it('keeps a state the app does not know yet instead of dropping someone', () => {
    const summary = teamSummary({ in: 2, on_training: 1 });
    assert.equal(summary.at(-1)?.label, 'on training');
    assert.equal(teamState('on_training').tone, 'neutral');
  });

  it('says how late, in minutes or hours', () => {
    assert.equal(lateLabel(0), null);
    assert.equal(lateLabel(null), null);
    assert.equal(lateLabel(25), 'Late by 25 min');
    assert.equal(lateLabel(60), 'Late by 1 h');
    assert.equal(lateLabel(70), 'Late by 1 h 10 min');
  });
});

describe('1:1 status', () => {
  it('calls a planned date that has passed "not held", not "next"', () => {
    assert.deepEqual(oneOnOneStatus('2026-10-22', '2026-10-01', '2026-10-26'), { kind: 'missed', date: '2026-10-22' });
    assert.deepEqual(oneOnOneStatus('2026-10-26', null, '2026-10-26'), { kind: 'next', date: '2026-10-26' }, 'today is still next');
    assert.deepEqual(oneOnOneStatus(null, '2026-10-01', '2026-10-26'), { kind: 'last', date: '2026-10-01' });
    assert.deepEqual(oneOnOneStatus(null, null, '2026-10-26'), { kind: 'none' });
  });
});
