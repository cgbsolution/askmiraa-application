/**
 * Performance shapes: reviews, the self-review form, learning.
 *
 * Mirrors `frontend/src/lib/types/performance.ts` (itself mirroring
 * `services/appraisal/review.py`'s dict payloads). Scores, weights and ratings
 * arrive as decimal strings and stay strings.
 */

export type StageRole = 'self' | 'manager' | 'reviewer' | 'hr' | 'normalisation';
export type AppraisalStatus = 'not_started' | 'in_progress' | 'submitted' | 'returned' | 'completed' | 'released' | 'acknowledged';
export type StageState = 'done' | 'current' | 'upcoming' | 'skipped';

export interface MyReview {
  appraisal_id: string;
  cycle_id: string;
  cycle_name: string;
  cycle_type: string;
  cycle_status: string;
  period_start: string;
  period_end: string;
  status: AppraisalStatus;
  stage_label: string | null;
  stage_role: StageRole | null;
  due_date: string | null;
  days_overdue: number;
  waiting_on_me: boolean;
  final_rating: string | null;
  acknowledged_at: string | null;
}

/** A review in a manager's team list (`GET /appraisal/team`). */
export interface TeamReview {
  appraisal_id: string;
  cycle_name: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  manager_name: string | null;
  status: AppraisalStatus;
  stage_label: string | null;
  stage_role: StageRole | null;
  due_date: string | null;
  days_overdue: number;
  awaiting_me: boolean;
  final_rating: string | null;
}

export interface Evidence {
  competency_code: string;
  competency_name: string;
  has_evidence: boolean;
  recognition_count: number;
  distinct_recognisers: number;
  items: { recognition_id: string; value_code: string; from_name: string; message: string; given_on: string }[];
  note: string;
}

export interface ScaleLevel {
  value: string;
  label: string;
  description: string;
}

export interface ReviewCompetency {
  competency_id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  weight: string;
  is_mandatory: boolean;
  indicators: { scale_value: string; behaviour: string }[];
  evidence: Evidence | null;
}

export interface ReviewValue {
  code: string;
  name: string;
  description: string;
  evidence: Evidence;
}

export interface CompetencyRatingInput {
  competency_id: string;
  rating: string | null;
  is_applicable: boolean;
  not_applicable_reason?: string | null;
  comment?: string | null;
}

export interface ValueRatingInput {
  value_code: string;
  rating: string | null;
  comment?: string | null;
}

export interface ReviewRatings {
  competencies?: CompetencyRatingInput[];
  values?: ValueRatingInput[];
  goals?: { goal_id: string; comment: string }[];
}

export interface ReviewEntry {
  id: string;
  stage_id: string;
  stage_label: string;
  stage_role: StageRole;
  actor_name: string | null;
  ratings: ReviewRatings;
  comments: string | null;
  score: string | null;
  submitted_at: string | null;
  returned_to_label: string | null;
  returned_reason: string | null;
}

export interface GoalContribution {
  goal_id: string;
  title: string;
  status: string;
  weight: string;
  progress: string;
  share_of_score: string | null;
}

export interface ReviewDetail {
  appraisal: {
    id: string;
    cycle_name: string;
    period_start: string;
    period_end: string;
    employee_name: string;
    manager_name: string | null;
    status: AppraisalStatus;
    current_stage_label: string | null;
    current_stage_role: StageRole | null;
    employee_id?: string;
    designation?: string | null;
    due_date: string | null;
    days_overdue: number;
    released_at: string | null;
    acknowledged_at: string | null;
    acknowledgement_type: 'agreed' | 'disagreed' | null;
    objection: string | null;
  };
  stages: { id: string; sequence: number; role: StageRole; label: string; due_date: string | null; state: StageState }[];
  viewer: {
    is_subject: boolean;
    can_act: boolean;
    act_reason: string | null;
    can_acknowledge: boolean;
    /** Earlier steps this viewer may send the review back to. */
    return_targets?: { id: string; label: string }[];
  };
  template: {
    goal_weight: string;
    competency_weight: string;
    values_weight: string;
    scale: { name: string; min_value: string; max_value: string; allow_decimals: boolean; levels: ScaleLevel[] } | null;
  } | null;
  competencies: ReviewCompetency[];
  values: ReviewValue[];
  goals: { score: string | null; contributing: GoalContribution[]; notes: string[] };
  entries: ReviewEntry[];
  draft: { ratings: ReviewRatings; comments: string | null } | null;
  outcome: { final_rating: string | null; final_score: string | null; calibrated: boolean | null } | null;
}

