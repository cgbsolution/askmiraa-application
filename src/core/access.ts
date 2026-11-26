/**
 * What a person can reach in the app.
 *
 * Mirrors the portal's `frontend/src/lib/access.ts`: a workspace module must
 * be switched on (the same keys the routers enforce with `require_module`),
 * self-service pages need a login linked to an employee record, manager pages
 * need direct reports (`user.is_manager` — a manager is anyone with a report,
 * whatever their role), and a linked product (ExpenseGenie, CGB Helpdesk,
 * AnytimeHire) takes over its section with a launcher.
 *
 * Hiding an entry point is the convenience; the API is still the enforcement.
 */

import type { ModuleKey, ProductKey } from './types.ts';

export interface AccessContext {
  role: 'super_admin' | 'admin' | 'sub_admin' | 'employee';
  isManager: boolean;
  hasEmployeeRecord: boolean;
  modules: Partial<Record<string, boolean>>;
  linkedProducts: Partial<Record<string, unknown>>;
}

export interface Feature {
  /** Workspace module that must be on. */
  module?: ModuleKey;
  /** About the person's own record: needs an employee record. */
  self?: boolean;
  /** Only for people with direct reports (or HR). */
  managers?: boolean;
  /** A linked product that takes this over. */
  product?: ProductKey;
}

export const FEATURES = {
  punch: { module: 'leave', self: true },
  attendance: { module: 'leave', self: true },
  leave: { module: 'leave', self: true },
  shifts: { module: 'leave', self: true },
  overtime: { module: 'leave', self: true },
  timesheet: { self: true },
  approvals: {},
  payslips: { module: 'payroll', self: true },
  salary: { module: 'payroll', self: true },
  tax: { module: 'payroll', self: true },
  loans: { module: 'payroll', self: true },
  flexi: { module: 'payroll', self: true },
  ewa: { module: 'payroll', self: true },
  benefits: { module: 'payroll', self: true },
  esop: { self: true },
  expenses: { self: true, product: 'expense' },
  helpdesk: { product: 'helpdesk' },
  documents: { module: 'core_hr', self: true },
  policies: { module: 'core_hr' },
  letters: { self: true },
  assets: { self: true, product: 'helpdesk' },
  profile: { self: true },
  org: { module: 'core_hr' },
  goals: { self: true },
  oneOnOnes: {},
  feedback: { self: true },
  appraisal: { self: true },
  learning: { self: true },
  culture: { module: 'culture' },
  rewards: { module: 'rewards', self: true },
  referrals: { module: 'hiring', self: true },
  interviews: { product: 'interview' },
  onboarding: { self: true },
  exit: { self: true },
  privacy: {},
  myTeam: { managers: true },
  companion: {},
  // Birthdays and anniversaries, and the company's links: for everyone.
  celebrations: {},
  links: {},
} as const satisfies Record<string, Feature>;

export type FeatureKey = keyof typeof FEATURES;

const HR_ROLES = new Set(['admin', 'sub_admin', 'super_admin']);

export function isHr(context: AccessContext): boolean {
  return HR_ROLES.has(context.role);
}

/** Whether the workspace has the feature's module on (a feature with no module always is). */
export function moduleOn(context: AccessContext, feature: Feature): boolean {
  return !feature.module || Boolean(context.modules[feature.module]);
}

/** Whether a linked product has taken this feature over. */
export function productLinked(context: AccessContext, feature: Feature): boolean {
  return Boolean(feature.product && context.linkedProducts[feature.product]);
}

/** Whether to show an entry point for a feature at all. */
export function canSee(context: AccessContext, key: FeatureKey): boolean {
  const feature: Feature = FEATURES[key];
  if (!moduleOn(context, feature)) return false;
  if (feature.managers && !(context.isManager || isHr(context))) return false;
  // A self-service page with no employee record would only show an empty
  // page; a linked product still has its launcher, so keep that visible.
  if (feature.self && !context.hasEmployeeRecord && !productLinked(context, feature)) return false;
  return true;
}

/** Build the context from GET /auth/session. */
export function accessFromSession(session: {
  user: { role: AccessContext['role']; is_manager?: boolean; employee_id: string | null };
  tenant: { enabled_modules: Record<string, unknown>; linked_products?: Record<string, unknown> };
}): AccessContext {
  const modules: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(session.tenant.enabled_modules ?? {})) modules[key] = Boolean(value);
  return {
    role: session.user.role,
    isManager: Boolean(session.user.is_manager),
    hasEmployeeRecord: Boolean(session.user.employee_id),
    modules,
    linkedProducts: session.tenant.linked_products ?? {},
  };
}

/**
 * Whether an API error means "this module is switched off for the
 * workspace" (`require_module`'s 403), so the screen can say exactly that.
 */
export function isModuleOffError(status: number, detail: string): boolean {
  return status === 403 && /module is not enabled/i.test(detail);
}
