/** Growth: goals and check-ins, 1:1s, feedback, reviews, learning. */

import type {
  FeedbackForm,
  FeedbackInboxItem,
  FeedbackRequestDetail,
  FeedbackRequestSummary,
  FeedbackResponseSubmit,
  GoalCheckInCreate,
  GoalCheckInRead,
  GoalRead,
  OneOnOneDetail,
  OneOnOneItemCreate,
  OneOnOneItemUpdate,
  OneOnOneRead,
  PrivateFeedbackCreate,
  PrivateFeedbackRead,
  ReportOneOnOneSummary,
} from '../core/types';
import type { LearningAssignment, LearningCourse, LearningResult, MyReview, ReviewDetail, ReviewRatings, ScorePreview, TeamReview } from '../core/performance';
import { api } from '../lib/api';

export const growthApi = {
  goals: () => api<GoalRead[]>('/goals', { query: { scope: 'mine' } }),
  goal: (id: string) => api<GoalRead>(`/goals/${id}`),
  checkIns: (goalId: string) => api<GoalCheckInRead[]>(`/goals/${goalId}/check-ins`),
  checkIn: (goalId: string, body: GoalCheckInCreate) => api<GoalRead>(`/goals/${goalId}/check-ins`, { method: 'POST', body }),

  oneOnOnes: () => api<OneOnOneRead[]>('/one-on-ones'),
  oneOnOneReports: () => api<ReportOneOnOneSummary[]>('/one-on-ones/reports'),
  oneOnOne: (id: string) => api<OneOnOneDetail>(`/one-on-ones/${id}`),
  addItem: (id: string, body: OneOnOneItemCreate) => api<OneOnOneDetail>(`/one-on-ones/${id}/items`, { method: 'POST', body }),
  updateItem: (id: string, itemId: string, body: OneOnOneItemUpdate) =>
    api<OneOnOneDetail>(`/one-on-ones/${id}/items/${itemId}`, { method: 'PATCH', body }),
  writeNote: (id: string, body: string) => api<OneOnOneDetail>(`/one-on-ones/${id}/my-note`, { method: 'PUT', body: { body } }),

  feedbackAboutMe: () => api<FeedbackRequestSummary[]>('/feedback/requests'),
  feedbackRequest: (id: string) => api<FeedbackRequestDetail>(`/feedback/requests/${id}`),
  feedbackInbox: () => api<FeedbackInboxItem[]>('/feedback/inbox'),
  feedbackForm: (reviewerId: string) => api<FeedbackForm>(`/feedback/responses/${reviewerId}`),
  submitFeedback: (reviewerId: string, body: FeedbackResponseSubmit) =>
    api<FeedbackForm>(`/feedback/responses/${reviewerId}/submit`, { method: 'POST', body }),
  declineFeedback: (reviewerId: string, reason: string) =>
    api<FeedbackForm>(`/feedback/responses/${reviewerId}/decline`, { method: 'POST', body: { reason: reason || null } }),
  privateFeedback: () => api<PrivateFeedbackRead[]>('/feedback/private', { query: { scope: 'received' } }),
  givePrivateFeedback: (body: PrivateFeedbackCreate) => api<PrivateFeedbackRead>('/feedback/private', { method: 'POST', body }),

  myReviews: () => api<MyReview[]>('/appraisal/my'),
  review: (id: string) => api<ReviewDetail>(`/appraisal/appraisals/${id}`),
  scorePreview: (id: string, ratings: ReviewRatings) =>
    api<ScorePreview>(`/appraisal/appraisals/${id}/score-preview`, { method: 'POST', body: { ratings } }),
  saveReviewDraft: (id: string, ratings: ReviewRatings, comments: string | null) =>
    api<{ saved: boolean }>(`/appraisal/appraisals/${id}/draft`, { method: 'POST', body: { ratings, comments } }),
  submitReview: (id: string, ratings: ReviewRatings, comments: string | null) =>
    api<unknown>(`/appraisal/appraisals/${id}/submit`, { method: 'POST', body: { ratings, comments } }),
  returnReview: (id: string, targetStageId: string, reason: string) =>
    api<unknown>(`/appraisal/appraisals/${id}/return`, { method: 'POST', body: { target_stage_id: targetStageId, reason } }),
  teamReviews: () => api<TeamReview[]>('/appraisal/team'),
  acknowledgeReview: (id: string, acknowledgement: 'agreed' | 'disagreed', objection: string | null) =>
    api<unknown>(`/appraisal/appraisals/${id}/acknowledge`, { method: 'POST', body: { acknowledgement, objection } }),

  learning: () => api<LearningAssignment[]>('/learning/me'),
  course: (id: string) => api<LearningCourse>(`/learning/me/${id}`),
  completeCourse: (id: string, answers: number[]) =>
    api<LearningResult>(`/learning/me/${id}/complete`, { method: 'POST', body: { answers } }),
  certificatePath: (id: string) => `/learning/assignments/${id}/certificate`,
};
