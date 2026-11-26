import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { targetFor } from '../routes.ts';
import { webToMobileRoute } from '../webToMobileRoute.ts';

const screen = (href: string) => {
  const target = webToMobileRoute(href);
  assert.equal(target.kind, 'screen', href);
  return target.kind === 'screen' ? target : null;
};

describe('web to mobile routes', () => {
  it('maps every path Ask Miraa opens from your own record', () => {
    // From backend services/ai/assistant.py lookup_own_record.
    assert.equal(screen('/profile')?.route, 'Profile');
    assert.equal(screen('/time')?.route, 'Leave');
    assert.equal(screen('/time/leave')?.route, 'Leave');
    assert.equal(screen('/pay')?.route, 'Payslips');
    assert.equal(screen('/pay/payslips')?.route, 'Payslips');
    assert.equal(screen('/time/attendance')?.route, 'Attendance');
    assert.equal(screen('/people/org-chart')?.route, 'OrgChart');
    assert.equal(screen('/assistant')?.route, 'AskMira');
  });

  it('prefers the longest matching prefix', () => {
    assert.equal(screen('/time/attendance-review?tab=regularisations')?.route, 'Approvals');
    assert.equal(screen('/time/timesheets/approvals')?.route, 'Approvals');
    assert.equal(screen('/time/timesheets')?.route, 'Timesheet');
    assert.equal(screen('/performance/feedback?tab=give')?.route, 'Feedback');
  });

  it('carries a tab through as a param', () => {
    assert.deepEqual(screen('/performance/feedback?tab=give')?.params, { tab: 'give' });
  });

  it('opens a helpdesk ticket by id', () => {
    const target = screen('/helpdesk/3e77f20d-70d7-4ead-a686-a2222cf3e0c6');
    assert.equal(target?.route, 'TicketDetail');
    assert.equal(target?.params?.id, '3e77f20d-70d7-4ead-a686-a2222cf3e0c6');
  });

  it('opens linked products in the browser', () => {
    assert.deepEqual(webToMobileRoute('/launch/expense'), { kind: 'external', path: '/launch/expense' });
    assert.equal(webToMobileRoute('https://example.com/x').kind, 'external');
  });

  it('falls back to Home for a page with no mobile home', () => {
    assert.equal(screen('/payroll/settlements')?.route, 'Home');
    assert.equal(screen('')?.route, 'Home');
    assert.equal(screen('/')?.route, 'Home');
    assert.equal(webToMobileRoute(null).kind, 'screen');
  });

  it('does not match a prefix in the middle of a word', () => {
    assert.equal(screen('/payroll')?.route, 'Home', '/payroll is not /pay');
  });

  it('only ever lands on a real screen', () => {
    const paths = [
      '/approvals', '/approvals/lifecycle/abc', '/notifications', '/compliance/privacy', '/time/overtime',
      '/time/shifts', '/pay/tax', '/pay/loans', '/pay/benefits', '/pay/stock-options', '/expenses',
      '/expenses/travel', '/expenses/reimbursements', '/people/clearance', '/people/exits', '/learning',
      '/culture', '/culture/clubs', '/rewards', '/docs', '/docs/letters', '/assets', '/onboarding',
      '/onboarding/tasks', '/hiring/referrals', '/hiring/interviews', '/performance', '/performance/team',
    ];
    for (const path of paths) {
      const target = screen(path);
      assert.ok(target && targetFor(target.route).screen, path);
    }
  });
});
