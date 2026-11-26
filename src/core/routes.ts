/**
 * Every screen in the app, and where it lives.
 *
 * One list drives the navigator, the deep links, the push routing and the
 * web→mobile route map, so a screen cannot be linked from a notification and
 * missing from the navigator. Pure TypeScript, tested in Node.
 */

export type TabName = 'HomeTab' | 'AttendanceTab' | 'LeaveTab' | 'MeTab';

/** The four tabs, in the tab bar's order (Ask Miraa sits between the second and third). */
export const TAB_NAMES: readonly TabName[] = ['HomeTab', 'AttendanceTab', 'LeaveTab', 'MeTab'];

/**
 * Screens. Detail screens take an `id` (or `date`) param. `tab: null` opens
 * over the tabs: as a modal sheet (forms, Ask Miraa), or pushed like a page
 * when `card` is set (the Inbox, reached from the bell on every tab).
 */
export const ROUTES = {
  // Home tab
  Home: { tab: 'HomeTab' },
  Services: { tab: 'HomeTab' },
  Announcements: { tab: 'HomeTab' },
  Celebrations: { tab: 'HomeTab' },
  QuickLinks: { tab: 'HomeTab' },

  // Attendance tab
  Attendance: { tab: 'AttendanceTab' },
  Punch: { tab: 'AttendanceTab' },
  PunchHistory: { tab: 'AttendanceTab' },
  Visits: { tab: 'AttendanceTab' },
  AttendanceDetail: { tab: 'AttendanceTab', param: 'date' },
  Regularisations: { tab: 'AttendanceTab' },
  Shifts: { tab: 'AttendanceTab' },
  Overtime: { tab: 'AttendanceTab' },
  Timesheet: { tab: 'AttendanceTab' },

  // Leave tab
  Leave: { tab: 'LeaveTab' },
  LeaveDetail: { tab: 'LeaveTab', param: 'id' },
  LeaveHistory: { tab: 'LeaveTab' },
  CompOff: { tab: 'LeaveTab' },
  OptionalHolidays: { tab: 'LeaveTab' },
  Holidays: { tab: 'LeaveTab' },
  WhoIsOut: { tab: 'LeaveTab' },

  // Over the tabs, pushed like a page: the bell on every tab opens it.
  Inbox: { tab: null, card: true },
  ApprovalDetail: { tab: null, card: true, param: 'id' },

  // Me tab
  MeHub: { tab: 'MeTab' },
  Profile: { tab: 'MeTab' },
  ProfileEdit: { tab: null },
  ChangeRequests: { tab: 'MeTab' },
  OrgChart: { tab: 'MeTab' },
  Colleague: { tab: 'MeTab', param: 'id' },
  Payslips: { tab: 'MeTab' },
  PayslipDetail: { tab: 'MeTab', param: 'id' },
  Salary: { tab: 'MeTab' },
  TotalRewards: { tab: 'MeTab' },
  Tax: { tab: 'MeTab' },
  TaxRegime: { tab: 'MeTab' },
  TaxDeclarations: { tab: 'MeTab' },
  Form16: { tab: 'MeTab' },
  Loans: { tab: 'MeTab' },
  Flexi: { tab: 'MeTab' },
  Ewa: { tab: 'MeTab' },
  Benefits: { tab: 'MeTab' },
  Esop: { tab: 'MeTab' },
  Expenses: { tab: 'MeTab' },
  ExpenseDetail: { tab: 'MeTab', param: 'id' },
  Advances: { tab: 'MeTab' },
  TravelRequests: { tab: 'MeTab' },
  Helpdesk: { tab: 'MeTab' },
  TicketDetail: { tab: 'MeTab', param: 'id' },
  Documents: { tab: 'MeTab' },
  CompanyPolicies: { tab: 'MeTab' },
  Letters: { tab: 'MeTab' },
  LetterDetail: { tab: 'MeTab', param: 'id' },
  Assets: { tab: 'MeTab' },
  Growth: { tab: 'MeTab' },
  Goals: { tab: 'MeTab' },
  GoalDetail: { tab: 'MeTab', param: 'id' },
  OneOnOnes: { tab: 'MeTab' },
  OneOnOneDetail: { tab: 'MeTab', param: 'id' },
  Feedback: { tab: 'MeTab' },
  Appraisal: { tab: 'MeTab' },
  ReviewDetail: { tab: 'MeTab', param: 'id' },
  Learning: { tab: 'MeTab' },
  CourseDetail: { tab: 'MeTab', param: 'id' },
  Culture: { tab: 'MeTab' },
  Shoutouts: { tab: 'MeTab' },
  Clubs: { tab: 'MeTab' },
  ClubDetail: { tab: 'MeTab', param: 'id' },
  Polls: { tab: 'MeTab' },
  Events: { tab: 'MeTab' },
  Surveys: { tab: 'MeTab' },

  Awards: { tab: 'MeTab' },
  Rewards: { tab: 'MeTab' },
  Referrals: { tab: 'MeTab' },
  Interviews: { tab: 'MeTab' },
  InterviewDetail: { tab: 'MeTab', param: 'id' },
  Onboarding: { tab: 'MeTab' },
  Exit: { tab: 'MeTab' },
  Privacy: { tab: 'MeTab' },
  Consent: { tab: 'MeTab' },
  DataRequests: { tab: 'MeTab' },
  AiTransparency: { tab: 'MeTab' },
  Security: { tab: 'MeTab' },
  Settings: { tab: 'MeTab' },
  NotificationPrefs: { tab: 'MeTab' },
  MyTeam: { tab: 'MeTab' },
  TeamMember: { tab: 'MeTab', param: 'id' },

  // Modals (over the tabs)
  AskMira: { tab: null },
  MiraHistory: { tab: null },
  ApplyLeave: { tab: null },
  Regularise: { tab: null },
  NewCompOff: { tab: null },
  NewExpense: { tab: null },
  NewTicket: { tab: null },
  GiveShoutout: { tab: null },
  Resign: { tab: null },
  RequestAsset: { tab: null },
  Refer: { tab: null, param: 'id' },
  ApplyLoan: { tab: null, param: 'id' },
  ShiftSwap: { tab: null },
  SelfReview: { tab: null, param: 'id' },
  GiveFeedback: { tab: null, param: 'id' },
  SurveyDetail: { tab: null, param: 'id' },
} as const satisfies Record<string, { tab: TabName | null; param?: 'id' | 'date'; card?: true }>;

