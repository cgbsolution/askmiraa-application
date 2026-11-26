/**
 * Home's "My to-dos" and the punch card's logic, kept testable.
 *
 * To-dos are only things that need the person: a task assigned to them, a
 * survey they have not answered, a document or asset waiting for their
 * acknowledgement, a review stage that is theirs, feedback asked of them, a
 * tax deadline close at hand, a punch that never reached the server. Nothing
 * is invented; a source that failed to load simply contributes nothing.
 */

import { diffDays, formatDateShort, localDay } from './dates.ts';
import type { QueuedPunch } from './offlineQueue.ts';
import type { RouteName } from './routes.ts';
import type {
  AnnouncementRead,
  AttendanceStatus,
  CompanyDocumentRead,
  DayTag,
  FeedbackInboxItem,
  MyAppraisal,
  MyAssetsRead,
  MySurveyRead,
  MyTaskRead,
  PunchRead,
  ShiftBrief,
  WindowRead,
} from './types.ts';

export interface Todo {
  key: string;
  title: string;
  subtitle: string;
  route: RouteName;
  params?: Record<string, string>;
  urgent: boolean;
}

export interface TodoSources {
  today: string;
  tasks?: MyTaskRead[];
  surveys?: MySurveyRead[];
  documents?: CompanyDocumentRead[];
  assets?: MyAssetsRead;
  appraisals?: MyAppraisal[];
  feedback?: FeedbackInboxItem[];
  taxWindows?: WindowRead[];
  announcements?: AnnouncementRead[];
  unsentPunches?: QueuedPunch[];
}

export function buildTodos(s: TodoSources): Todo[] {
  const out: Todo[] = [];

  for (const punch of s.unsentPunches ?? []) {
    out.push({
      key: `punch-${punch.id}`,
      title: `Punch ${punch.direction} was not recorded`,
      subtitle: 'Raise a regularisation for the time you tapped.',
      route: 'Regularise',
      params: { date: localDay(punch.punchedAt) ?? punch.punchedAt.slice(0, 10), punchId: punch.id, direction: punch.direction, at: punch.punchedAt },
      urgent: true,
    });
  }

  for (const task of s.tasks ?? []) {
    if (task.status !== 'pending') continue;
    const whose = (task as { employee_name?: string }).employee_name;
    out.push({
      key: `task-${task.id}`,
      title: task.title,
      subtitle: [whose ? `For ${whose}` : null, `due ${formatDateShort(task.due_date)}`, task.is_overdue ? 'overdue' : null]
        .filter(Boolean)
        .join(' · '),
      route: 'Tasks',
      urgent: task.is_overdue,
    });
  }

  for (const survey of s.surveys ?? []) {
    if (!survey.is_open_now || survey.has_responded) continue;
    out.push({
      key: `survey-${survey.id}`,
      title: `Answer: ${survey.name}`,
      subtitle: `Closes ${formatDateShort(survey.closes_on)}`,
      route: 'SurveyDetail',
      params: { id: survey.id },
      urgent: diffDays(s.today, survey.closes_on) <= 2,
    });
  }

  for (const doc of s.documents ?? []) {
    if (!doc.requires_acknowledgement || doc.acknowledged_by_me) continue;
    out.push({
      key: `doc-${doc.id}`,
      title: `Read and acknowledge: ${doc.title}`,
      subtitle: doc.document_type,
      route: 'CompanyPolicies',
      urgent: false,
    });
  }

  for (const assignment of s.assets?.current ?? []) {
    if (!assignment.requires_acknowledgement || assignment.acknowledged_at || !assignment.is_open) continue;
    out.push({
      key: `asset-${assignment.id}`,
      title: `Confirm you have: ${assignment.asset_name}`,
      subtitle: `${assignment.category_name} · ${assignment.asset_tag}`,
      route: 'Assets',
      urgent: false,
    });
  }

  for (const review of s.appraisals ?? []) {
    if (!review.waiting_on_me) continue;
    out.push({
      key: `review-${review.appraisal_id}`,
      title: `Your review: ${review.cycle_name}`,
      subtitle: [review.stage_label, review.due_date ? `due ${formatDateShort(review.due_date)}` : null].filter(Boolean).join(' · '),
      route: 'Appraisal',
      urgent: review.days_overdue > 0,
    });
  }

  for (const item of s.feedback ?? []) {
    const record = item as unknown as { id?: string; request_id?: string; subject_name?: string; status?: string; due_on?: string };
    if (record.status && record.status !== 'pending') continue;
    out.push({
      key: `feedback-${record.id ?? record.request_id}`,
      title: `Give feedback on ${record.subject_name ?? 'a colleague'}`,
      subtitle: record.due_on ? `Due ${formatDateShort(record.due_on)}` : 'Asked of you',
      route: 'Feedback',
      urgent: false,
    });
  }

  for (const window of s.taxWindows ?? []) {
    if (!window.is_open) continue;
    const left = diffDays(s.today, window.closes_at);
    if (left < 0 || left > 30) continue;
    out.push({
      key: `tax-${window.id}`,
      title: window.window_type === 'proof' ? 'Upload your tax proofs' : 'Submit your tax declarations',
      subtitle: `Closes ${formatDateShort(window.closes_at)} (${left} ${left === 1 ? 'day' : 'days'} left)`,
      route: 'TaxDeclarations',
      urgent: left <= 7,
    });
  }

  for (const announcement of s.announcements ?? []) {
    if (!announcement.requires_acknowledgement || announcement.acknowledged) continue;
    out.push({
      key: `announcement-${announcement.id}`,
      title: `Acknowledge: ${announcement.title}`,
      subtitle: 'Announcement',
      route: 'Announcements',
      urgent: false,
    });
  }

  // Urgent first, otherwise in the order above.
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

// ── Punch ────────────────────────────────────────────────────────────────────

/**
 * Which way the next punch goes: the opposite of the last one today, counting
 * a punch still on the device. No punch today means "in".
 */
export function nextDirection(today: string, serverPunches: PunchRead[], localPunches: QueuedPunch[], tzToday: (iso: string) => string): 'in' | 'out' {
  const all = [
    ...serverPunches.map((p) => ({ at: p.punched_at, direction: p.direction })),
    ...localPunches
      .filter((p) => p.state !== 'synced' && p.state !== 'rejected' && p.state !== 'stale')
      .map((p) => ({ at: p.punchedAt, direction: p.direction })),
  ].filter((p) => tzToday(p.at) === today);
  if (!all.length) return 'in';
  const last = all.sort((a, b) => a.at.localeCompare(b.at))[all.length - 1]!;
  return last.direction === 'in' ? 'out' : 'in';
}

/** "09:30 – 18:30" from "09:30:00". */
export function shiftTimes(shift: Pick<ShiftBrief, 'start_time' | 'end_time'> | null | undefined): string | null {
  if (!shift) return null;
  const hhmm = (value: string) => value.slice(0, 5);
  return `${hhmm(shift.start_time)} – ${hhmm(shift.end_time)}`;
}

// ── Attendance calendar ──────────────────────────────────────────────────────

export type DayKind = 'present' | 'absent' | 'leave' | 'holiday' | 'off' | 'half' | 'late' | 'attention' | 'none';

export function dayKind(status: AttendanceStatus | null | undefined, lateMinutes = 0): DayKind {
  switch (status) {
    case 'present':
      return lateMinutes > 0 ? 'late' : 'present';
    case 'absent':
    case 'lop':
      return 'absent';
    case 'on_leave':
      return 'leave';
    case 'holiday':
      return 'holiday';
    case 'week_off':
      return 'off';
    case 'half_day':
      return 'half';
    case 'needs_regularisation':
      return 'attention';
    default:
      return 'none';
  }
}

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  present: 'Present',
  absent: 'Absent',
  leave: 'Leave',
  holiday: 'Holiday',
  off: 'Weekly off',
  half: 'Half day',
  late: 'Late',
  attention: 'Needs fixing',
  none: 'No record',
};

