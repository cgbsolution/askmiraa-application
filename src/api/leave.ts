/** Leave: balances, preview-then-apply, history, comp-off, holidays. */

import type {
  CompOffCreate,
  CompOffRead,
  HolidayRead,
  LeaveAttachmentRead,
  LeaveBalanceRead,
  LeavePreviewRead,
  LeaveRequestCreate,
  LeaveRequestRead,
  LeaveTypeRead,
  OptionalHolidaysRead,
  Page_LeaveRequestRead_,
  TeamBalancesRead,
  WhoIsOutRead,
} from '../core/types';
import { api, upload, type UploadFile } from '../lib/api';

export const leaveApi = {
  types: () => api<LeaveTypeRead[]>('/leave/types'),
  balances: (year?: number) => api<LeaveBalanceRead[]>('/leave/balances', { query: { year } }),
  /** The days a request would count, and any problem, before it is sent. */
  preview: (body: LeaveRequestCreate) => api<LeavePreviewRead>('/leave/requests/preview', { method: 'POST', body }),
  apply: (body: LeaveRequestCreate) => api<LeaveRequestRead>('/leave/requests', { method: 'POST', body }),
  requests: (query: { status?: string; page?: number; page_size?: number; employee_id?: string } = {}) =>
    api<Page_LeaveRequestRead_>('/leave/requests', { query: { page_size: 50, ...query } }),
  /** Requests waiting on the caller as an approver, with reason and balance. */
  approvals: () => api<LeaveRequestRead[]>('/leave/approvals'),
  cancel: (id: string) => api<LeaveRequestRead>(`/leave/requests/${id}/cancel`, { method: 'POST' }),
  attach: (file: UploadFile) => upload<LeaveAttachmentRead>('/leave/attachments', { file }),
  /** Balances for the people in my reporting line (managers) or everyone (HR). */
  teamBalances: (query: { q?: string; page_size?: number; year?: number } = {}) =>
    api<TeamBalancesRead>('/leave/balances/team', { query }),
  whoIsOut: (start: string, end: string, team?: boolean) =>
    api<WhoIsOutRead[]>('/leave/who-is-out', { query: { start, end, team } }),
  holidays: (year?: number) => api<HolidayRead[]>('/leave/holidays', { query: { year } }),
  optionalHolidays: (year?: number) => api<OptionalHolidaysRead>('/leave/optional-holidays', { query: { year } }),
  pickOptional: (id: string) => api<OptionalHolidaysRead>(`/leave/optional-holidays/${id}`, { method: 'POST' }),
  unpickOptional: (id: string) => api<OptionalHolidaysRead>(`/leave/optional-holidays/${id}`, { method: 'DELETE' }),
  compOffs: () => api<CompOffRead[]>('/leave/comp-off', { query: { mine: true } }),
  claimCompOff: (body: CompOffCreate) => api<CompOffRead>('/leave/comp-off', { method: 'POST', body }),
  cancelCompOff: (id: string) => api<CompOffRead>(`/leave/comp-off/${id}/cancel`, { method: 'POST' }),
};
