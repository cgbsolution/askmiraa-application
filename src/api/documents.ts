/** My documents, company policies (acknowledge), letters (read, acknowledge, verify). */

import type { CompanyDocumentRead, DocumentRead, DocumentsCategoryRead, LetterRead } from '../core/types';
import { api, upload, type UploadFile } from '../lib/api';

export const documentsApi = {
  /** Always pass your own employee id: for HR the bare list is everybody's. */
  mine: (employeeId: string) => api<DocumentRead[]>('/documents', { query: { employee_id: employeeId } }),
  selfUploadCategories: () => api<DocumentsCategoryRead[]>('/documents/categories/self-upload'),
  uploadMine: (
    fields: { category: string; title: string; document_number?: string; issued_on?: string; valid_until?: string; remark?: string; dependant_name?: string },
    file: UploadFile,
  ) => upload<DocumentRead>('/documents/mine', { ...fields, file }),
  downloadPath: (id: string) => `/documents/${id}/download`,
  company: () => api<CompanyDocumentRead[]>('/documents/company'),
  companyPath: (id: string) => `/documents/company/${id}/download`,
  acknowledgeCompany: (id: string, typedName: string) =>
    api<CompanyDocumentRead>(`/documents/company/${id}/acknowledge`, { method: 'POST', body: { typed_name: typedName } }),
  /** Always pass your own employee id: for HR the bare list is every letter. */
  letters: (employeeId: string) => api<LetterRead[]>('/letters', { query: { employee_id: employeeId } }),
  letterPdfPath: (id: string) => `/letters/${id}/pdf`,
  acknowledgeLetter: (id: string, typedName: string, accept: boolean) =>
    api<LetterRead>(`/letters/${id}/acknowledge`, { method: 'POST', body: { typed_name: typedName, accept } }),
  verifyLetter: (id: string) => api<{ reference_number: string; content_hash: string; intact: boolean }>(`/letters/${id}/verify`),
};
