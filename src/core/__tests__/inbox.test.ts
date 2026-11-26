import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { inboxTarget } from '../inbox.ts';

const count = (unread: number, approvals: number, todos: number) => ({ unread, approvals, todos, total: unread + approvals + todos });

describe('the bell', () => {
  it('opens on what is waiting', () => {
    assert.equal(inboxTarget(count(0, 3, 0)).route, 'Approvals', 'approvals, when nothing new has arrived');
    assert.equal(inboxTarget(count(2, 3, 1)).route, 'Notifications', 'new updates first');
    assert.equal(inboxTarget(count(0, 0, 2)).route, 'Tasks', 'things to do, when they are all that waits');
    assert.equal(inboxTarget(count(0, 2, 2)).route, 'Approvals', 'approvals before things to do');
    assert.equal(inboxTarget(count(0, 0, 0)).route, 'Notifications', 'nothing waiting: the updates');
  });
});
