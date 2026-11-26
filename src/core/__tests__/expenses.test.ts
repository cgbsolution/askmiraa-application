import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { claimNeedsReason, claimSubmittable } from '../expenses.ts';

describe('expense claims', () => {
  it('lets an over-limit claim be submitted with a reason', () => {
    // The server says may_submit=false at capture, but accepts it with a reason.
    assert.equal(claimSubmittable('needs_justification', false), true);
    assert.equal(claimNeedsReason('needs_justification'), true);
  });

  it('stops a blocked claim, one missing its receipt, or one needing a trip', () => {
    assert.equal(claimSubmittable('blocked', false), false);
    assert.equal(claimSubmittable('receipt_required', false), false);
    assert.equal(claimSubmittable('pre_approval_required', false), false);
  });

  it('follows the server for everything else', () => {
    assert.equal(claimSubmittable('within_policy', true), true);
    assert.equal(claimSubmittable('flagged', true), true);
    assert.equal(claimSubmittable('no_rule'), true);
    assert.equal(claimNeedsReason('flagged'), false);
  });
});
