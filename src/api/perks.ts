/** Loans and salary advances, flexi benefits, earned wage access, insurance, stock options. */

import type { LoanDetailRead, LoanRead, OwnLoanApply, SchemeRead } from '../core/types';
import { api } from '../lib/api';

export interface FlexiDeclaration {
  id: string | null;
  financial_year: string | null;
  pot: string;
  declared: string;
  undeclared: string;
  status: 'none' | 'draft' | 'submitted' | 'approved' | 'returned' | string;
  decision_note: string | null;
  components: { code: string; name: string; limit: string; amount: string }[];
  note: string;
}

export interface EwaPosition {
  enabled: boolean;
  monthly_gross: string;
  days_paid_so_far: string;
  days_in_month: number;
  basis: string;
  earned_to_date: string;
  max_percent: string;
  already_drawn: string;
  available: string;
  min_amount: string;
  requests_left: number;
}

export interface EwaRequest {
  id: string;
  /** "2026-10": the month it is recovered from. */
  period: string;
  amount: string;
  status: string;
  requested_at?: string;
  created_at?: string;
  decision_note?: string | null;
  [key: string]: unknown;
}

export interface BenefitMember {
  name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'parent_in_law';
  date_of_birth?: string | null;
  gender?: 'female' | 'male' | 'non_binary' | 'undisclosed' | null;
}

export interface MyBenefit {
  plan: {
    id: string;
    name: string;
    kind: string;
    insurer: string;
    tpa: string | null;
    policy_number: string | null;
    policy_start: string;
    policy_end: string;
    sum_insured: string;
    covers: BenefitMember['relationship'][];
    max_children: number | null;
    top_ups: { code: string; name: string; sum_insured: string; employee_premium_annual: string }[];
    enrolment_opens: string | null;
    enrolment_closes: string | null;
    life_event_window_days: number;
  };
  enrolment: {
    id: string;
    status: string;
    members: BenefitMember[];
    top_up_code: string | null;
    employee_premium_annual: string;
    effective_from: string;
  } | null;
  window_open: boolean;
}

export interface EsopGrant {
  id: string;
  plan: string;
  instrument: string;
  grant_date: string;
  units: number;
  exercise_price: string;
  status: string;
  vested: number;
  exercised: number;
  exercisable: number;
  unvested: number;
  schedule: { date: string; units: number; vested: boolean }[];
  fmv_per_unit: string | null;
  fmv_from: string | null;
  value_vested_unexercised: string | null;
  value_unvested: string | null;
}

export interface EsopProjection {
  price_per_unit: string;
  value_now: string;
  value_when_fully_vested: string;
  timeline: { date: string; value: string }[];
}

export const perksApi = {
  schemes: () => api<SchemeRead[]>('/loans/schemes'),
  myLoans: () => api<LoanRead[]>('/loans/mine'),
  loan: (id: string) => api<LoanDetailRead>(`/loans/${id}`),
  applyLoan: (body: OwnLoanApply) => api<LoanRead>('/loans/mine', { method: 'POST', body }),

  flexi: (fyLong: string) => api<FlexiDeclaration>('/reimbursements/flexi/me', { query: { financial_year: fyLong } }),
  declareFlexi: (fyLong: string, allocations: Record<string, string>, submit: boolean) =>
    api<FlexiDeclaration>('/reimbursements/flexi/me', { method: 'PUT', body: { financial_year: fyLong, allocations, submit } }),

  ewa: () => api<EwaPosition>('/ewa/me'),
  ewaRequests: () => api<EwaRequest[]>('/ewa/requests'),
  requestEwa: (amount: string) => api<EwaRequest>('/ewa/requests', { method: 'POST', body: { amount } }),

  benefits: () => api<MyBenefit[]>('/benefits/me'),
  enrol: (planId: string, body: { waive?: boolean; members: BenefitMember[]; top_up_code?: string | null }) =>
    api<unknown>(`/benefits/plans/${planId}/enrol`, { method: 'POST', body }),

  esop: () => api<{ as_of: string; grants: EsopGrant[] }>('/esop/me'),
  esopProjection: (price: string) => api<EsopProjection>('/esop/me/projection', { query: { price_per_unit: price } }),
};