// ── Attendance calendar day tags ────────────────────────────────────────────
// The API decides which tag a day wears (backend services/attendance/
// calendar_tags.py) so the app and the portal colour a day the same way.

/** The legend's order, as on the older HRMS calendars HR teams know. */
export const DAY_TAG_ORDER: DayTag[] = [
  'absent',
  'week_off',
  'unapproved_leave',
  'partial',
  'holiday',
  'approved_leave',
  'full_day',
  'optional_holiday',
];

export const DAY_TAG_LABEL: Record<DayTag, string> = {
  full_day: 'Full day',
  partial: 'Partial',
  absent: 'Absent / Missed punch',
  week_off: 'Week off',
  holiday: 'Holiday',
  optional_holiday: 'Optional holiday',
  approved_leave: 'Approved leave',
  unapproved_leave: 'Unapproved leave',
};

/** What the calendar says about a day the API left blank. */
export function untaggedDayLabel(date: string, today: string, joinedOn?: string | null): string {
  if (joinedOn && diffDays(joinedOn, date) < 0) return 'Before joining';
  if (date === today) return 'Today — in progress';
  if (diffDays(today, date) > 0) return 'Working day';
  return 'Not worked out yet';
}

/** A day may be regularised when it is in the past or today and the period is not locked. */
export function canRegularise(date: string, today: string, locked: boolean): boolean {
  return !locked && diffDays(date, today) >= 0;
}

/** Weekly offs as names. The backend numbers them ISO-style: Monday 1 … Sunday 7. */
export function weeklyOffNames(days: number[] | null | undefined): string[] {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return [...(days ?? [])].sort((a, b) => a - b).map((d) => names[d % 7] ?? '').filter(Boolean);
}

// ── Punch card: worked today ─────────────────────────────────────────────────

/**
 * Minutes worked from a day's punches: each in → out pair, plus an "in" still
 * open, counted up to `now`. Punches out of order or doubled (two ins in a
 * row, an out with no in) are read the way the server reads them: a second
 * "in" while already in is a mistaken tap (the stretch keeps the first "in"),
 * a second "out" extends the stretch it follows, and an "out" before any "in"
 * is ignored.
 */
export function workedMinutes(punches: { punched_at: string; direction: 'in' | 'out' }[], now: string): number {
  const sorted = [...punches].sort((a, b) => a.punched_at.localeCompare(b.punched_at));
  let total = 0;
  let openSince: number | null = null;
  let lastOut: number | null = null;
  for (const punch of sorted) {
    const at = Date.parse(punch.punched_at);
    if (Number.isNaN(at)) continue;
    if (punch.direction === 'in') {
      if (openSince === null) openSince = at;
    } else if (openSince !== null) {
      total += Math.max(0, at - openSince);
      openSince = null;
      lastOut = at;
    } else if (lastOut !== null) {
      total += Math.max(0, at - lastOut);
      lastOut = at;
    }
  }
  if (openSince !== null) total += Math.max(0, Date.parse(now) - openSince);
  return Math.floor(total / 60_000);
}

/** A shift's length in minutes, from "09:30:00" to "18:30:00"; a night shift wraps past midnight. */
export function shiftMinutes(shift: Pick<ShiftBrief, 'start_time' | 'end_time'> | null | undefined): number | null {
  if (!shift) return null;
  const minutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const start = minutes(shift.start_time);
  const end = minutes(shift.end_time);
  if (start === end) return null;
  return end > start ? end - start : 24 * 60 - start + end;
}
