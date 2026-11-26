/**
 * Every service the app offers, grouped the way people look for them.
 *
 * One list drives Home's grid (the old HRMS opened on a grid of these, in this
 * order) and the searchable All services screen, so a service cannot be on one
 * and missing from the other. Each entry is shown only when the person can
 * reach it (core/access.ts): a module switched off hides its services, never
 * shows them disabled. Each has its picture from the website's icon set
 * (components/Spot.tsx). Pure TypeScript, tested in Node.
 */

import type { FeatureKey } from './access.ts';
import type { RouteName } from './routes.ts';
import type { SpotName } from './spotNames.ts';

export type ServiceGroup = 'attendance' | 'leave' | 'pay' | 'workplace' | 'growth' | 'account';

export interface Service {
  key: string;
  label: string;
  group: ServiceGroup;
  route: RouteName;
  feature: FeatureKey;
  /** Only for people with reports, or HR (approvals waiting on them). */
  managers?: boolean;
  /** Other words people search with: the old HRMS's names, Indian HR terms. */
  keywords?: string[];
  /** Its picture, from the website's icon set. */
  spot: SpotName;
  /** Its tile is Marigold (Ask Miraa, as on the website), else blush. */
  marigold?: true;
}

export const SERVICE_GROUPS: { key: ServiceGroup; label: string }[] = [
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave', label: 'Leave' },
  { key: 'pay', label: 'Pay & tax' },
  { key: 'workplace', label: 'Workplace' },
  { key: 'growth', label: 'Growth & culture' },
  { key: 'account', label: 'Me & account' },
];

