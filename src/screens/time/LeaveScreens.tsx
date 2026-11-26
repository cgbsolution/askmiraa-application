/**
 * Leave: balances, applying (with the days counted shown *before* sending),
 * history, a request's detail and cancelling it.
 *
 * Tier 1 — a leave request decides a day's pay.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  XCircle,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { leaveApi } from '../../api/leave';
import { AttachField } from '../../components/AttachField';
import { Badge, StatusBadge, Chip } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Fab } from '../../components/Fab';
import { Donut, LegendDot, seriesColor } from '../../components/Charts';
import { TabHeader } from '../../components/TabHeader';
import { ChoiceField, DateField, SelectField, SwitchRow, TextField } from '../../components/Field';
import { FormScreen } from '../../components/FormScreen';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { AskMiraChip } from '../../components/mira/AskMiraChip';
import { Row, Screen, Section, Stack } from '../../components/Screen';
import { ConfirmSheet } from '../../components/Sheet';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState, Notice, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { addDays, diffDays, formatDate, formatDateTime, formatRange, todayISO } from '../../core/dates';
import { formatDays, isPositiveAmount, plainDecimal } from '../../core/money';
import { statusLabel } from '../../core/status';
import type { LeaveBalanceRead, LeaveRequestCreate, LeaveRequestRead } from '../../core/types';
import type { UploadFile } from '../../lib/api';
import { t } from '../../lib/i18n';
import { useAction } from '../../lib/useAction';
import { useSession } from '../../lib/session';
import { useTheme } from '../../theme/ThemeProvider';
import { useGo, useParams } from '../../navigation/navigate';
import { layout, spacing } from '../../theme/tokens';

const requestsKey = ['leave', 'requests'];

function useRequests() {
  return useQuery({ queryKey: requestsKey, queryFn: () => leaveApi.requests({ page_size: 100 }) });
}

export function LeaveScreen() {
  const go = useGo();
  const { colors } = useTheme();
  const { can } = useSession();
  const balances = useQuery({ queryKey: ['leave', 'balances'], queryFn: () => leaveApi.balances() });
  const requests = useRequests();
  const [openType, setOpenType] = useState<string | null>(null);

  const all = (balances.data ?? []).filter((b) => !b.is_comp_off || Number(b.available_after_pending) > 0);
  // Statutory leave (maternity…) applies only when eligible: the portal lists
  // it apart, and it is not counted in what is "available".
  const statutory = all.filter((b) => b.is_statutory);
  const shown = [...all.filter((b) => !b.is_statutory), ...statutory];
  const counted = shown.filter((b) => b.is_paid && !b.is_statutory);
  const total = counted.reduce((sum, b) => sum + Math.max(0, Number(b.available_after_pending)), 0);
  const pending = (requests.data?.items ?? []).filter((r) => r.status === 'pending').length;

  return (
    <Screen
      header={<TabHeader title={t('Leave')} />}
      onRefresh={() => Promise.all([balances.refetch(), requests.refetch()])}
    >
      <QueryView
        query={balances}
        skeleton={<SkeletonCard lines={5} />}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState spot="calendar" title={t('No leave balances')} message={t('No leave policy is set up for you this year. Ask HR.')} />}
      >
        {() => (
          <Card tier="tier2">
            <View style={styles.overview}>
              <Donut
                size={layout.avatarXl + layout.avatarLg - spacing.sm}
                thickness={spacing.lg}
                centreLabel={t('Available')}
                centreValue={plainDecimal(String(total))}
                accessibilityLabel={t('{total} days of paid leave available', { total: plainDecimal(String(total)) })}
                parts={counted.map((b, index) => ({ key: b.leave_type_id, value: Math.max(0, Number(b.available_after_pending)), color: seriesColor(colors, index) }))}
              />
              <View style={styles.legend}>
                {counted.slice(0, 5).map((b, index) => (
                  <View key={b.leave_type_id} style={styles.legendRow}>
                    <LegendDot color={seriesColor(colors, index)} />
                    <Txt variant="callout" style={styles.flex} numberOfLines={2}>
                      {b.leave_type_name}
                    </Txt>
                    <Txt variant="calloutStrong" numeric>
                      {plainDecimal(b.available_after_pending)}
                    </Txt>
                  </View>
                ))}
              </View>
            </View>
            {statutory.length ? (
              <Txt variant="caption" tone="muted" style={styles.statutory}>
                {t('Statutory, when eligible: {list}', {
                  list: statutory.map((b) => `${b.leave_type_name} (${plainDecimal(b.available_after_pending)} ${t('days')})`).join(', '),
                })}
              </Txt>
            ) : null}
            <View style={styles.applyRow}>
              <Button label={t('Apply leave')} icon={CalendarPlus} variant="accent" onPress={() => go('ApplyLeave')} fullWidth />
            </View>
          </Card>
        )}
      </QueryView>

      {shown.length ? (
        <Section title={t('Balance by type')} description={t('Tap a type for how its days add up.')}>
          {shown.map((balance) => (
            <BalanceCard
              key={balance.leave_type_id}
              balance={balance}
              open={openType === balance.leave_type_id}
              onToggle={() => setOpenType((current) => (current === balance.leave_type_id ? null : balance.leave_type_id))}
            />
          ))}
          <View style={styles.chipRow}>
            <AskMiraChip question={t('How many leaves do I have left, and do any expire this year?')} />
          </View>
        </Section>
      ) : null}

      <Section title={t('Recent requests')} action={{ label: t('See all'), onPress: () => go('LeaveHistory') }}>
        <QueryView
          query={requests}
          skeleton={<SkeletonList rows={3} />}
          isEmpty={(data) => data.items.length === 0}
          empty={<EmptyState inline spot="calendarCheck" title={t('No requests yet')} message={t('Requests you make show here with their status.')} />}
        >
          {(data) => (
            <ListGroup>
              {data.items.slice(0, 4).map((request) => (
                <RequestRow key={request.id} request={request} onPress={() => go('LeaveDetail', { id: request.id })} />
              ))}
            </ListGroup>
          )}
        </QueryView>
      </Section>

      <Section title={t('More in leave')}>
        <ListGroup>
          <ListRow
            spot="calendarCheck"
            title={t('My leave requests')}
            trailing={pending ? <Badge label={t('{count} pending', { count: pending })} tone="warning" /> : undefined}
            onPress={() => go('LeaveHistory')}
          />
          <ListRow spot="calendarSwap" title={t('Comp-off')} subtitle={t('Claim a day for working on a day off')} onPress={() => go('CompOff')} />
          <ListRow spot="calendarStar" title={t('Holiday calendar')} onPress={() => go('Holidays')} />
          <ListRow spot="calendarHeart" title={t('Optional holidays')} onPress={() => go('OptionalHolidays')} />
          <ListRow spot="plane" title={t("Who's out")} subtitle={t('Your colleagues on leave this week')} onPress={() => go('WhoIsOut')} />
          {can('myTeam') ? <ListRow spot="team" title={t("My team's balances")} onPress={() => go('MyTeam')} /> : null}
        </ListGroup>
      </Section>
    </Screen>
  );
}

/** How often a leave type is credited, in words: "credited yearly". */
const ACCRUAL_WORDS: Record<string, string> = {
  annual: 'yearly',
  annually: 'yearly',
  yearly: 'yearly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  half_yearly: 'every six months',
  on_joining: 'on joining',
};

