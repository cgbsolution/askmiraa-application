import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ROUTES } from '../routes.ts';
import { ROUTE_MODULES, moduleOffFor } from '../routeModules.ts';

describe('screens of a switched-off module', () => {
  const modules = { leave: true, payroll: true, core_hr: true, culture: false, rewards: true, hiring: true };

  it('names the module a screen needs when it is off', () => {
    assert.equal(moduleOffFor('Shoutouts', modules), 'culture');
    assert.equal(moduleOffFor('GiveShoutout', modules), 'culture');
    assert.equal(moduleOffFor('Payslips', modules), null);
    assert.equal(moduleOffFor('Profile', modules), null, 'a screen with no module is never gated');
  });

  it('treats a module missing from the workspace as off', () => {
    assert.equal(moduleOffFor('Rewards', {}), 'rewards');
  });

  it('only names real screens', () => {
    for (const route of Object.keys(ROUTE_MODULES)) assert.ok(route in ROUTES, `${route} is not a route`);
  });
});
