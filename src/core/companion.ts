/**
 * Ask Miraa's chat rules, kept out of the screen so they can be tested.
 *
 * The phone uses the same backend as the portal (/companion/*). Nothing here
 * talks to a model: it decides how to lay out what came back, when the
 * composer may send, and how the history is grouped.
 */

import { isoFromDate, diffDays } from './dates.ts';
import type { CompanionCard, CompanionStatus, Conversation, ReportResult } from './types.ts';
import { MESSAGE_MAX_LENGTH } from './types.ts';

// ── History ──────────────────────────────────────────────────────────────────

export interface ConversationGroup {
  title: 'Today' | 'Yesterday' | 'Earlier';
  items: Conversation[];
}

/** Today / Yesterday / Earlier, newest first, empty groups left out. */
export function groupConversations(conversations: Conversation[], now: Date = new Date()): ConversationGroup[] {
  const today = isoFromDate(now);
  const groups: Record<ConversationGroup['title'], Conversation[]> = { Today: [], Yesterday: [], Earlier: [] };
  const sorted = [...conversations].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  for (const conversation of sorted) {
    const at = new Date(conversation.last_message_at);
    const gap = Number.isNaN(at.getTime()) ? 99 : diffDays(isoFromDate(at), today);
    groups[gap <= 0 ? 'Today' : gap === 1 ? 'Yesterday' : 'Earlier'].push(conversation);
  }
  return (['Today', 'Yesterday', 'Earlier'] as const)
    .filter((title) => groups[title].length)
    .map((title) => ({ title, items: groups[title] }));
}

/** Client-side search over conversation titles. */
export function searchConversations(conversations: Conversation[], query: string): Conversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return conversations;
  return conversations.filter((c) => c.title.toLowerCase().includes(q));
}

// ── Composer ─────────────────────────────────────────────────────────────────

export interface ComposerState {
  canSend: boolean;
  /** Why it cannot send, to show above the box. Null when it can, or the box is just empty. */
  blocked: string | null;
  /** "1,850 / 2,000" once within 200 characters of the limit. */
  counter: string | null;
  remainingToday: number;
}

export function composerState(
  status: Pick<CompanionStatus, 'daily_limit' | 'sent_today'> | null,
  text: string,
  online: boolean,
  pending: boolean,
  /** Files attached to the message: with one, the words may be empty. */
  attachments = 0,
): ComposerState {
  const remainingToday = status ? Math.max(0, status.daily_limit - status.sent_today) : 0;
  const length = text.length;
  const counter = length >= MESSAGE_MAX_LENGTH - 200 ? `${length.toLocaleString('en-IN')} / ${MESSAGE_MAX_LENGTH.toLocaleString('en-IN')}` : null;
  let blocked: string | null = null;
  if (!online) blocked = 'You are offline. Miraa needs a connection, and messages are not saved to send later.';
  else if (status && remainingToday === 0) {
    blocked = `You have used today's ${status.daily_limit} messages. They reset at midnight (India time).`;
  } else if (length > MESSAGE_MAX_LENGTH) blocked = `Keep it under ${MESSAGE_MAX_LENGTH.toLocaleString('en-IN')} characters.`;
  const canSend =
    !blocked && !pending && (text.trim().length > 0 || attachments > 0) && Boolean(status);
  return { canSend, blocked, counter, remainingToday };
}

// ── Status ───────────────────────────────────────────────────────────────────

/** The chip in the header. */
export function modeLabel(status: Pick<CompanionStatus, 'mode'>): string {
  return status.mode === 'ai' ? 'AI' : 'On-device lookup';
}