export interface ScorePreview {
  score: string | null;
  rating: { label: string; description: string | null } | null;
  problems: string[];
}

export interface LearningAssignment {
  id: string;
  course_id: string;
  course: string;
  kind: string;
  due_on: string;
  status: string;
  overdue: boolean;
  attempts: number;
  score: number | null;
  completed_at: string | null;
  expires_on: string | null;
  expired: boolean;
  certificate_number: string | null;
}

export interface LearningCourse extends LearningAssignment {
  content: {
    title: string;
    description: string | null;
    modules: { title: string; body: string | null; url: string | null }[];
    quiz: { question: string; options: string[] }[];
    pass_mark: number;
  };
}

export interface LearningResult extends LearningAssignment {
  passed: boolean;
  pass_mark: number;
}

/** Whether a self review is ready to send: every mandatory competency rated. */
export function selfReviewGaps(competencies: ReviewCompetency[], ratings: Record<string, CompetencyRatingInput>): string[] {
  return competencies
    .filter((c) => c.is_mandatory)
    .filter((c) => {
      const r = ratings[c.competency_id];
      return !r || (r.is_applicable && r.rating === null);
    })
    .map((c) => c.name);
}

/** The ratings a review form sends: only what was rated (or marked not applicable). */
export function ratingsPayload(
  competencies: Record<string, CompetencyRatingInput>,
  values: Record<string, ValueRatingInput>,
  usesValues: boolean,
): ReviewRatings {
  return {
    competencies: Object.values(competencies).filter((r) => r.rating !== null || !r.is_applicable),
    values: usesValues ? Object.values(values).filter((r) => r.rating !== null) : [],
  };
}

/** The steps a person can fill in from the phone. HR sign-off and calibration stay on the web. */
export const RATEABLE_STAGES: StageRole[] = ['self', 'manager', 'reviewer'];

/** Whether this viewer can fill in the step the review is at, here. */
export function canRateHere(detail: Pick<ReviewDetail, 'viewer' | 'appraisal'>): boolean {
  const role = detail.appraisal.current_stage_role;
  return detail.viewer.can_act && role !== null && RATEABLE_STAGES.includes(role);
}

/**
 * What is still unrated before this step can be sent.
 *
 * Self: the mandatory competencies (the rest are optional).
 * Manager: every competency that applies, because the server computes the
 * score from the manager's ratings and refuses a partial set.
 * Reviewer: nothing at all (an empty review carries the earlier score
 * forward), but once they rate anything the set must be complete.
 */
export function reviewGaps(
  role: StageRole,
  competencies: ReviewCompetency[],
  ratings: Record<string, CompetencyRatingInput>,
): string[] {
  const unrated = (c: ReviewCompetency) => {
    const r = ratings[c.competency_id];
    return !r || (r.is_applicable && r.rating === null);
  };
  if (role === 'self') return competencies.filter((c) => c.is_mandatory).filter(unrated).map((c) => c.name);
  if (role === 'reviewer') {
    const anyRated = competencies.some((c) => !unrated(c));
    if (!anyRated) return [];
  }
  return competencies.filter(unrated).map((c) => c.name);
}

/** The rating someone gave a competency at an earlier step, for the next person to see. */
export function earlierRating(entries: ReviewEntry[], role: StageRole, competencyId: string): string | null {
  const entry = [...entries].reverse().find((e) => e.stage_role === role && e.submitted_at);
  const r = entry?.ratings.competencies?.find((c) => c.competency_id === competencyId);
  if (!r) return null;
  return r.is_applicable ? r.rating : 'n/a';
}
