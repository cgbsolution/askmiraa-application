/** My assets: what I hold, acknowledging receipt, and asking for something. */

import type { AssetCategoryRead, AssetRequestRead, AssetsAssignmentRead, MyAssetsRead } from '../core/types';
import { api } from '../lib/api';

export const assetsApi = {
  mine: () => api<MyAssetsRead>('/assets/me'),
  acknowledge: (assignmentId: string) =>
    api<AssetsAssignmentRead>(`/assets/assignments/${assignmentId}/acknowledge`, { method: 'POST' }),
  categories: () => api<AssetCategoryRead[]>('/assets/categories'),
  requests: () => api<AssetRequestRead[]>('/assets/requests', { query: { scope: 'mine' } }),
  request: (body: { category_id: string; reason: string; needed_by?: string | null }) =>
    api<AssetRequestRead>('/assets/requests', { method: 'POST', body }),
  cancelRequest: (id: string) => api<AssetRequestRead>(`/assets/requests/${id}/cancel`, { method: 'POST' }),
};
