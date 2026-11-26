/** My record, my profile, change requests, colleagues and the org around me. */

import type {
  ChangeRequestCreate,
  DepartmentRead,
  LocationRead,
  ChangeRequestRead,
  EmployeeProfileRead,
  EmployeeRead,
  EmployeeSelfUpdate,
  Page_EmployeeSummary_,
  ProfileUpdate,
} from '../core/types';
import { api, upload, type UploadFile } from '../lib/api';

/**
 * A colleague found by name to pick (GET /employees/colleagues): names and titles
 * only. Outside HR the directory is the person's own team, so thanking or
 * swapping a shift with anybody else in the company searches here instead.
 */
export interface Colleague {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  designation: string | null;
  photo_url: string | null;
}

export const peopleApi = {
  me: () => api<EmployeeRead>('/employees/me'),
  updateMe: (body: EmployeeSelfUpdate) => api<EmployeeRead>('/employees/me', { method: 'PATCH', body }),
  profile: () => api<EmployeeProfileRead>('/employees/me/profile'),
  /** A section the person may edit directly (education, family…); applied at once. */
  updateProfile: (body: ProfileUpdate) => api<EmployeeProfileRead>('/employees/me/profile', { method: 'PUT', body }),
  changeRequests: () => api<ChangeRequestRead[]>('/employees/me/change-requests'),
  requestChange: (body: ChangeRequestCreate) =>
    api<ChangeRequestRead>('/employees/me/change-requests', { method: 'POST', body }),
  withdrawChange: (id: string) => api<ChangeRequestRead>(`/employees/change-requests/${id}/withdraw`, { method: 'POST' }),
  uploadPhoto: (file: UploadFile) => upload<EmployeeRead>('/employees/me/photo', { file }, { method: 'PUT' }),
  removePhoto: () => api<EmployeeRead>('/employees/me/photo', { method: 'DELETE' }),
  employee: (id: string) => api<EmployeeRead>(`/employees/${id}`),
  /** Names for the ids on an employee record: department and work location. */
  departments: () => api<DepartmentRead[]>('/org/departments'),
  locations: () => api<LocationRead[]>('/org/locations'),
  /** The caller's directory: the whole company for HR, their own team for anybody else. */
  list: (query: { manager_id?: string; search?: string; page_size?: number; current?: boolean }) =>
    api<Page_EmployeeSummary_>('/employees', { query: { current: true, page_size: 50, ...query } }),
  /** Colleagues in the caller's company by name or code, from two letters: names and titles only. */
  colleagues: (search: string) => api<Colleague[]>('/employees/colleagues', { query: { search } }),
};
