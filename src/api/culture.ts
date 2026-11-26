/** Culture: announcements, shoutouts and reactions, values, clubs, polls, events, surveys, awards. */

import type {
  AnnouncementRead,
  AwardResultRead,
  ClubRead,
  CompanyValueRead,
  MySurveyRead,
  Page_ShoutoutRead_,
  ReactionSummary,
  ShoutoutCreate,
  ShoutoutRead,
  SurveyResponseCreate,
} from '../core/types';
import { api } from '../lib/api';

export interface Poll {
  id: string;
  question: string;
  options: string[];
  is_anonymous: boolean;
  closes_at: string | null;
  is_open: boolean;
  responses: number;
  your_vote: number | null;
  results: number[] | null;
  results_note: string | null;
}

export interface CompanyEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  capacity: number | null;
  rsvp_by: string | null;
  cancelled: boolean;
  going: number;
  maybe: number;
  not_going: number;
  is_full: boolean;
  your_response: 'going' | 'maybe' | 'not_going' | null;
}

export interface ClubPost {
  id: string;
  club_id: string;
  author_name: string;
  body: string;
  created_at: string | null;
  mine: boolean;
}

export interface SurveyItem {
  key: string;
  text: string;
  theme?: string;
}

export interface SurveyInstrument {
  key: string;
  name: string;
  scale: 'zero_to_ten' | 'likert_5' | string;
  bounds: [number, number];
  items: SurveyItem[];
}

/** The emoji a shoutout can be reacted with (the server refuses any other). */
export const REACTIONS = ['👏', '❤️', '🎉', '🙌', '🚀', '😄'] as const;

export const cultureApi = {
  announcements: () => api<AnnouncementRead[]>('/culture/announcements'),
  acknowledgeAnnouncement: (id: string) =>
    api<AnnouncementRead>(`/culture/announcements/${id}/acknowledge`, { method: 'POST', body: {} }),
  mySurveys: () => api<MySurveyRead[]>('/culture/surveys/mine'),
  answerSurvey: (id: string, body: SurveyResponseCreate) => api<unknown>(`/culture/surveys/${id}/responses`, { method: 'POST', body }),

  shoutouts: (page = 1) => api<Page_ShoutoutRead_>('/culture/shoutouts', { query: { page, page_size: 20 } }),
  giveShoutout: (body: ShoutoutCreate) => api<ShoutoutRead>('/culture/shoutouts', { method: 'POST', body }),
  react: (id: string, emoji: string, active: boolean) =>
    api<ReactionSummary[]>(`/culture/shoutouts/${id}/reactions`, { method: 'PUT', body: { emoji, active } }),
  draftShoutout: (body: { to_employee_id: string; notes: string; value_code?: string | null }) =>
    api<{ message?: string; draft?: string; [key: string]: unknown }>('/culture/shoutouts/draft', { method: 'POST', body, timeoutMs: 60_000 }),
  values: () => api<CompanyValueRead[]>('/culture/values'),

  clubs: () => api<ClubRead[]>('/culture/clubs'),
  joinClub: (id: string) => api<ClubRead>(`/culture/clubs/${id}/join`, { method: 'POST' }),
  leaveClub: (id: string) => api<ClubRead | null>(`/culture/clubs/${id}/leave`, { method: 'POST' }),
  clubPosts: (id: string) => api<ClubPost[]>(`/culture/clubs/${id}/posts`),
  postInClub: (id: string, body: string) => api<ClubPost>(`/culture/clubs/${id}/posts`, { method: 'POST', body: { body } }),

  polls: () => api<Poll[]>('/culture/polls'),
  vote: (id: string, optionIndex: number) => api<Poll>(`/culture/polls/${id}/vote`, { method: 'POST', body: { option_index: optionIndex } }),

  events: () => api<CompanyEvent[]>('/culture/events'),
  rsvp: (id: string, response: 'going' | 'maybe' | 'not_going') =>
    api<CompanyEvent>(`/culture/events/${id}/rsvp`, { method: 'POST', body: { response } }),

  awards: () => api<AwardResultRead[]>('/culture/award-results'),
};