/**
 * One leave type: what is left now, and — tapped open — how the days add up,
 * in the older HRMS's terms (opening, credited, availed, pending, available).
 */
function BalanceCard({ balance, open, onToggle }: { balance: LeaveBalanceRead; open: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const frequency = balance.accrual_frequency ? t(ACCRUAL_WORDS[balance.accrual_frequency] ?? statusLabel(balance.accrual_frequency).toLowerCase()) : null;
  const quota = balance.is_statutory
    ? t('Statutory — when eligible')
    : isPositiveAmount(balance.annual_quota_days)
    ? frequency
      ? t('{quota} a year, credited {frequency}', { quota: plainDecimal(balance.annual_quota_days), frequency })
      : t('{quota} a year', { quota: plainDecimal(balance.annual_quota_days) })
    : balance.is_paid
      ? null
      : t('Unpaid');
  return (
    <Card padded="none">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${balance.leave_type_name}: ${plainDecimal(balance.available_after_pending)} ${t('days available')}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.balanceHead, pressed && { backgroundColor: colors.surfaceSunken }]}
      >
        <View style={styles.flex}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {balance.leave_type_name}
          </Txt>
          {quota ? (
            <Txt variant="caption" tone="muted" numberOfLines={1}>
              {quota}
            </Txt>
          ) : null}
        </View>
        <View style={styles.balanceFigure}>
          <Txt variant="statSmall" numeric>
            {plainDecimal(balance.available_after_pending)}
          </Txt>
          <Txt variant="caption" tone="muted">
            {t('days')}
          </Txt>
        </View>
        {open ? <ChevronUp size={layout.icon} color={colors.textMuted} /> : <ChevronDown size={layout.icon} color={colors.textMuted} />}
      </Pressable>
      {open ? (
        <View style={[styles.breakdown, { borderColor: colors.divider }]}>
          <KeyValue label={t('Opening')} value={plainDecimal(balance.opening)} />
          <KeyValue label={t('Credited this year')} value={plainDecimal(balance.accrued)} />
          {isPositiveAmount(balance.carried_forward) ? <KeyValue label={t('Carried forward')} value={plainDecimal(balance.carried_forward)} /> : null}
          {balance.adjusted && balance.adjusted !== '0' && balance.adjusted !== '0.00' ? <KeyValue label={t('Adjusted by HR')} value={plainDecimal(balance.adjusted)} /> : null}
          <KeyValue label={t('Availed')} value={plainDecimal(balance.used)} />
          {isPositiveAmount(balance.encashed) ? <KeyValue label={t('Encashed')} value={plainDecimal(balance.encashed)} /> : null}
          <KeyValue label={t('Balance')} value={plainDecimal(balance.available)} />
          <KeyValue label={t('Applied, awaiting approval')} value={plainDecimal(balance.pending)} tone={isPositiveAmount(balance.pending) ? 'warning' : 'default'} />
          <KeyValue label={t('Available to apply')} value={plainDecimal(balance.available_after_pending)} strong />
        </View>
      ) : null}
    </Card>
  );
}

