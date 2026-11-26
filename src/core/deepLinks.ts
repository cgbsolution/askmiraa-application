/**
 * Deep-link routing for push notifications and askmira:// URLs.
 *
 * An approval notification must open *that approval*, not the app home. The
 * difference between those two is whether a manager acts on it in ten seconds
 * or forgets about it — which is the whole reason the notification was sent.
 *
 * Every event key the backend can emit is listed in KNOWN_EVENT_KEYS (taken
 * from `backend/app/services/**`, where each is raised) and mapped here. A key
 * with no mapping falls back to Home rather than crashing, and
 * `unmappedEventKeys()` lists any gaps so a new event cannot quietly ship
 * without a destination — a test asserts it is empty.
 *
 * Pure TypeScript: no navigation library imported, so the mapping is testable
 * without a device.
 */

import { ROUTE_NAMES, listFallback, type RouteName, type ScreenRoute } from './routes.ts';

export type { RouteName } from './routes.ts';

export interface Destination {
  route: RouteName;
  params?: Record<string, string>;
}

interface Mapping {
  route: RouteName;
  /** Route param -> payload field that supplies it. Missing -> the list screen. */
  params?: Record<string, string>;
  /** Params fixed by the event, not read from the payload. */
  fixed?: Record<string, string>;
}

