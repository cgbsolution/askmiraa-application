/** My onboarding, tasks assigned to me, exit clearance tasks. */

import type { ClearanceTaskRead, MyTaskRead, OnboardingMe, OnboardingSummary, TaskRead } from '../core/types';
import { api } from '../lib/api';

export const onboardingApi = {
  me: () => api<OnboardingMe>('/onboarding/me'),
  summary: () => api<OnboardingSummary>('/onboarding/me/summary'),
  myTasks: (includeDone = false) => api<MyTaskRead[]>('/onboarding/my-tasks', { query: { include_done: includeDone } }),
  complete: (id: string, note?: string) =>
    api<TaskRead>(`/onboarding/tasks/${id}/complete`, { method: 'POST', body: { note: note ?? null } }),
  clearanceMine: () => api<ClearanceTaskRead[]>('/exits/clearance/mine'),
};
