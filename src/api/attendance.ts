/** Attendance: my period, days, punches, regularisations, shifts, swaps, overtime. */

import { firstOfMonth, lastOfMonth } from '../core/dates';

import type {
  AttendanceDayRead,
  AttendanceSettingsRead,
  MyAttendancePeriod,
  OvertimeEntryRead,
  PunchRead,
  RegularisationCreate,
  RegularisationRangeCreate,
  RegularisationQueueItem,
  RegularisationRead,
  ShiftRead,
  ShiftSwapCreate,
  TeamToday,
} from '../core/types';
import { api } from '../lib/api';

export interface SwapShift {
  id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
}

/** One shift swap, as services/attendance/shift_swaps.py `_read` builds it. */
export interface ShiftSwap {
  id: string;
  requester_employee_id: string;
  requester_name: string;
  partner_employee_id: string;
  partner_name: string;
  swap_date: string;
  requester_shift: SwapShift;
  partner_shift: SwapShift;
  reason: string;
  status: 'awaiting_partner' | 'awaiting_approval' | 'approved' | 'declined' | 'rejected' | 'cancelled';
  note: string | null;
  created_at: string | null;
  decided_at: string | null;
  you_are: 'requester' | 'partner' | 'approver';
}

/**
 * A whole month of the caller's attendance — one cache entry per month, for
 * every screen. The calendar shows days still to come (holidays, approved
 * leave, week offs), so the range is always the full month; screens that only
 * need today's shift read the same entry rather than a shorter copy under the
 * same key.
 */
export function monthPeriodQuery(month: string) {
  return {
    queryKey: ['attendance', 'period', month.slice(0, 7)] as const,
    queryFn: () => attendanceApi.period(firstOfMonth(month), lastOfMonth(month)),
  };
}

/**
 * Which map to draw, as the portal does: Google's when the API's .env has a
 * key (MAPS_PROVIDER, GOOGLE_MAPS_API_KEY — keys live only on the backend),
 * else OpenStreetMap's, which needs none.
 */
export interface MapConfigRead {
  provider: 'google' | 'leaflet';
  google_maps_api_key: string | null;
}

/** One client visit (services/attendance/visits.py). */
export interface FieldVisit {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  client_name: string;
  started_at: string;
  start_latitude: number;
  start_longitude: number;
  start_accuracy_metres: number | null;
  start_source: 'web' | 'mobile';
  start_address: string | null;
  has_photo: boolean;
  ended_at: string | null;
  end_latitude: number | null;
  end_longitude: number | null;
  end_accuracy_metres: number | null;
  end_source: 'web' | 'mobile' | null;
  end_address: string | null;
  /** Minutes from visit in to visit out; null while the visit is open. */
  duration_minutes: number | null;
}

export interface FieldVisitList {
  visits: FieldVisit[];
  total: number;
  people: number;
}

export interface VisitPoint {
  latitude: number;
  longitude: number;
  accuracy_metres: number;
  /** Android flagged the fix as coming from a mock-location app. */
  is_mocked?: boolean;
}

export const attendanceApi = {
  settings: () => api<AttendanceSettingsRead>('/attendance/settings'),
  mapConfig: () => api<MapConfigRead>('/attendance/map-config'),
  period: (from: string, to: string) => api<MyAttendancePeriod>('/attendance/period', { query: { from, to } }),
  days: (from: string, to: string) => api<AttendanceDayRead[]>('/attendance/day', { query: { from, to } }),
  punches: (from: string, to: string) => api<PunchRead[]>('/attendance/punches', { query: { from, to } }),
  regularise: (body: RegularisationCreate) =>
    api<RegularisationRead>('/attendance/regularisation', { method: 'POST', body }),
  regulariseRange: (body: RegularisationRangeCreate) =>
    api<RegularisationRead[]>('/attendance/regularisations/range', { method: 'POST', body }),
  regularisations: (status?: string) => api<RegularisationRead[]>('/attendance/regularisations', { query: { status } }),
  /** Regularisations waiting on the caller as an approver, with the day's current status. */
  pendingRegularisations: () => api<RegularisationQueueItem[]>('/attendance/regularisations/pending'),
  cancelRegularisation: (id: string) =>
    api<RegularisationRead>(`/attendance/regularisations/${id}/cancel`, { method: 'POST' }),
  shifts: () => api<ShiftRead[]>('/attendance/shifts'),
  swaps: () => api<ShiftSwap[]>('/attendance/shift-swaps'),
  requestSwap: (body: ShiftSwapCreate) => api<ShiftSwap>('/attendance/shift-swaps', { method: 'POST', body }),
  respondSwap: (id: string, accept: boolean) =>
    api<ShiftSwap>(`/attendance/shift-swaps/${id}/respond`, { method: 'POST', body: { accept } }),
  cancelSwap: (id: string) => api<ShiftSwap>(`/attendance/shift-swaps/${id}/cancel`, { method: 'POST' }),
  overtime: (start?: string, end?: string) => api<OvertimeEntryRead[]>('/attendance/overtime/mine', { query: { start, end } }),
  teamToday: () => api<TeamToday>('/attendance/team/today'),
  myVisits: (from: string, to: string) => api<FieldVisitList>('/attendance/visits/mine', { query: { from, to } }),
  visitIn: (body: VisitPoint & { client_name: string; photo: string }) =>
    api<FieldVisit>('/attendance/visits', { method: 'POST', body: { ...body, source: 'mobile' }, timeoutMs: 30_000 }),
  visitOut: (id: string, body: VisitPoint) =>
    api<FieldVisit>(`/attendance/visits/${id}/end`, { method: 'POST', body: { ...body, source: 'mobile' } }),
};