/** Event key to screen. */
const EVENTS: Record<string, Mapping> = {
  // Approvals waiting on the reader open that approval (or the approvals list).
  'leave.approval.requested': { route: 'ApprovalDetail', params: { id: 'leave_request_id' }, fixed: { source: 'leave' } },
  'leave.compoff.requested': { route: 'Approvals' },
  'attendance.regularisation.requested': {
    route: 'ApprovalDetail',
    params: { id: 'regularisation_id' },
    fixed: { source: 'regularisation' },
  },
  'attendance.regularisation.reminder': { route: 'Approvals' },
  'attendance.shift_swap.to_approve': { route: 'Approvals' },
  'expenses.claim.awaiting_manager': { route: 'Approvals' },
  'expenses.travel.awaiting_manager': { route: 'Approvals' },
  'timesheets.submitted': { route: 'Approvals' },
  'timesheets.reminder.pending': { route: 'Approvals' },
  'lifecycle.approval.waiting': { route: 'Approvals' },
  'people.profile_change.requested': { route: 'Approvals' },
  'approvals.escalated': { route: 'Approvals' },
  'assets.request.submitted': { route: 'Approvals' },

  // Decisions on the reader's own requests open the request.
  'leave.approval.decided': { route: 'LeaveDetail', params: { id: 'leave_request_id' } },
  'leave.request.cancelled': { route: 'Leave' },
  'leave.compoff.decided': { route: 'CompOff' },
  'attendance.regularisation.decided': { route: 'AttendanceDetail', params: { date: 'attendance_date' } },
  'attendance.shift_swap.asked': { route: 'Shifts' },
  'attendance.shift_swap.outcome': { route: 'Shifts' },
  'attendance.period.unlocked': { route: 'Attendance' },
  'attendance.device.silent': { route: 'Attendance' },
  'expenses.claim.decided': { route: 'ExpenseDetail', params: { id: 'claim_id' } },
  'expenses.claim.manager_decided': { route: 'ExpenseDetail', params: { id: 'claim_id' } },
  'expenses.travel.decided': { route: 'TravelRequests' },
  'timesheets.decided': { route: 'Timesheet' },
  'timesheets.reminder.unsubmitted': { route: 'Timesheet' },
  'people.profile_change.decided': { route: 'ChangeRequests' },
  'people.document.uploaded': { route: 'Documents' },
  'people.document.verified': { route: 'Documents' },
  'assets.assigned': { route: 'Assets' },
  'assets.request.decided': { route: 'Assets' },
  'assets.return.due': { route: 'Assets' },

  // Pay and tax.
  'payroll.payslip.published': { route: 'PayslipDetail', params: { id: 'payslip_id' } },
  'payroll.run.failed': { route: 'Payslips' },
  'payroll.disbursement.credit_failed': { route: 'Payslips' },
  'payroll.reimbursement.decided': { route: 'Flexi' },
  'payroll.reimbursement.unclaimed': { route: 'Flexi' },
  'payroll.rule_set.expired': { route: 'Home' },
  'statutory.change_due': { route: 'Home' },
  'tax.window.opened': { route: 'TaxDeclarations' },
  'tax.window.closing': { route: 'TaxDeclarations' },
  'tax.proof.decided': { route: 'TaxDeclarations' },
  'tax.proof.unproven': { route: 'TaxDeclarations' },

  // Documents and letters.
  'documents.letter.issued': { route: 'LetterDetail', params: { id: 'letter_id' } },
  'documents.letter.acknowledgement_requested': { route: 'LetterDetail', params: { id: 'letter_id' } },
  'documents.letter.acknowledged': { route: 'Letters' },
  'documents.policy.acknowledgement_requested': { route: 'CompanyPolicies' },
  'documents.expiring': { route: 'Documents' },
  'documents.expiring_summary': { route: 'Documents' },

  // Helpdesk.
  'helpdesk.ticket.created': { route: 'TicketDetail', params: { id: 'ticket_id' } },
  'helpdesk.ticket.assigned': { route: 'TicketDetail', params: { id: 'ticket_id' } },
  'helpdesk.ticket.replied': { route: 'TicketDetail', params: { id: 'ticket_id' } },
  'helpdesk.ticket.resolved': { route: 'TicketDetail', params: { id: 'ticket_id' } },

  // Growth.
  'performance.feedback.requested': { route: 'Feedback' },
  'performance.feedback.reminder': { route: 'Feedback' },
  'performance.feedback.submitted': { route: 'Feedback' },
  'performance.feedback.summary_ready': { route: 'Feedback' },
  'performance.feedback.private_received': { route: 'Feedback' },
  'performance.goal.assigned': { route: 'Goals' },
  'performance.goal.check_in_commented': { route: 'Goals' },
  'performance.one_on_one.scheduled': { route: 'OneOnOnes' },
  'performance.one_on_one.rescheduled': { route: 'OneOnOnes' },
  'performance.one_on_one.cancelled': { route: 'OneOnOnes' },
  'performance.review.launched': { route: 'Appraisal' },
  'performance.review.stage_open': { route: 'Appraisal' },
  'performance.review.reminder': { route: 'Appraisal' },
  'performance.review.returned': { route: 'Appraisal' },
  'performance.review.released': { route: 'Appraisal' },
  'performance.review.escalated': { route: 'Appraisal' },
  'performance.review.objection': { route: 'Appraisal' },
  'performance.pip.opened': { route: 'Appraisal' },
  'performance.probation.due': { route: 'MyTeam' },
  'probation.review_due': { route: 'MyTeam' },
  'analytics.signals.digest': { route: 'MyTeam' },
  'analytics.signals.team': { route: 'MyTeam' },
  'learning.assigned': { route: 'Learning' },
  'learning.overdue': { route: 'Learning' },

  // Interviews (the reader is on a panel).
  'interview.scheduled': { route: 'Interviews' },
  'interview.reminder': { route: 'Interviews' },
  'interview.reschedule_requested': { route: 'Interviews' },
  'interview.panelist_declined': { route: 'Interviews' },
  'offer.released': { route: 'Referrals' },

  // Culture.
  'culture.shoutout.received': { route: 'Shoutouts' },
  'culture.shoutout.posted': { route: 'Shoutouts' },
  'culture.milestone': { route: 'Celebrations' },
  'rewards.points.expiring': { route: 'Rewards' },

  // Onboarding and exit.
  'onboarding.plan.started': { route: 'Onboarding' },
  'onboarding.task.assigned': { route: 'Tasks' },
  'onboarding.task.overdue': { route: 'Tasks' },
  'exit.resignation.submitted': { route: 'Exit' },
  'exit.resignation.accepted': { route: 'Exit' },
  'exit.resignation.withdrawn': { route: 'Exit' },
  'exits.settlement.approved': { route: 'Exit' },
  'exits.settlement.paid': { route: 'Exit' },

  // Company-wide.
  'system.announcement': { route: 'Announcements' },
  'system.announcement.critical': { route: 'Announcements' },
  'system.digest.daily': { route: 'Home' },

  // Account and security.
  'auth.login.created': { route: 'Security' },
  'auth.password.reset': { route: 'Security' },
  'security.break_glass_used': { route: 'Security' },
  'security.suspicious_login': { route: 'Security' },
};

/**
 * Every event key the backend emits to a person who might hold this app.
 * Candidate-facing keys (`hiring.candidate.*`) go to people outside the
 * workspace by email and are not here.
 */
