/**
 * Where the bell opens. Pure, so it is tested in Node (lib/inbox.ts counts).
 *
 * What is waiting comes first: approvals when nothing new has arrived, the
 * updates when something has, and the things to do (a survey, a policy to
 * acknowledge, a punch not recorded) when they are all that waits.
 */

export interface InboxCount {
  unread: number;
  approvals: number;
  todos: number;
  total: number;
}

export function inboxTarget(count: InboxCount): { route: 'Approvals' | 'Notifications' | 'Tasks' } {
  if (count.approvals > 0 && count.unread === 0) return { route: 'Approvals' };
  if (count.unread === 0 && count.todos > 0) return { route: 'Tasks' };
  return { route: 'Notifications' };
}
