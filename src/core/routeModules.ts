/**
 * Which workspace module each screen needs, from the server's own wiring
 * (`backend/app/api/v1/__init__.py`, `_module(...)` on each router).
 *
 * When the module is switched off the server refuses every call; the screen
 * would show buttons ("Give a shoutout", "Apply leave") over a "not switched
 * on" message. The navigator shows only the message instead.
 */

import type { ModuleKey } from './types.ts';
import type { ScreenRoute } from './routes.ts';

export const ROUTE_MODULES: Partial<Record<ScreenRoute, ModuleKey>> = {
  // leave, attendance and overtime routers
  WhoIsOut: 'leave',
  Holidays: 'leave',
  Attendance: 'leave',
  AttendanceDetail: 'leave',
  Regularisations: 'leave',
  Regularise: 'leave',
  Leave: 'leave',
  LeaveDetail: 'leave',
  LeaveHistory: 'leave',
  ApplyLeave: 'leave',
  CompOff: 'leave',
  NewCompOff: 'leave',
  OptionalHolidays: 'leave',
  Shifts: 'leave',
  ShiftSwap: 'leave',
  Overtime: 'leave',

  // payslips, salary, tax, loans (and flexi), EWA and benefits routers
  Payslips: 'payroll',
  PayslipDetail: 'payroll',
  Salary: 'payroll',
  TotalRewards: 'payroll',
  Tax: 'payroll',
  TaxRegime: 'payroll',
  TaxDeclarations: 'payroll',
  Form16: 'payroll',
  Loans: 'payroll',
  ApplyLoan: 'payroll',
  Flexi: 'payroll',
  Ewa: 'payroll',
  Benefits: 'payroll',

  // documents and company documents routers
  Documents: 'core_hr',
  CompanyPolicies: 'core_hr',

  // culture routers (announcements live there too)
  Announcements: 'culture',
  Culture: 'culture',
  Shoutouts: 'culture',
  GiveShoutout: 'culture',
  Clubs: 'culture',
  ClubDetail: 'culture',
  Polls: 'culture',
  Events: 'culture',
  Surveys: 'culture',
  SurveyDetail: 'culture',
  Awards: 'culture',

  Rewards: 'rewards',

  // recruiting router
  Referrals: 'hiring',
  Refer: 'hiring',
};

/** The module a screen needs that this workspace has switched off, if any. */
export function moduleOffFor(route: string, modules: Partial<Record<string, boolean>>): ModuleKey | null {
  const needed = ROUTE_MODULES[route as ScreenRoute];
  return needed && !modules[needed] ? needed : null;
}
