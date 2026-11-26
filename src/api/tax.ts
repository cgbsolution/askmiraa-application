/** Tax: regime, comparison, declarations and proofs, HRA, previous employer, projection, Form 12BB, Form 16. */

import type {
  DeclarationRead,
  DeclarationUpsert,
  HouseRentRead,
  HouseRentUpsert,
  IssuedDocumentRead,
  PreviousEmployerRead,
  PreviousEmployerUpsert,
  ProofRead,
  RegimeElectionResponse,
  RegimeRead,
  WindowRead,
} from '../core/types';
import { api, upload, type UploadFile } from '../lib/api';

export interface RegimeFigures {
  regime: 'old' | 'new';
  gross_annual_income: string;
  total_exemptions: string;
  total_deductions: string;
  taxable_income: string;
  tax_before_rebate: string;
  rebate: string;
  surcharge: string;
  cess: string;
  annual_tax_liability: string;
  slabs: { from: string; to: string | null; rate: string; tax: string }[];
  deductions: { code?: string; label?: string; section?: string; amount: string; [key: string]: unknown }[];
  pending_if_unclaimed: { code: string; label: string; amount: string; basis: string }[];
  notes: string[];
}

export interface RegimeComparison {
  regimes: { old: RegimeFigures; new: RegimeFigures };
  lower_liability_regime: 'old' | 'new';
  saving: string;
  note: string;
}

export interface Form16Year {
  financial_year: string;
  assessment_year: string;
  available: boolean;
  reason: string | null;
  taxable_income: string | null;
  tax_payable: string | null;
  tds_deducted: string | null;
}

export const taxApi = {
  windows: (fy?: string) => api<WindowRead[]>('/tax/windows', { query: { financial_year: fy } }),
  regime: (fy: string) => api<RegimeRead | null>('/tax/regime', { query: { financial_year: fy } }),
  chooseRegime: (fy: string, regime: 'old' | 'new') =>
    api<RegimeElectionResponse>('/tax/regime', { method: 'POST', body: { financial_year: fy, regime } }),
  compare: (fy: string) => api<RegimeComparison>('/tax/regime/compare', { query: { financial_year: fy } }),
  declarations: (fy: string) => api<DeclarationRead[]>('/tax/declarations', { query: { financial_year: fy } }),
  saveDeclaration: (body: DeclarationUpsert) => api<DeclarationRead>('/tax/declarations', { method: 'PUT', body }),
  submitDeclaration: (id: string) => api<DeclarationRead>(`/tax/declarations/${id}/submit`, { method: 'POST' }),
  uploadProof: (declarationId: string, amount: string, file: UploadFile) =>
    upload<ProofRead>('/tax/proofs', { declaration_id: declarationId, proof_amount: amount, file }),
  proofPath: (proofId: string) => `/tax/proofs/${proofId}/document`,
  houseRent: (fy: string) => api<HouseRentRead | null>('/tax/house-rent', { query: { financial_year: fy } }),
  saveHouseRent: (body: HouseRentUpsert) => api<HouseRentRead>('/tax/house-rent', { method: 'PUT', body }),
  previousEmployer: (fy: string) =>
    api<PreviousEmployerRead | null>('/tax/previous-employer', { query: { financial_year: fy } }),
  savePreviousEmployer: (body: PreviousEmployerUpsert) =>
    api<PreviousEmployerRead>('/tax/previous-employer', { method: 'PUT', body }),
  projection: (fy: string) => api<Record<string, unknown>>('/tax/projection', { query: { financial_year: fy } }),
  form12bbDocuments: (fy: string) => api<IssuedDocumentRead[]>('/tax/form-12bb/documents', { query: { financial_year: fy } }),
  form12bbPdfPath: (letterId: string) => `/tax/form-12bb/${letterId}/pdf`,
  form16: () => api<Form16Year[]>('/tax/form-16'),
  form16Path: (fy: string) => `/tax/form-16/pdf?financial_year=${encodeURIComponent(fy)}`,
};
