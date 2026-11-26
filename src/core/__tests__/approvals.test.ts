import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { actionsFor, blockReason, knownSources } from '../approvals.ts';
import { initials, statusLabel, toneFor } from '../status.ts';
import { accessFromSession, canSee, isModuleOffError } from '../access.ts';

describe('approval actions', () => {
  it('covers every source the inbox reports', () => {
    // From GET /approvals on the seeded workspace, 2026-10-26.
    const inbox = [
      'leave', 'leave_comp_off', 'attendance_regularisation', 'overtime', 'shift_swap', 'timesheet',
      'expense_claim_manager', 'travel_request_manager', 'lifecycle_event', 'asset_request',
      'resignation', 'clearance_task', 'feedback_request',
    ];
    for (const source of inbox) assert.ok(actionsFor(source).length > 0, source);
    assert.deepEqual([...knownSources()].sort(), [...inbox].sort());
  });

  it('requires a note to reject, never to approve', () => {
    for (const source of knownSources()) {
      for (const action of actionsFor(source)) {
        if (action.kind === 'reject') assert.equal(action.noteRequired, true, source);
        if (action.kind === 'approve') assert.equal(action.noteRequired, false, source);
      }
    }
  });

  it('confirms every decision before it is sent', () => {
    for (const source of knownSources()) {
      for (const action of actionsFor(source)) {
        if (action.request) assert.equal(action.confirm, true, `${source} ${action.kind}`);
      }
    }
  });

  it('builds the exact request each router expects', () => {
    const [approve, reject] = actionsFor('leave');
    assert.deepEqual(approve!.request!('L1', ''), { method: 'POST', path: '/leave/requests/L1/approve', body: { note: null } });
    assert.deepEqual(reject!.request!('L1', ' Too many out '), {
      method: 'POST',
      path: '/leave/requests/L1/reject',
      body: { note: 'Too many out' },
    });
    assert.deepEqual(actionsFor('attendance_regularisation')[1]!.request!('R1', 'no'), {
      method: 'PATCH',
      path: '/attendance/regularisation/R1',
      body: { approve: false, note: 'no' },
    });
    assert.deepEqual(actionsFor('expense_claim_manager')[0]!.request!('E1', ''), {
      method: 'POST',
      path: '/expenses/claims/E1/manager-decision',
      body: { approve: true, note: null },
    });
    assert.equal(actionsFor('resignation')[0]!.request!('X1', '').path, '/exits/X1/accept');
  });

  it('has no action for an unknown source', () => {
    assert.deepEqual(actionsFor('something_new'), []);
  });

  it('blocks a decision offline, or a rejection without a note', () => {
    const reject = actionsFor('leave')[1]!;
    const approve = actionsFor('leave')[0]!;
    assert.match(blockReason(approve, '', false) ?? '', /offline/);
    assert.match(blockReason(reject, '  ', true) ?? '', /note/);
    assert.equal(blockReason(reject, 'Clash with the release', true), null);
    assert.equal(blockReason(approve, '', true), null);
  });
});

describe('status words', () => {
  it('colours the same word the same way in every module', () => {
    assert.equal(toneFor('approved'), 'success');
    assert.equal(toneFor('PENDING'), 'warning');
    assert.equal(toneFor('awaiting_manager'), 'warning');
    assert.equal(toneFor('rejected'), 'danger');
    assert.equal(toneFor('cancelled'), 'neutral');
    assert.equal(toneFor('something_unheard_of'), 'neutral');
  });

  it('labels in plain words', () => {
    assert.equal(statusLabel('awaiting_manager'), 'With your manager');
    assert.equal(statusLabel('in_progress'), 'In progress');
    assert.equal(statusLabel('lop'), 'Loss of pay');
    assert.equal(statusLabel(null), '—');
    assert.equal(initials('Meera Nair'), 'MN');
    assert.equal(initials('Miraa'), 'MI');
    assert.equal(initials(''), '?');
  });
});

describe('access', () => {
  const base = {
    user: { role: 'employee' as const, is_manager: false, employee_id: 'e1' },
    tenant: { enabled_modules: { leave: true, payroll: true, culture: false }, linked_products: {} },
  };

  it('hides a module the workspace has switched off', () => {
    const access = accessFromSession(base);
    assert.equal(canSee(access, 'leave'), true);
    assert.equal(canSee(access, 'culture'), false);
    assert.equal(canSee(access, 'rewards'), false);
  });

  it('shows My Team only to people with reports, or HR', () => {
    assert.equal(canSee(accessFromSession(base), 'myTeam'), false);
    assert.equal(canSee(accessFromSession({ ...base, user: { ...base.user, is_manager: true } }), 'myTeam'), true);
    assert.equal(canSee(accessFromSession({ ...base, user: { ...base.user, role: 'sub_admin' } }), 'myTeam'), true);
  });

  it('hides self-service for a login without an employee record', () => {
    const access = accessFromSession({ ...base, user: { ...base.user, employee_id: null } });
    assert.equal(canSee(access, 'payslips'), false);
    assert.equal(canSee(access, 'approvals'), true);
  });

  it('keeps a linked product launcher visible', () => {
    const access = accessFromSession({
      ...base,
      user: { ...base.user, employee_id: null },
      tenant: { ...base.tenant, linked_products: { expense: { name: 'ExpenseGenie' } } },
    });
    assert.equal(canSee(access, 'expenses'), true);
  });

  it('recognises the module-off refusal', () => {
    assert.equal(isModuleOffError(403, 'The rewards module is not enabled for this workspace.'), true);
    assert.equal(isModuleOffError(403, 'You do not have access to this.'), false);
  });
});

describe('bulk decisions', () => {
  it('allows sources with both approve and reject, not links or clearances', async () => {
    const { bulkDecidable } = await import('../approvals.ts');
    assert.equal(bulkDecidable('leave'), true);
    assert.equal(bulkDecidable('attendance_regularisation'), true);
    assert.equal(bulkDecidable('clearance_task'), false);
    assert.equal(bulkDecidable('no_such_source'), false);
  });

  it('builds one request per item on its own route, skipping the rest', async () => {
    const { bulkRequests } = await import('../approvals.ts');
    const built = bulkRequests(
      [
        { id: 'l1', source: 'leave' },
        { id: 'r1', source: 'attendance_regularisation' },
        { id: 'c1', source: 'clearance_task' },
      ],
      'reject',
      ' Team is short that week ',
    );
    assert.deepEqual(built.map((b) => b.id), ['l1', 'r1']);
    assert.deepEqual(built[0]!.request, { method: 'POST', path: '/leave/requests/l1/reject', body: { note: 'Team is short that week' } });
    assert.deepEqual(built[1]!.request, { method: 'PATCH', path: '/attendance/regularisation/r1', body: { approve: false, note: 'Team is short that week' } });
  });

  it('needs a note to reject, and a connection', async () => {
    const { bulkBlockReason } = await import('../approvals.ts');
    assert.equal(bulkBlockReason('approve', 3, '', true), null);
    assert.match(bulkBlockReason('reject', 3, '  ', true)!, /note/);
    assert.match(bulkBlockReason('approve', 0, '', true)!, /Tick/);
    assert.match(bulkBlockReason(null, 2, '', true)!, /Choose/);
    assert.match(bulkBlockReason('approve', 2, '', false)!, /offline/);
  });
});
