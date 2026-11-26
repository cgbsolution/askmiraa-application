/** DPDP: the notice, consents, my data, my requests; and what AI may do to my record. */

import { api } from '../lib/api';

export interface ConsentPurpose {
  purpose: string;
  name: string;
  status: 'granted' | 'withdrawn' | 'declined' | 'not_asked' | 'not_applicable' | string;
  lawful_basis: string;
  lawful_basis_label: string;
  can_withdraw: boolean;
  is_permitted: boolean;
  decided_at: string | null;
  agreed_version: number | null;
  current_version: number;
  stops_if_withdrawn: string[];
  description?: string;
  /** What withdrawing deletes (DPDP s.8(7)(a)). */
  withdrawal_erases?: string[];
  /** What withdrawing does not delete, and why. */
  withdrawal_keeps?: string[];
}

export interface MyConsents {
  principal_id: string;
  purposes: ConsentPurpose[];
  capabilities_permitted: string[];
}

export interface NoticeItem {
  purpose: string;
  heading: string;
  body: string;
  lawful_basis: string;
  basis_explanation: string;
  data_used: string[];
  offers_a_choice: boolean;
  stops_if_declined: string[];
  sub_processors: string[];
}

export interface PrivacyNotice {
  notice_id: string;
  version: number;
  language: string;
  title: string;
  intro: string;
  choices: NoticeItem[];
  disclosures: NoticeItem[];
  rights_line: string;
  grievance_contact: string | null;
}

export interface DataRequest {
  id: string;
  type: 'access' | 'correction' | 'erasure' | 'grievance' | 'nomination' | string;
  status: string;
  details: string | null;
  received_at: string;
  due_by: string | null;
  responded_at: string | null;
  rejection_reason: string | null;
}

export interface ErasurePreview {
  summary: string;
  is_complete: boolean;
  purged_count: number;
  retained_count: number;
  decisions: {
    category: string;
    category_name: string;
    outcome: string;
    explanation: string;
    retained_until: string | null;
    statutory_reference: string | null;
  }[];
}

export interface MyDataExport {
  generated_at: string;
  sections: { category: string; name: string; what_this_is: string; why_we_hold_it: string; how_long: string; field_count: number }[];
}

export interface AutonomyAction {
  key: string;
  description: string;
  max_autonomy_label: string;
  is_protected: boolean;
  ceiling_reason: string;
  reversible: boolean;
  impact: string;
  configured_autonomy?: string;
}

export interface Transparency {
  permitted: AutonomyAction[];
  protected: AutonomyAction[];
  protected_statement: string;
  activity: Record<string, number>;
  not_built: string[];
}

export const privacyApi = {
  notice: (language = 'en') => api<PrivacyNotice>('/dpdp/me/notice', { query: { language } }),
  consents: () => api<MyConsents>('/dpdp/me/consent'),
  grant: (purposeKey: string, noticeId?: string) =>
    api<unknown>('/dpdp/me/consent', {
      method: 'POST',
      body: { purpose_key: purposeKey, granted: true, captured_via: 'self_service', notice_id: noticeId ?? null },
    }),
  withdraw: (purposeKey: string) => api<unknown>(`/dpdp/me/consent/${purposeKey}/withdraw`, { method: 'POST' }),
  requests: () => api<{ requests: DataRequest[] }>('/dpdp/me/requests'),
  raise: (requestType: string, details: string) =>
    api<unknown>('/dpdp/me/requests', { method: 'POST', body: { request_type: requestType, details: details || null } }),
  exportSummary: () => api<MyDataExport>('/dpdp/me/export'),
  erasurePreview: () => api<ErasurePreview>('/dpdp/me/erasure-preview'),
  transparency: () => api<Transparency>('/autonomy/transparency'),
};
