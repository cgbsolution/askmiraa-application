/**
 * What is waiting in the Inbox: unread notifications, approvals waiting on
 * the person, and things to do (lib/todos.ts). One query per source, shared
 * by every tab's bell, so the badge reads the same wherever it shows.
 */

import { useQuery } from '@tanstack/react-query';

import { approvalsApi } from '../api/approvals';
import { notificationsApi, unreadFrom } from '../api/notifications';
import { inboxTarget, type InboxCount } from '../core/inbox';
import { useSession } from './session';
import { useTodos } from './todos';

export { inboxTarget, type InboxCount };

/** The total from GET /approvals/count, whatever key the server used. */
export function approvalsTotal(payload: Record<string, number> | undefined): number {
  if (!payload) return 0;
  const value = payload.total ?? payload.count ?? Object.values(payload)[0];
  return typeof value === 'number' ? value : 0;
}

export function useInboxCount(): InboxCount {
  const { can } = useSession();
  const unread = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60_000,
  });
  const approvals = useQuery({
    queryKey: ['approvals', 'count'],
    queryFn: approvalsApi.count,
    refetchInterval: 120_000,
    enabled: can('approvals'),
  });
  const { todos } = useTodos();
  const unreadCount = unreadFrom(unread.data);
  const approvalCount = approvalsTotal(approvals.data);
  return { unread: unreadCount, approvals: approvalCount, todos: todos.length, total: unreadCount + approvalCount + todos.length };
}