function RequestRow({ request, onPress }: { request: LeaveRequestRead; onPress: () => void }) {
  return (
    <ListRow
      title={request.leave_type_name}
      subtitle={`${formatRange(request.start_date, request.end_date)} · ${request.is_half_day ? t('Half day') : formatDays(request.total_days)}`}
      trailing={<StatusBadge status={request.status} />}
      onPress={onPress}
    />
  );
}

const FILTERS = ['all', 'pending', 'approved', 'rejected', 'cancelled'] as const;

export function LeaveHistoryScreen() {
  const go = useGo();
  const requests = useRequests();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  return (
    <Screen onRefresh={() => requests.refetch()} overlay={<Fab icon={CalendarPlus} label={t('Apply leave')} onPress={() => go('ApplyLeave')} />}>
      <View style={styles.chipRow}>
        {FILTERS.map((value) => (
          <Chip key={value} label={value === 'all' ? t('All') : t(statusLabel(value))} selected={filter === value} onPress={() => setFilter(value)} />
        ))}
      </View>
      <QueryView query={requests} skeleton={<SkeletonList rows={6} />}>
        {(data) => {
          const shown = data.items.filter((r) => filter === 'all' || r.status === filter);
          return shown.length ? (
            <ListGroup>
              {shown.map((request) => (
                <RequestRow key={request.id} request={request} onPress={() => go('LeaveDetail', { id: request.id })} />
              ))}
            </ListGroup>
          ) : (
            <EmptyState spot="calendarCheck" title={t('Nothing here')} message={filter === 'all' ? t('You have not asked for leave yet.') : t('No requests with this status.')} />
          );
        }}
      </QueryView>
    </Screen>
  );
}

