/** Home: the summary, quick links, celebrations. */

import type { CelebrationsRead, DashboardSummary } from '../core/types';
import { api } from '../lib/api';

export interface QuickLink {
  label: string;
  url: string;
}

export const dashboardApi = {
  summary: () => api<DashboardSummary>('/dashboard/summary'),
  quickLinks: () => api<{ links: QuickLink[] | null; [key: string]: unknown }>('/dashboard/quick-links'),
  saveQuickLinks: (links: QuickLink[]) =>
    api<{ links: QuickLink[] | null }>('/dashboard/quick-links', { method: 'PUT', body: { links } }),
  celebrations: (days = 30) => api<CelebrationsRead>('/employees/celebrations', { query: { days } }),
};
