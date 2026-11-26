/**
 * Expense claim rules the screens share.
 *
 * At capture the server reports `may_submit: false` for an over-limit claim
 * that has no reason yet ("needs_justification"), but submit accepts it once
 * a reason is given. Only these verdicts stop a claim outright.
 */

const BLOCKING = new Set(['blocked', 'receipt_required', 'pre_approval_required']);

/** Whether the person can submit this claim (perhaps with a reason). */
export function claimSubmittable(verdictKind: string, maySubmit?: boolean): boolean {
  if (verdictKind === 'needs_justification') return true;
  if (BLOCKING.has(verdictKind)) return false;
  return maySubmit ?? true;
}

/** Whether submitting needs a reason typed first. */
export function claimNeedsReason(verdictKind: string): boolean {
  return verdictKind === 'needs_justification';
}
