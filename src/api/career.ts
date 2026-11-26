/** Reward points, referrals, interviews I am on the panel of, resignation. */

import type { ExitRead } from '../core/types';
import { api } from '../lib/api';

export interface RewardsStatement {
  balance_points: number;
  balance_rupees: string;
  rows: { entry_id: string; type: string; points: number; value: string; occurred_at: string; balance_after: number }[];
  expiring: { points: number; expires_on: string }[];
  expiry_disclosure: string | null;
  tax?: { financial_year: string; total_value: string; taxable_value: string; [key: string]: unknown };
}

export interface OpenRole {
  id: string;
  code: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  experience_min_years: number | null;
  experience_max_years: number | null;
  open_vacancies: number;
  posted_on: string;
}

export interface ReferralProgramme {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  bonus_by_grade: Record<string, string>;
  milestones: { key: string; label: string; share_percent: string; days_after_joining: number }[];
}

export interface MyReferral {
  id: string;
  candidate: string;
  requisition_code: string | null;
  requisition_title: string | null;
  status: string;
  submitted_at: string;
  duplicate_note: string | null;
  ineligibility_reason: string | null;
  bonus_amount: string | null;
  hired_on: string | null;
  payouts: { label?: string; amount?: string; status?: string; due_on?: string; paid_on?: string | null; [key: string]: unknown }[];
}

export interface MyInterview {
  id: string;
  candidate_name: string;
  requisition_code: string | null;
  requisition_title: string | null;
  stage_name?: string;
  stage?: { name: string; stage_type: string; duration_minutes: number; required_competencies: string[]; feedback_required: boolean; preparation_notes: string | null };
  scheduled_start: string;
  scheduled_end: string;
  mode: string;
  location_or_link: string | null;
  status: string;
  panel: { user_id: string; name: string; role: string; response: string; feedback_submitted: boolean }[];
  my_role: string | null;
  my_response?: string;
  my_feedback_submitted: boolean;
}

export interface InterviewFeedback {
  feedback: { panelist: string; recommendation: string; ratings: Record<string, string>; strengths: string; concerns: string; submitted_at: string; is_mine: boolean }[];
  withheld_count: number;
  withheld_note: string;
}

export type Recommendation = 'strong_yes' | 'yes' | 'no' | 'strong_no';

export const careerApi = {
  rewards: () => api<RewardsStatement>('/rewards/me/statement'),

  openRoles: () => api<OpenRole[]>('/recruiting/open-roles'),
  programmes: () => api<ReferralProgramme[]>('/recruiting/referral-programmes'),
  myReferrals: () => api<MyReferral[]>('/recruiting/my-referrals'),
  refer: (body: {
    programme_id: string;
    requisition_id: string;
    candidate_name: string;
    candidate_email: string;
    candidate_phone?: string | null;
    note?: string | null;
  }) => api<Record<string, unknown>>('/recruiting/refer', { method: 'POST', body }),

  myInterviews: () => api<MyInterview[]>('/interviews/mine'),
  interview: (id: string) => api<MyInterview>(`/interviews/${id}`),
  interviewFeedback: (id: string) => api<InterviewFeedback>(`/interviews/${id}/feedback`),
  respond: (id: string, panelistUserId: string, response: 'accepted' | 'tentative' | 'declined') =>
    api<unknown>(`/interviews/${id}/response`, { method: 'POST', body: { panelist_user_id: panelistUserId, response } }),
  giveInterviewFeedback: (id: string, body: { recommendation: Recommendation; ratings: Record<string, string>; strengths: string; concerns: string }) =>
    api<unknown>(`/interviews/${id}/feedback`, { method: 'POST', body }),

  myExit: () => api<ExitRead | null>('/exits/mine'),
  resign: (body: { reason: string; requested_last_working_day?: string | null; comments?: string | null }) =>
    api<ExitRead>('/exits/resign', { method: 'POST', body }),
  withdrawResignation: (id: string, reason: string) => api<ExitRead>(`/exits/${id}/withdraw`, { method: 'POST', body: { reason } }),
};
