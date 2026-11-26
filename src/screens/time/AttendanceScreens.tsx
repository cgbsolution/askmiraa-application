/**
 * Attendance: the month as a calendar, a day's record and punches, and
 * regularisations (fixing a missed punch or a wrong status) with their status.
 *
 * Tier 1 — attendance decides payable days.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  TimerReset,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { attendanceApi, monthPeriodQuery } from '../../api/attendance';
import { Badge, StatusBadge } from '../../components/Badge';
import { Button, IconButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { Fab } from '../../components/Fab';
import { ChoiceField, DateField, SelectField, SwitchRow, TextField, TimeField } from '../../components/Field';
import { FormScreen } from '../../components/FormScreen';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { Row, Screen, Section, Stack } from '../../components/Screen';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { Segmented } from '../../components/Segmented';
import { StatGrid } from '../../components/Stat';
import { TabHeader } from '../../components/TabHeader';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, Notice, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import {
  MONTHS,
  WEEKDAYS,
  addMonths,
  dateFromISO,
  diffDays,
  firstOfMonth,
  formatDate,
  formatClock,
  formatDayLabel,
  formatMinutes,
  formatMonth,
  formatTime,
  monthGrid,
  parseISODate,
  todayISO,
} from '../../core/dates';
import { DAY_KIND_LABEL, DAY_TAG_LABEL, DAY_TAG_ORDER, canRegularise, dayKind, untaggedDayLabel } from '../../core/home';
import { plainDecimal } from '../../core/money';
import { statusLabel } from '../../core/status';
import type { AttendanceDayRead, DayTag, RegularisationKind, RegularisationRead } from '../../core/types';
import { t } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { useAction } from '../../lib/useAction';
import { punchQueueFor } from '../../lib/punchQueue';
import { usePunch } from '../../lib/usePunch';
import type { QueuedPunch } from '../../core/offlineQueue';
import { PunchCard, PunchResultSheet } from './PunchParts';
import { useGo, useParams } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing, type Colors } from '../../theme/tokens';

/** Each tag's fill and the date on it, from the theme. */
const TAG_COLOURS: Record<DayTag, [keyof Colors, keyof Colors]> = {
  full_day: ['dayFull', 'onDayFull'],
  partial: ['dayPartial', 'onDayPartial'],
  absent: ['dayAbsent', 'onDayAbsent'],
  week_off: ['dayWeekOff', 'onDayWeekOff'],
  holiday: ['dayHoliday', 'onDayHoliday'],
  optional_holiday: ['dayOptionalHoliday', 'onDayOptionalHoliday'],
  approved_leave: ['dayApprovedLeave', 'onDayApprovedLeave'],
  unapproved_leave: ['dayUnapprovedLeave', 'onDayUnapprovedLeave'],
};

function tagColours(colors: Colors, tag: DayTag): { fill: string; text: string } {
  const [fill, text] = TAG_COLOURS[tag];
  return { fill: colors[fill], text: colors[text] };
}

/** "25 OCT" — the selected day's heading, as on the older HRMS calendar. */
function dayHeading(date: string): string {
  const ymd = parseISODate(date);
  return ymd ? `${ymd.d} ${(MONTHS[ymd.m - 1] ?? '').toUpperCase()}` : '';
}

function usePeriod(month: string) {
  return useQuery(monthPeriodQuery(month));
}

/** An arrow on the month band. */
function BandArrow({ icon: Icon, label, onPress }: { icon: typeof ChevronLeft; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.bandArrow, pressed && styles.pressed]}
    >
      <Icon size={layout.iconLg} color={colors.onCalendarBand} strokeWidth={2.25} />
    </Pressable>
  );
}

