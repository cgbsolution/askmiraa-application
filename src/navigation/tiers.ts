/**
 * Which screens are Tier 1 (a mistake costs money or triggers a filing).
 * Used to cover the app in the app switcher on those screens.
 */

const TIER1 = new Set([
  'Payslips', 'PayslipDetail', 'Salary', 'TotalRewards', 'Tax', 'TaxRegime', 'TaxDeclarations', 'Form16',
  'Loans', 'ApplyLoan', 'Flexi', 'Ewa', 'Benefits', 'Esop', 'Expenses', 'ExpenseDetail', 'NewExpense', 'Advances',
  'TravelRequests', 'Attendance', 'AttendanceDetail', 'Punch', 'PunchHistory', 'Regularisations', 'Regularise', 'Leave', 'LeaveDetail',
  'LeaveHistory', 'ApplyLeave', 'CompOff', 'Overtime', 'Timesheet', 'Inbox', 'ApprovalDetail', 'Profile',
  'ProfileEdit', 'Exit', 'Resign', 'MyTeam', 'TeamMember',
]);

export function isTier1Route(name: string | undefined): boolean {
  return Boolean(name && TIER1.has(name));
}
