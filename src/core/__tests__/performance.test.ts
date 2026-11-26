import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canRateHere, earlierRating, ratingsPayload, reviewGaps, selfReviewGaps, type CompetencyRatingInput, type ReviewCompetency, type ReviewEntry } from '../performance.ts';

const competency = (id: string, name: string, mandatory = true): ReviewCompetency => ({
  competency_id: id,
  code: id.toUpperCase(),
  name,
  description: null,
  category: 'behavioural',
  weight: '25.00',
  is_mandatory: mandatory,
  indicators: [],
  evidence: null,
});

describe('self review', () => {
  it('names the mandatory competencies still unrated', () => {
    const list = [competency('a', 'Collaboration'), competency('b', 'Ownership'), competency('c', 'Craft', false)];
    const ratings: Record<string, CompetencyRatingInput> = {
      a: { competency_id: 'a', rating: '4.00', is_applicable: true },
      b: { competency_id: 'b', rating: null, is_applicable: true },
      c: { competency_id: 'c', rating: null, is_applicable: true },
    };
    assert.deepEqual(selfReviewGaps(list, ratings), ['Ownership']);
    ratings.b = { competency_id: 'b', rating: null, is_applicable: false, not_applicable_reason: 'Not in my role' };
    assert.deepEqual(selfReviewGaps(list, ratings), [], 'not applicable counts as answered');
  });

  it('sends only what was rated, and values only when the template weighs them', () => {
    const payload = ratingsPayload(
      {
        a: { competency_id: 'a', rating: '4.00', is_applicable: true },
        b: { competency_id: 'b', rating: null, is_applicable: true },
      },
      { ownership: { value_code: 'ownership', rating: '3.00' } },
      false,
    );
    assert.deepEqual(payload.competencies?.map((c) => c.competency_id), ['a']);
    assert.deepEqual(payload.values, []);
    assert.equal(ratingsPayload({}, { ownership: { value_code: 'ownership', rating: '3.00' } }, true).values?.length, 1);
  });
});

describe('review by stage', () => {
  const list = [competency('a', 'Collaboration'), competency('b', 'Craft', false)];
  const blank = (): Record<string, CompetencyRatingInput> => ({
    a: { competency_id: 'a', rating: null, is_applicable: true },
    b: { competency_id: 'b', rating: null, is_applicable: true },
  });

  it('asks a manager for every competency that applies, not only the mandatory ones', () => {
    const r = blank();
    r.a = { competency_id: 'a', rating: '3.00', is_applicable: true };
    assert.deepEqual(reviewGaps('self', list, r), []);
    assert.deepEqual(reviewGaps('manager', list, r), ['Craft']);
    r.b = { competency_id: 'b', rating: null, is_applicable: false, not_applicable_reason: 'New in role' };
    assert.deepEqual(reviewGaps('manager', list, r), []);
  });

  it('lets a reviewer send nothing (keeps the score) but not half a set', () => {
    const r = blank();
    assert.deepEqual(reviewGaps('reviewer', list, r), []);
    r.a = { competency_id: 'a', rating: '4.00', is_applicable: true };
    assert.deepEqual(reviewGaps('reviewer', list, r), ['Craft']);
  });

  it('shows the latest submitted rating from an earlier step', () => {
    const entry = (rating: string | null, submitted: string | null): ReviewEntry => ({
      id: rating ?? 'x',
      stage_id: 's',
      stage_label: 'Self review',
      stage_role: 'self',
      actor_name: 'Aditya',
      ratings: { competencies: [{ competency_id: 'a', rating, is_applicable: true }] },
      comments: null,
      score: null,
      submitted_at: submitted,
      returned_to_label: null,
      returned_reason: null,
    });
    assert.equal(earlierRating([entry('2.00', '2026-10-01'), entry('4.00', '2026-10-10')], 'self', 'a'), '4.00');
    assert.equal(earlierRating([entry('2.00', '2026-10-01'), entry('5.00', null)], 'self', 'a'), '2.00', 'a draft is not shown');
    assert.equal(earlierRating([], 'self', 'a'), null);
  });

  it('keeps HR sign-off on the web', () => {
    const viewer = { is_subject: false, can_act: true, act_reason: null, can_acknowledge: false };
    const at = (role: 'manager' | 'hr') => ({ viewer, appraisal: { current_stage_role: role } as never });
    assert.equal(canRateHere(at('manager')), true);
    assert.equal(canRateHere(at('hr')), false);
    assert.equal(canRateHere({ viewer: { ...viewer, can_act: false }, appraisal: { current_stage_role: 'manager' } as never }), false);
  });
});
