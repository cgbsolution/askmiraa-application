/** Company documents, my assets, my reviews, feedback asked of me, tax windows. */

import type {
  CompanyDocumentRead,
  FeedbackInboxItem,
  MyAssetsRead,
  MyAppraisal,
  WindowRead,
} from '../core/types';
import { api } from '../lib/api';

export const workplaceApi = {
  companyDocuments: () => api<CompanyDocumentRead[]>('/documents/company'),
  myAssets: () => api<MyAssetsRead>('/assets/me'),
  myAppraisals: () => api<MyAppraisal[]>('/appraisal/my'),
  feedbackInbox: () => api<FeedbackInboxItem[]>('/feedback/inbox'),
  taxWindows: () => api<WindowRead[]>('/tax/windows'),
};