export const SERVICES: Service[] = [
  // Attendance
  { key: 'punch', label: 'Punch', group: 'attendance', route: 'Punch', feature: 'punch', spot: 'device', keywords: ['punch in', 'punch out', 'mark attendance', 'clock in', 'clock out', 'location', 'gps'] },
  { key: 'calendar', label: 'Calendar', group: 'attendance', route: 'Attendance', feature: 'attendance', spot: 'calendarClock', keywords: ['attendance calendar', 'present', 'absent', 'week off', 'payable days'] },
  { key: 'regularise', label: 'Regularise attendance', group: 'attendance', route: 'Regularise', feature: 'attendance', spot: 'clockEdit', keywords: ['attendance regularization', 'regularisation', 'missed punch', 'time correction', 'ar', 'attendance application'] },
  { key: 'regularisations', label: 'My corrections', group: 'attendance', route: 'Regularisations', feature: 'attendance', spot: 'auditLog', keywords: ['regularisations', 'regularizations', 'application status', 'attendance application', 'ar status'] },
  { key: 'visits', label: 'Client visits', group: 'attendance', route: 'Visits', feature: 'punch', spot: 'pin', keywords: ['visit in', 'visit out', 'field visit', 'sales call', 'client meeting', 'market visit', 'beat', 'customer visit'] },
  { key: 'punchHistory', label: 'Punch history', group: 'attendance', route: 'PunchHistory', feature: 'attendance', spot: 'inOut', keywords: ['in out report', 'in-out', 'offline punch', 'swipes'] },
  { key: 'shifts', label: 'Shifts & swaps', group: 'attendance', route: 'Shifts', feature: 'shifts', spot: 'clock', keywords: ['roster', 'change shift', 'shift swap'] },
  { key: 'overtime', label: 'Overtime', group: 'attendance', route: 'Overtime', feature: 'overtime', spot: 'clockPlus', keywords: ['ot', 'extra hours'] },
  { key: 'timesheet', label: 'Timesheet', group: 'attendance', route: 'Timesheet', feature: 'timesheet', spot: 'sheet', keywords: ['hours', 'projects'] },

  // Leave
  { key: 'leave', label: 'Leave', group: 'leave', route: 'Leave', feature: 'leave', spot: 'calendar', keywords: ['leave balance', 'balance', 'casual', 'sick', 'earned', 'privilege'] },
  { key: 'applyLeave', label: 'Apply leave', group: 'leave', route: 'ApplyLeave', feature: 'leave', spot: 'calendarPlus', keywords: ['time off', 'request leave', 'holiday request'] },
  { key: 'leaveRequests', label: 'My leave requests', group: 'leave', route: 'LeaveHistory', feature: 'leave', spot: 'calendarCheck', keywords: ['leave status', 'leave application status', 'cancel leave'] },
  { key: 'compOff', label: 'Comp-off', group: 'leave', route: 'CompOff', feature: 'leave', spot: 'calendarSwap', keywords: ['compensatory off', 'compoff', 'worked on holiday'] },
  { key: 'holidays', label: 'Holiday calendar', group: 'leave', route: 'Holidays', feature: 'leave', spot: 'calendarStar', keywords: ['holidays', 'public holiday', 'festival'] },
  { key: 'optionalHolidays', label: 'Optional holidays', group: 'leave', route: 'OptionalHolidays', feature: 'leave', spot: 'calendarHeart', keywords: ['restricted holiday', 'rh', 'floating'] },
  { key: 'whoIsOut', label: "Who's out", group: 'leave', route: 'WhoIsOut', feature: 'leave', spot: 'plane', keywords: ['team leave', 'on leave today'] },

  // Pay & tax
  { key: 'payslips', label: 'Payslips', group: 'pay', route: 'Payslips', feature: 'payslips', spot: 'payslip', keywords: ['salary slip', 'pay slip', 'salary', 'net pay', 'download payslip'] },
  { key: 'salary', label: 'Salary structure', group: 'pay', route: 'Salary', feature: 'salary', spot: 'rupee', keywords: ['ctc', 'components', 'basic', 'hra'] },
  { key: 'totalRewards', label: 'Total rewards', group: 'pay', route: 'TotalRewards', feature: 'salary', spot: 'gift', keywords: ['benefits value', 'employer contribution'] },
  { key: 'taxDeclarations', label: 'IT declaration', group: 'pay', route: 'TaxDeclarations', feature: 'tax', spot: 'fileSend', keywords: ['investment declaration', '80c', 'proof', 'income tax', 'tax saving'] },
  { key: 'tax', label: 'Income tax', group: 'pay', route: 'Tax', feature: 'tax', spot: 'calculator', keywords: ['tds', 'regime', 'projection', 'it statement'] },
  { key: 'form16', label: 'Form 16', group: 'pay', route: 'Form16', feature: 'tax', spot: 'certificate', keywords: ['form16', 'tax certificate', '12bb'] },
  { key: 'loans', label: 'Loans & advances', group: 'pay', route: 'Loans', feature: 'loans', spot: 'bank', keywords: ['loan', 'salary advance', 'emi'] },
  { key: 'flexi', label: 'Flexi benefits', group: 'pay', route: 'Flexi', feature: 'flexi', spot: 'sliders', keywords: ['fbp', 'flexible benefit plan'] },
  { key: 'ewa', label: 'Early pay', group: 'pay', route: 'Ewa', feature: 'ewa', spot: 'cash', keywords: ['earned wage access', 'ewa', 'advance salary'] },
  { key: 'benefits', label: 'Benefits', group: 'pay', route: 'Benefits', feature: 'benefits', spot: 'shield', keywords: ['insurance', 'medical', 'health cover'] },
  { key: 'esop', label: 'Stock options', group: 'pay', route: 'Esop', feature: 'esop', spot: 'growth', keywords: ['esop', 'shares', 'vesting'] },

  // Workplace
  { key: 'approvals', label: 'Approvals', group: 'workplace', route: 'Approvals', feature: 'approvals', managers: true, spot: 'workflow', keywords: ['approval', 'approve', 'pending requests', 'team requests', 'bulk approve'] },
  { key: 'myTeam', label: 'My team', group: 'workplace', route: 'MyTeam', feature: 'myTeam', spot: 'team', keywords: ['reportees', 'subordinates', 'team attendance'] },
  { key: 'documents', label: 'Documents', group: 'workplace', route: 'Documents', feature: 'documents', spot: 'folder', keywords: ['plug me', 'files', 'personal files', 'company files', 'aadhaar', 'pan', 'upload document'] },
  { key: 'policies', label: 'Company policies', group: 'workplace', route: 'CompanyPolicies', feature: 'policies', spot: 'book', keywords: ['acknowledgement', 'acknowledge', 'handbook', 'policy'] },
  { key: 'letters', label: 'Letters', group: 'workplace', route: 'Letters', feature: 'letters', spot: 'mail', keywords: ['offer letter', 'appointment letter', 'experience letter'] },
  { key: 'assets', label: 'Assets', group: 'workplace', route: 'Assets', feature: 'assets', spot: 'laptop', keywords: ['my assets', 'laptop', 'device', 'asset request'] },
  { key: 'helpdesk', label: 'Helpdesk', group: 'workplace', route: 'Helpdesk', feature: 'helpdesk', spot: 'headset', keywords: ['ticket', 'tickets', 'support', 'help desk', 'issue', 'raise ticket'] },
  { key: 'expenses', label: 'Expenses', group: 'workplace', route: 'Expenses', feature: 'expenses', spot: 'receipt', keywords: ['claim', 'reimbursement', 'travel', 'bill'] },
  { key: 'org', label: 'Manager & team', group: 'workplace', route: 'OrgChart', feature: 'org', spot: 'org', keywords: ['org chart', 'reporting manager', 'directory'] },
  { key: 'announcements', label: 'Announcements', group: 'workplace', route: 'Announcements', feature: 'culture', spot: 'megaphone', keywords: ['news', 'notice', 'circular', 'company news'] },
  { key: 'celebrations', label: 'Celebrations', group: 'workplace', route: 'Celebrations', feature: 'celebrations', spot: 'cake', keywords: ['birthday', 'birthdays', 'work anniversary', 'anniversaries'] },
  { key: 'quickLinks', label: 'Company links', group: 'workplace', route: 'QuickLinks', feature: 'links', spot: 'connected', keywords: ['links', 'quick links', 'tools', 'intranet'] },

  // Growth & culture
  { key: 'goals', label: 'Goals', group: 'growth', route: 'Goals', feature: 'goals', spot: 'target', keywords: ['okr', 'kra', 'targets'] },
  { key: 'appraisal', label: 'My reviews', group: 'growth', route: 'Appraisal', feature: 'appraisal', spot: 'trend', keywords: ['appraisal', 'performance review', 'self review'] },
  { key: 'oneOnOnes', label: '1:1s', group: 'growth', route: 'OneOnOnes', feature: 'oneOnOnes', spot: 'chat', keywords: ['one on one', 'check-in', 'meeting'] },
  { key: 'feedback', label: 'Feedback', group: 'growth', route: 'Feedback', feature: 'feedback', spot: 'quote', keywords: ['360', 'feedback request'] },
  { key: 'learning', label: 'Learning', group: 'growth', route: 'Learning', feature: 'learning', spot: 'cap', keywords: ['courses', 'training', 'certificate'] },
  { key: 'culture', label: 'Culture', group: 'growth', route: 'Culture', feature: 'culture', spot: 'heart', keywords: ['clubs', 'polls', 'events', 'surveys'] },
  { key: 'shoutout', label: 'Give a shoutout', group: 'growth', route: 'GiveShoutout', feature: 'culture', spot: 'medal', keywords: ['recognition', 'kudos', 'appreciation'] },
  { key: 'rewards', label: 'Reward points', group: 'growth', route: 'Rewards', feature: 'rewards', spot: 'coins', keywords: ['points', 'redeem', 'catalogue'] },
  { key: 'referrals', label: 'Refer a friend', group: 'growth', route: 'Referrals', feature: 'referrals', spot: 'recruit', keywords: ['referral', 'jobs', 'open roles'] },
  { key: 'interviews', label: 'My interviews', group: 'growth', route: 'Interviews', feature: 'interviews', spot: 'question', keywords: ['interview feedback', 'panel'] },
  { key: 'onboarding', label: 'My onboarding', group: 'growth', route: 'Onboarding', feature: 'onboarding', spot: 'checklist', keywords: ['joining', 'induction', 'checklist'] },

  // Me & account
  { key: 'askMira', label: 'Ask Miraa', group: 'account', route: 'AskMira', feature: 'companion', spot: 'mira', marigold: true, keywords: ['chatbot', 'ai', 'assistant', 'help', 'fia'] },
  { key: 'profile', label: 'My profile', group: 'account', route: 'Profile', feature: 'profile', spot: 'person', keywords: ['personal details', 'bank details', 'address', 'pan', 'uan'] },
  { key: 'security', label: 'Password & security', group: 'account', route: 'Security', feature: 'privacy', spot: 'key', keywords: ['change password', 'fingerprint', '2-step', 'mfa'] },
  { key: 'notificationPrefs', label: 'Notification settings', group: 'account', route: 'NotificationPrefs', feature: 'privacy', spot: 'bell', keywords: ['notifications', 'alerts', 'whatsapp'] },
  { key: 'settings', label: 'Settings', group: 'account', route: 'Settings', feature: 'privacy', spot: 'toggle', keywords: ['language', 'theme', 'dark mode'] },
  { key: 'privacy', label: 'Privacy', group: 'account', route: 'Privacy', feature: 'privacy', spot: 'privacy', keywords: ['consent', 'my data', 'dpdp'] },
  { key: 'exit', label: 'Resignation', group: 'account', route: 'Exit', feature: 'exit', spot: 'door', keywords: ['separation', 'resign', 'notice period', 'exit'] },
];

