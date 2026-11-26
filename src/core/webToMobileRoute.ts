/**
 * A portal path, as Ask Miraa's cards and the approvals inbox return it
 * ("/time/attendance", "/pay/payslips", "/launch/expense"), to where the same
 * thing lives in the app.
 *
 * Longest matching prefix wins, so "/time/attendance" beats "/time". A path
 * with no mobile home falls back to Home rather than failing. `/launch/...`
 * opens a linked product in the system browser, so it is flagged as external.
 */

import type { RouteName } from './routes.ts';

export type MobileTarget =
  | { kind: 'screen'; route: RouteName; params?: Record<string, string> }
  | { kind: 'external'; path: string };

const MAP: [prefix: string, route: RouteName, params?: Record<string, string>][] = [
  ['/ask-mira', 'AskMira'],
  ['/assistant', 'AskMira'],
  ['/approvals/lifecycle', 'Approvals'],
  ['/approvals', 'Approvals'],
  ['/notifications', 'Notifications'],
  ['/profile', 'Profile'],
  ['/compliance/privacy', 'Privacy'],

  // Time
  ['/time/attendance-review', 'Approvals'],
  ['/time/attendance', 'Attendance'],
  ['/time/overtime', 'Overtime'],
  ['/time/timesheets/approvals', 'Approvals'],
  ['/time/timesheets', 'Timesheet'],
  ['/time/shifts', 'Shifts'],
  ['/time/leave', 'Leave'],
  ['/time/holidays', 'Holidays'],
  ['/time', 'Leave'],

  // Pay
  ['/pay/payslips', 'Payslips'],
  ['/pay/tax', 'Tax'],
  ['/pay/loans', 'Loans'],
  ['/pay/benefits', 'Benefits'],
  ['/pay/stock-options', 'Esop'],
  ['/pay', 'Payslips'],

  // Expenses
  ['/expenses/travel', 'TravelRequests'],
  ['/expenses/team', 'Approvals'],
  ['/expenses/reimbursements', 'Flexi'],
  ['/expenses', 'Expenses'],

  // People
  ['/people/org-chart', 'OrgChart'],
  ['/people/clearance', 'Tasks'],
  ['/people/exits', 'Exit'],
  ['/people/change-requests', 'ChangeRequests'],
  ['/people', 'OrgChart'],

  // Growth
  ['/performance/goals', 'Goals'],
  ['/performance/one-on-ones', 'OneOnOnes'],
  ['/performance/feedback', 'Feedback'],
  ['/performance/team', 'MyTeam'],
  ['/performance', 'Appraisal'],
  ['/learning', 'Learning'],

  // Culture
  ['/culture/announcements', 'Announcements'],
  ['/culture/awards', 'Awards'],
  ['/culture/surveys', 'Surveys'],
  ['/culture/polls', 'Polls'],
  ['/culture/clubs', 'Clubs'],
  ['/culture', 'Culture'],
  ['/rewards', 'Rewards'],

  // Documents, assets, helpdesk, onboarding, hiring
  ['/docs/letters', 'Letters'],
  ['/docs', 'Documents'],
  ['/assets', 'Assets'],
  ['/helpdesk', 'Helpdesk'],
  ['/onboarding/tasks', 'Tasks'],
  ['/onboarding', 'Onboarding'],
  ['/hiring/referrals', 'Referrals'],
  ['/hiring/interviews', 'Interviews'],
];

// Longest prefix first.
const ORDERED = [...MAP].sort((a, b) => b[0].length - a[0].length);

export function webToMobileRoute(href: string | null | undefined): MobileTarget {
  if (!href) return { kind: 'screen', route: 'Home' };
  const raw = href.trim();
  if (/^https?:\/\//i.test(raw)) return { kind: 'external', path: raw };
  const [pathPart = '', queryPart = ''] = raw.split('?');
  const path = '/' + pathPart.replace(/^\/+/, '').replace(/\/+$/, '');

  if (path.startsWith('/launch/')) return { kind: 'external', path: raw };

  for (const [prefix, route, params] of ORDERED) {
    if (path === prefix || path.startsWith(prefix + '/')) {
      const rest = path.slice(prefix.length).replace(/^\//, '');
      const merged: Record<string, string> = { ...(params ?? {}) };
      // A helpdesk ticket ("/helpdesk/<id>") opens that ticket.
      if (route === 'Helpdesk' && rest && /^[0-9a-f-]{8,}$/i.test(rest)) {
        return { kind: 'screen', route: 'TicketDetail', params: { id: rest } };
      }
      const query = parseQuery(queryPart);
      if (query.tab && route !== 'Approvals') merged.tab = query.tab;
      return { kind: 'screen', route, params: Object.keys(merged).length ? merged : undefined };
    }
  }
  return { kind: 'screen', route: 'Home' };
}

function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key = '', value = ''] = pair.split('=');
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}
