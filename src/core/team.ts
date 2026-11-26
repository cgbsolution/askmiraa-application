/**
 * A manager's view of the team today: what each attendance state is called,
 * and the one-line summary at the top of My team.
 */

import type { Tone } from './status.ts';

export interface TeamState {
  label: string;
  tone: Tone;
}

/** The states `GET /attendance/team/today` returns, in the order a summary lists them. */
export const TEAM_STATES: Record<string, TeamState> = {
  in: { label: 'In', tone: 'success' },
  out: { label: 'Punched out', tone: 'neutral' },
  on_duty: { label: 'On duty', tone: 'info' },
  work_from_home: { label: 'Working from home', tone: 'info' },
  on_leave: { label: 'On leave', tone: 'warning' },
  holiday: { label: 'Holiday', tone: 'neutral' },
  week_off: { label: 'Week off', tone: 'neutral' },
  not_in: { label: 'Not in yet', tone: 'danger' },
};

export function teamState(state: string): TeamState {
  return TEAM_STATES[state] ?? { label: state.replace(/_/g, ' '), tone: 'neutral' };
}

/** "3 in · 1 on leave · 2 not in yet": only states someone is in, in a fixed order. */
export function teamSummary(counts: Record<string, number>): { state: string; label: string; count: number; tone: Tone }[] {
  const known = Object.keys(TEAM_STATES);
  const extra = Object.keys(counts).filter((k) => k !== 'late' && !known.includes(k));
  return [...known, ...extra]
    .filter((state) => (counts[state] ?? 0) > 0)
    .map((state) => ({ state, count: counts[state]!, ...teamState(state) }));
}

/** "Late by 25 min", "Late by 1 h 10 min". */
export function lateLabel(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `Late by ${m} min`;
  return m ? `Late by ${h} h ${m} min` : `Late by ${h} h`;
}

export type OneOnOneStatus =
  | { kind: 'next'; date: string }
  | { kind: 'missed'; date: string }
  | { kind: 'last'; date: string }
  | { kind: 'none' };

/**
 * What to say about a report's 1:1s. A planned date that has passed without
 * being held is "not held yet", never "next".
 */
export function oneOnOneStatus(next: string | null | undefined, last: string | null | undefined, today: string): OneOnOneStatus {
  if (next) return next < today ? { kind: 'missed', date: next } : { kind: 'next', date: next };
  if (last) return { kind: 'last', date: last };
  return { kind: 'none' };
}
