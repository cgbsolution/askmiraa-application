/**
 * Response and request shapes.
 *
 * Everything the backend declares as a Pydantic schema is generated into
 * `api.gen.ts` from its own OpenAPI output (scripts/gen_api_types.py) and
 * re-exported here. Endpoints that return a plain `dict` have no schema to
 * generate from; their shapes are written below, each checked against the
 * service that builds it and against a real response from the QA API.
 *
 * Screens import from here, never redeclare a shape: a duplicated shape
 * drifts, and the drift shows up as a blank field on someone's payslip.
 */

export * from './api.gen.ts';

import type { CompanyBrand, TenantRead, UserRead } from './api.gen.ts';

// ── Session ──────────────────────────────────────────────────────────────────

/** GET /auth/session — who is signed in and what their workspace has switched on. */
export interface Session {
  user: UserRead;
  tenant: TenantRead;
  /** Their own company (legal entity): its name and logo, shown on Home. */
  company?: CompanyBrand | null;
}

export type ModuleKey =
  | 'core_hr'
  | 'leave'
  | 'payroll'
  | 'hiring'
  | 'culture'
  | 'rewards'
  | 'benefits'
  | 'analytics';

export type ProductKey = 'interview' | 'expense' | 'helpdesk';

// ── Ask Miraa (mirrors frontend/src/components/companion/types.ts exactly) ────

export type Sensitivity = 'public' | 'hr_only' | 'payroll_only';

export interface ResultColumn {
  key: string;
  label: string;
  data_type: string;
  aggregation: string | null;
  sensitivity: Sensitivity;
}

export interface ReportResult {
  run_id: string;
  columns: ResultColumn[];
  /** Positional: `rows[i][j]` is the value of `columns[j]`. */
  rows: unknown[][];
  total_rows: number;
  returned_rows: number;
  max_sensitivity: Sensitivity;
  row_scope: string;
  notes: string[];
  denied_fields: string[];
  duration_ms: number | null;
}

/** What the chat screen needs before it shows anything. */
export interface CompanionStatus {
  available: boolean;
  /** "ai": a model plans each turn. "direct": words are matched to a lookup here; nothing leaves AskMiraa. */
  mode: 'ai' | 'direct';
  /** Why a model is not planning, in direct mode. */
  reason: 'not_configured' | 'disabled' | 'no_consent' | null;
  /** What this workspace calls its companion. */
  name: string;
  greeting: string;
  tools: { key: string; title: string }[];
  /** Questions this person can ask, one per tool they have. */
  examples: string[];
  daily_limit: number;
  sent_today: number;
  can_configure: boolean;
}

export interface Citation {
  number: number;
  id: string;
  source: string;
  label: string;
  href: string | null;
}

