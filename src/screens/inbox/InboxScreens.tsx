/**
 * Inbox — Notifications · Approvals · Tasks.
 *
 * Tier 1. Approvals are decided online only, after a confirm sheet, with a
 * note required to reject (README rule: a decision that silently fails to
 * sync is worse than one that could not be made). Each source is decided on
 * its own module's route, built by core/approvals.ts.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Laptop,
  LifeBuoy,
  Megaphone,
  ReceiptIndianRupee,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { approvalsApi } from '../../api/approvals';
import { attendanceApi } from '../../api/attendance';
import { leaveApi } from '../../api/leave';
import { notificationsApi, unreadFrom } from '../../api/notifications';
import { onboardingApi } from '../../api/onboarding';
import { Avatar } from '../../components/Avatar';
import { Badge, Chip } from '../../components/Badge';
import { Button, IconButton, LinkButton } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { usePageActions } from '../../components/PageShell';
import { ChoiceField, TextField } from '../../components/Field';
import { Card } from '../../components/Card';
import { IconTile, KeyValue, ListGroup, ListRow } from '../../components/List';
import { Screen, Section, Stack } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, Notice, QueryView, describeError } from '../../components/States';
import { Txt } from '../../components/Text';
import { toast } from '../../components/Toast';
import { actionsFor, blockReason, bulkBlockReason, bulkDecidable, bulkRequests, type ApprovalAction } from '../../core/approvals';
import { destinationFor } from '../../core/deepLinks';
import { formatDate, formatDateTime, formatRange, formatTime, readableDates, timeAgo } from '../../core/dates';
import type { Todo } from '../../core/home';
import { formatDays } from '../../core/money';
import { statusLabel } from '../../core/status';
import type { ApprovalInboxRead, ApprovalItemRead, ClearanceTaskRead, MyTaskRead, NotificationRead } from '../../core/types';
import { t, tn } from '../../lib/i18n';
import { useOnline } from '../../lib/network';
import { useSession } from '../../lib/session';
import { useTodos } from '../../lib/todos';
import { useAction } from '../../lib/useAction';
import { useGo, useParams } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';
import * as Haptics from 'expo-haptics';

type SegmentKey = 'notifications' | 'approvals' | 'tasks';

function iconFor(eventKey: string): LucideIcon {
  const domain = eventKey.split('.')[0];
  switch (domain) {
    case 'leave':
    case 'attendance':
    case 'timesheets':
      return CalendarDays;
    case 'payroll':
    case 'tax':
    case 'expenses':
      return ReceiptIndianRupee;
    case 'documents':
    case 'people':
      return FileText;
    case 'helpdesk':
      return LifeBuoy;
    case 'assets':
      return Laptop;
    case 'system':
      return Megaphone;
    case 'onboarding':
    case 'exit':
    case 'exits':
      return ClipboardCheck;
    case 'culture':
    case 'rewards':
      return Sparkles;
    default:
      return Bell;
  }
}

export function InboxScreen() {
  const params = useParams<{ segment: SegmentKey }>();
  const [segment, setSegment] = useState<SegmentKey>(params.segment ?? 'notifications');
  useEffect(() => {
    if (params.segment) setSegment(params.segment);
  }, [params.segment]);
  const { session, can } = useSession();
  const queryClient = useQueryClient();

  const notifications = useQuery({ queryKey: ['notifications', 'list'], queryFn: () => notificationsApi.list({ limit: 50 }) });
  const unread = useQuery({ queryKey: ['notifications', 'unread-count'], queryFn: notificationsApi.unreadCount });
  const inbox = useQuery({ queryKey: ['approvals', 'inbox'], queryFn: approvalsApi.inbox, enabled: can('approvals') });
  const tasks = useQuery({ queryKey: ['onboarding', 'my-tasks'], queryFn: () => onboardingApi.myTasks(), enabled: Boolean(session?.user.employee_id) });
  const clearance = useQuery({ queryKey: ['exits', 'clearance', 'mine'], queryFn: onboardingApi.clearanceMine, enabled: Boolean(session?.user.employee_id) });

  const markAll = useAction(() => notificationsApi.markAllRead(), { success: t('All marked read'), invalidate: [['notifications']] });
  const unreadCount = unreadFrom(unread.data);

  usePageActions(
    segment === 'notifications' && unreadCount > 0 ? (
      <IconButton icon={CheckCheck} label={t('Mark all read')} onPress={() => void markAll.run(undefined)} />
    ) : null,
    [segment, unreadCount],
  );

  const todo = useTodos();
  const pendingTasks = (tasks.data ?? []).filter((task) => task.status === 'pending').length + (clearance.data?.length ?? 0) + todo.todos.length;
  const showApprovals = (inbox.data?.total ?? 0) > 0 || Boolean(session?.user.is_manager) || session?.user.role !== 'employee';

  const segments = [
    { value: 'notifications' as const, label: t('Updates'), count: unreadCount },
    ...(showApprovals ? [{ value: 'approvals' as const, label: t('Approvals'), count: inbox.data?.total ?? 0 }] : []),
    { value: 'tasks' as const, label: t('Tasks'), count: pendingTasks },
  ];

  const refresh = () =>
    Promise.all([notifications.refetch(), unread.refetch(), inbox.refetch(), tasks.refetch(), clearance.refetch(), todo.refetch()]).then(() =>
      queryClient.invalidateQueries({ queryKey: ['approvals', 'count'] }),
    );

  if (segment === 'approvals' && showApprovals) {
    return <ApprovalList query={inbox} segments={segments} onSegment={setSegment} onRefresh={refresh} />;
  }

  return (
    <Screen inTabs={false} onRefresh={refresh}>
      <Segmented segments={segments} value={segment} onChange={setSegment} />
      {segment === 'notifications' ? <NotificationList query={notifications} /> : null}
      {segment === 'tasks' ? <TaskList tasks={tasks} clearance={clearance} todos={todo.todos} /> : null}
    </Screen>
  );
}

function NotificationList({ query }: { query: UseQueryResult<NotificationRead[]> }) {
  const go = useGo();
  const queryClient = useQueryClient();
  const open = (item: NotificationRead) => {
    if (!item.read_at) {
      void notificationsApi
        .markRead(item.id)
        .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
        .catch(() => {});
    }
    const destination = destinationFor(item.event_key, item.payload as Record<string, unknown>);
    go(destination.route, destination.params);
  };
  return (
    <QueryView
      query={query}
      skeleton={<SkeletonList rows={6} />}
      isEmpty={(data) => data.length === 0}
      empty={<EmptyState spot="bell" title={t('No notifications')} message={t('Updates about your requests and your company show here.')} />}
    >
      {(data) => (
        <ListGroup>
          {data.map((item) => (
            <NotificationRow key={item.id} item={item} onPress={() => open(item)} />
          ))}
        </ListGroup>
      )}
    </QueryView>
  );
}

function NotificationRow({ item, onPress }: { item: NotificationRead; onPress: () => void }) {
  const { colors } = useTheme();
  const unread = !item.read_at;
  // Server texts carry dates as 2026-10-30; people read 30 Oct 2026.
  const subject = item.rendered_subject ? readableDates(item.rendered_subject) : null;
  const body = readableDates(item.rendered_body);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? t('Unread') + '. ' : ''}${subject ?? ''}. ${body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.note, pressed && { backgroundColor: colors.surfaceSunken }]}
    >
      <IconTile icon={iconFor(item.event_key)} tone={item.is_urgent ? 'danger' : unread ? 'primary' : 'neutral'} />
      <View style={styles.flex}>
        <View style={styles.noteTop}>
          <Txt variant={unread ? 'bodyStrong' : 'body'} numberOfLines={2} style={styles.flex}>
            {subject ?? t(statusLabel(item.event_key.split('.').slice(-1)[0]))}
          </Txt>
          {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
        </View>
        <Txt variant="callout" tone="muted" numberOfLines={3}>
          {body}
        </Txt>
        <Txt variant="caption" tone="subtle">
          {timeAgo(item.created_at)}
        </Txt>
      </View>
    </Pressable>
  );
}

/**
 * Approvals waiting on the person — the older HRMS's approval screens, in one
 * list: filter by kind, read it latest first or person by person, tick
 * several and approve or reject them together with one remark. Each tick is
 * still its own decision on its own module's route (there is no bulk
 * endpoint), so the audit trail is the same as deciding one at a time.
 */
