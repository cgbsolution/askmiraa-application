/**
 * The rest of Time: comp-off, optional holidays, the holiday calendar,
 * shifts and swaps, overtime and the weekly timesheet.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Repeat2, Sun, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { attendanceApi, monthPeriodQuery, type ShiftSwap } from '../../api/attendance';
import { leaveApi } from '../../api/leave';
import { peopleApi } from '../../api/people';
import { timesheetsApi, type TimesheetEntry } from '../../api/timesheets';
import { Badge, StatusBadge } from '../../components/Badge';
import { Button, IconButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { AmountField, ChoiceField, DateField, SearchField, SelectField, SwitchRow, TextField } from '../../components/Field';
import { FormScreen } from '../../components/FormScreen';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { Money } from '../../components/Money';
import { Screen, Section, Stack } from '../../components/Screen';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, Notice, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { validateAmount } from '../../core/amount';
import { MONTHS_LONG, addDays, diffDays, formatDate, formatDayLabel, formatMinutes, formatRange, parseISODate, startOfWeek, todayISO } from '../../core/dates';
import { shiftTimes, weeklyOffNames } from '../../core/home';
import { formatDays, plainDecimal, sumDecimals } from '../../core/money';
import { personName } from '../../core/status';
import { t } from '../../lib/i18n';
import { useAction } from '../../lib/useAction';
import { useGo } from '../../navigation/navigate';
import { layout, spacing } from '../../theme/tokens';

// ── Comp-off ─────────────────────────────────────────────────────────────────

export function CompOffScreen() {
  const go = useGo();
  const claims = useQuery({ queryKey: ['leave', 'comp-off'], queryFn: leaveApi.compOffs });
  const [cancelling, setCancelling] = useState<string | null>(null);
  const cancel = useAction((id: string) => leaveApi.cancelCompOff(id), { success: t('Claim withdrawn'), invalidate: [['leave']] });
  return (
    <Screen onRefresh={() => claims.refetch()}>
      <Txt variant="callout" tone="muted">
        {t('Worked on a weekly off or a holiday? Claim the day back. Once approved it is added to your comp-off balance.')}
      </Txt>
      <Button label={t('Claim comp-off')} icon={Sun} variant="accent" onPress={() => go('NewCompOff')} fullWidth />
      <QueryView
        query={claims}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState inline spot="calendarSwap" title={t('No claims yet')} />}
      >
        {(data) => (
          <ListGroup>
            {data.map((claim) => (
              <ListRow
                key={claim.id}
                title={`${formatDate(claim.worked_date)}${claim.worked_day_label ? ` · ${claim.worked_day_label}` : ''}`}
                subtitle={`${formatDays(claim.days)} · ${claim.reason}`}
                meta={[
                  claim.expires_on ? t('Use by {date}', { date: formatDate(claim.expires_on) }) : null,
                  claim.decision_note ? `${t('Note')}: ${claim.decision_note}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined}
                trailing={<StatusBadge status={claim.status} />}
                onPress={claim.can_cancel ? () => setCancelling(claim.id) : undefined}
                chevron={false}
              />
            ))}
          </ListGroup>
        )}
      </QueryView>
      <ConfirmSheet
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={t('Withdraw this claim?')}
        confirmLabel={t('Withdraw')}
        tone="danger"
        onConfirm={async () => {
          const id = cancelling;
          setCancelling(null);
          if (id) await cancel.run(id);
        }}
      />
    </Screen>
  );
}

export function NewCompOffScreen() {
  const navigation = useNavigation();
  const today = todayISO();
  const [date, setDate] = useState<string | null>(null);
  const [days, setDays] = useState<'1' | '0.5'>('1');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const claim = useAction(() => leaveApi.claimCompOff({ worked_date: date!, days, reason: reason.trim() }), {
    success: t('Claim sent for approval'),
    invalidate: [['leave'], ['approvals']],
  });
  const errors = {
    date: !date ? t('Choose the day you worked.') : null,
    reason: !reason.trim() ? t('Say what you worked on.') : null,
  };
  return (
    <FormScreen
      submitLabel={t('Send claim')}
      dirty={Boolean(date || reason)}
      onSubmit={async () => {
        setTouched(true);
        if (errors.date || errors.reason) return;
        if (await claim.run(undefined)) navigation.goBack();
      }}
    >
      <Stack gap="row">
        <DateField label={t('Day you worked')} required value={date} onChange={setDate} maximumDate={today} minimumDate={addDays(today, -90)} error={touched ? errors.date : null} />
        <ChoiceField
          label={t('How much?')}
          value={days}
          options={[
            { value: '1', label: t('Full day') },
            { value: '0.5', label: t('Half day') },
          ]}
          onChange={setDays}
        />
        <TextField label={t('What did you work on?')} required value={reason} onChangeText={setReason} multiline maxLength={2000} error={touched ? errors.reason : null} />
      </Stack>
    </FormScreen>
  );
}

// ── Holidays ─────────────────────────────────────────────────────────────────

export function OptionalHolidaysScreen() {
  const year = Number(todayISO().slice(0, 4));
  const query = useQuery({ queryKey: ['holidays', 'optional', year], queryFn: () => leaveApi.optionalHolidays(year) });
  const toggle = useAction(
    ({ id, pick }: { id: string; pick: boolean }) => (pick ? leaveApi.pickOptional(id) : leaveApi.unpickOptional(id)),
    { invalidate: [['holidays']], success: (r) => t('{chosen} of {quota} chosen', { chosen: r.chosen, quota: r.quota }) },
  );
  return (
    <Screen onRefresh={() => query.refetch()}>
      <QueryView query={query} skeleton={<SkeletonList rows={5} />}>
        {(data) => (
          <>
            <Card variant="soft">
              <Txt variant="headline">{t('{chosen} of {quota} chosen for {year}', { chosen: data.chosen, quota: data.quota, year: data.year })}</Txt>
              <Txt variant="callout" tone="muted">
                {t('Pick the festivals you want off. Past dates cannot be changed.')}
              </Txt>
            </Card>
            {data.holidays.length ? (
              <Card>
                {data.holidays.map((holiday) => {
                  const past = diffDays(todayISO(), holiday.holiday_date) < 0;
                  const full = data.chosen >= data.quota && !holiday.selected;
                  return (
                    <SwitchRow
                      key={holiday.id}
                      label={holiday.name}
                      description={formatDayLabel(holiday.holiday_date) + (past ? ` · ${t('past')}` : full ? ` · ${t('quota used')}` : '')}
                      value={Boolean(holiday.selected)}
                      disabled={past || full || toggle.pending}
                      onChange={(pick) => void toggle.run({ id: holiday.id, pick })}
                    />
                  );
                })}
              </Card>
            ) : (
              <EmptyState spot="calendarHeart" title={t('No optional holidays this year')} />
            )}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

export function HolidaysScreen() {
  const year = Number(todayISO().slice(0, 4));
  const query = useQuery({ queryKey: ['holidays', year], queryFn: () => leaveApi.holidays(year), staleTime: 6 * 60 * 60_000 });
  const today = todayISO();
  const grouped = useMemo(() => {
    const mine = (query.data ?? []).filter((h) => h.applies_to_me !== false);
    const months = new Map<number, typeof mine>();
    for (const h of mine) {
      const m = parseISODate(h.holiday_date)!.m;
      months.set(m, [...(months.get(m) ?? []), h]);
    }
    return [...months.entries()].sort((a, b) => a[0] - b[0]);
  }, [query.data]);
  return (
    <Screen onRefresh={() => query.refetch()}>
      <QueryView query={query} isEmpty={() => grouped.length === 0} empty={<EmptyState spot="calendarStar" title={t('No holidays published yet')} />}>
        {() =>
          grouped.map(([month, list]) => (
            <Section key={month} title={t(MONTHS_LONG[month - 1] ?? '')}>
              <ListGroup>
                {list.map((h) => (
                  <ListRow
                    key={h.id}
                    title={h.name}
                    subtitle={formatDayLabel(h.holiday_date)}
                    meta={h.location_name ?? undefined}
                    trailing={
                      h.is_optional ? (
                        <Badge label={h.selected ? t('Chosen') : t('Optional')} tone={h.selected ? 'success' : 'neutral'} />
                      ) : diffDays(today, h.holiday_date) < 0 ? (
                        <Badge label={t('Past')} tone="neutral" />
                      ) : undefined
                    }
                  />
                ))}
              </ListGroup>
            </Section>
          ))
        }
      </QueryView>
    </Screen>
  );
}

// ── Shifts and swaps ─────────────────────────────────────────────────────────

const SWAP_LABEL: Record<ShiftSwap['status'], string> = {
  awaiting_partner: 'Waiting for your colleague',
  awaiting_approval: 'Waiting for approval',
  approved: 'Approved',
  declined: 'Colleague said no',
  rejected: 'Not approved',
  cancelled: 'Cancelled',
};

export function ShiftsScreen() {
  const go = useGo();
  const today = todayISO();
  const period = useQuery(monthPeriodQuery(today));
  const swaps = useQuery({ queryKey: ['attendance', 'swaps'], queryFn: attendanceApi.swaps });
  const [acting, setActing] = useState<{ swap: ShiftSwap; kind: 'accept' | 'decline' | 'cancel' } | null>(null);
  const respond = useAction(({ id, accept }: { id: string; accept: boolean }) => attendanceApi.respondSwap(id, accept), {
    success: t('Answer sent'),
    invalidate: [['attendance', 'swaps']],
  });
  const cancel = useAction((id: string) => attendanceApi.cancelSwap(id), { success: t('Swap cancelled'), invalidate: [['attendance', 'swaps']] });

  return (
    <Screen onRefresh={() => Promise.all([period.refetch(), swaps.refetch()])}>
      <Section title={t('My shift')}>
        <QueryView query={period} skeleton={<SkeletonCard lines={2} />}>
          {(data) =>
            data.shift_today ? (
              <Card>
                <Stack gap="tight">
                  <Txt variant="headline">{data.shift_today.name}</Txt>
                  <KeyValue label={t('Hours')} value={shiftTimes(data.shift_today) ?? '—'} />
                  <KeyValue label={t('Break')} value={formatMinutes(data.shift_today.break_minutes)} />
                  <KeyValue label={t('Grace for late')} value={formatMinutes(data.shift_today.grace_in_minutes)} />
                  <KeyValue
                    label={t('Weekly off')}
                    value={weeklyOffNames(data.shift_today.weekly_off_days).map((d) => t(d)).join(', ') || '—'}
                  />
                  {data.shift_today_is_default ? (
                    <Txt variant="caption" tone="muted">
                      {t('This is the company’s default shift; none is assigned to you by name.')}
                    </Txt>
                  ) : null}
                </Stack>
              </Card>
            ) : (
              <EmptyState inline spot="clock" title={t('No shift assigned')} message={t('Ask HR to assign you a shift.')} />
            )
          }
        </QueryView>
      </Section>

      <Section title={t('Shift swaps')} action={{ label: t('Request a swap'), onPress: () => go('ShiftSwap') }}>
        <QueryView
          query={swaps}
          isEmpty={(data) => data.length === 0}
          empty={<EmptyState inline spot="clock" title={t('No swaps')} message={t('Swap a day with a colleague; your manager approves it.')} />}
        >
          {(data) => (
            <ListGroup>
              {data.map((swap) => {
                const other = swap.you_are === 'requester' ? swap.partner_name : swap.requester_name;
                const canAnswer = swap.you_are === 'partner' && swap.status === 'awaiting_partner';
                const canCancel = swap.you_are === 'requester' && (swap.status === 'awaiting_partner' || swap.status === 'awaiting_approval');
                return (
                  <View key={swap.id}>
                    <ListRow
                      icon={Repeat2}
                      title={`${formatDayLabel(swap.swap_date)} · ${t('with {name}', { name: other })}`}
                      subtitle={`${swap.requester_shift.name} ⇄ ${swap.partner_shift.name}`}
                      meta={swap.reason}
                      trailing={<Badge label={t(SWAP_LABEL[swap.status])} tone={swap.status === 'approved' ? 'success' : swap.status.startsWith('awaiting') ? 'warning' : 'neutral'} />}
                    />
                    {canAnswer || canCancel ? (
                      <View style={styles.inlineActions}>
                        {canAnswer ? (
                          <>
                            <Button label={t('Accept')} size="sm" variant="primary" onPress={() => setActing({ swap, kind: 'accept' })} />
                            <Button label={t('Decline')} size="sm" variant="secondary" onPress={() => setActing({ swap, kind: 'decline' })} />
                          </>
                        ) : null}
                        {canCancel ? <Button label={t('Cancel')} size="sm" variant="secondary" onPress={() => setActing({ swap, kind: 'cancel' })} /> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ListGroup>
          )}
        </QueryView>
      </Section>

      <ConfirmSheet
        open={acting !== null}
        onClose={() => setActing(null)}
        title={
          acting?.kind === 'accept' ? t('Accept this swap?') : acting?.kind === 'decline' ? t('Decline this swap?') : t('Cancel this swap?')
        }
        message={acting ? `${formatDayLabel(acting.swap.swap_date)} · ${acting.swap.requester_shift.name} ⇄ ${acting.swap.partner_shift.name}` : undefined}
        confirmLabel={acting?.kind === 'accept' ? t('Accept') : acting?.kind === 'decline' ? t('Decline') : t('Cancel swap')}
        tone={acting?.kind === 'accept' ? 'primary' : 'danger'}
        onConfirm={async () => {
          const target = acting;
          setActing(null);
          if (!target) return;
          if (target.kind === 'cancel') await cancel.run(target.swap.id);
          else await respond.run({ id: target.swap.id, accept: target.kind === 'accept' });
        }}
      />
    </Screen>
  );
}

export function ShiftSwapScreen() {
  const navigation = useNavigation();
  const today = todayISO();
  const [search, setSearch] = useState('');
  const [partner, setPartner] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const people = useQuery({
    queryKey: ['people', 'colleagues', search],
    queryFn: () => peopleApi.colleagues(search.trim()),
    enabled: search.trim().length >= 2,
  });
  const request = useAction(() => attendanceApi.requestSwap({ partner_employee_id: partner!, swap_date: date!, reason: reason.trim() }), {
    success: t('Swap asked. Your colleague will be told.'),
    invalidate: [['attendance', 'swaps']],
  });
  const errors = {
    partner: !partner ? t('Choose the colleague.') : null,
    date: !date ? t('Choose the day.') : null,
    reason: !reason.trim() ? t('Say why.') : null,
  };
  const options = (people.data ?? []).map((p) => ({ value: p.id, label: personName(p), description: p.designation ?? undefined }));
  return (
    <FormScreen
      submitLabel={t('Ask for the swap')}
      dirty={Boolean(partner || date || reason)}
      onSubmit={async () => {
        setTouched(true);
        if (Object.values(errors).some(Boolean)) return;
        if (await request.run(undefined)) navigation.goBack();
      }}
    >
      <Stack gap="row">
        <SearchField
          label={t('Find a colleague')}
          showLabel
          value={search}
          onChangeText={setSearch}
          placeholder={t('Type at least two letters')}
          // The colleagues found, to choose straight from the box.
          suggestions={(people.data ?? []).map((p) => ({
            key: p.id,
            label: personName(p),
            hint: p.designation ?? undefined,
          }))}
          onPick={(line) => setPartner(line.key)}
        />
        <SelectField
          label={t('Colleague')}
          required
          value={partner}
          options={options}
          onChange={setPartner}
          placeholder={search.trim().length < 2 ? t('Search first') : people.isFetching ? t('Searching…') : t('Choose…')}
          disabled={!options.length}
          error={touched ? errors.partner : null}
        />
        <DateField label={t('Day to swap')} required value={date} onChange={setDate} minimumDate={addDays(today, 1)} error={touched ? errors.date : null} />
        <TextField label={t('Reason')} required value={reason} onChangeText={setReason} multiline maxLength={1000} error={touched ? errors.reason : null} />
      </Stack>
    </FormScreen>
  );
}

// ── Overtime ─────────────────────────────────────────────────────────────────

export function OvertimeScreen() {
  const query = useQuery({ queryKey: ['attendance', 'overtime', 'mine'], queryFn: () => attendanceApi.overtime() });
  return (
    <Screen onRefresh={() => query.refetch()}>
      <QueryView
        query={query}
        skeleton={<SkeletonList rows={4} />}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState spot="clockPlus" title={t('No overtime recorded')} message={t('Time worked beyond your shift, under your company’s overtime policy, shows here.')} />}
      >
        {(data) => (
          <>
            <Card>
              <Stack gap="tight">
                <KeyValue label={t('Approved')} value={formatMinutes(data.reduce((sum, e) => sum + (e.approved_minutes ?? 0), 0))} strong />
                <KeyValue label={t('Waiting for approval')} value={formatMinutes(data.filter((e) => e.status === 'pending').reduce((s, e) => s + e.eligible_minutes, 0))} />
                <KeyValue label={t('Amount (approved)')} value={<Money value={sumDecimals(data.filter((e) => e.status !== 'rejected').map((e) => e.amount))} />} />
              </Stack>
            </Card>
            <ListGroup>
              {data.map((entry) => (
                <ListRow
                  key={entry.id}
                  title={`${formatDayLabel(entry.attendance_date)}${entry.is_rest_day ? ` · ${t('rest day')}` : ''}`}
                  subtitle={t('{eligible} eligible of {recorded} worked', {
                    eligible: formatMinutes(entry.eligible_minutes),
                    recorded: formatMinutes(entry.recorded_minutes),
                  })}
                  meta={entry.amount ? `${entry.policy_name ?? ''} · ₹${plainDecimal(entry.amount)}` : entry.policy_name ?? undefined}
                  trailing={<StatusBadge status={entry.status} />}
                />
              ))}
            </ListGroup>
          </>
        )}
      </QueryView>
    </Screen>
  );
}

// ── Timesheet ────────────────────────────────────────────────────────────────

export function TimesheetScreen() {
  const [week, setWeek] = useState(startOfWeek(todayISO()));
  const sheet = useQuery({ queryKey: ['timesheet', week], queryFn: () => timesheetsApi.week(week) });
  const projects = useQuery({ queryKey: ['timesheet', 'projects'], queryFn: timesheetsApi.projects, staleTime: 10 * 60_000 });
  const [adding, setAdding] = useState(false);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  useEffect(() => setEntries(sheet.data?.entries ?? []), [sheet.data]);

  const editable = !sheet.data || sheet.data.status === 'draft' || sheet.data.status === 'rejected';
  const dirty = JSON.stringify(entries) !== JSON.stringify(sheet.data?.entries ?? []);
  const save = useAction(
    (list: TimesheetEntry[]) =>
      timesheetsApi.save(
        week,
        list.map((e) => ({ work_date: e.work_date, project_id: e.project_id, task_id: e.task_id, hours: e.hours, description: e.description })),
      ),
    { success: t('Saved'), invalidate: [['timesheet', week]] },
  );
  const submit = useAction(() => timesheetsApi.submit(week), { success: t('Sent for approval'), invalidate: [['timesheet', week], ['approvals']] });
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const isThisWeek = week === startOfWeek(todayISO());

  return (
    <Screen onRefresh={() => Promise.all([sheet.refetch(), projects.refetch()])}>
      <View style={styles.weekRow}>
        <IconButton icon={ChevronLeft} label={t('Previous week')} onPress={() => setWeek(addDays(week, -7))} />
        <Txt variant="headline" align="center" style={styles.flex}>
          {formatRange(week, addDays(week, 6))}
        </Txt>
        <IconButton icon={ChevronRight} label={t('Next week')} onPress={() => setWeek(addDays(week, 7))} disabled={isThisWeek} />
      </View>
      <QueryView query={sheet} skeleton={<SkeletonCard lines={4} />}>
        {(data) => (
          <>
            <Card>
              <View style={styles.titleRow}>
                <Txt variant="headline" style={styles.flex}>
                  {t('{hours} hours', { hours: plainDecimal(sumDecimals(entries.map((e) => e.hours))) })}
                </Txt>
                <StatusBadge status={data.status} />
              </View>
              {data.decision_note ? <Notice tone="info" title={t('Note from your approver')} message={data.decision_note} /> : null}
            </Card>
            {projects.data && projects.data.filter((p) => p.active).length === 0 ? (
              <EmptyState spot="sheet" title={t('No projects to log time against')} message={t('Your company has not set up any timesheet projects yet. Ask HR.')} />
            ) : (
              <>
                {days.map((day) => {
                  const list = entries.filter((e) => e.work_date === day);
                  return (
                    <Section key={day} title={formatDayLabel(day)} description={list.length ? t('{hours} h', { hours: plainDecimal(sumDecimals(list.map((e) => e.hours))) }) : undefined}>
                      {list.length ? (
                        <ListGroup>
                          {list.map((entry, index) => (
                            <ListRow
                              key={`${entry.id ?? index}-${entry.project_id}`}
                              title={entry.project ?? t('Project')}
                              subtitle={[entry.task, entry.description].filter(Boolean).join(' · ') || undefined}
                              value={`${plainDecimal(entry.hours)} h`}
                              trailing={
                                editable ? (
                                  <IconButton
                                    icon={Trash2}
                                    label={t('Remove')}
                                    onPress={() => setEntries((all) => all.filter((e) => e !== entry))}
                                  />
                                ) : undefined
                              }
                            />
                          ))}
                        </ListGroup>
                      ) : null}
                    </Section>
                  );
                })}
                {editable ? (
                  <Stack gap="inline">
                    <Button label={t('Add time')} icon={Plus} variant="secondary" onPress={() => setAdding(true)} fullWidth />
                    <Button label={t('Save')} variant="primary" onPress={() => void save.run(entries)} loading={save.pending} disabled={!dirty} fullWidth />
                    <Button
                      label={t('Submit for approval')}
                      variant="accent"
                      onPress={() => setConfirmSubmit(true)}
                      disabled={dirty || entries.length === 0}
                      fullWidth
                    />
                    {dirty ? (
                      <Txt variant="caption" tone="muted">
                        {t('Save your changes before submitting.')}
                      </Txt>
                    ) : null}
                  </Stack>
                ) : null}
              </>
            )}
          </>
        )}
      </QueryView>
      <AddTimeSheet
        open={adding}
        onClose={() => setAdding(false)}
        days={days}
        projects={(projects.data ?? []).filter((p) => p.active)}
        onAdd={(entry) => {
          setEntries((all) => [...all, entry]);
          setAdding(false);
        }}
      />
      <ConfirmSheet
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        title={t('Submit this week?')}
        message={t('You cannot change it after submitting unless it is sent back.')}
        confirmLabel={t('Submit')}
        tone="accent"
        onConfirm={async () => {
          setConfirmSubmit(false);
          await submit.run(undefined);
        }}
      />
    </Screen>
  );
}

function AddTimeSheet({
  open,
  onClose,
  days,
  projects,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  days: string[];
  projects: { id: string; name: string; tasks: { id: string; name: string; active: boolean }[] }[];
  onAdd: (entry: TimesheetEntry) => void;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [task, setTask] = useState<string | null>(null);
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setDay(days.find((d) => d === todayISO()) ?? days[0] ?? null);
      setProject(projects[0]?.id ?? null);
      setTask(null);
      setHours('');
      setNote('');
      setTouched(false);
    }
  }, [open, days, projects]);
  const chosen = projects.find((p) => p.id === project);
  const hoursError = validateAmount(hours, { max: '24', maxLabel: t('24 hours') });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Add time')}
      scrollable
      dirty={Boolean(hours || note)}
      footer={
        <Button
          label={t('Add')}
          variant="primary"
          fullWidth
          onPress={() => {
            setTouched(true);
            if (!day || !project || hoursError) return;
            onAdd({
              id: `new-${Date.now()}`,
              work_date: day,
              project_id: project,
              project: chosen?.name ?? null,
              task_id: task,
              task: chosen?.tasks.find((x) => x.id === task)?.name ?? null,
              hours,
              description: note.trim() || null,
            });
          }}
        />
      }
    >
      <SelectField label={t('Day')} value={day} options={days.map((d) => ({ value: d, label: formatDayLabel(d) }))} onChange={setDay} />
      <SelectField label={t('Project')} value={project} options={projects.map((p) => ({ value: p.id, label: p.name }))} onChange={setProject} />
      {chosen?.tasks.filter((x) => x.active).length ? (
        <SelectField
          label={t('Task')}
          value={task}
          options={chosen.tasks.filter((x) => x.active).map((x) => ({ value: x.id, label: x.name }))}
          onChange={setTask}
        />
      ) : null}
      <AmountField label={t('Hours')} value={hours} onChangeText={setHours} rules={{ decimals: 2, maxIntegerDigits: 2 }} prefix="" error={touched ? hoursError : null} />
      <TextField label={t('What you did')} value={note} onChangeText={setNote} maxLength={500} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inlineActions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: layout.card, paddingBottom: spacing.md },
  weekRow: { flexDirection: 'row', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
