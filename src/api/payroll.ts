/** My pay: payslips, salary structure, total rewards, PDF protection. */

import type { PayslipRead, PayslipSummaryRead, SalaryRecordRead } from '../core/types';
import { api } from '../lib/api';

export const payrollApi = {
  payslips: () => api<PayslipSummaryRead[]>('/payroll/my-payslips'),
  payslip: (id: string) => api<PayslipRead>(`/payroll/my-payslips/${id}`),
  pdfPath: (id: string) => `/payroll/my-payslips/${id}/pdf`,
  protection: () => api<{ enabled: boolean; rule: string }>('/payroll/payslip-protection'),
  salary: () => api<SalaryRecordRead[]>('/payroll/my-salary'),
  totalRewards: () => api<Record<string, unknown>>('/payroll/my-total-rewards'),
};