function ApprovalList({
  query,
  segments,
  onSegment,
  onRefresh,
}: {
  query: UseQueryResult<ApprovalInboxRead>;
  segments: { value: SegmentKey; label: string; count?: number }[];
  onSegment: (value: SegmentKey) => void;
  onRefresh: () => Promise<unknown>;
}) {
  const go = useGo();
  const { colors } = useTheme();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<string>('all');
  const [view, setView] = useState<'latest' | 'people'>('latest');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const items = query.data?.items ?? [];
  const kinds = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const item of items) counts.set(item.source, { label: item.source_label, count: (counts.get(item.source)?.count ?? 0) + 1 });
    return [...counts.entries()].map(([source, value]) => ({ source, ...value }));
  }, [items]);
  const shown = items.filter((item) => kind === 'all' || item.source === kind).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  const keyOf = (item: ApprovalItemRead) => `${item.source}:${item.id}`;
  const decidable = shown.filter((item) => bulkDecidable(item.source));
  const pickedItems = decidable.filter((item) => picked.has(keyOf(item)));
  const allPicked = decidable.length > 0 && pickedItems.length === decidable.length;

  const toggle = (item: ApprovalItemRead) => {
    const next = new Set(picked);
    if (next.has(keyOf(item))) next.delete(keyOf(item));
    else next.add(keyOf(item));
    setPicked(next);
  };
  const togglePerson = (list: ApprovalItemRead[]) => {
    const keys = list.filter((i) => bulkDecidable(i.source)).map(keyOf);
    const every = keys.length > 0 && keys.every((k) => picked.has(k));
    const next = new Set(picked);
    for (const k of keys) {
      if (every) next.delete(k);
      else next.add(k);
    }
    setPicked(next);
  };

  const people = useMemo(() => {
    const groups = new Map<string, ApprovalItemRead[]>();
    for (const item of shown) {
      const who = item.subject_name ?? t('Other');
      groups.set(who, [...(groups.get(who) ?? []), item]);
    }
    return [...groups.entries()];
  }, [shown]);

  const decide = async (decision: 'approve' | 'reject', noteText: string) => {
    const requests = bulkRequests(pickedItems, decision, noteText);
    let done = 0;
    const failures: string[] = [];
    for (const entry of requests) {
      try {
        await approvalsApi.decide(entry.request);
        done += 1;
      } catch (error) {
        const item = pickedItems.find((i) => i.id === entry.id && i.source === entry.source);
        failures.push(`${item?.subject_name ?? item?.title ?? ''}: ${describeError(error).message}`);
      }
    }
    setBulkOpen(false);
    setPicked(new Set());
    await queryClient.invalidateQueries({ queryKey: ['approvals'] });
    void queryClient.invalidateQueries({ queryKey: ['leave'] });
    void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    if (failures.length === 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(decision === 'approve' ? tn(done, '{count} approved', '{count} approved') : tn(done, '{count} rejected', '{count} rejected'));
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(
        t('{done} done, {failed} not: {reasons}', { done, failed: failures.length, reasons: failures.slice(0, 2).join('; ') }),
      );
    }
  };

  const row = (item: ApprovalItemRead, showName: boolean) => {
    const canPick = bulkDecidable(item.source);
    return (
      <Pressable
        key={keyOf(item)}
        accessibilityRole="button"
        accessibilityLabel={[item.subject_name, item.title, item.detail].filter(Boolean).join(', ')}
        onPress={() => go('ApprovalDetail', { id: item.id, source: item.source })}
        style={({ pressed }) => [styles.approvalRow, pressed && { backgroundColor: colors.surfaceSunken }]}
      >
        {canPick ? (
          <Checkbox checked={picked.has(keyOf(item))} onChange={() => toggle(item)} label={t('Choose {what}', { what: item.subject_name ?? item.title })} />
        ) : (
          <View style={styles.checkboxSpace} />
        )}
        <View style={styles.flex}>
          <View style={styles.approvalTop}>
            <Txt variant="label" tone="primary" style={styles.flex} numberOfLines={1}>
              {item.source_label.toUpperCase()}
            </Txt>
            {item.due_on ? <Badge label={t('Due {date}', { date: formatDate(item.due_on) })} tone="warning" /> : null}
          </View>
          <Txt variant="bodyStrong" numberOfLines={2}>
            {showName ? (item.subject_name ?? item.title) : item.title}
          </Txt>
          {showName && item.subject_name ? (
            <Txt variant="callout" numberOfLines={2}>
              {item.title}
            </Txt>
          ) : null}
          {item.detail ? (
            <Txt variant="callout" tone="muted" numberOfLines={3}>
              {item.detail}
            </Txt>
          ) : null}
          <Txt variant="caption" tone="subtle">
            {t('Asked {when}', { when: timeAgo(item.submitted_at) })}
          </Txt>
        </View>
        <ChevronRight size={layout.icon} color={colors.textSubtle} />
      </Pressable>
    );
  };

  const footer =
    decidable.length > 0 ? (
      <View style={styles.selectionBar}>
        <Checkbox
          checked={allPicked}
          mixed={pickedItems.length > 0 && !allPicked}
          onChange={() => setPicked(allPicked ? new Set() : new Set(decidable.map(keyOf)))}
          label={t('Select all')}
        />
        <View style={styles.flex}>
          <Txt variant="calloutStrong">{t('Select all')}</Txt>
          <Txt variant="caption" tone="muted">
            {t('{count} selected', { count: pickedItems.length })}
          </Txt>
        </View>
        <Button label={t('Bulk action')} variant="primary" disabled={pickedItems.length === 0 || !online} onPress={() => setBulkOpen(true)} />
      </View>
    ) : undefined;

  return (
    <Screen inTabs={false} onRefresh={onRefresh} footer={footer}>
      <Segmented segments={segments} value="approvals" onChange={onSegment} />
      <QueryView
        query={query}
        skeleton={<SkeletonList rows={5} />}
        isEmpty={(data) => data.items.length === 0}
        empty={<EmptyState spot="workflow" title={t('Nothing waiting on you')} message={t('Requests you need to approve show here.')} />}
      >
        {(data) => (
          <>
            {kinds.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds}>
                <Chip label={t('All ({count})', { count: items.length })} selected={kind === 'all'} onPress={() => setKind('all')} />
                {kinds.map((k) => (
                  <Chip key={k.source} label={`${k.label} (${k.count})`} selected={kind === k.source} onPress={() => setKind(k.source)} />
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.viewRow}>
              <Txt variant="caption" tone="muted" style={styles.flex}>
                {view === 'latest' ? t('Latest first') : t('Person by person')}
              </Txt>
              <LinkButton
                label={view === 'latest' ? t('Group by person') : t('Show latest first')}
                onPress={() => setView(view === 'latest' ? 'people' : 'latest')}
              />
            </View>
            {!online ? <Notice tone="warning" message={t('You are offline. Decisions are sent only with a connection, so nothing is lost.')} /> : null}

            {view === 'latest' ? (
              <Card padded="none">
                {shown.map((item, index) => (
                  <View key={keyOf(item)} style={index > 0 ? [styles.rule, { borderColor: colors.divider }] : null}>
                    {row(item, true)}
                  </View>
                ))}
              </Card>
            ) : (
              people.map(([who, list]) => {
                const keys = list.filter((i) => bulkDecidable(i.source)).map(keyOf);
                const every = keys.length > 0 && keys.every((k) => picked.has(k));
                const some = keys.some((k) => picked.has(k));
                const isFolded = folded.has(who);
                return (
                  <Card key={who} padded="none">
                    <View style={[styles.personHead, { borderColor: colors.divider }, !isFolded && styles.personHeadRule]}>
                      {keys.length ? (
                        <Checkbox checked={every} mixed={some && !every} onChange={() => togglePerson(list)} label={t('Choose all from {name}', { name: who })} />
                      ) : (
                        <View style={styles.checkboxSpace} />
                      )}
                      <Avatar name={who} size={layout.avatar} />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: !isFolded }}
                        accessibilityLabel={`${who}, ${tn(list.length, '{count} request', '{count} requests')}`}
                        onPress={() => {
                          const next = new Set(folded);
                          if (isFolded) next.delete(who);
                          else next.add(who);
                          setFolded(next);
                        }}
                        style={styles.personText}
                      >
                        <View style={styles.flex}>
                          <Txt variant="bodyStrong" numberOfLines={1}>
                            {who}
                          </Txt>
                          <Txt variant="caption" tone="muted">
                            {tn(list.length, '{count} request', '{count} requests')}
                          </Txt>
                        </View>
                        {isFolded ? <ChevronDown size={layout.icon} color={colors.textMuted} /> : <ChevronUp size={layout.icon} color={colors.textMuted} />}
                      </Pressable>
                    </View>
                    {!isFolded
                      ? list.map((item, index) => (
                          <View key={keyOf(item)} style={index > 0 ? [styles.rule, { borderColor: colors.divider }] : null}>
                            {row(item, false)}
                          </View>
                        ))
                      : null}
                  </Card>
                );
              })
            )}

            {data.sources
              .filter((source) => source.available === false && source.note)
              .map((source) => (
                <Notice key={source.key} tone="info" title={source.label} message={source.note!} />
              ))}
          </>
        )}
      </QueryView>
      <BulkActionSheet open={bulkOpen} count={pickedItems.length} online={online} onClose={() => setBulkOpen(false)} onSubmit={decide} />
    </Screen>
  );
}

