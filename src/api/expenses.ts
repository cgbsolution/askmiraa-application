/** Expenses: claims (capture, verdict, submit), receipts, advances, travel requests. */

import type {
  AdvanceRead,
  ClaimIn,
  ExpenseMeta,
  ExpensesClaimRead,
  ReceiptRead,
  SubmitIn,
  TravelRequestIn,
  TravelRequestRead,
} from '../core/types';
import { api, upload, type UploadFile } from '../lib/api';

/** The policy verdict a claim is given at capture (services/expenses/policy.py). */
export interface PolicyVerdict {
  kind: 'within_policy' | 'needs_justification' | 'flagged' | 'blocked' | 'receipt_required' | 'pre_approval_required' | string;
  permits_submission: boolean;
  is_violation: boolean;
  limit_amount: string | null;
  already_claimed: string;
  this_claim: string;
  overage: string;
  message: string;
}

/** POST /expenses/claims: the claim is captured and judged in one call. */
export interface CaptureResult {
  claim_id: string;
  status: string;
  amount: string;
  original_amount: string;
  original_currency: string;
  verdict: PolicyVerdict;
  may_submit: boolean;
}

export const expensesApi = {
  meta: () => api<ExpenseMeta>('/expenses/meta'),
  claims: (status?: string) =>
    api<ExpensesClaimRead[]>('/expenses/claims', { query: { scope: 'mine', status_filter: status } }),
  claim: (id: string) => api<ExpensesClaimRead>(`/expenses/claims/${id}`),
  capture: (body: ClaimIn) => api<CaptureResult>('/expenses/claims', { method: 'POST', body }),
  submit: (id: string, body: SubmitIn) =>
    api<{ claim_id: string; status: string }>(`/expenses/claims/${id}/submit`, { method: 'POST', body }),
  cancel: (id: string) => api<ExpensesClaimRead>(`/expenses/claims/${id}/cancel`, { method: 'POST' }),
  uploadReceipt: (file: UploadFile) => upload<ReceiptRead>('/expenses/receipts', { file }),
  receiptPath: (id: string) => `/expenses/receipts/${id}`,
  advances: () => api<AdvanceRead[]>('/expenses/advances', { query: { scope: 'mine' } }),
  travel: () => api<TravelRequestRead[]>('/expenses/travel-requests', { query: { scope: 'mine' } }),
  requestTravel: (body: TravelRequestIn) =>
    api<TravelRequestRead>('/expenses/travel-requests', { method: 'POST', body }),
  cancelTravel: (id: string) =>
    api<TravelRequestRead>(`/expenses/travel-requests/${id}/cancel`, { method: 'POST' }),
};
