import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FeatureKey } from '../access.ts';
import { FEATURES } from '../access.ts';
import { ALIASES, ROUTES } from '../routes.ts';
import { DEFAULT_HOME_SERVICES, HOME_SERVICE_COUNT, SERVICES, groupServices, homeServices, searchServices } from '../services.ts';
import { SPOT_NAMES } from '../spotNames.ts';

const everyone = { can: () => true, approver: true };

describe('services catalogue', () => {
  it('points every service at a real screen and a real feature', () => {
    for (const service of SERVICES) {
      assert.ok(service.route in ROUTES || service.route in ALIASES, `${service.key} -> ${service.route}`);
      assert.ok(service.feature in FEATURES, `${service.key} feature ${service.feature}`);
    }
    assert.equal(new Set(SERVICES.map((s) => s.key)).size, SERVICES.length, 'keys are unique');
  });

  it('gives every service a picture from the website set, no two alike in a group', () => {
    const known = new Set<string>(SPOT_NAMES);
    for (const service of SERVICES) assert.ok(known.has(service.spot), `${service.key} has a spot (${service.spot})`);
    for (const group of groupServices(SERVICES)) {
      const spots = group.services.map((s) => s.spot);
      assert.equal(new Set(spots).size, spots.length, `${group.key}: each service looks different`);
    }
    // On Home every tile must be told apart at a glance.
    const home = homeServices(everyone, null).map((s) => s.spot);
    assert.equal(new Set(home).size, home.length, 'Home tiles look different');
  });

  it('opens Home on the old HRMS grid, in its order', () => {
    assert.deepEqual(DEFAULT_HOME_SERVICES, [
      'punch', 'leave', 'payslips', 'regularise', 'documents', 'calendar', 'askMira',
      'taxDeclarations', 'punchHistory', 'helpdesk', 'policies', 'assets', 'approvals',
    ]);
    assert.equal(HOME_SERVICE_COUNT, DEFAULT_HOME_SERVICES.length);
  });

  it('keeps every screen that left Home reachable from All services', () => {
    // Home used to carry these as cards; now they are services like the rest.
    for (const route of ['Announcements', 'Celebrations', 'QuickLinks', 'WhoIsOut', 'Holidays', 'Leave', 'Punch']) {
      assert.ok(SERVICES.some((s) => s.route === route), `${route} is a service`);
    }
  });

  it('fills Home with the defaults, nothing the person cannot reach', () => {
    const all = homeServices(everyone, null);
    assert.equal(all.length, HOME_SERVICE_COUNT);
    assert.deepEqual(all.map((s) => s.key), DEFAULT_HOME_SERVICES.slice(0, HOME_SERVICE_COUNT));

    // An employee with no reports does not see Approvals; payroll switched off hides payslips.
    const employee = { can: (f: FeatureKey) => f !== 'payslips' && f !== 'tax', approver: false };
    const keys = homeServices(employee, null).map((s) => s.key);
    assert.ok(!keys.includes('approvals'));
    assert.ok(!keys.includes('payslips'));
    assert.deepEqual(keys, ['punch', 'leave', 'regularise', 'documents', 'calendar', 'askMira', 'punchHistory', 'helpdesk', 'policies', 'assets']);
  });

  it('keeps the person\'s own pick and order, skipping what they cannot reach', () => {
    const picked = homeServices({ can: (f) => f !== 'helpdesk', approver: false }, ['helpdesk', 'payslips', 'approvals', 'askMira', 'nope']);
    assert.deepEqual(picked.map((s) => s.key), ['payslips', 'askMira']);
  });

  it('finds things by the older HRMS\'s names', () => {
    const first = (q: string) => searchServices(q, SERVICES)[0]?.key;
    assert.equal(first('plug me'), 'documents');
    assert.equal(first('salary slip'), 'payslips');
    assert.equal(first('in out report'), 'punchHistory');
    assert.equal(first('Attendance Regularization'), 'regularise');
    assert.equal(first('change password'), 'security');
    assert.equal(first('separation'), 'exit');
    assert.equal(first('chatbot'), 'askMira');
    assert.equal(first('acknowledgement'), 'policies');
    assert.equal(first('birthday'), 'celebrations');
    assert.equal(first('approval'), 'approvals');
    assert.deepEqual(searchServices('zzzz', SERVICES), []);
    assert.equal(searchServices('', SERVICES).length, SERVICES.length, 'an empty search lists everything');
  });

  it('ranks a name match above a keyword match', () => {
    const keys = searchServices('leave', SERVICES).map((s) => s.key);
    assert.equal(keys[0], 'leave', 'a name that starts with the word comes first');
    // "Apply leave" has it in the name; "Who's out" only as a keyword ("team leave").
    assert.ok(keys.includes('whoIsOut'));
    assert.ok(keys.indexOf('applyLeave') < keys.indexOf('whoIsOut'));
  });

  it('groups what is left after a filter, dropping empty groups', () => {
    const groups = groupServices(SERVICES.filter((s) => s.group === 'leave' || s.group === 'pay'));
    assert.deepEqual(groups.map((g) => g.key), ['leave', 'pay']);
  });
});
