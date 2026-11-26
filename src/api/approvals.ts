/** The unified approvals inbox and decisions on each source's own route. */

import type { DecisionRequest } from '../core/approvals';
import type { ApprovalInboxRead } from '../core/types';
import { api } from '../lib/api';

export const approvalsApi = {
  inbox: () => api<ApprovalInboxRead>('/approvals'),
  count: () => api<Record<string, number>>('/approvals/count'),
  /** Send a decision built by core/approvals.ts. Online only: never queued. */
  decide: (request: DecisionRequest) => api<unknown>(request.path, { method: request.method, body: request.body }),
};