export const KNOWN_EVENT_KEYS: readonly string[] = [
  'analytics.signals.digest', 'analytics.signals.team', 'approvals.escalated',
  'assets.assigned', 'assets.request.decided', 'assets.request.submitted', 'assets.return.due',
  'attendance.device.silent', 'attendance.period.unlocked', 'attendance.regularisation.decided',
  'attendance.regularisation.reminder', 'attendance.regularisation.requested',
  'attendance.shift_swap.asked', 'attendance.shift_swap.outcome', 'attendance.shift_swap.to_approve',
  'auth.login.created', 'auth.password.reset',
  'culture.milestone', 'culture.shoutout.posted', 'culture.shoutout.received',
  'documents.expiring', 'documents.expiring_summary', 'documents.letter.acknowledged',
  'documents.letter.acknowledgement_requested', 'documents.letter.issued',
  'documents.policy.acknowledgement_requested',
  'exit.resignation.accepted', 'exit.resignation.submitted', 'exit.resignation.withdrawn',
  'exits.settlement.approved', 'exits.settlement.paid',
  'expenses.claim.awaiting_manager', 'expenses.claim.decided', 'expenses.claim.manager_decided',
  'expenses.travel.awaiting_manager', 'expenses.travel.decided',
  'helpdesk.ticket.assigned', 'helpdesk.ticket.created', 'helpdesk.ticket.replied', 'helpdesk.ticket.resolved',
  'interview.panelist_declined', 'interview.reminder', 'interview.reschedule_requested', 'interview.scheduled',
  'learning.assigned', 'learning.overdue',
  'leave.approval.decided', 'leave.approval.requested', 'leave.compoff.decided',
  'leave.compoff.requested', 'leave.request.cancelled',
  'lifecycle.approval.waiting', 'offer.released',
  'onboarding.plan.started', 'onboarding.task.assigned', 'onboarding.task.overdue',
  'payroll.disbursement.credit_failed', 'payroll.payslip.published', 'payroll.reimbursement.decided',
  'payroll.reimbursement.unclaimed', 'payroll.rule_set.expired', 'payroll.run.failed',
  'people.document.uploaded', 'people.document.verified', 'people.profile_change.decided',
  'people.profile_change.requested',
  'performance.feedback.private_received', 'performance.feedback.reminder', 'performance.feedback.requested',
  'performance.feedback.submitted', 'performance.feedback.summary_ready', 'performance.goal.assigned',
  'performance.goal.check_in_commented', 'performance.one_on_one.cancelled',
  'performance.one_on_one.rescheduled', 'performance.one_on_one.scheduled', 'performance.pip.opened',
  'performance.probation.due', 'performance.review.escalated', 'performance.review.launched',
  'performance.review.objection', 'performance.review.released', 'performance.review.reminder',
  'performance.review.returned', 'performance.review.stage_open', 'probation.review_due',
  'rewards.points.expiring', 'security.break_glass_used', 'security.suspicious_login',
  'statutory.change_due', 'system.announcement', 'system.announcement.critical', 'system.digest.daily',
  'tax.proof.decided', 'tax.proof.unproven', 'tax.window.closing', 'tax.window.opened',
  'timesheets.decided', 'timesheets.reminder.pending', 'timesheets.reminder.unsubmitted', 'timesheets.submitted',
];

/**
 * Where a notification should open.
 *
 * An unknown key lands on Home rather than throwing — a push that crashes the
 * app is worse than one that opens the wrong screen.
 */
export function destinationFor(eventKey: string, payload: Record<string, unknown> = {}): Destination {
  const mapping = EVENTS[eventKey];
  if (!mapping) return { route: 'Home' };

  if (!mapping.params) {
    return mapping.fixed ? { route: mapping.route, params: { ...mapping.fixed } } : { route: mapping.route };
  }

  const params: Record<string, string> = { ...(mapping.fixed ?? {}) };
  for (const [routeParam, payloadKey] of Object.entries(mapping.params)) {
    const value = payload[payloadKey];
    if (value === undefined || value === null || value === '') {
      // The route needs an id we do not have. Fall back to the list screen
      // rather than opening a detail view for nothing.
      return { route: listFallback(mapping.route as ScreenRoute) };
    }
    params[routeParam] = String(value);
  }
  return { route: mapping.route, params };
}

/** Event keys with no destination. A test asserts this is empty. */
export function unmappedEventKeys(): string[] {
  return KNOWN_EVENT_KEYS.filter((key) => !(key in EVENTS));
}

/**
 * Parse an `askmira://` URL into a destination.
 *
 * Used for links from email and WhatsApp, which arrive as URLs rather than as
 * a push payload.
 */
export function parseUrl(url: string): Destination | null {
  const match = /^askmira:\/\/([^/?]+)(?:\/([^?]+))?(?:\?(.*))?$/.exec(url.trim());
  if (!match) return null;

  const [, host, segment, query] = match;
  const route = toRouteName(host ?? '');
  if (!route) return null;

  const params: Record<string, string> = {};
  if (segment) params.id = safeDecode(segment);
  if (query) {
    for (const pair of query.split('&')) {
      const [key, value = ''] = pair.split('=');
      if (key) params[safeDecode(key)] = safeDecode(value);
    }
  }

  return Object.keys(params).length ? { route, params } : { route };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function toRouteName(host: string): RouteName | null {
  const normalised = host.toLowerCase();
  return ROUTE_NAMES.find((name) => name.toLowerCase() === normalised) ?? null;
}
