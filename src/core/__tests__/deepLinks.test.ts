/**
 * Deep links route correctly from every notification type.
 *
 * An approval notification that opens the app home instead of the approval is
 * the difference between a manager acting in ten seconds and forgetting about
 * it — which defeats the point of having sent it.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { KNOWN_EVENT_KEYS, destinationFor, parseUrl, unmappedEventKeys } from '../deepLinks.ts';
import { ROUTE_NAMES, ROUTES, targetFor, type ScreenRoute } from '../routes.ts';

const SERVICES = fileURLToPath(new URL('../../../../backend/app/services', import.meta.url));

function pythonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === '__pycache__') continue;
    if (statSync(full).isDirectory()) out.push(...pythonFiles(full));
    else if (entry.endsWith('.py')) out.push(full);
  }
  return out;
}

describe('deep links', () => {
  it('has a destination for every event key it knows', () => {
    assert.deepEqual(unmappedEventKeys(), []);
  });

  it('knows every event key the backend emits', { skip: !existsSync(SERVICES) && 'backend not checked out' }, () => {
    // The gate: a notification added to the backend cannot reach a phone
    // without somewhere to land. Event keys are three or more dotted segments.
    const pattern =
      /"((?:analytics|approvals|assets|attendance|auth|culture|documents|exit|exits|expenses|helpdesk|interview|learning|leave|lifecycle|offer|onboarding|payroll|people|performance|probation|rewards|security|statutory|system|tax|timesheets)(?:\.[a-z_]+){2,3})"/g;
    const emitted = new Set<string>();
    for (const file of pythonFiles(SERVICES)) {
      for (const match of readFileSync(file, 'utf8').matchAll(pattern)) emitted.add(match[1]!);
    }
    const known = new Set(KNOWN_EVENT_KEYS);
    const missing = [...emitted].filter((key) => !known.has(key)).sort();
    assert.deepEqual(missing, [], `Add a destination in deepLinks.ts for: ${missing.join(', ')}`);
  });

  it('sends every destination to a real screen', () => {
    for (const key of KNOWN_EVENT_KEYS) {
      const destination = destinationFor(key, { id: 'x' });
      const target = targetFor(destination.route, destination.params);
      assert.ok(target.screen in ROUTES, `${key} -> ${destination.route} is not a screen`);
    }
  });

  it('opens the specific approval, not the home screen', () => {
    const destination = destinationFor('leave.approval.requested', { leave_request_id: 'abc-123' });
    assert.equal(destination.route, 'ApprovalDetail');
    assert.equal(destination.params?.id, 'abc-123');
    assert.equal(destination.params?.source, 'leave');
  });

  it('opens the specific payslip', () => {
    const destination = destinationFor('payroll.payslip.published', { payslip_id: 'slip-9' });
    assert.equal(destination.route, 'PayslipDetail');
    assert.equal(destination.params?.id, 'slip-9');
  });

  it('opens the specific letter', () => {
    const destination = destinationFor('documents.letter.issued', { letter_id: 'ltr-1' });
    assert.equal(destination.route, 'LetterDetail');
    assert.equal(destination.params?.id, 'ltr-1');
  });

  it('opens the specific ticket', () => {
    const destination = destinationFor('helpdesk.ticket.replied', { ticket_id: 't-7' });
    assert.equal(destination.route, 'TicketDetail');
    assert.equal(destination.params?.id, 't-7');
  });

  it('routes an attendance regularisation decision to that day', () => {
    const destination = destinationFor('attendance.regularisation.decided', { attendance_date: '2026-04-06' });
    assert.equal(destination.route, 'AttendanceDetail');
    assert.equal(destination.params?.date, '2026-04-06');
  });

  it('falls back to the list screen when the id is missing', () => {
    // A detail screen with no id would render an error. The list is useful.
    const destination = destinationFor('leave.approval.requested', {});
    assert.equal(destination.route, 'Approvals');
    assert.equal(destination.params, undefined);
    assert.equal(destinationFor('helpdesk.ticket.replied', {}).route, 'Helpdesk');
    assert.equal(destinationFor('payroll.payslip.published', {}).route, 'Payslips');
  });

  it('opens approvals on the Inbox approvals segment', () => {
    const target = targetFor('Approvals');
    // The Inbox is pushed over the tabs from the bell, not a tab of its own.
    assert.equal(target.tab, null);
    assert.equal(target.screen, 'Inbox');
    assert.equal(target.params?.segment, 'approvals');
  });

  it('falls back to home for an unknown event rather than crashing', () => {
    // A push that crashes the app is worse than one that opens the wrong screen.
    assert.equal(destinationFor('some.future.event').route, 'Home');
  });

  it('sends security events to the security screen, where the session controls are', () => {
    assert.equal(destinationFor('security.break_glass_used').route, 'Security');
    assert.equal(destinationFor('security.suspicious_login').route, 'Security');
  });

  it('puts every screen in a tab or over the tabs as a modal', () => {
    for (const name of Object.keys(ROUTES) as ScreenRoute[]) {
      const tab = ROUTES[name].tab;
      assert.ok(tab === null || ['HomeTab', 'AttendanceTab', 'LeaveTab', 'MeTab'].includes(tab), name);
    }
    assert.ok(ROUTE_NAMES.length > 90);
  });

  describe('url parsing', () => {
    it('parses a bare route', () => {
      assert.deepEqual(parseUrl('askmira://Payslips'), { route: 'Payslips' });
    });

    it('parses a route with an id segment', () => {
      assert.deepEqual(parseUrl('askmira://PayslipDetail/slip-9'), {
        route: 'PayslipDetail',
        params: { id: 'slip-9' },
      });
    });

    it('parses query parameters', () => {
      assert.deepEqual(parseUrl('askmira://AttendanceDetail?date=2026-04-06'), {
        route: 'AttendanceDetail',
        params: { date: '2026-04-06' },
      });
    });

    it('is case-insensitive on the host, as URL hosts are', () => {
      assert.equal(parseUrl('askmira://payslips')?.route, 'Payslips');
      assert.equal(parseUrl('askmira://PAYSLIPS')?.route, 'Payslips');
    });

    it('rejects an unknown route rather than guessing', () => {
      assert.equal(parseUrl('askmira://NotARealScreen'), null);
    });

    it('rejects a link from another scheme', () => {
      assert.equal(parseUrl('https://example.com/Payslips'), null);
      assert.equal(parseUrl('evil://Payslips'), null);
    });

    it('decodes percent-encoded values', () => {
      assert.equal(
        parseUrl('askmira://LetterDetail/ACM%2FOFF%2F2026-27%2F00001')?.params?.id,
        'ACM/OFF/2026-27/00001',
      );
    });

    it('survives a malformed percent sequence', () => {
      assert.equal(parseUrl('askmira://LetterDetail/%E0%A4%A')?.params?.id, '%E0%A4%A');
    });

    it('opens Ask Miraa from a link', () => {
      assert.equal(targetFor(parseUrl('askmira://AskMira')!.route).tab, null);
    });
  });
});
