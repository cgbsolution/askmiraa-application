/**
 * What is waiting on the person, beyond approvals and notifications: a punch
 * that was not recorded, a survey to answer, a policy or an announcement to
 * acknowledge, an asset to confirm, a review or feedback asked of them, a tax
 * declaration window closing. (Onboarding and exit tasks are listed by the
 * Inbox's Tasks tab itself, with their Done buttons.)
 *
 * Shown in the Inbox's Tasks tab and counted on every tab's bell. Each source
 * is asked only when its module is on; one that fails is left out, never
 * guessed.
 */

import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { cultureApi } from '../api/culture';
import { workplaceApi } from '../api/workplace';
import { todayISO } from '../core/dates';
import { buildTodos, type Todo } from '../core/home';
import { punchQueueFor } from './punchQueue';
import { useSession } from './session';

export function useTodos(): { todos: Todo[]; loading: boolean; refetch: () => Promise<unknown> } {
  const { session, can } = useSession();
  const today = todayISO();
  const self = Boolean(session?.user.employee_id);
  const userId = session?.user.id ?? 'anonymous';

  const sources = useQueries({
    queries: [
      { queryKey: ['culture', 'surveys', 'mine'], queryFn: cultureApi.mySurveys, enabled: can('culture') && self },
      { queryKey: ['documents', 'company'], queryFn: workplaceApi.companyDocuments, enabled: can('policies') },
      { queryKey: ['assets', 'me'], queryFn: workplaceApi.myAssets, enabled: can('assets') },
      { queryKey: ['appraisal', 'my'], queryFn: workplaceApi.myAppraisals, enabled: can('appraisal') },
      { queryKey: ['feedback', 'inbox'], queryFn: workplaceApi.feedbackInbox, enabled: can('feedback') },
      { queryKey: ['tax', 'windows'], queryFn: workplaceApi.taxWindows, enabled: can('tax') },
      { queryKey: ['culture', 'announcements'], queryFn: cultureApi.announcements, enabled: can('culture') },
    ],
  });
  // The same query the punch screens use, so a punch sent later clears it everywhere.
  const queue = useQuery({
    queryKey: ['punch-queue', userId],
    queryFn: () => punchQueueFor(userId).all(),
    enabled: can('punch'),
    staleTime: 0,
    networkMode: 'always',
  });

  const [surveys, documents, assets, appraisals, feedback, taxWindows, announcements] = sources.map((q) => q.data);
  const todos = useMemo(
    () =>
      buildTodos({
        today,
        surveys: surveys as never,
        documents: documents as never,
        assets: assets as never,
        appraisals: appraisals as never,
        feedback: feedback as never,
        taxWindows: taxWindows as never,
        announcements: announcements as never,
        unsentPunches: (queue.data ?? []).filter((p) => (p.state === 'stale' || p.state === 'rejected') && !p.resolvedAt),
      }),
    [today, surveys, documents, assets, appraisals, feedback, taxWindows, announcements, queue.data],
  );

  return {
    todos,
    loading: sources.some((q) => q.isPending && q.fetchStatus !== 'idle'),
    refetch: () => Promise.all([...sources.map((q) => q.refetch()), queue.refetch()]),
  };
}
