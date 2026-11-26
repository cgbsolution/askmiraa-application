/**
 * Deciding an item from the unified approvals inbox (GET /approvals).
 *
 * The inbox lists items from thirteen sources; each is decided on its own
 * module's route with its own body. This maps a source to the actions the
 * phone offers and the exact request each makes — checked against the
 * routers, and tested — so the screen never guesses a path.
 *
 * Rules from the README: approvals are online only (no queued decision), a
 * decision needs a confirm sheet, and a rejection needs a note.
 */

export type ActionKind = 'approve' | 'reject' | 'accept' | 'clear' | 'open';

export interface DecisionRequest {
  method: 'POST' | 'PATCH';
  path: string;
  body: Record<string, unknown>;
}

export interface ApprovalAction {
  kind: ActionKind;
  label: string;
  /** The note box must be filled before this action can be sent. */
  noteRequired: boolean;
  /** Ask for confirmation in a sheet before sending. Always true for a decision. */
  confirm: boolean;
  tone: 'primary' | 'danger' | 'neutral';
  /** Build the request; null for `open`, which navigates instead. */
  request: ((id: string, note: string) => DecisionRequest) | null;
  /** Where `open` goes in the app. */
  openRoute?: string;
}

const note = (text: string) => (text.trim() ? text.trim() : null);

function approveReject(
  approve: (id: string, note: string) => DecisionRequest,
  reject: (id: string, note: string) => DecisionRequest,
): ApprovalAction[] {
  return [
    { kind: 'approve', label: 'Approve', noteRequired: false, confirm: true, tone: 'primary', request: approve },
    { kind: 'reject', label: 'Reject', noteRequired: true, confirm: true, tone: 'danger', request: reject },
  ];
}

const SOURCES: Record<string, ApprovalAction[]> = {
  leave: approveReject(
    (id, n) => ({ method: 'POST', path: `/leave/requests/${id}/approve`, body: { note: note(n) } }),
    (id, n) => ({ method: 'POST', path: `/leave/requests/${id}/reject`, body: { note: note(n) } }),
  ),
  leave_comp_off: approveReject(
    (id, n) => ({ method: 'POST', path: `/leave/comp-off/${id}/approve`, body: { note: note(n) } }),
    (id, n) => ({ method: 'POST', path: `/leave/comp-off/${id}/reject`, body: { note: note(n) } }),
  ),
  attendance_regularisation: approveReject(
    (id, n) => ({ method: 'PATCH', path: `/attendance/regularisation/${id}`, body: { approve: true, note: note(n) } }),
    (id, n) => ({ method: 'PATCH', path: `/attendance/regularisation/${id}`, body: { approve: false, note: note(n) } }),
  ),
  overtime: approveReject(
    (id, n) => ({ method: 'POST', path: `/attendance/overtime/${id}/decide`, body: { approve: true, note: note(n) } }),
    (id, n) => ({ method: 'POST', path: `/attendance/overtime/${id}/decide`, body: { approve: false, note: note(n) } }),
  ),
  shift_swap: approveReject(
    (id, n) => ({ method: 'POST', path: `/attendance/shift-swaps/${id}/decide`, body: { approve: true, note: note(n) } }),
    (id, n) => ({ method: 'POST', path: `/attendance/shift-swaps/${id}/decide`, body: { approve: false, note: note(n) } }),
  ),
  timesheet: approveReject(
    (id, n) => ({ method: 'POST', path: `/timesheets/${id}/decide`, body: { approve: true, note: note(n) } }),
    (id, n) => ({ method: 'POST', path: `/timesheets/${id}/decide`, body: { approve: false, note: note(n) } }),
  ),
  expense_claim_manager: approveReject(
    (id, n) => ({ method: 'POST', path: `/expenses/claims/${id}/manager-decision`, body: { approve: true, note: note(n) } }),
    (id, n) => ({ method: 'POST', path: `/expenses/claims/${id}/manager-decision`, body: { approve: false, note: note(n) } }),
  ),
  travel_request_manager: approveReject(
    (id, n) => ({
      method: 'POST',
      path: `/expenses/travel-requests/${id}/manager-decision`,
      body: { approve: true, note: note(n) },
    }),
    (id, n) => ({
      method: 'POST',
      path: `/expenses/travel-requests/${id}/manager-decision`,
      body: { approve: false, note: note(n) },
    }),
  ),
  lifecycle_event: approveReject(
    (id, n) => ({ method: 'POST', path: `/lifecycle/events/${id}/decide`, body: { approve: true, note: n.trim() } }),
    (id, n) => ({ method: 'POST', path: `/lifecycle/events/${id}/decide`, body: { approve: false, note: n.trim() } }),
  ),
  asset_request: approveReject(
    (id, n) => ({ method: 'POST', path: `/assets/requests/${id}/approve`, body: { note: note(n) } }),
    (id, n) => ({ method: 'POST', path: `/assets/requests/${id}/reject`, body: { note: n.trim() } }),
  ),
  // A resignation is accepted, not rejected: the person withdraws it themselves.
  resignation: [
    {
      kind: 'accept',
      label: 'Accept resignation',
      noteRequired: false,
      confirm: true,
      tone: 'primary',
      request: (id, n) => ({ method: 'POST', path: `/exits/${id}/accept`, body: { note: note(n) } }),
    },
  ],
  clearance_task: [
    {
      kind: 'clear',
      label: 'Mark cleared',
      noteRequired: false,
      confirm: true,
      tone: 'primary',
      request: (id, n) => ({ method: 'PATCH', path: `/exits/clearance/${id}`, body: { outcome: 'cleared', notes: note(n) } }),
    },
  ],
  feedback_request: [
    { kind: 'open', label: 'Give feedback', noteRequired: false, confirm: false, tone: 'primary', request: null, openRoute: 'Feedback' },
  ],
};