/** Approve or reject the ticked requests, with one remark for all. */
function BulkActionSheet({
  open,
  count,
  online,
  onClose,
  onSubmit,
}: {
  open: boolean;
  count: number;
  online: boolean;
  onClose: () => void;
  onSubmit: (decision: 'approve' | 'reject', note: string) => Promise<void>;
}) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (open) {
      setDecision(null);
      setNote('');
      setTried(false);
    }
  }, [open]);
  const blocked = bulkBlockReason(decision, count, note, online);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={Boolean(note.trim()) && !busy}
      title={t('Bulk action')}
      description={tn(count, '{count} request selected. Each is decided on its own, with this remark.', '{count} requests selected. Each is decided on its own, with this remark.')}
      footer={
        <View style={styles.sheetButtons}>
          <Button label={t('Cancel')} variant="secondary" onPress={onClose} style={styles.flex} />
          <Button
            label={decision === 'reject' ? t('Reject {count}', { count }) : decision === 'approve' ? t('Approve {count}', { count }) : t('Submit')}
            variant={decision === 'reject' ? 'danger' : 'primary'}
            loading={busy}
            onPress={async () => {
              setTried(true);
              if (blocked || !decision) return;
              setBusy(true);
              try {
                await onSubmit(decision, note);
              } finally {
                setBusy(false);
              }
            }}
            style={styles.flex}
          />
        </View>
      }
    >
      <ChoiceField
        label={t('Action')}
        value={decision}
        options={[
          { value: 'approve' as const, label: t('Approve') },
          { value: 'reject' as const, label: t('Reject') },
        ]}
        onChange={(value) => setDecision(value)}
      />
      <TextField
        label={decision === 'reject' ? t('Remark (needed to reject)') : t('Remark')}
        value={note}
        onChangeText={setNote}
        placeholder={t('Add a remark here')}
        multiline
        maxLength={1000}
        error={tried && blocked && blocked !== 'You are offline. Decisions are sent only with a connection, so nothing is lost.' ? t(blocked) : null}
      />
      {!online ? <Notice tone="warning" message={t('You are offline. Decisions are sent only with a connection, so nothing is lost.')} /> : null}
    </Sheet>
  );
}