/** What AskMiraa looked up and showed, as the person. Never sent to the model. */
export type CompanionCard =
  | { type: 'notice'; tone: 'info' | 'warning'; text: string }
  | {
      type: 'table';
      title: string;
      caption: string;
      columns: string[];
      rows: unknown[][];
      /** The linked product the rows were read from, when they came from one. */
      source?: string;
      /** Where to open that product: the portal's launch page. */
      open?: string;
      /** Per row: where to open that row in the product (a job's candidates, with résumés). */
      links?: (string | null)[];
      /** One page of a longer list on a portal page: which page, its size and the rows in all. */
      page?: { number: number; size: number; total: number };
    }
  | {
      type: 'policy';
      outcome: 'answered' | 'partially_answered' | 'refused' | 'withheld';
      answer: string;
      citations: Citation[];
      confidence_band: string | null;
      answered_from: 'policy' | 'your_record';
      open?: string;
    }
  | {
      type: 'report';
      interpretation: string;
      confidence_band: string;
      chart: 'number' | 'bar' | 'line' | 'table';
      answered: boolean;
      result: ReportResult | null;
      problem: string | null;
    }
  | { type: 'own_record'; text: string; open: string }
  | {
      type: 'record';
      title: string;
      subtitle: string;
      heading: string;
      figures: { label: string; value: string }[];
      table?: { columns: string[]; rows: unknown[][] };
      note: string;
      open?: string;
      open_label?: string;
    }
  | {
      type: 'choices';
      title: string;
      caption: string;
      options: { label: string; detail: string; text: string; tool: string; inputs: Record<string, string> }[];
    }
  | { type: 'launch'; product: string; name: string; href: string }
  | {
      /** A product not ready for the person: what is missing, and what they can do. */
      type: 'connect';
      product: string;
      brand: string;
      state: string;
      title: string;
      text: string;
      /** "connect": an admin can connect it (in the portal). "sync": an admin can sync people. */
      action: 'connect' | 'sync' | null;
    }
  | {
      /** A file the person attached, as AskMiraa read it. The file itself is not kept. */
      type: 'attachment';
      name: string;
      media: 'image' | 'pdf';
      size: number;
      pages: number;
      label: string;
      read: 'text' | 'picture' | 'none';
      note: string | null;
    }
  | {
      /** A figure drawn as a chart: one value per label on `x`, per series. */
      type: 'chart';
      title: string;
      caption: string;
      chart: 'line' | 'area' | 'bar' | 'stacked_bar' | 'horizontal_bar' | 'pie' | 'donut';
      /** "inr", "count", "number" or "percent". */
      unit: string;
      x: string[];
      series: { name: string; values: string[] }[];
    }
  | {
      /** Something Miraa offered to do; nothing happens until the person says yes. */
      type: 'proposal';
      action_id: string;
      kind: string;
      title: string;
      figures: { label: string; value: string }[];
      /** The lines of the offer (a claim's bills, an order's roles), when it has some. */
      table?: { columns: string[]; rows: unknown[][] };
      notes: string[];
      confirm_label: string;
      status: 'proposed' | 'done' | 'cancelled' | 'failed' | 'expired';
      result?: { text?: string; error?: boolean; open?: string } | null;
      /** Held for an approval elsewhere (a Won waiting in Saleinx): it can't be confirmed now. */
      waiting?: string;
    };

export interface CompanionMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tool: string | null;
  tool_title: string | null;
  arguments: Record<string, unknown> | null;
  cards: CompanionCard[];
  created_at: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string | null;
}

export interface ConversationDetail extends Conversation {
  messages: CompanionMessage[];
}

/** One turn's answer: the person's message as saved, and the reply. */
export interface Turn {
  conversation: Conversation;
  messages: [CompanionMessage, CompanionMessage];
}

/** POST /companion/messages body (`MessageIn`: text 1–2000 characters). */
export interface MessageIn {
  text: string;
  conversation_id?: string | null;
  /** This message's own id: sent again after a timeout, the first answer comes back. */
  client_ref?: string | null;
}

/** Confirm or Cancel pressed on an offer: its state now, and the line Miraa adds. */
export interface OfferDecision {
  action: Extract<CompanionCard, { type: 'proposal' }>;
  message: CompanionMessage;
}

export const MESSAGE_MAX_LENGTH = 2000;

// ── Notifications ────────────────────────────────────────────────────────────

/** One frame of GET /notifications/stream (server-sent events). */
export interface StreamNotification {
  id: string;
  event_key: string;
  subject: string | null;
  body: string;
  is_urgent: boolean;
  created_at: string;
}

// ── Performance ──────────────────────────────────────────────────────────────

/** One row of GET /appraisal/my (services/appraisal: my_appraisals). */
export interface MyAppraisal {
  appraisal_id: string;
  cycle_id: string;
  cycle_name: string;
  cycle_type: string;
  cycle_status: string;
  period_start: string;
  period_end: string;
  status: string;
  stage_label: string | null;
  stage_role: string | null;
  due_date: string | null;
  days_overdue: number;
  waiting_on_me: boolean;
  final_rating: string | null;
  acknowledged_at: string | null;
}
