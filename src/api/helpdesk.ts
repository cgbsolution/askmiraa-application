/** Helpdesk: my tickets, raising one, the conversation, reopen, rate, cancel. */

import type { HelpdeskCategoryRead, MySummary, TicketDetail, TicketSummary } from '../core/types';
import { api, upload, type UploadFile } from '../lib/api';

export const helpdeskApi = {
  categories: () => api<HelpdeskCategoryRead[]>('/helpdesk/categories'),
  summary: () => api<MySummary>('/helpdesk/me/summary'),
  mine: (status?: string) => api<TicketSummary[]>('/helpdesk/tickets/mine', { query: { status } }),
  ticket: (id: string) => api<TicketDetail>(`/helpdesk/tickets/${id}`),
  create: (
    body: { category_id: string; subject: string; description: string; priority: string },
    file?: UploadFile | null,
  ) => upload<TicketSummary>('/helpdesk/tickets', { ...body, file: file ?? undefined }),
  comment: (id: string, body: string, file?: UploadFile | null) =>
    upload<TicketDetail>(`/helpdesk/tickets/${id}/comments`, { body, file: file ?? undefined }),
  reopen: (id: string, reason: string) =>
    api<TicketDetail>(`/helpdesk/tickets/${id}/reopen`, { method: 'POST', body: { reason } }),
  rate: (id: string, rating: number, comment?: string) =>
    api<TicketDetail>(`/helpdesk/tickets/${id}/rate`, { method: 'POST', body: { rating, comment: comment || null } }),
  cancel: (id: string, reason?: string) =>
    api<TicketDetail>(`/helpdesk/tickets/${id}/cancel`, { method: 'POST', body: { reason: reason || null } }),
  attachmentPath: (id: string) => `/helpdesk/attachments/${id}`,
};