export function AttendanceScreen() {
  const go = useGo();
  const { colors } = useTheme();
  const { can } = useSession();
  const today = todayISO();
  const [month, setMonth] = useState(firstOfMonth(today));
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<'calendar' | 'days'>('calendar');
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const period = usePeriod(month);
  const punch = usePunch();
  const todayPeriod = usePeriod(firstOfMonth(today));
  const regs = useQuery({ queryKey: ['attendance', 'regularisations'], queryFn: () => attendanceApi.regularisations(), enabled: can('attendance') });
  const [punched, setPunched] = useState<QueuedPunch | null>(null);
  const ymd = parseISODate(month)!;

  const byDate = useMemo(() => new Map((period.data?.days ?? []).map((d) => [d.attendance_date, d])), [period.data]);
  const tags = useMemo(() => new Map((period.data?.day_tags ?? []).map((entry) => [entry.day, entry.tag])), [period.data]);
  const shiftsById = useMemo(() => new Map((period.data?.shifts ?? []).map((s) => [s.id, s])), [period.data]);
  const weeks = monthGrid(ymd.y, ymd.m, 0);
  const pendingRegs = (regs.data ?? []).filter((r) => r.status === 'pending').length;

  const changeMonth = (delta: number) => {
    const next = addMonths(month, delta);
    setMonth(next);
    setSelected(next === firstOfMonth(today) ? today : next);
  };

  const describe = (date: string, joinedOn?: string | null) => {
    const tag = tags.get(date) ?? null;
    return { tag, label: tag ? t(DAY_TAG_LABEL[tag]) : t(untaggedDayLabel(date, today, joinedOn)) };
  };
  const chosen = describe(selected, period.data?.date_of_joining);
  const chosenDay = byDate.get(selected);
  const hasHappened = diffDays(today, selected) <= 0;

  // The list view: days of the month that have happened, latest first.
  const pastDays = useMemo(() => {
    const out: string[] = [];
    for (const week of weeks) for (const cell of week) if (cell.inMonth && diffDays(today, cell.date) <= 0) out.push(cell.date);
    return out.reverse();
  }, [weeks, today]);

  const actionDay = actionsFor ? byDate.get(actionsFor) : undefined;
  const actionRegs = actionsFor ? (regs.data ?? []).filter((r) => r.attendance_date === actionsFor) : [];

  return (
    <Screen
      header={<TabHeader title={t('Attendance')} />}
      onRefresh={() => Promise.all([period.refetch(), todayPeriod.refetch(), punch.refresh(), regs.refetch()])}
    >
      {punch.enabled ? (
        <PunchCard
          punch={punch}
          shift={todayPeriod.data?.shift_today ?? null}
          hasNoShift={Boolean(todayPeriod.data?.has_no_shift)}
          onPunched={setPunched}
        />
      ) : null}

      <Segmented
        segments={[
          { value: 'calendar', label: t('Calendar') },
          { value: 'days', label: t('Day by day') },
        ]}
        value={view}
        onChange={setView}
      />

      <Card padded="none">
        <View style={[styles.band, { backgroundColor: colors.calendarBand }]}>
          <View style={styles.monthRow}>
            <BandArrow icon={ChevronLeft} label={t('Previous month')} onPress={() => changeMonth(-1)} />
            <Txt variant="headline" style={[styles.monthLabel, { color: colors.onCalendarBand }]} align="center">
              {formatMonth(ymd.y, ymd.m)}
            </Txt>
            <BandArrow icon={ChevronRight} label={t('Next month')} onPress={() => changeMonth(1)} />
          </View>
          {view === 'calendar' ? (
            <View style={styles.weekHeader}>
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <Txt key={d} variant="calloutStrong" align="center" style={[styles.cell, { color: colors.onCalendarBand }]}>
                  {t(WEEKDAYS[d] ?? '').slice(0, 1)}
                </Txt>
              ))}
            </View>
          ) : null}
        </View>

        <QueryView query={period} skeleton={<View style={styles.gridArea}><SkeletonList rows={4} /></View>}>
          {(data) =>
            view === 'calendar' ? (
              <View style={styles.gridArea}>
                {data.is_locked ? <Notice tone="info" message={t('This month is locked for payroll. Changes now go through HR.')} /> : null}
                {weeks.map((week) => (
                  <View key={week[0]!.date} style={styles.week}>
                    {week.map((cell) => {
                      if (!cell.inMonth) return <View key={cell.date} style={styles.cell} />;
                      const { tag, label } = describe(cell.date, data.date_of_joining);
                      const paint = tag ? tagColours(colors, tag) : null;
                      const isSelected = cell.date === selected;
                      return (
                        <Pressable
                          key={cell.date}
                          accessibilityRole="button"
                          accessibilityLabel={`${formatDate(cell.date)}: ${label}`}
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => setSelected(cell.date)}
                          style={styles.cell}
                        >
                          <View style={[styles.ring, { borderColor: isSelected ? colors.calendarMark : colors.surface }]}>
                            <View style={[styles.dayCircle, paint ? { backgroundColor: paint.fill } : null]}>
                              <Txt variant="calloutStrong" numeric style={{ color: paint ? paint.text : colors.text }}>
                                {cell.day}
                              </Txt>
                            </View>
                          </View>
                          <View style={[styles.todayDot, { backgroundColor: cell.date === today ? colors.calendarMark : colors.surface }]} />
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
                <View style={[styles.legend, { borderColor: colors.divider }]}>
                  {DAY_TAG_ORDER.map((tag) => (
                    <View key={tag} style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: tagColours(colors, tag).fill }]} />
                      <Txt variant="caption">{t(DAY_TAG_LABEL[tag])}</Txt>
                    </View>
                  ))}
                </View>
              </View>
            ) : pastDays.length === 0 ? (
              <View style={styles.gridArea}>
                <Txt variant="callout" tone="muted" align="center">
                  {t('This month has not started yet.')}
                </Txt>
              </View>
            ) : (
              <View>
                {data.is_locked ? (
                  <View style={styles.gridArea}>
                    <Notice tone="info" message={t('This month is locked for payroll. Changes now go through HR.')} />
                  </View>
                ) : null}
                {pastDays.map((date, index) => (
                  <DayRow
                    key={date}
                    date={date}
                    first={index === 0}
                    record={byDate.get(date)}
                    tag={tags.get(date) ?? null}
                    label={describe(date, data.date_of_joining).label}
                    shift={byDate.get(date)?.shift_id ? (shiftsById.get(byDate.get(date)!.shift_id!) ?? null) : null}
                    pendingReg={(regs.data ?? []).some((r) => r.attendance_date === date && r.status === 'pending')}
                    onOpen={() => go('AttendanceDetail', { date })}
                    onMore={() => setActionsFor(date)}
                  />
                ))}
              </View>
            )
          }
        </QueryView>
      </Card>

      {period.data && view === 'calendar' ? (
        <Card
          onPress={hasHappened ? () => go('AttendanceDetail', { date: selected }) : undefined}
          accessibilityLabel={`${formatDayLabel(selected)}: ${chosen.label}`}
        >
          <View style={styles.selectedRow}>
            <View style={[styles.selectedBar, { backgroundColor: chosen.tag ? tagColours(colors, chosen.tag).fill : colors.border }]} />
            <View style={styles.flex}>
              <Txt variant="title" numeric>
                {dayHeading(selected)}
              </Txt>
              <Txt variant="body" tone="muted">
                {chosen.label}
              </Txt>
              {chosenDay && (chosenDay.first_in || chosenDay.last_out) ? (
                <Txt variant="callout" tone="muted">
                  {`${t('In')} ${formatClock(chosenDay.first_in, false)} · ${t('Out')} ${formatClock(chosenDay.last_out, false)} · ${formatMinutes(chosenDay.worked_minutes)}`}
                </Txt>
              ) : null}
            </View>
            {hasHappened ? <ChevronRight size={layout.icon} color={colors.textMuted} /> : null}
          </View>
        </Card>
      ) : null}

      {period.data ? (
        <Section title={t('{month} at a glance', { month: formatMonth(ymd.y, ymd.m) })}>
          <StatGrid
            items={[
              { label: t('Payable days'), value: plainDecimal(period.data.summary.payable_days), strong: true },
              { label: t('Present'), value: String(period.data.summary.present_days) },
              { label: t('Absent'), value: String(period.data.summary.absent_days), tone: period.data.summary.absent_days ? 'danger' : undefined },
              { label: t('On leave'), value: String(period.data.summary.on_leave_days) },
              { label: t('Half days'), value: String(period.data.summary.half_days) },
              { label: t('Late marks'), value: String(period.data.summary.late_count), tone: period.data.summary.late_count ? 'warning' : undefined },
              { label: t('Loss of pay'), value: plainDecimal(period.data.summary.lop_days), tone: period.data.summary.lop_days !== '0.00' ? 'danger' : undefined },
              { label: t('Need fixing'), value: String(period.data.summary.needs_regularisation), tone: period.data.summary.needs_regularisation ? 'danger' : undefined },
              { label: t('Regularised'), value: String((period.data.days ?? []).filter((d) => d.is_regularised).length) },
            ]}
          />
        </Section>
      ) : null}

      <Section title={t('More in attendance')}>
        <ListGroup>
          <ListRow
            spot="auditLog"
            title={t('My corrections')}
            subtitle={t('Regularise a missed punch or a wrong status')}
            trailing={pendingRegs ? <Badge label={t('{count} pending', { count: pendingRegs })} tone="warning" /> : undefined}
            onPress={() => go('Regularisations')}
          />
          <ListRow spot="pin" title={t('Client visits')} subtitle={t('Visit in and out at each client, with your location')} onPress={() => go('Visits')} />
          <ListRow spot="inOut" title={t('Punch history')} subtitle={t('Every punch, and punches saved offline')} onPress={() => go('PunchHistory')} />
          {can('shifts') ? <ListRow spot="clock" title={t('Shifts & swaps')} onPress={() => go('Shifts')} /> : null}
          {can('overtime') ? <ListRow spot="clockPlus" title={t('Overtime')} onPress={() => go('Overtime')} /> : null}
          {can('timesheet') ? <ListRow spot="sheet" title={t('Timesheet')} onPress={() => go('Timesheet')} /> : null}
        </ListGroup>
      </Section>

      <Sheet open={actionsFor !== null} onClose={() => setActionsFor(null)} title={actionsFor ? formatDayLabel(actionsFor) : undefined}>
        <ListGroup>
          {actionsFor && period.data && canRegularise(actionsFor, today, period.data.is_locked) ? (
            <ListRow
              spot="clockEdit"
              title={t('Regularise this day')}
              subtitle={t('Ask for a missed punch or the wrong status to be fixed')}
              onPress={() => {
                const date = actionsFor;
                setActionsFor(null);
                go('Regularise', { date });
              }}
            />
          ) : null}
          <ListRow
            spot="calendarClock"
            title={t('View the day')}
            subtitle={actionDay ? `${t('In')} ${formatClock(actionDay.first_in, false)} · ${t('Out')} ${formatClock(actionDay.last_out, false)}` : undefined}
            onPress={() => {
              const date = actionsFor!;
              setActionsFor(null);
              go('AttendanceDetail', { date });
            }}
          />
          {actionRegs.length ? (
            <ListRow
              spot="auditLog"
              title={t('View my regularisation')}
              subtitle={t(statusLabel(actionRegs[0]!.status))}
              onPress={() => {
                setActionsFor(null);
                go('Regularisations');
              }}
            />
          ) : null}
        </ListGroup>
      </Sheet>
      <PunchResultSheet result={punched} places={punch.workLocations} onClose={() => setPunched(null)} />
    </Screen>
  );
}

/**
 * One day in the "Day by day" list: the older HRMS's regularisation card —
 * the date with its colour, the rostered shift, in, out and hours — with a
 * menu for what can be done about it.
 */
function DayRow({
  date,
  first,
  record,
  tag,
  label,
  shift,
  pendingReg,
  onOpen,
  onMore,
}: {
  date: string;
  first: boolean;
  record: AttendanceDayRead | undefined;
  tag: DayTag | null;
  label: string;
  shift: { name: string; start_time: string; end_time: string } | null;
  pendingReg: boolean;
  onOpen: () => void;
  onMore: () => void;
}) {
  const { colors } = useTheme();
  const paint = tag ? tagColours(colors, tag) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDayLabel(date)}: ${label}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.dayRow, !first && { borderTopWidth: layout.hairline, borderColor: colors.divider }, pressed && { backgroundColor: colors.surfaceSunken }]}
    >
      <View style={styles.dayRowTop}>
        <View style={[styles.dayDot, { backgroundColor: paint ? paint.fill : colors.borderStrong }]} />
        <Txt variant="bodyStrong" style={styles.flex} numberOfLines={1}>
          {formatDayLabel(date)}
        </Txt>
        <Txt variant="caption" tone="muted" numberOfLines={1} style={styles.dayStatus}>
          {label}
        </Txt>
        <IconButton icon={EllipsisVertical} label={t('Actions for {day}', { day: formatDayLabel(date) })} onPress={onMore} />
      </View>
      <View style={styles.dayFacts}>
        <DayFact label={t('Shift')} value={shift ? `${shift.name} (${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)})` : '—'} wide />
        <DayFact label={t('In')} value={formatClock(record?.first_in, false)} />
        <DayFact label={t('Out')} value={formatClock(record?.last_out, false)} />
        <DayFact label={t('Hours')} value={record ? formatMinutes(record.worked_minutes) : '—'} />
      </View>
      {record?.late_by_minutes || record?.is_regularised || pendingReg ? (
        <View style={styles.dayBadges}>
          {record?.late_by_minutes ? <Badge label={t('Late {time}', { time: formatMinutes(record.late_by_minutes) })} tone="warning" /> : null}
          {record?.is_regularised ? <Badge label={t('Regularised')} tone="info" /> : null}
          {pendingReg ? <Badge label={t('Regularisation pending')} tone="warning" /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function DayFact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={wide ? styles.dayFactWide : styles.dayFact}>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
      <Txt variant="calloutStrong" numeric numberOfLines={1}>
        {value}
      </Txt>
    </View>
  );
}

export function AttendanceDetailScreen() {
  const go = useGo();
  const { colors } = useTheme();
  const { date } = useParams<{ date: string }>();
  const day = date ?? todayISO();
  const period = usePeriod(firstOfMonth(day));
  const punches = useQuery({ queryKey: ['attendance', 'punches', day], queryFn: () => attendanceApi.punches(day, day) });
  const regs = useQuery({ queryKey: ['attendance', 'regularisations'], queryFn: () => attendanceApi.regularisations() });

  const record: AttendanceDayRead | undefined = period.data?.days.find((d) => d.attendance_date === day);
  const holiday = period.data?.holidays?.find((h) => h.holiday_date === day);
  const leave = period.data?.leaves?.find((l) => l.leave_date === day);
  const pending = (regs.data ?? []).filter((r) => r.attendance_date === day);
  const kind = record ? dayKind(record.status, record.late_by_minutes) : holiday ? 'holiday' : 'none';
  const tag = period.data?.day_tags?.find((entry) => entry.day === day)?.tag;

  return (
    <Screen onRefresh={() => Promise.all([period.refetch(), punches.refetch(), regs.refetch()])}>
      <Txt variant="title">{formatDayLabel(day)}</Txt>
      {period.isPending ? (
        <SkeletonCard lines={4} />
      ) : (
        <Card>
          <Stack gap="tight">
            <View style={styles.titleRow}>
              {tag ? <View style={[styles.legendSwatch, { backgroundColor: tagColours(colors, tag).fill }]} /> : null}
              <Txt variant="headline" style={styles.flex}>
                {/* One day is either absent or missing a punch, never "Absent / Missed punch". */}
                {tag === 'absent' && record
                  ? t(record.status === 'needs_regularisation' ? 'Missed punch' : 'Absent')
                  : tag
                    ? t(DAY_TAG_LABEL[tag])
                    : t(DAY_KIND_LABEL[kind])}
              </Txt>
              {record?.is_regularised ? <Badge label={t('Regularised')} tone="info" /> : null}
            </View>
            {holiday ? (
              <KeyValue
                label={holiday.is_optional ? t('Optional holiday') : t('Holiday')}
                value={holiday.is_paid === false ? `${holiday.name} (${t('unpaid')})` : holiday.name}
              />
            ) : null}
            {leave ? <KeyValue label={t('Leave')} value={`${leave.leave_type}${leave.is_half_day ? `, ${t('half day')}` : ''} (${t(statusLabel(leave.status))})`} /> : null}
            {record ? (
              <>
                <KeyValue label={t('First in')} value={formatTime(record.first_in)} />
                <KeyValue label={t('Last out')} value={formatTime(record.last_out)} />
                <KeyValue label={t('Worked')} value={formatMinutes(record.worked_minutes)} />
                {record.late_by_minutes ? <KeyValue label={t('Late by')} value={formatMinutes(record.late_by_minutes)} tone="warning" /> : null}
                {record.early_by_minutes ? <KeyValue label={t('Left early by')} value={formatMinutes(record.early_by_minutes)} tone="warning" /> : null}
                {record.overtime_minutes ? <KeyValue label={t('Overtime')} value={formatMinutes(record.overtime_minutes)} /> : null}
                <KeyValue label={t('Counts as')} value={t('{fraction} of a day', { fraction: plainDecimal(record.payable_fraction) })} />
                {record.computation_note ? (
                  <Txt variant="caption" tone="muted">
                    {record.computation_note}
                  </Txt>
                ) : null}
              </>
            ) : !holiday ? (
              <Txt variant="callout" tone="muted">
                {t('No attendance has been worked out for this day yet.')}
              </Txt>
            ) : null}
          </Stack>
        </Card>
      )}

      <Section title={t('Punches')}>
        <QueryView
          query={punches}
          isEmpty={(data) => data.length === 0}
          empty={<EmptyState inline spot="inOut" title={t('No punches')} message={t('Nothing was recorded on this day.')} />}
        >
          {(data) => (
            <ListGroup>
              {data.map((p) => (
                <ListRow
                  key={p.id}
                  icon={p.direction === 'in' ? LogIn : LogOut}
                  iconTone={p.outside_geofence ? 'warning' : 'primary'}
                  title={`${p.direction === 'in' ? t('In') : t('Out')} · ${formatTime(p.punched_at)}`}
                  subtitle={[t(statusLabel(p.source)), p.location_label].filter(Boolean).join(' · ')}
                  trailing={p.outside_geofence ? <Badge label={t('Outside work location')} icon={MapPin} tone="warning" /> : undefined}
                />
              ))}
            </ListGroup>
          )}
        </QueryView>
      </Section>

      {pending.length ? (
        <Section title={t('Regularisations for this day')}>
          <ListGroup>
            {pending.map((r) => (
              <RegularisationRow key={r.id} item={r} />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {period.data && canRegularise(day, todayISO(), period.data.is_locked) ? (
        <Button label={t('Regularise this day')} icon={TimerReset} variant="accent" onPress={() => go('Regularise', { date: day })} fullWidth />
      ) : null}
    </Screen>
  );
}

const KIND_LABEL: Record<RegularisationKind, string> = {
  missed_punch: 'Missed punch',
  status_change: 'Wrong status',
  on_duty: 'On duty',
  work_from_home: 'Work from home',
};

function RegularisationRow({ item, onCancel }: { item: RegularisationRead; onCancel?: () => void }) {
  return (
    <ListRow
      title={`${formatDate(item.attendance_date)} · ${t(KIND_LABEL[item.kind ?? 'missed_punch'])}`}
      subtitle={item.reason}
      meta={[
        item.requested_first_in ? `${t('In')} ${formatTime(item.requested_first_in)}` : null,
        item.requested_last_out ? `${t('Out')} ${formatTime(item.requested_last_out)}` : null,
        item.decision_note ? `${t('Note')}: ${item.decision_note}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined}
      trailing={<StatusBadge status={item.status} />}
      onPress={onCancel}
      chevron={false}
    />
  );
}

export function RegularisationsScreen() {
  const go = useGo();
  const regs = useQuery({ queryKey: ['attendance', 'regularisations'], queryFn: () => attendanceApi.regularisations() });
  const [cancelling, setCancelling] = useState<RegularisationRead | null>(null);
  const cancel = useAction((id: string) => attendanceApi.cancelRegularisation(id), {
    success: t('Regularisation withdrawn'),
    invalidate: [['attendance']],
  });
  return (
    <Screen onRefresh={() => regs.refetch()} overlay={<Fab icon={Plus} label={t('New regularisation')} onPress={() => go('Regularise')} />}>
      <QueryView
        query={regs}
        skeleton={<SkeletonList rows={4} />}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState spot="auditLog" title={t('No regularisations')} message={t('If a punch was missed or a day shows the wrong status, ask for it to be fixed here.')} />}
      >
        {(data) => (
          <ListGroup>
            {[...data]
              .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))
              .map((item) => (
                <RegularisationRow key={item.id} item={item} onCancel={item.status === 'pending' ? () => setCancelling(item) : undefined} />
              ))}
          </ListGroup>
        )}
      </QueryView>
      <ConfirmSheet
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={t('Withdraw this regularisation?')}
        message={cancelling ? t('For {date}. Your approver will no longer see it.', { date: formatDate(cancelling.attendance_date) }) : undefined}
        confirmLabel={t('Withdraw')}
        tone="danger"
        onConfirm={async () => {
          const target = cancelling;
          setCancelling(null);
          if (target) await cancel.run(target.id);
        }}
      />
    </Screen>
  );
}

/** Local date + "HH:MM" as an ISO timestamp in the phone's time zone. */
function atTime(date: string, hhmm: string): string {
  const d = dateFromISO(date);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

export function RegulariseScreen() {
  const navigation = useNavigation();
  const { session } = useSession();
  const params = useParams<{ date: string; punchId: string; direction: string; at: string }>();
  const today = todayISO();
  const fromPunch = params.at ? formatTime(params.at) : null;

  const [range, setRange] = useState(false);
  const [date, setDate] = useState<string | null>(params.date ?? null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [kind, setKind] = useState<RegularisationKind>('missed_punch');
  const [firstIn, setFirstIn] = useState<string | null>(params.direction === 'in' ? fromPunch : null);
  const [lastOut, setLastOut] = useState<string | null>(params.direction === 'out' ? fromPunch : null);
  const [status, setStatus] = useState<'present' | 'half_day' | 'on_leave'>('present');
  const [reason, setReason] = useState(
    params.at ? t('Punched {direction} at {time} with no signal; the app could not send it in time.', { direction: params.direction ?? 'in', time: fromPunch ?? '' }) : '',
  );
  const [touched, setTouched] = useState(false);

  const errors = {
    date: !date ? t('Choose the day.') : diffDays(date, today) < 0 ? t('You can only regularise today or earlier.') : null,
    end: range && (!endDate || (date && diffDays(date, endDate) < 0)) ? t('Choose a last day on or after the first.') : null,
    times:
      kind === 'missed_punch' && !range && !firstIn && !lastOut
        ? t('Enter the time you came in, left, or both.')
        : firstIn && lastOut && firstIn >= lastOut
          ? t('The time out must be after the time in.')
          : null,
    reason: !reason.trim() ? t('Say what happened.') : reason.length > 1000 ? t('Keep it under 1000 characters.') : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = useAction(
    async () => {
      if (range) {
        return attendanceApi.regulariseRange({
          kind: kind === 'missed_punch' ? 'status_change' : kind,
          start_date: date!,
          end_date: endDate!,
          reason: reason.trim(),
          requested_status: kind === 'status_change' ? status : 'present',
        });
      }
      return attendanceApi.regularise({
        attendance_date: date!,
        kind,
        reason: reason.trim(),
        requested_status: kind === 'status_change' ? status : 'present',
        requested_first_in: kind === 'missed_punch' && firstIn ? atTime(date!, firstIn) : null,
        requested_last_out: kind === 'missed_punch' && lastOut ? atTime(date!, lastOut) : null,
      });
    },
    {
      success: t('Sent for approval'),
      invalidate: [['attendance'], ['approvals']],
    },
  );

  return (
    <FormScreen
      submitLabel={t('Send for approval')}
      dirty={Boolean(reason.trim() && !params.at) || Boolean(firstIn || lastOut) && !params.at}
      onSubmit={async () => {
        setTouched(true);
        if (invalid) return;
        const done = await submit.run(undefined);
        if (!done) return;
        if (params.punchId && session) await punchQueueFor(session.user.id).resolve(params.punchId);
        navigation.goBack();
      }}
    >
      {params.at ? (
        <Notice tone="info" message={t('Filled in from the punch saved on this phone at {time}. Check it and send.', { time: fromPunch ?? '' })} />
      ) : null}
      <Stack gap="row">
        <SwitchRow label={t('Several days')} description={t('On duty or working from home across a range.')} value={range} onChange={setRange} />
        <ChoiceField
          label={t('What needs fixing?')}
          value={kind}
          options={(range ? (['status_change', 'on_duty', 'work_from_home'] as const) : (['missed_punch', 'status_change', 'on_duty', 'work_from_home'] as const)).map(
            (value) => ({ value, label: t(KIND_LABEL[value]) }),
          )}
          onChange={setKind}
        />
        {range ? (
          <Row>
            <View style={styles.flex}>
              <DateField label={t('From')} required value={date} onChange={setDate} maximumDate={today} error={touched ? errors.date : null} />
            </View>
            <View style={styles.flex}>
              <DateField label={t('To')} required value={endDate} onChange={setEndDate} maximumDate={today} minimumDate={date ?? undefined} error={touched ? errors.end : null} />
            </View>
          </Row>
        ) : (
          <DateField label={t('Day')} required value={date} onChange={setDate} maximumDate={today} error={touched ? errors.date : null} />
        )}
        {kind === 'missed_punch' && !range ? (
          <Row>
            <View style={styles.flex}>
              <TimeField label={t('Came in at')} value={firstIn} onChange={setFirstIn} />
            </View>
            <View style={styles.flex}>
              <TimeField label={t('Left at')} value={lastOut} onChange={setLastOut} error={touched ? errors.times : null} />
            </View>
          </Row>
        ) : null}
        {kind === 'status_change' ? (
          <SelectField
            label={t('It should be')}
            value={status}
            options={[
              { value: 'present', label: t('Present') },
              { value: 'half_day', label: t('Half day') },
              { value: 'on_leave', label: t('On leave') },
            ]}
            onChange={setStatus}
          />
        ) : null}
        <TextField label={t('Reason')} required value={reason} onChangeText={setReason} multiline maxLength={1000} error={touched ? errors.reason : null} />
      </Stack>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  band: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', minHeight: layout.touch },
  monthLabel: { flex: 1 },
  bandArrow: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
  weekHeader: { flexDirection: 'row', marginTop: spacing.xs },
  gridArea: { paddingHorizontal: spacing.sm, paddingTop: spacing.md, paddingBottom: layout.card, gap: spacing.xs },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center' },
  ring: { padding: spacing.xxs, borderWidth: spacing.xxs, borderRadius: radius.pill },
  dayCircle: {
    width: layout.iconTile,
    height: layout.iconTile,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayDot: { width: spacing.xs, height: spacing.xs, borderRadius: radius.pill, marginTop: spacing.xxs },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    borderTopWidth: layout.hairline,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendSwatch: { width: spacing.md + spacing.xxs, height: spacing.md + spacing.xxs, borderRadius: 0 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  selectedBar: { width: spacing.xs, alignSelf: 'stretch', borderRadius: radius.pill },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayRow: { paddingLeft: layout.card, paddingRight: spacing.xs, paddingVertical: spacing.sm, gap: spacing.sm },
  dayRowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayDot: { width: spacing.md, height: spacing.md, borderRadius: radius.pill },
  dayStatus: { maxWidth: '45%' },
  dayFacts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, paddingRight: layout.card },
  dayFact: { width: '33.333%', gap: spacing.xxs },
  dayFactWide: { width: '100%', gap: spacing.xxs },
  dayBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingBottom: spacing.xs },
});
