/** My weekly timesheet. */

import { api } from '../lib/api';

/** One line of a week, as services/timesheets.py builds it. */
export interface TimesheetEntry {
  id: string;
  work_date: string;
  project_id: string | null;
  project: string | null;
  task_id: string | null;
  task: string | null;
  hours: string;
  description: string | null;
}

export interface TimesheetWeek {
  id: string | null;
  employee_id: string;
  week_start: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | string;
  decision_note: string | null;
  approval_chain: unknown[];
  total_hours: string;
  entries: TimesheetEntry[];
}

export interface TimesheetProject {
  id: string;
  code: string;
  name: string;
  client: string | null;
  billable: boolean;
  active: boolean;
  tasks: { id: string; project_id: string; name: string; active: boolean }[];
}

export const timesheetsApi = {
  week: (weekOf: string) => api<TimesheetWeek>('/timesheets/me', { query: { week_of: weekOf } }),
  save: (weekOf: string, entries: { work_date: string; project_id: string | null; task_id: string | null; hours: string; description: string | null }[]) =>
    api<TimesheetWeek>('/timesheets/me', { method: 'PUT', query: { week_of: weekOf }, body: { entries } }),
  submit: (weekOf: string) => api<TimesheetWeek>('/timesheets/me/submit', { method: 'POST', query: { week_of: weekOf } }),
  projects: () => api<TimesheetProject[]>('/timesheets/projects'),
};