/** The actions for an inbox item's source. Unknown sources get none (the screen says to use the web). */
export function actionsFor(source: string): ApprovalAction[] {
  return SOURCES[source] ?? [];
}

export function knownSources(): string[] {
  return Object.keys(SOURCES);
}

/** Why an action cannot be sent yet, or null when it can. */
export function blockReason(action: ApprovalAction, noteText: string, online: boolean): string | null {
  if (!online) return 'You are offline. Decisions are sent only with a connection, so nothing is lost.';
  if (action.noteRequired && !noteText.trim()) return 'Add a note so the person knows why.';
  if (noteText.length > 1000) return 'Keep the note under 1000 characters.';
  return null;
}

// ── Bulk decisions ───────────────────────────────────────────────────────────

/**
 * Whether items from a source can be approved or rejected several at a time:
 * the source has both decisions as plain requests. Anything else (an "open
 * in…" link, a clearance) is decided one by one.
 */
export function bulkDecidable(source: string): boolean {
  const actions = actionsFor(source);
  return ['approve', 'reject'].every((kind) => actions.some((a) => a.kind === kind && a.request !== null));
}

/**
 * The requests for one decision over many items, each on its own module's
 * route — there is no bulk endpoint, so each is its own audited decision.
 * Items that cannot be decided in bulk are left out.
 */
export function bulkRequests(
  items: { id: string; source: string }[],
  kind: 'approve' | 'reject',
  noteText: string,
): { id: string; source: string; request: DecisionRequest }[] {
  const out: { id: string; source: string; request: DecisionRequest }[] = [];
  for (const item of items) {
    if (!bulkDecidable(item.source)) continue;
    const action = actionsFor(item.source).find((a) => a.kind === kind);
    if (action?.request) out.push({ id: item.id, source: item.source, request: action.request(item.id, noteText) });
  }
  return out;
}

/** Why a bulk decision cannot be sent yet, or null. A rejection needs a note, as one at a time. */
export function bulkBlockReason(kind: 'approve' | 'reject' | null, count: number, noteText: string, online: boolean): string | null {
  if (!online) return 'You are offline. Decisions are sent only with a connection, so nothing is lost.';
  if (!count) return 'Tick the requests to decide.';
  if (!kind) return 'Choose Approve or Reject.';
  if (kind === 'reject' && !noteText.trim()) return 'Add a note so people know why.';
  if (noteText.length > 1000) return 'Keep the note under 1000 characters.';
  return null;
}