export function LeaveDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigation = useNavigation();
  const requests = useRequests();
  const [confirm, setConfirm] = useState(false);
  const cancel = useAction((requestId: string) => leaveApi.cancel(requestId), {
    success: t('Request cancelled'),
    invalidate: [['leave']],
  });

  if (requests.isPending) return <Screen><SkeletonCard lines={5} /></Screen>;
  if (!requests.data) return <Screen><ErrorState error={requests.error} onRetry={() => void requests.refetch()} /></Screen>;
  const request = requests.data.items.find((r) => r.id === id);
  if (!request) {
    return (
      <Screen>
        <EmptyState spot="calendarCheck" title={t('Request not found')} message={t('It may have been removed, or it belongs to someone else.')} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => requests.refetch()}>
      <Card>
        <Stack gap="row">
          <View style={styles.titleRow}>
            <Txt variant="title" style={styles.flex}>
              {request.leave_type_name}
            </Txt>
            <StatusBadge status={request.status} />
          </View>
          <KeyValue label={t('Dates')} value={formatRange(request.start_date, request.end_date)} />
          <KeyValue
            label={t('Days')}
            value={request.is_half_day ? `${t('Half day')} (${t(statusLabel(request.half_day_session ?? ''))})` : formatDays(request.total_days)}
          />
          {request.reason ? <KeyValue label={t('Reason')} value={request.reason} /> : null}
          <KeyValue label={t('Applied')} value={formatDateTime(request.created_at)} />
          {request.balance ? <KeyValue label={t('Balance after approval')} value={formatDays(request.balance.after_approval)} /> : null}
          {request.decision_note ? <Notice tone="info" title={t('Note from the approver')} message={request.decision_note} /> : null}
        </Stack>
      </Card>

      {request.approval_chain.length ? (
        <Section title={t('Approvals')}>
          <ListGroup>
            {request.approval_chain.map((step) => (
              <ListRow
                key={step.step}
                icon={step.status === 'approved' ? CheckCircle2 : step.status === 'rejected' ? XCircle : CircleDashed}
                iconTone={step.status === 'approved' ? 'success' : step.status === 'rejected' ? 'danger' : 'neutral'}
                title={step.decided_by_name || step.approver_name}
                subtitle={[t(statusLabel(step.status)), step.decided_at ? formatDateTime(step.decided_at) : null].filter(Boolean).join(' · ')}
                meta={step.note ?? undefined}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {request.can_cancel ? <Button label={t('Cancel this request')} variant="secondary" onPress={() => setConfirm(true)} fullWidth /> : null}

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('Cancel this leave request?')}
        message={
          request.status === 'approved'
            ? t('It was already approved. Cancelling gives the days back to your balance.')
            : t('Your approver will no longer see it.')
        }
        confirmLabel={t('Cancel request')}
        tone="danger"
        onConfirm={async () => {
          const done = await cancel.run(request.id);
          setConfirm(false);
          if (done) navigation.goBack();
        }}
      />
    </Screen>
  );
}

export function ApplyLeaveScreen() {
  const navigation = useNavigation();
  const params = useParams<{ start: string; end: string; halfDay: string; session: string; kind: string; reason: string }>();
  const types = useQuery({ queryKey: ['leave', 'types'], queryFn: leaveApi.types, staleTime: 10 * 60_000 });
  const balances = useQuery({ queryKey: ['leave', 'balances'], queryFn: () => leaveApi.balances() });
  const today = todayISO();

  const [typeId, setTypeId] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(params.start ?? null);
  const [end, setEnd] = useState<string | null>(params.end ?? params.start ?? null);
  const [halfDay, setHalfDay] = useState(params.halfDay === '1');
  const [session, setSession] = useState<'first_half' | 'second_half'>(params.session === 'second_half' ? 'second_half' : 'first_half');
  const [reason, setReason] = useState(params.reason ?? '');
  const [file, setFile] = useState<UploadFile | null>(null);
  const [touched, setTouched] = useState(false);

  const active = useMemo(() => (types.data ?? []).filter((type) => type.is_active && !type.is_comp_off), [types.data]);
  const type = active.find((item) => item.id === typeId) ?? null;

  // A type named in the words ("sick leave") is picked for the person.
  useEffect(() => {
    if (typeId || !params.kind || !active.length) return;
    const match = active.find((item) => item.name.toLowerCase().replace(/\s/g, '').includes(params.kind!.toLowerCase()));
    if (match) setTypeId(match.id);
  }, [active, params.kind, typeId]);

  useEffect(() => {
    if (start && end && diffDays(start, end) < 0) setEnd(start);
    if (halfDay && start && end !== start) setEnd(start);
  }, [start, end, halfDay]);

  const body: LeaveRequestCreate | null =
    typeId && start && end
      ? {
          leave_type_id: typeId,
          start_date: start,
          end_date: end,
          is_half_day: halfDay,
          half_day_session: halfDay ? session : null,
          reason: reason.trim() || null,
        }
      : null;

  const preview = useQuery({
    queryKey: ['leave', 'preview', body],
    queryFn: () => leaveApi.preview(body!),
    enabled: Boolean(body),
    staleTime: 0,
    retry: false,
  });

  const errors = {
    type: !typeId ? t('Choose a leave type.') : null,
    start: !start ? t('Choose the first day.') : null,
    end: start && end && diffDays(start, end) < 0 ? t('The last day cannot be before the first.') : null,
    file: type?.requires_document && !file ? t('{type} needs a supporting document.', { type: type.name }) : null,
    reason: reason.length > 2000 ? t('Keep the reason under 2000 characters.') : null,
  };
  const blocked = Object.values(errors).some(Boolean) || (preview.data ? !preview.data.allowed : false);

  const apply = useAction(
    async () => {
      let documentUrl: string | null = null;
      if (file) documentUrl = (await leaveApi.attach(file)).document_url;
      return leaveApi.apply({ ...body!, document_url: documentUrl });
    },
    { success: t('Leave applied. Your approver has been told.'), invalidate: [['leave'], ['approvals'], ['dashboard']] },
  );

  const dirty = Boolean(typeId || start || reason || file);
  const availableFor = (id: string) => balances.data?.find((b) => b.leave_type_id === id);

  return (
    <FormScreen
      submitLabel={t('Apply leave')}
      dirty={dirty}
      submitDisabled={Boolean(touched && blocked)}
      onSubmit={async () => {
        setTouched(true);
        if (blocked || !body) return;
        const done = await apply.run(undefined);
        if (done) navigation.goBack();
      }}
      footerNote={
        preview.data && preview.data.allowed ? (
          <Txt variant="callout" tone="muted">
            {t('{days} will be taken from your balance.', { days: formatDays(preview.data.total_days) })}
          </Txt>
        ) : null
      }
    >
      <Stack gap="row">
        {types.isPending ? (
          <SkeletonCard lines={1} />
        ) : (
          <SelectField
            label={t('Leave type')}
            required
            value={typeId}
            options={active.map((item) => {
              const balance = availableFor(item.id);
              return {
                value: item.id,
                label: item.name,
                description: balance ? t('{days} available', { days: plainDecimal(balance.available_after_pending) }) : item.is_paid ? t('Paid') : t('Unpaid'),
              };
            })}
            onChange={setTypeId}
            error={touched ? errors.type : null}
          />
        )}
        <Row>
          <View style={styles.flex}>
            <DateField label={t('From')} required value={start} onChange={setStart} error={touched ? errors.start : null} minimumDate={addDays(today, -60)} />
          </View>
          <View style={styles.flex}>
            <DateField label={t('To')} required value={end} onChange={setEnd} error={errors.end} minimumDate={start ?? undefined} disabled={halfDay} />
          </View>
        </Row>
        {type?.allows_half_day !== false ? (
          <SwitchRow label={t('Half day')} description={t('Only for a single day.')} value={halfDay} onChange={setHalfDay} />
        ) : null}
        {halfDay ? (
          <ChoiceField
            label={t('Which half?')}
            value={session}
            options={[
              { value: 'first_half', label: t('First half') },
              { value: 'second_half', label: t('Second half') },
            ]}
            onChange={setSession}
          />
        ) : null}
        <TextField label={t('Reason')} value={reason} onChangeText={setReason} multiline maxLength={2000} error={errors.reason} placeholder={t('Optional, but it helps your approver')} />
        {type?.requires_document ? (
          <AttachField label={t('Supporting document')} required value={file} onChange={setFile} error={touched ? errors.file : null} />
        ) : null}
      </Stack>

      {body ? (
        <Section title={t('What this takes')}>
          {preview.isFetching && !preview.data ? (
            <SkeletonCard lines={3} />
          ) : preview.error ? (
            <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
          ) : preview.data ? (
            <Card>
              <Stack gap="tight">
                <KeyValue label={t('Days counted')} value={formatDays(preview.data.total_days)} strong />
                {preview.data.weekly_offs.length ? (
                  <KeyValue label={t('Weekly offs not counted')} value={String(preview.data.weekly_offs.length)} />
                ) : null}
                {preview.data.holidays.map((holiday) => (
                  <KeyValue key={holiday.date} label={t('Holiday, not counted')} value={`${holiday.name}, ${formatDate(holiday.date)}`} />
                ))}
                {preview.data.available_before !== null ? (
                  <KeyValue label={t('Available now')} value={formatDays(preview.data.available_before)} />
                ) : null}
                {isPositiveAmount(preview.data.pending_days) ? (
                  <KeyValue label={t('Already waiting for approval')} value={formatDays(preview.data.pending_days)} />
                ) : null}
                {preview.data.available_after !== null ? (
                  <KeyValue label={t('Left after this')} value={formatDays(preview.data.available_after)} tone={preview.data.available_after?.startsWith('-') ? 'danger' : 'default'} />
                ) : null}
                {preview.data.approvers.length ? <KeyValue label={t('Goes to')} value={preview.data.approvers.join(', ')} /> : null}
              </Stack>
            </Card>
          ) : null}
          {preview.data?.problems.map((problem) => <Notice key={problem} tone="danger" message={problem} />)}
          {preview.data?.warnings.map((warning) => <Notice key={warning} tone="warning" message={warning} />)}
        </Section>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overview: { flexDirection: 'row', alignItems: 'center', gap: layout.row + spacing.xs },
  legend: { flex: 1, gap: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  applyRow: { paddingTop: layout.row + spacing.xs },
  statutory: { paddingTop: layout.row },
  balanceHead: { flexDirection: 'row', alignItems: 'center', gap: layout.row, paddingHorizontal: layout.card, paddingVertical: spacing.md, minHeight: layout.rowHeight + spacing.sm },
  balanceFigure: { alignItems: 'flex-end' },
  breakdown: { paddingHorizontal: layout.card, paddingVertical: spacing.md, gap: spacing.sm, borderTopWidth: layout.hairline },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
