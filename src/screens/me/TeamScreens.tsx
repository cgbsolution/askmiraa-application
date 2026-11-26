/**
 * My team, for anyone with people reporting to them: who is in today,
 * what is waiting on me, reviews, 1:1s, and one page per person.
 *
 * Decisions themselves happen in the Inbox and the review form; this page
 * only points at them.
 */

import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ClipboardCheck, MessagesSquare } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { approvalsApi } from '../../api/approvals';
import { attendanceApi } from '../../api/attendance';
import { growthApi } from '../../api/growth';
import { leaveApi } from '../../api/leave';
import { peopleApi } from '../../api/people';
import { Avatar } from '../../components/Avatar';
import { Badge, CountBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { Screen, Section, Stack } from '../../components/Screen';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { formatDate, formatTime, todayISO } from '../../core/dates';
import { plainDecimal } from '../../core/money';
import { statusLabel } from '../../core/status';
import { lateLabel, oneOnOneStatus, teamState, teamSummary } from '../../core/team';
import type { TeamMemberToday } from '../../core/types';
import { t, tn } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { useGo, useParams } from '../../navigation/navigate';
import { spacing } from '../../theme/tokens';

const keys = {
  today: ['team', 'today'],
  reviews: ['team', 'reviews'],
  oneOnOnes: ['team', 'one-on-ones'],
  balances: ['team', 'balances'],
} as const;

function useTeam() {
  const today = useQuery({ queryKey: keys.today, queryFn: attendanceApi.teamToday });
  const reviews = useQuery({ queryKey: keys.reviews, queryFn: growthApi.teamReviews });
  const oneOnOnes = useQuery({ queryKey: keys.oneOnOnes, queryFn: growthApi.oneOnOneReports });
  return { today, reviews, oneOnOnes };
}

/** Shown when someone without reports follows a link to a manager page. */
function NotAManager() {
  return (
    <Screen tier="tier2">
      <EmptyState spot="team" title={t('No one reports to you')} message={t('My team is for people with direct reports. When someone joins your team, it opens here.')} />
    </Screen>
  );
}

function oneOnOneLine(next: string | null | undefined, last: string | null | undefined): string {
  const status = oneOnOneStatus(next, last, todayISO());
  switch (status.kind) {
    case 'next':
      return t('Next on {date}', { date: formatDate(status.date) });
    case 'missed':
      return t('Planned for {date}, not held yet', { date: formatDate(status.date) });
    case 'last':
      return t('Last on {date}', { date: formatDate(status.date) });
    default:
      return t('None held yet');
  }
}

/** "In since 09:42", "On leave · Casual Leave", "Late by 25 min". */
function todayLine(m: TeamMemberToday): string {
  const parts = [t(teamState(m.state).label)];
  if (m.state === 'in' && m.first_in) parts[0] = t('In since {time}', { time: formatTime(m.first_in) });
  if (m.state === 'out' && m.last_punch_at) parts[0] = t('Punched out at {time}', { time: formatTime(m.last_punch_at) });
  if (m.detail) parts.push(m.detail);
  const late = lateLabel(m.late_by_minutes);
  if (late) parts.push(t(late));
  if (m.last_punch_outside) parts.push(t('outside the office'));
  return parts.join(' · ');
}

export function MyTeamScreen() {
  const allowed = useSession().can('myTeam');
  return allowed ? <MyTeam /> : <NotAManager />;
}

function MyTeam() {
  const go = useGo();
  const { today, reviews, oneOnOnes } = useTeam();
  const waiting = useQuery({ queryKey: ['approvals', 'count'], queryFn: approvalsApi.count });
  const waitingCount = Number(waiting.data?.count ?? 0);
  const reviewsDue = (reviews.data ?? []).filter((r) => r.awaiting_me);

  return (
    <Screen
      tier="tier2"
      onRefresh={() => Promise.all([today.refetch(), reviews.refetch(), oneOnOnes.refetch(), waiting.refetch()])}
    >
      <Section title={t('Waiting on you')}>
        <ListGroup>
          <ListRow
            spot="workflow"
            title={t('Approvals')}
            subtitle={waiting.isSuccess ? (waitingCount ? t('Leave, attendance, expenses and more') : t('Nothing waiting')) : undefined}
            trailing={waitingCount ? <CountBadge count={waitingCount} /> : undefined}
            onPress={() => go('Inbox')}
          />
          <ListRow
            spot="trend"
            title={t('Reviews to write')}
            subtitle={reviews.isSuccess ? (reviewsDue.length ? tn(reviewsDue.length, '{count} waiting on you', '{count} waiting on you') : t('Nothing waiting')) : undefined}
            trailing={reviewsDue.length ? <CountBadge count={reviewsDue.length} /> : undefined}
            onPress={reviewsDue[0] ? () => go('ReviewDetail', { id: reviewsDue[0]!.appraisal_id }) : undefined}
            chevron={reviewsDue.length > 0}
          />
        </ListGroup>
      </Section>

      <Section title={t('Today')} description={today.data ? formatDate(today.data.today) : undefined}>
        <QueryView
          query={today}
          skeleton={<SkeletonList rows={4} />}
          isEmpty={(d) => d.members.length === 0}
          empty={<EmptyState spot="team" title={t('No one reports to you')} message={t('When people join your team, they show here.')} />}
        >
          {(d) => (
            <Stack gap="row">
              <View style={styles.summary}>
                {teamSummary(d.counts).map((s) => (
                  <Badge key={s.state} label={`${s.count} ${t(s.label).toLowerCase()}`} tone={s.tone} />
                ))}
                {d.counts.late ? <Badge label={tn(d.counts.late, '{count} late', '{count} late')} tone="warning" /> : null}
              </View>
              <ListGroup>
                {d.members.map((m) => (
                  <ListRow
                    key={m.employee_id}
                    leading={<Avatar name={m.employee_name} />}
                    title={m.employee_name}
                    subtitle={m.designation ?? undefined}
                    // The badge already says the state; the line only adds a time, a reason or lateness.
                    meta={todayLine(m) !== t(teamState(m.state).label) ? todayLine(m) : undefined}
                    trailing={<Badge label={t(teamState(m.state).label)} tone={teamState(m.state).tone} />}
                    onPress={() => go('TeamMember', { id: m.employee_id })}
                  />
                ))}
              </ListGroup>
            </Stack>
          )}
        </QueryView>
      </Section>

      {reviews.data && reviews.data.length ? (
        <Section title={t('Reviews')}>
          <ListGroup>
            {reviews.data.map((r) => (
              <ListRow
                key={r.appraisal_id}
                icon={ClipboardCheck}
                iconTone={r.awaiting_me ? 'accent' : 'neutral'}
                title={r.employee_name}
                subtitle={[r.cycle_name, r.stage_label].filter(Boolean).join(' · ')}
                meta={r.days_overdue > 0 ? tn(r.days_overdue, '{count} day overdue', '{count} days overdue') : r.due_date ? t('due {date}', { date: formatDate(r.due_date) }) : undefined}
                trailing={r.awaiting_me ? <Badge label={t('Your turn')} tone="warning" /> : r.final_rating ? <Badge label={r.final_rating} tone="success" /> : <Badge label={t(statusLabel(r.status))} tone="neutral" />}
                onPress={() => go('ReviewDetail', { id: r.appraisal_id })}
              />
            ))}
          </ListGroup>
        </Section>
      ) : reviews.error ? (
        <ErrorState error={reviews.error} onRetry={() => void reviews.refetch()} />
      ) : null}

      {oneOnOnes.data && oneOnOnes.data.length ? (
        <Section title={t('1:1s')}>
          <ListGroup>
            {oneOnOnes.data.map((o) => (
              <ListRow
                key={o.employee_id}
                icon={MessagesSquare}
                title={o.name}
                subtitle={oneOnOneLine(o.next_scheduled_on, o.last_held_on)}
                meta={o.open_action_items ? tn(o.open_action_items, '{count} open action item', '{count} open action items') : undefined}
                onPress={o.next_one_on_one_id ? () => go('OneOnOneDetail', { id: o.next_one_on_one_id! }) : undefined}
                chevron={Boolean(o.next_one_on_one_id)}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}
    </Screen>
  );
}

export function TeamMemberScreen() {
  const allowed = useSession().can('myTeam');
  return allowed ? <TeamMember /> : <NotAManager />;
}

function TeamMember() {
  const go = useGo();
  const { id } = useParams<{ id: string }>();
  const { today, reviews, oneOnOnes } = useTeam();
  const person = useQuery({ queryKey: ['employee', id], queryFn: () => peopleApi.employee(id!), enabled: Boolean(id) });
  const balances = useQuery({
    queryKey: [...keys.balances, id],
    queryFn: () => leaveApi.teamBalances({ q: person.data?.employee_code ?? undefined, page_size: 25 }),
    enabled: Boolean(person.data?.employee_code),
  });

  if (person.isPending) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={4} />
      </Screen>
    );
  }
  if (!person.data) {
    return (
      <Screen tier="tier2">
        <ErrorState error={person.error} onRetry={() => void person.refetch()} />
      </Screen>
    );
  }
  const p = person.data;
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
  const member = today.data?.members.find((m) => m.employee_id === id);
  const balanceRow = balances.data?.items.find((r) => r.employee_id === id);
  const columns = balances.data?.leave_types ?? [];
  const theirReviews = (reviews.data ?? []).filter((r) => r.employee_id === id);
  const oneOnOne = oneOnOnes.data?.find((o) => o.employee_id === id);

  return (
    <Screen
      tier="tier2"
      onRefresh={() => Promise.all([person.refetch(), today.refetch(), reviews.refetch(), oneOnOnes.refetch(), balances.refetch()])}
    >
      <Card>
        <View style={styles.head}>
          <Avatar name={name} url={p.photo_url} />
          <View style={styles.flex}>
            <Txt variant="headline" numberOfLines={1}>
              {name}
            </Txt>
            <Txt variant="callout" tone="muted" numberOfLines={1}>
              {[p.designation, p.employee_code].filter(Boolean).join(' · ')}
            </Txt>
          </View>
        </View>
        <Button label={t('Full profile')} size="sm" variant="ghost" onPress={() => go('Colleague', { id: id! })} />
      </Card>

      <Section title={t('Today')}>
        {today.isPending ? (
          <SkeletonCard lines={2} />
        ) : member ? (
          <Card>
            <Stack gap="tight">
              <View style={styles.titleRow}>
                <Txt variant="bodyStrong" style={styles.flex}>
                  {todayLine(member)}
                </Txt>
                <Badge label={t(teamState(member.state).label)} tone={teamState(member.state).tone} />
              </View>
              {member.shift_name ? (
                <Txt variant="caption" tone="muted">
                  {member.shift_start ? t('{shift}, starts {time}', { shift: member.shift_name, time: member.shift_start.slice(0, 5) }) : member.shift_name}
                </Txt>
              ) : null}
              {member.last_punch_location ? (
                <Txt variant="caption" tone="muted">
                  {t('Last punch at {place}', { place: member.last_punch_location })}
                </Txt>
              ) : null}
            </Stack>
          </Card>
        ) : (
          <Txt variant="callout" tone="muted">
            {t('Today’s attendance is not shown for this person.')}
          </Txt>
        )}
      </Section>

      <Section title={t('Leave balance')} description={balances.data ? String(balances.data.year) : undefined}>
        {balances.isPending ? (
          <SkeletonCard lines={3} />
        ) : balanceRow ? (
          <Card>
            <Stack gap="tight">
              {balanceRow.balances
                .map((b) => ({ b, column: columns.find((c) => c.leave_type_id === b.leave_type_id) }))
                .filter(({ b, column }) => column && (Number(b.entitled) > 0 || Number(b.used) > 0 || Number(b.pending) > 0))
                .map(({ b, column }) => (
                  <KeyValue
                    key={b.leave_type_id}
                    label={column!.name}
                    value={
                      Number(b.pending) > 0
                        ? t('{available} left · {pending} pending', { available: plainDecimal(b.available), pending: plainDecimal(b.pending) })
                        : t('{available} of {entitled} left', { available: plainDecimal(b.available), entitled: plainDecimal(b.entitled) })
                    }
                  />
                ))}
            </Stack>
          </Card>
        ) : balances.error ? (
          <ErrorState error={balances.error} onRetry={() => void balances.refetch()} />
        ) : (
          <Txt variant="callout" tone="muted">
            {t('No leave balance for this year yet.')}
          </Txt>
        )}
      </Section>

      {theirReviews.length ? (
        <Section title={t('Reviews')}>
          <ListGroup>
            {theirReviews.map((r) => (
              <ListRow
                key={r.appraisal_id}
                icon={ClipboardCheck}
                title={r.cycle_name}
                subtitle={r.stage_label ?? t(statusLabel(r.status))}
                trailing={r.awaiting_me ? <Badge label={t('Your turn')} tone="warning" /> : r.final_rating ? <Badge label={r.final_rating} tone="success" /> : undefined}
                onPress={() => go('ReviewDetail', { id: r.appraisal_id })}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {oneOnOne ? (
        <Section title={t('1:1s')}>
          <ListGroup>
            <ListRow
              icon={CalendarClock}
              title={oneOnOne.next_scheduled_on ? oneOnOneLine(oneOnOne.next_scheduled_on, null) : t('Nothing scheduled')}
              subtitle={
                [
                  oneOnOne.held_count ? tn(oneOnOne.held_count, '{count} held', '{count} held') : t('None held yet'),
                  oneOnOne.last_held_on ? t('last on {date}', { date: formatDate(oneOnOne.last_held_on) }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              }
              meta={oneOnOne.open_action_items ? tn(oneOnOne.open_action_items, '{count} open action item', '{count} open action items') : undefined}
              onPress={oneOnOne.next_one_on_one_id ? () => go('OneOnOneDetail', { id: oneOnOne.next_one_on_one_id! }) : undefined}
              chevron={Boolean(oneOnOne.next_one_on_one_id)}
            />
          </ListGroup>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
