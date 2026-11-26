/** Human names for the screens a Miraa card can open ("Open Attendance"). */

import type { RouteName } from '../../core/routes';

export const SCREEN_LABEL: Partial<Record<RouteName, string>> = {
  Profile: 'my profile',
  Leave: 'Leave',
  Payslips: 'Payslips',
  Attendance: 'Attendance',
  OrgChart: 'my team',
  Approvals: 'Approvals',
  Tax: 'Tax',
  Documents: 'Documents',
  Helpdesk: 'Helpdesk',
  Expenses: 'Expenses',
  Goals: 'Goals',
  Feedback: 'Feedback',
  Learning: 'Learning',
  Assets: 'My assets',
  Home: 'Home',
};