export type RouteName = keyof typeof ROUTES | AliasName;

/**
 * Names that are not screens of their own but a screen in a particular state:
 * "Approvals" is the Inbox on its Approvals segment. Kept so links and
 * notifications can say what they mean.
 */
export const ALIASES = {
  Approvals: { route: 'Inbox', params: { segment: 'approvals' } },
  Notifications: { route: 'Inbox', params: { segment: 'notifications' } },
  Tasks: { route: 'Inbox', params: { segment: 'tasks' } },
  Today: { route: 'Home' },
  Me: { route: 'MeHub' },
  Time: { route: 'Attendance' },
  TimeHub: { route: 'Attendance' },
  Recognition: { route: 'Shoutouts' },
  DocumentDetail: { route: 'Documents' },
} as const satisfies Record<string, { route: keyof typeof ROUTES; params?: Record<string, string> }>;

export type AliasName = keyof typeof ALIASES;
export type ScreenRoute = keyof typeof ROUTES;

export const ROUTE_NAMES: readonly RouteName[] = [
  ...(Object.keys(ROUTES) as ScreenRoute[]),
  ...(Object.keys(ALIASES) as AliasName[]),
];

export interface Target {
  /** The tab whose stack holds the screen, or null for a modal over the tabs. */
  tab: TabName | null;
  screen: ScreenRoute;
  params?: Record<string, string>;
}

/** Resolve a route name (screen or alias) and its params to where the navigator should go. */
export function targetFor(route: RouteName, params?: Record<string, string>): Target {
  if (route in ALIASES) {
    const alias = ALIASES[route as AliasName] as { route: ScreenRoute; params?: Record<string, string> };
    const merged = { ...(alias.params ?? {}), ...(params ?? {}) };
    return {
      tab: ROUTES[alias.route].tab,
      screen: alias.route,
      params: Object.keys(merged).length ? merged : undefined,
    };
  }
  const screen = route as ScreenRoute;
  return { tab: ROUTES[screen].tab, screen, params };
}

/** Whether a screen over the tabs is pushed like a page (true) or slides up as a modal. */
export function isCardRoute(route: ScreenRoute): boolean {
  return Boolean((ROUTES[route] as { card?: true }).card);
}

/** Whether a route needs an id or date to make sense. */
export function requiredParam(route: ScreenRoute): 'id' | 'date' | null {
  const definition = ROUTES[route] as { param?: 'id' | 'date' };
  return definition.param ?? null;
}

/** The list screen behind a detail screen. */
export const LIST_FALLBACK: Partial<Record<ScreenRoute, RouteName>> = {
  ApprovalDetail: 'Approvals',
  LeaveDetail: 'Leave',
  PayslipDetail: 'Payslips',
  LetterDetail: 'Letters',
  AttendanceDetail: 'Attendance',
  ExpenseDetail: 'Expenses',
  TicketDetail: 'Helpdesk',
  GoalDetail: 'Goals',
  OneOnOneDetail: 'OneOnOnes',
  CourseDetail: 'Learning',
  ReviewDetail: 'Appraisal',
  SelfReview: 'Appraisal',
  GiveFeedback: 'Feedback',
  ClubDetail: 'Clubs',
  SurveyDetail: 'Surveys',
  InterviewDetail: 'Interviews',
  Colleague: 'OrgChart',
  TeamMember: 'MyTeam',
};

export function listFallback(route: ScreenRoute): RouteName {
  return LIST_FALLBACK[route] ?? 'Home';
}
