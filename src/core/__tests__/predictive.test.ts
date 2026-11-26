import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { matchScore, rankSuggestions } from '../predictive.ts';
import { SERVICES, type Service } from '../services.ts';

const labels = (lines: { label: string }[]) => lines.map((line) => line.label);
const line = (label: string, keywords?: string) => ({ label, keywords });

describe('predictive search (same rules as the portal)', () => {
  it('ranks a label that starts with the words above a word start, above a mid-word match', () => {
    const items = [line('Calibration'), line('A Rahul'), line('Rahul Verma')];
    assert.deepEqual(labels(rankSuggestions(items, 'ra')), ['Rahul Verma', 'A Rahul', 'Calibration']);
  });

  it('needs every typed word, ignores case and spaces, offers nothing for a blank box', () => {
    assert.deepEqual(labels(rankSuggestions([line('Leave balance'), line('Apply leave')], '  LEAVE  apply ')), ['Apply leave']);
    assert.deepEqual(rankSuggestions([line('Payslips')], '   '), []);
    assert.equal(matchScore('amit verma', 'Amit Sharma'), null);
  });

  it('treats symbols and regex characters as plain text', () => {
    for (const typed of ['(', '[', '*', String.fromCharCode(92), '?', '+', '.', '-', 'e', '%']) {
      assert.doesNotThrow(() => rankSuggestions([line('R&D (Pune)'), line('50% basic')], typed), typed);
    }
    assert.deepEqual(labels(rankSuggestions([line('R&D (Pune)')], '(pune)')), ['R&D (Pune)']);
  });

  it('caps the list and does not hang on a huge pasted term', () => {
    const items = Array.from({ length: 3000 }, (_, i) => line(`Service ${i}`));
    assert.equal(rankSuggestions(items, 'service', 6).length, 6);
    assert.deepEqual(rankSuggestions(items, 'x'.repeat(10000)), []);
  });
});

describe('service suggestions', () => {
  const lines = SERVICES.map((service: Service) => ({
    label: service.label,
    keywords: [service.label, ...(service.keywords ?? [])].join(' '),
  }));

  it('finds a service by the words people use for it', () => {
    assert.ok(labels(rankSuggestions(lines, 'salary slip')).length > 0);
    assert.equal(labels(rankSuggestions(lines, 'punch'))[0], 'Punch');
  });

  it('puts a service whose name starts with the words first', () => {
    const found = labels(rankSuggestions(lines, 'pay'));
    assert.ok(found[0]?.toLowerCase().startsWith('pay'), found.join(', '));
  });
});
