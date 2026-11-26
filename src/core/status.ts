/**
 * Status words from the API, as a label and a tone.
 *
 * Every module has its own enum (leave `pending`, expense
 * `awaiting_manager`, ticket `waiting_on_requester`…). They are shown through
 * one function so the same word has the same colour everywhere.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

const SUCCESS = new Set([
  'approved', 'paid', 'completed', 'complete', 'done', 'resolved', 'closed', 'verified', 'active',
  'acknowledged', 'accepted', 'present', 'synced', 'issued', 'signed', 'enrolled', 'cleared',
  'fulfilled', 'disbursed', 'settled', 'published', 'answered', 'released', 'assigned', 'recorded',
  'joined', 'going', 'redeemed', 'hired', 'confirmed', 'reimbursed', 'processed', 'finalised',
]);
const WARNING = new Set([
  'pending', 'submitted', 'in_review', 'open', 'awaiting_manager', 'awaiting_finance',
  'awaiting_approval', 'pending_approval', 'pending_manager', 'waiting_on_employee', 'in_progress', 'waiting_on_requester', 'waiting',
  'needs_regularisation', 'half_day', 'late', 'due', 'requested', 'sent_for_signature',
  'pending_signature', 'under_review', 'proposed', 'scheduled', 'notice', 'serving_notice',
  'on_hold', 'partially_answered', 'maybe', 'reopened', 'queued', 'syncing', 'not_started',
]);
const DANGER = new Set([
  'rejected', 'failed', 'overdue', 'expired', 'absent', 'lop', 'revoked', 'declined', 'refused',
  'lost', 'damaged', 'breached', 'withheld', 'returned_for_changes', 'dead_letter',
]);
const NEUTRAL = new Set([
  'cancelled', 'canceled', 'withdrawn', 'draft', 'archived', 'inactive', 'week_off', 'returned',
  'not_going', 'skipped', 'lapsed', 'superseded',
]);
const INFO = new Set(['on_leave', 'holiday', 'new', 'upcoming', 'pre_joining']);

/** A status word's tone. Unknown words are neutral, never alarming. */
export function toneFor(status: string | null | undefined): Tone {
  const key = (status ?? '').toLowerCase().trim();
  if (SUCCESS.has(key)) return 'success';
  if (WARNING.has(key)) return 'warning';
  if (DANGER.has(key)) return 'danger';
  if (INFO.has(key)) return 'info';
  if (NEUTRAL.has(key)) return 'neutral';
  return 'neutral';
}

const LABELS: Record<string, string> = {
  lop: 'Loss of pay',
  week_off: 'Weekly off',
  on_leave: 'On leave',
  half_day: 'Half day',
  needs_regularisation: 'Needs regularising',
  awaiting_manager: 'With your manager',
  awaiting_finance: 'With finance',
  waiting_on_requester: 'Waiting on you',
  waiting_on_employee: 'Waiting on you',
  pending_manager: 'With your manager',
  in_review: 'In review',
  pre_joining: 'Joining soon',
  first_half: 'First half',
  biometric: 'Attendance device',
  import: 'From the attendance device',
  mobile_geo: 'Phone, with location',
  web: 'Phone or web',
  manual: 'Added by HR',
  kiosk: 'Kiosk',
  second_half: 'Second half',
};

/** "awaiting_manager" -> "With your manager"; "in_progress" -> "In progress". */
export function statusLabel(status: string | null | undefined): string {
  const key = (status ?? '').toLowerCase().trim();
  if (!key) return '—';
  if (LABELS[key]) return LABELS[key]!;
  const words = key.replace(/[_-]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Initials for an avatar: "Meera Nair" -> "MN", "Miraa" -> "MI". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/** First name for a greeting. */
export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/** A person's name from an employee record: the display name, else first and last. */
export function personName(person: { display_name?: string | null; first_name?: string | null; last_name?: string | null } | null | undefined): string {
  if (!person) return '';
  return person.display_name?.trim() || [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}