function TaskList({
  tasks,
  clearance,
  todos,
}: {
  tasks: UseQueryResult<MyTaskRead[]>;
  clearance: UseQueryResult<ClearanceTaskRead[]>;
  /** Everything else waiting on the person (lib/todos.ts). */
  todos: Todo[];
}) {
  const go = useGo();
  const [completing, setCompleting] = useState<{ id: string; title: string; kind: 'task' | 'clearance' } | null>(null);
  const complete = useAction(
    async ({ id, kind, note }: { id: string; kind: 'task' | 'clearance'; note: string }) =>
      kind === 'task'
        ? onboardingApi.complete(id, note.trim() || undefined)
        : approvalsApi.decide(actionsFor('clearance_task')[0]!.request!(id, note)),
    { success: t('Marked done'), invalidate: [['onboarding'], ['exits'], ['approvals']] },
  );
  const open = (tasks.data ?? []).filter((task) => task.status === 'pending');
  const loading = tasks.isPending && clearance.isPending;
  if (loading) return <SkeletonList rows={3} />;
  if (!open.length && !(clearance.data ?? []).length && !todos.length) {
    return (
      <EmptyState
        spot="checklist"
        title={t('Nothing to do')}
        message={t('Surveys to answer, policies to acknowledge, reviews, tax declarations, onboarding and exit tasks show here.')}
      />
    );
  }
  return (
    <>
      {todos.length ? (
        <Section title={t('To do')}>
          <ListGroup>
            {todos.map((todo) => (
              <ListRow
                key={todo.key}
                icon={todo.urgent ? TriangleAlert : CheckCircle2}
                iconTone={todo.urgent ? 'warning' : 'primary'}
                title={t(todo.title)}
                subtitle={t(todo.subtitle)}
                onPress={() => go(todo.route, todo.params)}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}
      {open.length ? (
        <Section title={t('Onboarding')}>
          <ListGroup>
            {open.map((task) => (
              <ListRow
                key={task.id}
                icon={ClipboardCheck}
                iconTone={task.is_overdue ? 'warning' : 'primary'}
                title={task.title}
                subtitle={[(task as { employee_name?: string }).employee_name, `${t('due')} ${formatDate(task.due_date)}`, task.is_overdue ? t('overdue') : null]
                  .filter(Boolean)
                  .join(' · ')}
                meta={task.description ?? undefined}
                trailing={
                  (task as { can_complete?: boolean }).can_complete !== false ? (
                    <Button label={t('Done')} size="sm" variant="secondary" onPress={() => setCompleting({ id: task.id, title: task.title, kind: 'task' })} />
                  ) : undefined
                }
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}
      {(clearance.data ?? []).length ? (
        <Section title={t('Exit clearance')}>
          <ListGroup>
            {clearance.data!.map((item) => (
              <ListRow
                key={item.item_id}
                icon={ClipboardCheck}
                title={item.description}
                subtitle={`${item.employee_name} · ${item.department}`}
                meta={item.last_working_day ? t('Last day {date}', { date: formatDate(item.last_working_day) }) : undefined}
                trailing={
                  <Button label={t('Clear')} size="sm" variant="secondary" onPress={() => setCompleting({ id: item.item_id, title: item.description, kind: 'clearance' })} />
                }
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}
      <ConfirmSheet
        open={completing !== null}
        onClose={() => setCompleting(null)}
        title={completing?.kind === 'clearance' ? t('Mark this cleared?') : t('Mark this done?')}
        message={completing?.title}
        confirmLabel={completing?.kind === 'clearance' ? t('Mark cleared') : t('Mark done')}
        note={{ label: t('Note') }}
        onConfirm={async (note) => {
          const target = completing;
          setCompleting(null);
          if (target) await complete.run({ id: target.id, kind: target.kind, note });
        }}
      />
    </>
  );
}

export function ApprovalDetailScreen() {
  const { id, source: sourceParam } = useParams<{ id: string; source: string }>();
  const navigation = useNavigation();
  const go = useGo();
  const online = useOnline();
  const queryClient = useQueryClient();
  const inbox = useQuery({ queryKey: ['approvals', 'inbox'], queryFn: approvalsApi.inbox });
  const item = inbox.data?.items.find((i) => i.id === id && (!sourceParam || i.source === sourceParam || sourceParam === 'regularisation'));
  const source = item?.source ?? (sourceParam === 'regularisation' ? 'attendance_regularisation' : sourceParam) ?? '';

  const leave = useQuery({ queryKey: ['leave', 'approvals'], queryFn: leaveApi.approvals, enabled: source === 'leave' });
  const regs = useQuery({ queryKey: ['attendance', 'regularisations', 'pending'], queryFn: attendanceApi.pendingRegularisations, enabled: source === 'attendance_regularisation' });
  const leaveRequest = leave.data?.find((r) => r.id === id);
  const reg = regs.data?.find((r) => r.id === id);

  const [action, setAction] = useState<ApprovalAction | null>(null);
  const actions = actionsFor(source);

  const decide = async (chosen: ApprovalAction, note: string) => {
    const request = chosen.request!(id!, note);
    try {
      await approvalsApi.decide(request);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(chosen.kind === 'reject' ? t('Rejected') : chosen.kind === 'accept' ? t('Accepted') : t('Approved'));
      await queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['leave'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setAction(null);
      navigation.goBack();
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(describeError(error).message);
    }
  };

  if (inbox.isPending) return <Screen><SkeletonCard lines={4} /></Screen>;
  if (!item) {
    return (
      <Screen>
        <EmptyState
          spot="workflow"
          title={t('Already decided')}
          message={t('This is no longer waiting on you. Someone may have decided it, or it was withdrawn.')}
          action={{ label: t('Back to approvals'), onPress: () => go('Approvals') }}
        />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => inbox.refetch()}>
      <Card>
        <Stack gap="row">
          <Badge label={item.source_label} tone="info" />
          <Txt variant="title">{item.subject_name ?? item.title}</Txt>
          {item.subject_name ? <Txt variant="headline">{item.title}</Txt> : null}
          {item.detail ? (
            <Txt variant="callout" tone="muted">
              {item.detail}
            </Txt>
          ) : null}
          <KeyValue label={t('Asked')} value={formatDateTime(item.submitted_at)} />
          {item.due_on ? <KeyValue label={t('Due')} value={formatDate(item.due_on)} tone="warning" /> : null}
        </Stack>
      </Card>

      {leaveRequest ? (
        <Section title={t('The request')}>
          <Card>
            <Stack gap="tight">
              <KeyValue label={t('Dates')} value={formatRange(leaveRequest.start_date, leaveRequest.end_date)} />
              <KeyValue label={t('Days')} value={leaveRequest.is_half_day ? t('Half day') : formatDays(leaveRequest.total_days)} />
              {leaveRequest.reason ? <KeyValue label={t('Reason')} value={leaveRequest.reason} /> : null}
              {leaveRequest.balance ? (
                <>
                  <KeyValue label={t('Available now')} value={formatDays(leaveRequest.balance.available)} />
                  <KeyValue label={t('Left if approved')} value={formatDays(leaveRequest.balance.after_approval)} tone={leaveRequest.balance.after_approval.startsWith('-') ? 'danger' : 'default'} />
                </>
              ) : null}
            </Stack>
          </Card>
        </Section>
      ) : null}

      {reg ? (
        <Section title={t('The correction')}>
          <Card>
            <Stack gap="tight">
              <KeyValue label={t('Day')} value={formatDate(reg.attendance_date)} />
              <KeyValue label={t('Shows now')} value={reg.current_status ? t(statusLabel(reg.current_status)) : '—'} />
              <KeyValue label={t('Asks for')} value={t(statusLabel(reg.requested_status))} />
              {reg.requested_first_in ? <KeyValue label={t('In at')} value={formatTime(reg.requested_first_in)} /> : null}
              {reg.requested_last_out ? <KeyValue label={t('Out at')} value={formatTime(reg.requested_last_out)} /> : null}
              <KeyValue label={t('Reason')} value={reg.reason} />
              {reg.period_locked ? <Notice tone="warning" message={t('This month is locked for payroll. Approving may need HR.')} /> : null}
            </Stack>
          </Card>
        </Section>
      ) : null}

      {!online ? <Notice tone="warning" message={t('You are offline. Decisions are sent only with a connection, so nothing is lost.')} /> : null}

      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((a) =>
            a.request ? (
              <View key={a.kind} style={styles.flex}>
                <Button
                  label={t(a.label)}
                  variant={a.tone === 'danger' ? 'secondary' : 'primary'}
                  onPress={() => setAction(a)}
                  disabled={!online}
                  fullWidth
                />
              </View>
            ) : (
              <View key={a.kind} style={styles.flex}>
                <Button label={t(a.label)} variant="primary" onPress={() => a.openRoute && go(a.openRoute as never)} fullWidth />
              </View>
            ),
          )}
        </View>
      ) : (
        <Notice tone="info" message={t('This kind of request is decided on the AskMiraa website.')} />
      )}

      <ConfirmSheet
        open={action !== null}
        onClose={() => setAction(null)}
        title={action ? `${t(action.label)}?` : ''}
        message={item.subject_name ? `${item.subject_name} · ${item.title}` : item.title}
        confirmLabel={action ? t(action.label) : ''}
        tone={action?.tone === 'danger' ? 'danger' : 'primary'}
        note={action ? { label: action.kind === 'reject' ? t('Why are you rejecting it?') : t('Note (optional)'), required: action.noteRequired } : undefined}
        blocked={action ? blockReason(action, 'x', online) : null}
        onConfirm={async (note) => {
          if (!action) return;
          const reason = blockReason(action, note, online);
          if (reason) {
            toast.error(reason);
            return;
          }
          await decide(action, note);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: layout.row,
    paddingHorizontal: layout.card,
    paddingVertical: spacing.md,
    minHeight: layout.rowHeight,
  },
  noteTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill },
  actions: { flexDirection: 'row', gap: spacing.sm },
  kinds: { gap: spacing.sm, paddingRight: layout.gutter },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  approvalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: layout.row, paddingHorizontal: layout.card, paddingVertical: spacing.md },
  approvalTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkboxSpace: { width: layout.iconLg - spacing.xxs },
  rule: { borderTopWidth: layout.hairline },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: layout.row, paddingLeft: layout.card, paddingRight: spacing.md, paddingVertical: spacing.md },
  personHeadRule: { borderBottomWidth: layout.hairline },
  personText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: layout.touch },
  selectionBar: { flexDirection: 'row', alignItems: 'center', gap: layout.row },
  sheetButtons: { flexDirection: 'row', gap: spacing.sm },
});