/**
 * Home's grid when the person has not chosen their own: the old HRMS's home
 * screen, tile for tile and in its order (Punch, Leave, Payslip, Attendance
 * Regularization, Plug Me!, Calendar, Fia, IT Declaration, In Out Report,
 * Help Desk, Acknowledgement, Assets, Approval).
 */
export const DEFAULT_HOME_SERVICES = [
  'punch',
  'leave',
  'payslips',
  'regularise',
  'documents',
  'calendar',
  'askMira',
  'taxDeclarations',
  'punchHistory',
  'helpdesk',
  'policies',
  'assets',
  'approvals',
];

/** How many services Home shows, as the old HRMS did; "All services" follows them. */
export const HOME_SERVICE_COUNT = 13;

export interface ServiceAccess {
  can: (feature: FeatureKey) => boolean;
  /** Has direct reports, or is HR. */
  approver: boolean;
}

export function serviceVisible(service: Service, access: ServiceAccess): boolean {
  if (service.managers && !access.approver) return false;
  return access.can(service.feature);
}

/**
 * The services on Home: the person's own pick (kept on the phone) in their
 * order, else the defaults — each only if they can reach it — up to
 * HOME_SERVICE_COUNT.
 */
export function homeServices(access: ServiceAccess, pinned: string[] | null): Service[] {
  const byKey = new Map(SERVICES.map((s) => [s.key, s]));
  const keys = pinned && pinned.length ? pinned : DEFAULT_HOME_SERVICES;
  const out: Service[] = [];
  for (const key of keys) {
    const service = byKey.get(key);
    if (service && serviceVisible(service, access) && !out.includes(service)) out.push(service);
    if (out.length === HOME_SERVICE_COUNT) break;
  }
  return out;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Services matching a search, best first: a label that starts with the query,
 * then a label that contains it, then a keyword. Every word typed must match.
 */
export function searchServices(query: string, services: Service[]): Service[] {
  const q = normalise(query);
  if (!q) return services;
  const words = q.split(' ');
  const scored: { service: Service; score: number }[] = [];
  for (const service of services) {
    const label = normalise(service.label);
    const haystack = [label, ...(service.keywords ?? []).map(normalise)].join(' | ');
    if (!words.every((word) => haystack.includes(word))) continue;
    const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2;
    scored.push({ service, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.service);
}

/** Services grouped for the All services screen, empty groups left out. */
export function groupServices(services: Service[]): { key: ServiceGroup; label: string; services: Service[] }[] {
  return SERVICE_GROUPS.map((group) => ({ ...group, services: services.filter((s) => s.group === group.key) })).filter(
    (group) => group.services.length > 0,
  );
}