/** One honest line for why AI is not planning. */
export function reasonCopy(reason: CompanionStatus['reason'], name: string): { title: string; message: string } | null {
  switch (reason) {
    case 'not_configured':
      return {
        title: 'Quick lookups, without AI',
        message: `This server has no AI provider set up, so ${name} matches your words to a lookup instead. Ask short, direct questions. Nothing you type leaves AskMiraa.`,
      };
    case 'disabled':
      return {
        title: 'Quick lookups, without AI',
        message: `Your company has switched AI off, so ${name} matches your words to a lookup instead. Ask short, direct questions. Nothing you type leaves AskMiraa.`,
      };
    case 'no_consent':
      return {
        title: 'Quick lookups, without AI',
        message: `You have not agreed to the AI assistant, so ${name} matches your words to a lookup. Agree in Privacy to ask anything in your own words.`,
      };
    default:
      return null;
  }
}

/** Starter questions: the server's examples (one per tool the person has), plus the AI-only two. */
export function suggestions(status: Pick<CompanionStatus, 'tools' | 'examples'>, max = 6): string[] {
  const keys = new Set(status.tools.map((tool) => tool.key));
  const list = [
    keys.has('policy_question') ? 'What is the work-from-home policy?' : null,
    keys.has('report_question') ? 'How many people joined this year?' : null,
    ...status.examples,
  ].filter((s): s is string => Boolean(s));
  return [...new Set(list)].slice(0, max);
}

// ── Cards ────────────────────────────────────────────────────────────────────

/** Three columns or fewer read best as stacked rows; wider tables scroll sideways. */
export function tableLayout(columns: string[]): 'stacked' | 'scroll' {
  return columns.length <= 3 ? 'stacked' : 'scroll';
}

/** A table cell as text. Empty is a dash, never "null". */
export function cellText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** "Showing 1–20 of 134", or null when the table is not one page of more. */
export function pageLabel(page: { number: number; size: number; total: number } | undefined, rowsShown: number): string | null {
  if (!page || page.total <= rowsShown && page.number <= 1) return null;
  const first = (page.number - 1) * page.size + 1;
  const last = first + rowsShown - 1;
  return `Showing ${first.toLocaleString('en-IN')}–${last.toLocaleString('en-IN')} of ${page.total.toLocaleString('en-IN')}`;
}

/** Whether a further page exists after this one. */
export function hasMore(page: { number: number; size: number; total: number } | undefined): boolean {
  return Boolean(page && page.number * page.size < page.total);
}

/** The follow-up turn that asks for the next page — the same words the web would send. */
export function nextPageMessage(card: { title: string; page?: { number: number } }): string {
  return `Show page ${(card.page?.number ?? 1) + 1} of ${card.title.toLowerCase()}`;
}

export const OUTCOME_LABEL: Record<'answered' | 'partially_answered' | 'refused' | 'withheld', string> = {
  answered: 'Answered',
  partially_answered: 'Partly answered',
  refused: 'Not answered',
  withheld: 'Withheld',
};

/** A report that is one value (one row, one column) shows as a big number. */
export function singleValue(result: ReportResult | null): string | null {
  if (!result || result.rows.length !== 1 || result.columns.length !== 1) return null;
  return cellText(result.rows[0]?.[0]);
}

export interface Series {
  labels: string[];
  values: number[];
  valueLabel: string;
}

/**
 * The series a small chart draws: the first column as labels, the first
 * numeric column as values. Charts are pictures, so a float here is fine; the
 * table under the chart shows the exact figures.
 */
export function chartSeries(result: ReportResult | null): Series | null {
  if (!result || result.columns.length < 2 || result.rows.length === 0) return null;
  const numericIndex = result.columns.findIndex(
    (column, index) => index > 0 && result.rows.every((row) => row[index] === null || Number.isFinite(Number(row[index]))),
  );
  if (numericIndex < 0) return null;
  return {
    labels: result.rows.map((row) => cellText(row[0])),
    values: result.rows.map((row) => Number(row[numericIndex] ?? 0)),
    valueLabel: result.columns[numericIndex]!.label,
  };
}

/** Whether every card in a reply came back empty (a reply with only text). */
export function hasCards(cards: CompanionCard[] | undefined): boolean {
  return Boolean(cards && cards.length);
}
