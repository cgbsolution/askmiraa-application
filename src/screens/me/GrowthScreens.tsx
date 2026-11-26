/**
 * Growth: goals and check-ins, 1:1s (shared points and a private note),
 * feedback (giving it, and what was asked about me), reviews (the self review,
 * the outcome, agreeing or not) and learning (read, quiz, certificate).
 *
 * Tier 2. Scores and ratings are the server's; nothing is computed here.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarClock, ClipboardCheck } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { growthApi } from '../../api/growth';
import { Badge, Chip, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { AmountField, ChoiceField, TextField } from '../../components/Field';
import { FormScreen } from '../../components/FormScreen';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { Row, Screen, Section, Stack } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { useResetOnOpen } from '../../components/sheetContext';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState, Notice, ProgressBar, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { toast } from '../../components/Toast';
import { formatDate, formatDateShort, todayISO } from '../../core/dates';
import { plainDecimal } from '../../core/money';
import {
  canRateHere,
  earlierRating,
  ratingsPayload,
  reviewGaps,
  type CompetencyRatingInput,
  type StageRole,
  type MyReview,
  type ReviewDetail,
  type ValueRatingInput,
} from '../../core/performance';
import { statusLabel } from '../../core/status';
import type { CheckInConfidence, FeedbackForm, GoalRead, KeyResultRead, OneOnOneDetail } from '../../core/types';
import { openDownloaded } from '../../lib/files';
import { openInBrowser } from '../../lib/links';
import { t, tn } from '../../lib/i18n';
import { useAction } from '../../lib/useAction';
import { useGo, useParams } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';

const percent = (value: string | number | null | undefined) => Number(value ?? 0) / 100;

const CONFIDENCE: Record<CheckInConfidence, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  on_track: { label: 'On track', tone: 'success' },
  at_risk: { label: 'At risk', tone: 'warning' },
  off_track: { label: 'Off track', tone: 'danger' },
  done: { label: 'Done', tone: 'info' },
};

// ── Hub ─────────────────────────────────────────────────────────────────────

export function GrowthScreen() {
  const go = useGo();
  const goals = useQuery({ queryKey: ['goals'], queryFn: growthApi.goals });
  const reviews = useQuery({ queryKey: ['reviews', 'mine'], queryFn: growthApi.myReviews });
  const meetings = useQuery({ queryKey: ['one-on-ones'], queryFn: growthApi.oneOnOnes });
  const inbox = useQuery({ queryKey: ['feedback', 'inbox'], queryFn: growthApi.feedbackInbox });
  const learning = useQuery({ queryKey: ['learning'], queryFn: growthApi.learning });

  const active = (goals.data ?? []).filter((g) => g.status === 'active');
  const waitingReview = (reviews.data ?? []).find((r) => r.waiting_on_me);
  const today = todayISO();
  const next = (meetings.data ?? []).filter((m) => m.status === 'scheduled' && m.scheduled_on >= today).sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on))[0];
  const toGive = (inbox.data ?? []).filter((i) => i.status === 'pending').length;
  const toLearn = (learning.data ?? []).filter((l) => l.status === 'assigned').length;

  return (
    <Screen tier="tier2" onRefresh={() => Promise.all([goals.refetch(), reviews.refetch(), meetings.refetch(), inbox.refetch(), learning.refetch()])}>
      <ListGroup>
        <ListRow
          spot="target"
          title={t('Goals')}
          subtitle={active.length ? t('{count} active', { count: active.length }) : t('No active goals')}
          onPress={() => go('Goals')}
        />
        <ListRow
          spot="trend"
          title={t('My review')}
          subtitle={waitingReview ? t('{stage} is waiting on you', { stage: waitingReview.stage_label ?? t('A step') }) : t('Your reviews and outcomes')}
          trailing={waitingReview ? <Badge label={t('To do')} tone="warning" /> : undefined}
          onPress={() => go('Appraisal')}
        />
        <ListRow
          spot="chat"
          title={t('1:1s')}
          subtitle={next ? t('Next with {name}, {date}', { name: next.with_name, date: formatDate(next.scheduled_on) }) : t('Nothing scheduled')}
          onPress={() => go('OneOnOnes')}
        />
        <ListRow
          spot="quote"
          title={t('Feedback')}
          subtitle={toGive ? t('{count} asked of you', { count: toGive }) : t('Given, asked for and received')}
          trailing={toGive ? <Badge label={String(toGive)} tone="warning" /> : undefined}
          onPress={() => go('Feedback')}
        />
        <ListRow
          spot="cap"
          title={t('Learning')}
          subtitle={toLearn ? t('{count} to complete', { count: toLearn }) : t('Courses and certificates')}
          onPress={() => go('Learning')}
        />
      </ListGroup>
    </Screen>
  );
}

// ── Goals ───────────────────────────────────────────────────────────────────

function GoalCard({ goal, onPress }: { goal: GoalRead; onPress: () => void }) {
  const confidence = goal.latest_check_in?.confidence ? CONFIDENCE[goal.latest_check_in.confidence] : null;
  return (
    <Card onPress={onPress}>
      <Stack gap="tight">
        <View style={styles.titleRow}>
          <Txt variant="headline" style={styles.flex}>
            {goal.title}
          </Txt>
          {goal.status !== 'active' ? <StatusBadge status={goal.status} /> : confidence ? <Badge label={t(confidence.label)} tone={confidence.tone} /> : null}
        </View>
        {goal.parent_title ? (
          <Txt variant="caption" tone="muted">
            {t('Supports: {title}', { title: goal.parent_title })}
          </Txt>
        ) : null}
        <ProgressBar value={percent(goal.progress_percent)} label={t('{n}% done', { n: plainDecimal(goal.progress_percent) })} />
        <Row>
          <Txt variant="caption" tone="muted" style={styles.flex}>
            {t('{n}% done', { n: Math.round(Number(goal.progress_percent)) })}
          </Txt>
          {goal.status === 'active' && goal.due_date < todayISO() ? (
            <Txt variant="caption" tone="danger">
              {t('Overdue since {date}', { date: formatDate(goal.due_date) })}
            </Txt>
          ) : (
            <Txt variant="caption" tone="muted">
              {t('Due {date}', { date: formatDate(goal.due_date) })}
            </Txt>
          )}
        </Row>
      </Stack>
    </Card>
  );
}

export function GoalsScreen() {
  const go = useGo();
  const goals = useQuery({ queryKey: ['goals'], queryFn: growthApi.goals });
  const [segment, setSegment] = useState<'active' | 'done'>('active');
  const all = goals.data ?? [];
  const active = all.filter((g) => g.status === 'active' || g.status === 'draft');
  const done = all.filter((g) => g.status === 'completed' || g.status === 'cancelled');
  const shown = segment === 'active' ? active : done;
  return (
    <Screen tier="tier2" onRefresh={() => goals.refetch()}>
      <Segmented
        segments={[
          { value: 'active', label: t('Active'), count: active.length, quiet: true },
          { value: 'done', label: t('Finished'), count: done.length, quiet: true },
        ]}
        value={segment}
        onChange={setSegment}
      />
      <QueryView query={goals} skeleton={<SkeletonList rows={3} />}>
        {() =>
          shown.length ? (
            <Stack gap="row">
              {shown.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onPress={() => go('GoalDetail', { id: goal.id })} />
              ))}
            </Stack>
          ) : (
            <EmptyState
              spot="target"
              title={segment === 'active' ? t('No active goals') : t('Nothing finished yet')}
              message={segment === 'active' ? t('Goals your manager sets with you show here, with how far along each is.') : undefined}
            />
          )
        }
      </QueryView>
    </Screen>
  );
}

function krValue(kr: KeyResultRead, value: string): string {
  const plain = plainDecimal(value);
  if (kr.kind === 'percent') return `${plain}%`;
  if (kr.kind === 'currency') return `₹${plain}`;
  if (kr.kind === 'milestone') return Number(value) >= Number(kr.target_value) ? t('Done') : t('Not yet');
  return kr.unit ? `${plain} ${kr.unit}` : plain;
}

export function GoalDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const goal = useQuery({ queryKey: ['goals', id], queryFn: () => growthApi.goal(id!), enabled: Boolean(id) });
  const history = useQuery({ queryKey: ['goals', id, 'check-ins'], queryFn: () => growthApi.checkIns(id!), enabled: Boolean(id) });
  const [checking, setChecking] = useState(false);

  if (goal.isPending) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={5} />
      </Screen>
    );
  }
  if (!goal.data) {
    return (
      <Screen tier="tier2">
        <ErrorState error={goal.error} onRetry={() => void goal.refetch()} />
      </Screen>
    );
  }
  const g = goal.data;
  const canCheckIn = g.status === 'active';

  return (
    <Screen
      tier="tier2"
      onRefresh={() => Promise.all([goal.refetch(), history.refetch()])}
      footer={canCheckIn ? <Button label={t('Check in')} variant="accent" onPress={() => setChecking(true)} fullWidth /> : undefined}
    >
      <Card>
        <Stack gap="row">
          <View style={styles.titleRow}>
            <Txt variant="title" style={styles.flex}>
              {g.title}
            </Txt>
            <StatusBadge status={g.status} />
          </View>
          {g.description ? (
            <Txt variant="body" tone="muted">
              {g.description}
            </Txt>
          ) : null}
          <ProgressBar value={percent(g.progress_percent)} />
          <KeyValue label={t('Progress')} value={`${Math.round(Number(g.progress_percent))}%`} strong />
          <KeyValue label={t('Due')} value={formatDate(g.due_date)} />
          <KeyValue label={t('Weight')} value={`${plainDecimal(g.weight)}%`} />
          {g.parent_title ? <KeyValue label={t('Supports')} value={g.parent_title} /> : null}
        </Stack>
      </Card>

      {g.key_results.length ? (
        <Section title={t('Key results')}>
          <Stack gap="row">
            {g.key_results.map((kr) => (
              <Card key={kr.id} variant="sunken">
                <Stack gap="tight">
                  <Txt variant="bodyStrong">{kr.title}</Txt>
                  <ProgressBar value={percent(kr.progress)} />
                  <Txt variant="caption" tone="muted">
                    {t('{now} of {target} · started at {start}', {
                      now: krValue(kr, kr.current_value),
                      target: krValue(kr, kr.target_value),
                      start: krValue(kr, kr.start_value),
                    })}
                  </Txt>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Section>
      ) : null}

      <Section title={t('Check-ins')}>
        <QueryView
          query={history}
          skeleton={<SkeletonList rows={2} />}
          isEmpty={(d) => d.length === 0}
          empty={
            <Txt variant="callout" tone="muted">
              {t('No check-ins yet. Check in to record progress or how it is going.')}
            </Txt>
          }
        >
          {(data) => (
            <ListGroup>
              {data.map((c) => (
                <ListRow
                  key={c.id}
                  title={
                    c.key_result_title && c.new_value !== null
                      ? t('{kr}: {from} → {to}', { kr: c.key_result_title, from: plainDecimal(c.previous_value), to: plainDecimal(c.new_value) })
                      : c.confidence
                        ? t(CONFIDENCE[c.confidence].label)
                        : t('Note')
                  }
                  subtitle={c.note ?? undefined}
                  meta={[formatDate(c.recorded_at), c.recorded_by_name].filter(Boolean).join(' · ')}
                  numberOfLines={3}
                />
              ))}
            </ListGroup>
          )}
        </QueryView>
      </Section>

      <CheckInSheet open={checking} onClose={() => setChecking(false)} goal={g} />
    </Screen>
  );
}

function CheckInSheet({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: GoalRead }) {
  const [krId, setKrId] = useState<string>('');
  const [value, setValue] = useState('');
  const [confidence, setConfidence] = useState<CheckInConfidence | ''>('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setKrId(goal.key_results[0]?.id ?? '');
    setValue('');
    setConfidence('');
    setNote('');
    setTouched(false);
  });
  const kr = goal.key_results.find((k) => k.id === krId) ?? null;
  const nothing = !value && !confidence && !note.trim();
  const error = nothing ? t('Enter a new value, how it is going, or a note.') : null;
  const save = useAction(
    () =>
      growthApi.checkIn(goal.id, {
        key_result_id: value && kr ? kr.id : null,
        value: value && kr ? value : null,
        confidence: confidence || null,
        note: note.trim() || null,
      }),
    { success: t('Checked in'), invalidate: [['goals']], onSuccess: onClose },
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Check in')}
      description={goal.title}
      dirty={!nothing}
      footer={
        <Button
          label={t('Save check-in')}
          variant="accent"
          loading={save.pending}
          onPress={() => {
            setTouched(true);
            if (!error) void save.run(undefined);
          }}
          fullWidth
        />
      }
    >
      {goal.key_results.length > 1 ? (
        <ChoiceField label={t('Key result')} value={krId} options={goal.key_results.map((k) => ({ value: k.id, label: k.title }))} onChange={setKrId} />
      ) : null}
      {kr ? (
        <AmountField
          label={t('New value')}
          prefix={kr.kind === 'currency' ? '₹' : ''}
          value={value}
          onChangeText={setValue}
          rules={{ decimals: 4 }}
          helper={t('Now {now}, target {target}', { now: krValue(kr, kr.current_value), target: krValue(kr, kr.target_value) })}
        />
      ) : null}
      <ChoiceField
        label={t('How is it going?')}
        value={confidence}
        options={(Object.keys(CONFIDENCE) as CheckInConfidence[]).map((c) => ({ value: c, label: t(CONFIDENCE[c].label) }))}
        onChange={(v) => setConfidence(v as CheckInConfidence)}
      />
      <TextField label={t('Note')} value={note} onChangeText={setNote} multiline maxLength={2000} placeholder={t('What moved, what is blocking')} />
      {touched && error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
    </Sheet>
  );
}

// ── 1:1s ────────────────────────────────────────────────────────────────────

export function OneOnOnesScreen() {
  const go = useGo();
  const meetings = useQuery({ queryKey: ['one-on-ones'], queryFn: growthApi.oneOnOnes });
  const [segment, setSegment] = useState<'upcoming' | 'past'>('upcoming');
  const all = meetings.data ?? [];
  const today = todayISO();
  // A meeting whose day has gone is past, even if nobody marked it done.
  const upcoming = all.filter((m) => m.status === 'scheduled' && m.scheduled_on >= today).sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on));
  const past = all.filter((m) => !(m.status === 'scheduled' && m.scheduled_on >= today)).sort((a, b) => b.scheduled_on.localeCompare(a.scheduled_on));
  const shown = segment === 'upcoming' ? upcoming : past;
  return (
    <Screen tier="tier2" onRefresh={() => meetings.refetch()}>
      <Segmented
        segments={[
          { value: 'upcoming', label: t('Upcoming'), count: upcoming.length, quiet: true },
          { value: 'past', label: t('Past'), count: past.length, quiet: true },
        ]}
        value={segment}
        onChange={setSegment}
      />
      <QueryView query={meetings} skeleton={<SkeletonList rows={3} />}>
        {() =>
          shown.length ? (
            <ListGroup>
              {shown.map((m) => (
                <ListRow
                  key={m.id}
                  icon={CalendarClock}
                  title={t('With {name}', { name: m.with_name })}
                  subtitle={[formatDateShort(m.scheduled_on), m.start_time ? m.start_time.slice(0, 5) : null, t('{n} min', { n: m.duration_minutes })]
                    .filter(Boolean)
                    .join(' · ')}
                  meta={m.talking_points ? tn(m.talking_points, '{count} talking point', '{count} talking points') : undefined}
                  trailing={
                    m.status !== 'scheduled' ? <StatusBadge status={m.status} /> : m.scheduled_on < today ? <Badge label={t('Not closed')} tone="neutral" /> : undefined
                  }
                  onPress={() => go('OneOnOneDetail', { id: m.id })}
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState spot="chat" title={segment === 'upcoming' ? t('No 1:1s coming up') : t('No past 1:1s')} />
          )
        }
      </QueryView>
    </Screen>
  );
}

export function OneOnOneDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { colors } = useTheme();
  const meeting = useQuery({ queryKey: ['one-on-ones', id], queryFn: () => growthApi.oneOnOne(id!), enabled: Boolean(id) });
  const [adding, setAdding] = useState<'talking_point' | 'action_item' | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const toggle = useAction(
    (args: { itemId: string; done: boolean }) => growthApi.updateItem(id!, args.itemId, { done: args.done }),
    { success: (_, args) => (args.done ? t('Marked done') : t('Reopened')), invalidate: [['one-on-ones']] },
  );

  if (meeting.isPending) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={5} />
      </Screen>
    );
  }
  if (!meeting.data) {
    return (
      <Screen tier="tier2">
        <ErrorState error={meeting.error} onRetry={() => void meeting.refetch()} />
      </Screen>
    );
  }
  const m: OneOnOneDetail = meeting.data;
  const open = m.status === 'scheduled';
  const points = m.items.filter((i) => i.kind === 'talking_point');
  const actions = [...m.items.filter((i) => i.kind === 'action_item'), ...m.carried_over];

  return (
    <Screen tier="tier2" onRefresh={() => meeting.refetch()}>
      <Card>
        <Stack gap="tight">
          <View style={styles.titleRow}>
            <Txt variant="title" style={styles.flex}>
              {t('1:1 with {name}', { name: m.with_name })}
            </Txt>
            <StatusBadge status={m.status} />
          </View>
          <Txt variant="callout" tone="muted">
            {[formatDate(m.scheduled_on), m.start_time ? m.start_time.slice(0, 5) : null, t('{n} min', { n: m.duration_minutes })].filter(Boolean).join(' · ')}
          </Txt>
          {m.summary ? <Txt variant="body">{m.summary}</Txt> : null}
        </Stack>
      </Card>

      <Section title={t('Talking points')} action={open ? { label: t('Add'), onPress: () => setAdding('talking_point') } : undefined}>
        {points.length ? (
          <ListGroup>
            {points.map((p) => (
              <ListRow key={p.id} title={p.body} meta={p.added_by_name ? t('Added by {name}', { name: p.added_by_name }) : undefined} numberOfLines={4} />
            ))}
          </ListGroup>
        ) : (
          <Txt variant="callout" tone="muted">
            {open ? t('Nothing yet. Add what you want to talk about.') : t('No talking points were added.')}
          </Txt>
        )}
      </Section>

      <Section title={t('Action items')} action={open ? { label: t('Add'), onPress: () => setAdding('action_item') } : undefined}>
        {actions.length ? (
          <ListGroup>
            {actions.map((a) => {
              const done = Boolean(a.done_at);
              return (
                <ListRow
                  key={a.id}
                  title={a.body}
                  subtitle={[a.owner_name ? t('Owner: {name}', { name: a.owner_name }) : null, a.due_on ? t('due {date}', { date: formatDateShort(a.due_on) }) : null, a.from_meeting_on ? t('from {date}', { date: formatDateShort(a.from_meeting_on) }) : null]
                    .filter(Boolean)
                    .join(' · ')}
                  numberOfLines={4}
                  leading={
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      accessibilityLabel={a.body}
                      hitSlop={spacing.sm}
                      onPress={() => void toggle.run({ itemId: a.id, done: !done })}
                      style={[styles.check, { borderColor: done ? colors.success : colors.borderStrong, backgroundColor: done ? colors.success : 'transparent' }]}
                    >
                      {done ? <Txt variant="label" style={{ color: colors.surface }}>✓</Txt> : null}
                    </Pressable>
                  }
                />
              );
            })}
          </ListGroup>
        ) : (
          <Txt variant="callout" tone="muted">
            {t('No action items.')}
          </Txt>
        )}
      </Section>

      <Section title={t('My private note')} description={t('Only you can see this.')}>
        <Card variant="sunken" onPress={() => setNoteOpen(true)}>
          <Stack gap="tight">
            <Txt variant="body" tone={m.my_note ? 'default' : 'muted'}>
              {m.my_note || t('Tap to write a note for yourself.')}
            </Txt>
            {m.my_note_updated_at ? (
              <Txt variant="caption" tone="subtle">
                {t('Saved {date}', { date: formatDate(m.my_note_updated_at) })}
              </Txt>
            ) : null}
          </Stack>
        </Card>
      </Section>

      <AddItemSheet kind={adding} onClose={() => setAdding(null)} meetingId={m.id} />
      <NoteSheet open={noteOpen} onClose={() => setNoteOpen(false)} meetingId={m.id} current={m.my_note ?? ''} />
    </Screen>
  );
}

function AddItemSheet({ kind, onClose, meetingId }: { kind: 'talking_point' | 'action_item' | null; onClose: () => void; meetingId: string }) {
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(kind !== null, () => {
    setBody('');
    setTouched(false);
  });
  const error = !body.trim() ? t('Write it down first.') : null;
  const add = useAction(() => growthApi.addItem(meetingId, { kind: kind!, body: body.trim() }), {
    success: t('Added'),
    invalidate: [['one-on-ones']],
    onSuccess: onClose,
  });
  return (
    <Sheet
      open={kind !== null}
      onClose={onClose}
      title={kind === 'action_item' ? t('Add an action item') : t('Add a talking point')}
      dirty={Boolean(body.trim())}
      footer={
        <Button
          label={t('Add')}
          variant="accent"
          loading={add.pending}
          onPress={() => {
            setTouched(true);
            if (!error) void add.run(undefined);
          }}
          fullWidth
        />
      }
    >
      <TextField label={kind === 'action_item' ? t('What needs doing') : t('What to talk about')} required value={body} onChangeText={setBody} multiline maxLength={2000} error={touched ? error : null} />
      <Txt variant="caption" tone="muted">
        {t('Both of you see this.')}
      </Txt>
    </Sheet>
  );
}

function NoteSheet({ open, onClose, meetingId, current }: { open: boolean; onClose: () => void; meetingId: string; current: string }) {
  const [body, setBody] = useState(current);
  useResetOnOpen(open, () => setBody(current));
  const save = useAction(() => growthApi.writeNote(meetingId, body), { success: t('Note saved'), invalidate: [['one-on-ones']], onSuccess: onClose });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('My private note')}
      description={t('Only you can see this. Not your manager, not HR.')}
      dirty={body !== current}
      footer={<Button label={t('Save note')} variant="primary" loading={save.pending} onPress={() => void save.run(undefined)} fullWidth />}
    >
      <TextField label={t('Note')} value={body} onChangeText={setBody} multiline maxLength={10000} />
    </Sheet>
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────

export function FeedbackScreen() {
  const go = useGo();
  const inbox = useQuery({ queryKey: ['feedback', 'inbox'], queryFn: growthApi.feedbackInbox });
  const aboutMe = useQuery({ queryKey: ['feedback', 'about-me'], queryFn: growthApi.feedbackAboutMe });
  const received = useQuery({ queryKey: ['feedback', 'private'], queryFn: growthApi.privateFeedback });
  const pending = (inbox.data ?? []).filter((i) => i.status === 'pending');
  const [segment, setSegment] = useState<'give' | 'me' | 'received'>('give');

  return (
    <Screen tier="tier2" onRefresh={() => Promise.all([inbox.refetch(), aboutMe.refetch(), received.refetch()])}>
      <Segmented
        segments={[
          { value: 'give', label: t('To give'), count: pending.length },
          { value: 'me', label: t('About me') },
          { value: 'received', label: t('Received') },
        ]}
        value={segment}
        onChange={setSegment}
      />
      {segment === 'give' ? (
        <QueryView
          query={inbox}
          skeleton={<SkeletonList rows={3} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState spot="quote" title={t('Nobody has asked you for feedback')} message={t('When a colleague’s manager asks for your view, it shows here.')} />}
        >
          {(data) => (
            <ListGroup>
              {data.map((item) => (
                <ListRow
                  key={item.reviewer_id}
                  title={t('Feedback on {name}', { name: item.subject_name })}
                  subtitle={[item.cycle_name, t('due {date}', { date: formatDateShort(item.due_on) })].filter(Boolean).join(' · ')}
                  meta={item.requested_by_name ? t('Asked by {name}', { name: item.requested_by_name }) : undefined}
                  trailing={
                    item.status === 'pending' ? (
                      <Badge label={t('Due')} tone="warning" />
                    ) : item.status === 'submitted' ? (
                      <Badge label={t('Sent')} tone="success" />
                    ) : (
                      <Badge label={t('Declined')} tone="neutral" />
                    )
                  }
                  onPress={item.status === 'pending' && item.request_status === 'open' ? () => go('GiveFeedback', { id: item.reviewer_id }) : undefined}
                />
              ))}
            </ListGroup>
          )}
        </QueryView>
      ) : null}
      {segment === 'me' ? (
        <QueryView
          query={aboutMe}
          skeleton={<SkeletonList rows={2} />}
          isEmpty={(d) => d.filter((r) => r.my_role === 'subject').length === 0}
          empty={<EmptyState spot="quote" title={t('No feedback asked about you')} />}
        >
          {(data) => (
            <Stack gap="row">
              {data
                .filter((r) => r.my_role === 'subject')
                .map((r) => (
                  <AboutMeCard key={r.id} requestId={r.id} />
                ))}
            </Stack>
          )}
        </QueryView>
      ) : null}
      {segment === 'received' ? (
        <QueryView
          query={received}
          skeleton={<SkeletonList rows={2} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState spot="quote" title={t('Nothing received yet')} message={t('Private notes of appreciation or suggestions from colleagues show here.')} />}
        >
          {(data) => (
            <Stack gap="row">
              {data.map((f) => (
                <Card key={f.id}>
                  <Stack gap="tight">
                    <View style={styles.titleRow}>
                      <Txt variant="bodyStrong" style={styles.flex}>
                        {f.from_name}
                      </Txt>
                      <Badge label={t(f.kind === 'appreciation' ? 'Appreciation' : 'Suggestion')} tone={f.kind === 'appreciation' ? 'success' : 'info'} />
                    </View>
                    <Txt variant="body">{f.body}</Txt>
                    <Txt variant="caption" tone="subtle">
                      {formatDate(f.created_at)}
                    </Txt>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </QueryView>
      ) : null}
    </Screen>
  );
}

function AboutMeCard({ requestId }: { requestId: string }) {
  const detail = useQuery({ queryKey: ['feedback', 'request', requestId], queryFn: () => growthApi.feedbackRequest(requestId) });
  if (detail.isPending) return <SkeletonCard lines={3} />;
  if (!detail.data) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  const d = detail.data;
  const agg = d.aggregate;
  return (
    <Card>
      <Stack gap="tight">
        <View style={styles.titleRow}>
          <Txt variant="headline" style={styles.flex}>
            {d.cycle_name ?? t('Feedback about you')}
          </Txt>
          <StatusBadge status={d.status} />
        </View>
        <Txt variant="caption" tone="muted">
          {t('{answered} of {total} answered · asked by {name}', { answered: d.responses, total: d.reviewers_total, name: d.requested_by_name ?? '—' })}
        </Txt>
        <Txt variant="callout" tone="muted">
          {d.visibility_note}
        </Txt>
        {agg ? (
          <>
            {agg.overall_average ? <KeyValue label={t('Overall')} value={plainDecimal(agg.overall_average)} strong /> : null}
            {agg.competencies.map((c) => (
              <KeyValue key={c.competency_id} label={c.name} value={c.average ? plainDecimal(c.average) : '—'} />
            ))}
            {agg.strengths.length ? (
              <Stack gap="tight">
                <Txt variant="label" tone="muted">
                  {t('Strengths')}
                </Txt>
                {agg.strengths.map((s, i) => (
                  <Txt key={i} variant="callout">
                    “{s}”
                  </Txt>
                ))}
              </Stack>
            ) : null}
            {agg.improvements.length ? (
              <Stack gap="tight">
                <Txt variant="label" tone="muted">
                  {t('To work on')}
                </Txt>
                {agg.improvements.map((s, i) => (
                  <Txt key={i} variant="callout">
                    “{s}”
                  </Txt>
                ))}
              </Stack>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Card>
  );
}

function ScaleChips({
  levels,
  value,
  onChange,
}: {
  levels: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {levels.map((l) => (
        <Chip key={l.value} label={`${plainDecimal(l.value)} · ${l.label}`} selected={l.value === value} onPress={() => onChange(l.value === value ? null : l.value)} />
      ))}
    </View>
  );
}

export function GiveFeedbackScreen() {
  const navigation = useNavigation();
  const { id } = useParams<{ id: string }>();
  const form = useQuery({ queryKey: ['feedback', 'form', id], queryFn: () => growthApi.feedbackForm(id!), enabled: Boolean(id) });
  const [ratings, setRatings] = useState<Record<string, string | null>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [overall, setOverall] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const f = form.data;
    if (!f) return;
    setRatings(Object.fromEntries(f.competency_ratings.map((r) => [r.competency_id, r.rating ?? null])));
    setStrengths(f.strengths ?? '');
    setImprovements(f.improvements ?? '');
    setOverall(f.overall_rating);
  }, [form.data]);

  const submit = useAction(
    (f: FeedbackForm) =>
      growthApi.submitFeedback(f.reviewer_id, {
        competency_ratings: f.questions.map((q) => ({ competency_id: q.competency_id, rating: ratings[q.competency_id] ?? null, comment: comments[q.competency_id]?.trim() || null })),
        strengths: strengths.trim() || null,
        improvements: improvements.trim() || null,
        overall_rating: overall,
      }),
    { success: t('Feedback sent'), invalidate: [['feedback']] },
  );
  const decline = useAction((reason: string) => growthApi.declineFeedback(id!, reason), { success: t('Declined'), invalidate: [['feedback']] });

  if (form.isPending) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={6} />
      </Screen>
    );
  }
  if (!form.data) {
    return (
      <Screen tier="tier2">
        <ErrorState error={form.error} onRetry={() => void form.refetch()} />
      </Screen>
    );
  }
  const f = form.data;
  const levels = f.scale?.levels ?? [];
  const unrated = f.questions.filter((q) => !ratings[q.competency_id]);
  const empty = unrated.length === f.questions.length && !strengths.trim() && !improvements.trim() && !overall;
  const done = f.status !== 'pending' || f.request_status !== 'open';

  if (done) {
    return (
      <Screen tier="tier2">
        <EmptyState spot="quote" title={f.status === 'submitted' ? t('Feedback sent') : t('This request is closed')} message={f.submitted_at ? t('You sent it on {date}.', { date: formatDate(f.submitted_at) }) : undefined} />
      </Screen>
    );
  }

  return (
    <FormScreen
      tier="tier2"
      submitLabel={t('Send feedback')}
      dirty={!empty}
      closing={closing}
      secondary={{ label: t('Decline'), onPress: () => setDeclining(true) }}
      onSubmit={async () => {
        setTouched(true);
        if (empty) return;
        const sent = await submit.run(f);
        if (sent) navigation.goBack();
      }}
      footerNote={
        touched && empty ? (
          <Txt variant="caption" tone="danger">
            {t('Rate at least one thing or write a comment.')}
          </Txt>
        ) : null
      }
    >
      <Stack gap="tight">
        <Txt variant="displaySmall">{t('Feedback on {name}', { name: f.subject_name })}</Txt>
        {f.message ? (
          <Txt variant="callout" tone="muted">
            “{f.message}” — {f.requested_by_name}
          </Txt>
        ) : null}
        <Notice tone="info" message={f.visibility_statement} />
      </Stack>
      {f.questions.map((q) => (
        <Card key={q.competency_id} variant="sunken">
          <Stack gap="tight">
            <Txt variant="headline">{q.name}</Txt>
            {q.description ? (
              <Txt variant="caption" tone="muted">
                {q.description}
              </Txt>
            ) : null}
            <ScaleChips levels={levels} value={ratings[q.competency_id] ?? null} onChange={(v) => setRatings((r) => ({ ...r, [q.competency_id]: v }))} />
            <TextField
              label={t('Example (optional)')}
              value={comments[q.competency_id] ?? ''}
              onChangeText={(v) => setComments((c) => ({ ...c, [q.competency_id]: v }))}
              multiline
              maxLength={2000}
            />
          </Stack>
        </Card>
      ))}
      <TextField label={t('What they do well')} value={strengths} onChangeText={setStrengths} multiline maxLength={4000} />
      <TextField label={t('What they could do better')} value={improvements} onChangeText={setImprovements} multiline maxLength={4000} />
      {levels.length ? (
        <Stack gap="tight">
          <Txt variant="label" tone="muted">
            {t('Overall')}
          </Txt>
          <ScaleChips levels={levels} value={overall} onChange={setOverall} />
        </Stack>
      ) : null}
      <ConfirmSheet
        open={declining}
        onClose={() => setDeclining(false)}
        title={t('Decline to give feedback?')}
        message={t('{name}’s manager will see that you declined.', { name: f.subject_name })}
        confirmLabel={t('Decline')}
        cancelLabel={t('Keep it')}
        tone="danger"
        note={{ label: t('Reason'), placeholder: t('Optional — for example, you have not worked together') }}
        onConfirm={async (reason) => {
          setDeclining(false);
          const declined = await decline.run(reason);
          if (declined) setClosing(true);
        }}
      />
    </FormScreen>
  );
}

// ── Reviews ─────────────────────────────────────────────────────────────────

function ReviewRow({ review, onPress }: { review: MyReview; onPress: () => void }) {
  return (
    <ListRow
      icon={ClipboardCheck}
      title={review.cycle_name}
      subtitle={
        review.final_rating
          ? t('Outcome: {rating}', { rating: review.final_rating })
          : [review.stage_label, review.due_date ? t('due {date}', { date: formatDate(review.due_date) }) : null].filter(Boolean).join(' · ')
      }
      meta={review.waiting_on_me && review.days_overdue > 0 ? tn(review.days_overdue, '{count} day overdue', '{count} days overdue') : undefined}
      trailing={review.waiting_on_me ? <Badge label={t('To do')} tone="warning" /> : <StatusBadge status={review.status} />}
      onPress={onPress}
    />
  );
}

export function AppraisalScreen() {
  const go = useGo();
  const reviews = useQuery({ queryKey: ['reviews', 'mine'], queryFn: growthApi.myReviews });
  return (
    <Screen tier="tier2" onRefresh={() => reviews.refetch()}>
      <QueryView
        query={reviews}
        skeleton={<SkeletonList rows={2} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState spot="trend" title={t('No reviews yet')} message={t('When HR starts a review cycle, your review shows here.')} />}
      >
        {(data) => (
          <ListGroup>
            {data.map((r) => (
              <ReviewRow key={r.appraisal_id} review={r} onPress={() => go('ReviewDetail', { id: r.appraisal_id })} />
            ))}
          </ListGroup>
        )}
      </QueryView>
    </Screen>
  );
}

export function ReviewDetailScreen() {
  const go = useGo();
  const { id } = useParams<{ id: string }>();
  const { colors } = useTheme();
  const detail = useQuery({ queryKey: ['reviews', id], queryFn: () => growthApi.review(id!), enabled: Boolean(id) });
  const [acking, setAcking] = useState<'agreed' | 'disagreed' | null>(null);
  const [sendingBack, setSendingBack] = useState(false);
  const sendBack = useAction(
    (args: { target: string; reason: string }) => growthApi.returnReview(id!, args.target, args.reason),
    { success: t('Sent back'), invalidate: [['reviews'], ['team', 'reviews']], onSuccess: () => setSendingBack(false) },
  );
  const ack = useAction(
    (args: { kind: 'agreed' | 'disagreed'; objection: string }) => growthApi.acknowledgeReview(id!, args.kind, args.objection.trim() || null),
    { success: t('Thanks — your response is recorded'), invalidate: [['reviews']] },
  );

  if (detail.isPending) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={6} />
      </Screen>
    );
  }
  if (!detail.data) {
    return (
      <Screen tier="tier2">
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }
  const d: ReviewDetail = detail.data;
  const a = d.appraisal;
  const myStep = canRateHere(d);
  const selfStep = myStep && a.current_stage_role === 'self';
  const returnTargets = myStep && !selfStep ? (d.viewer.return_targets ?? []) : [];
  const startLabel = selfStep
    ? d.draft
      ? t('Continue your self review')
      : t('Start your self review')
    : d.draft
      ? t('Continue your review')
      : t('Write your review');

  return (
    <Screen
      tier="tier2"
      onRefresh={() => detail.refetch()}
      footer={
        myStep ? (
          <Stack gap="inline">
            <Button label={startLabel} variant="accent" onPress={() => go('SelfReview', { id: a.id })} fullWidth />
            {returnTargets.length ? <Button label={t('Send back')} variant="ghost" onPress={() => setSendingBack(true)} fullWidth /> : null}
          </Stack>
        ) : undefined
      }
    >
      <Card>
        <Stack gap="tight">
          {!d.viewer.is_subject ? (
            <Txt variant="callout" tone="muted">
              {[a.employee_name, a.designation].filter(Boolean).join(' · ')}
            </Txt>
          ) : null}
          <Txt variant="title">{a.cycle_name}</Txt>
          <Txt variant="caption" tone="muted">
            {formatDate(a.period_start)} – {formatDate(a.period_end)}
            {a.manager_name ? ` · ${t('Manager: {name}', { name: a.manager_name })}` : ''}
          </Txt>
          {d.outcome?.final_rating ? (
            <View style={[styles.outcome, { backgroundColor: colors.soft, borderColor: colors.softBorder }]}>
              <Txt variant="caption" tone="muted">
                {t('Outcome')}
              </Txt>
              <Txt variant="displaySmall">{d.outcome.final_rating}</Txt>
              {d.outcome.final_score ? (
                <Txt variant="caption" tone="muted">
                  {t('Score {score}', { score: plainDecimal(d.outcome.final_score) })}
                </Txt>
              ) : null}
            </View>
          ) : null}
          {a.days_overdue > 0 && a.current_stage_label ? (
            <Notice tone="warning" message={tn(a.days_overdue, '{stage} is {count} day overdue.', '{stage} is {count} days overdue.', { stage: a.current_stage_label })} />
          ) : null}
        </Stack>
      </Card>

      <Section title={t('Steps')}>
        <ListGroup>
          {d.stages.map((s) => (
            <ListRow
              key={s.id}
              title={s.label}
              subtitle={s.due_date ? t('due {date}', { date: formatDate(s.due_date) }) : undefined}
              trailing={<Badge label={t(statusLabel(s.state === 'current' ? 'in_progress' : s.state))} tone={s.state === 'done' ? 'success' : s.state === 'current' ? 'warning' : 'neutral'} />}
            />
          ))}
        </ListGroup>
      </Section>

      {d.goals.contributing.length ? (
        <Section title={t('Goals in this review')} description={d.goals.score ? t('Goal score {score}', { score: plainDecimal(d.goals.score) }) : undefined}>
          <ListGroup>
            {d.goals.contributing.map((g) => (
              <ListRow key={g.goal_id} title={g.title} subtitle={t('{n}% done · weight {w}', { n: Math.round(Number(g.progress)), w: plainDecimal(g.weight) })} />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {d.entries.filter((e) => e.submitted_at).length ? (
        <Section title={t('What was written')}>
          <Stack gap="row">
            {d.entries
              .filter((e) => e.submitted_at)
              .map((e) => (
                <Card key={e.id} variant="sunken">
                  <Stack gap="tight">
                    <Txt variant="bodyStrong">{e.stage_label}</Txt>
                    <Txt variant="caption" tone="muted">
                      {[e.actor_name, formatDate(e.submitted_at)].filter(Boolean).join(' · ')}
                    </Txt>
                    {e.comments ? <Txt variant="callout">{e.comments}</Txt> : null}
                    {e.returned_reason ? <Notice tone="info" message={t('Sent back: {reason}', { reason: e.returned_reason })} /> : null}
                  </Stack>
                </Card>
              ))}
          </Stack>
        </Section>
      ) : null}

      {d.viewer.can_acknowledge ? (
        <Card variant="soft">
          <Stack gap="inline">
            <Txt variant="headline">{t('Your response')}</Txt>
            <Txt variant="callout" tone="muted">
              {t('Agree, or say why you do not. Either way the review closes; a disagreement goes on record with your words.')}
            </Txt>
            <Row>
              <View style={styles.flex}>
                <Button label={t('I agree')} variant="primary" onPress={() => setAcking('agreed')} fullWidth />
              </View>
              <View style={styles.flex}>
                <Button label={t('I disagree')} variant="secondary" onPress={() => setAcking('disagreed')} fullWidth />
              </View>
            </Row>
          </Stack>
        </Card>
      ) : a.acknowledged_at ? (
        <Txt variant="caption" tone="muted">
          {d.viewer.is_subject
            ? a.acknowledgement_type === 'disagreed'
              ? t('You disagreed on {date}: “{why}”', { date: formatDate(a.acknowledged_at), why: a.objection ?? '' })
              : t('You agreed on {date}.', { date: formatDate(a.acknowledged_at) })
            : a.acknowledgement_type === 'disagreed'
              ? t('{name} disagreed on {date}: “{why}”', { name: a.employee_name, date: formatDate(a.acknowledged_at), why: a.objection ?? '' })
              : t('{name} agreed on {date}.', { name: a.employee_name, date: formatDate(a.acknowledged_at) })}
        </Txt>
      ) : null}

      <SendBackSheet open={sendingBack} onClose={() => setSendingBack(false)} targets={returnTargets} pending={sendBack.pending} onSend={(target, reason) => void sendBack.run({ target, reason })} />

      <ConfirmSheet
        open={acking !== null}
        onClose={() => setAcking(null)}
        title={acking === 'disagreed' ? t('Disagree with this review?') : t('Agree with this review?')}
        message={acking === 'disagreed' ? t('Say what you disagree with. HR and your manager will read it.') : t('This closes your review.')}
        confirmLabel={acking === 'disagreed' ? t('Send') : t('I agree')}
        note={acking === 'disagreed' ? { label: t('What you disagree with'), required: true } : undefined}
        onConfirm={async (note) => {
          const kind = acking!;
          setAcking(null);
          await ack.run({ kind, objection: note });
        }}
      />
    </Screen>
  );
}

function SendBackSheet({
  open,
  onClose,
  targets,
  pending,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  targets: { id: string; label: string }[];
  pending: boolean;
  onSend: (target: string, reason: string) => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setTarget(targets.length === 1 ? targets[0]!.id : null);
    setReason('');
    setTouched(false);
  });
  const errors = { target: !target ? t('Choose the step.') : null, reason: !reason.trim() ? t('Say what needs changing.') : null };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Send back')}
      description={t('The review goes back to that step with your reason. Your ratings are not sent.')}
      dirty={Boolean(reason)}
      footer={
        <Button
          label={t('Send back')}
          variant="danger"
          loading={pending}
          onPress={() => {
            setTouched(true);
            if (!errors.target && !errors.reason) onSend(target!, reason.trim());
          }}
          fullWidth
        />
      }
    >
      <ChoiceField label={t('Back to')} value={target} options={targets.map((x) => ({ value: x.id, label: x.label }))} onChange={setTarget} required error={touched ? errors.target : null} />
      <TextField label={t('What needs changing')} value={reason} onChangeText={setReason} multiline maxLength={4000} required error={touched ? errors.reason : null} />
    </Sheet>
  );
}

type FormStage = 'self' | 'manager' | 'reviewer';

const STAGE_COPY: Record<FormStage, { title: string; submit: string; comments: string; confirmTitle: string; confirm: string; sent: string }> = {
  self: {
    title: 'Self review',
    submit: 'Send to manager',
    comments: 'Anything else your manager should know',
    confirmTitle: 'Send your self review?',
    confirm: 'Your manager reviews it next. You cannot change it after sending.',
    sent: 'Self review sent to your manager',
  },
  manager: {
    title: 'Manager review',
    submit: 'Send',
    comments: 'Overall comments',
    confirmTitle: 'Send your review?',
    confirm: 'It moves to the next step. You cannot change it after sending.',
    sent: 'Review sent',
  },
  reviewer: {
    title: 'Second review',
    submit: 'Send',
    comments: 'Overall comments',
    confirmTitle: 'Send your review?',
    confirm: 'If you rate nothing, the manager’s score stands. You cannot change it after sending.',
    sent: 'Review sent',
  },
};

/** The self, manager or second review form (the route keeps its first name). */
export function SelfReviewScreen() {
  const { id } = useParams<{ id: string }>();
  const detail = useQuery({ queryKey: ['reviews', id], queryFn: () => growthApi.review(id!), enabled: Boolean(id) });
  const [competencies, setCompetencies] = useState<Record<string, CompetencyRatingInput> | null>(null);
  const [values, setValues] = useState<Record<string, ValueRatingInput>>({});
  const [comments, setComments] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const d = detail.data;
    if (!d || competencies) return;
    const initial: Record<string, CompetencyRatingInput> = {};
    for (const c of d.competencies) {
      const saved = d.draft?.ratings.competencies?.find((r) => r.competency_id === c.competency_id);
      initial[c.competency_id] = saved ?? { competency_id: c.competency_id, rating: null, is_applicable: true };
    }
    const vals: Record<string, ValueRatingInput> = {};
    for (const v of d.values) {
      const saved = d.draft?.ratings.values?.find((r) => r.value_code === v.code);
      vals[v.code] = saved ?? { value_code: v.code, rating: null };
    }
    setCompetencies(initial);
    setValues(vals);
    setComments(d.draft?.comments ?? '');
  }, [detail.data, competencies]);

  const d = detail.data;
  const usesValues = Boolean(d?.template && Number(d.template.values_weight) > 0);
  const ratings = useMemo(() => (competencies ? ratingsPayload(competencies, values, usesValues) : null), [competencies, values, usesValues]);
  const preview = useQuery({
    queryKey: ['reviews', id, 'preview', ratings],
    queryFn: () => growthApi.scorePreview(id!, ratings!),
    enabled: Boolean(ratings && d?.template),
    staleTime: 0,
    retry: false,
  });

  const draft = useAction(() => growthApi.saveReviewDraft(id!, ratings!, comments.trim() || null), { success: t('Draft saved'), invalidate: [['reviews']] });
  const role: StageRole = d?.appraisal.current_stage_role ?? 'self';
  const stage: FormStage = role === 'manager' || role === 'reviewer' ? role : 'self';
  const copy = STAGE_COPY[stage];
  const submit = useAction(() => growthApi.submitReview(id!, ratings!, comments.trim() || null), { success: t(copy.sent), invalidate: [['reviews'], ['team', 'reviews']] });

  if (detail.isPending || (d && !competencies)) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={6} />
      </Screen>
    );
  }
  if (!d) {
    return (
      <Screen tier="tier2">
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }
  if (!canRateHere(d)) {
    return (
      <Screen tier="tier2">
        <EmptyState
          spot="trend"
          title={d.viewer.is_subject ? t('Your self review is not open') : t('This review is not waiting on you')}
          message={d.appraisal.current_stage_label ? t('It is with {stage} now.', { stage: d.appraisal.current_stage_label }) : (d.viewer.act_reason ?? undefined)}
        />
      </Screen>
    );
  }
  const levels = d.template?.scale?.levels ?? [];
  const gaps = reviewGaps(stage, d.competencies, competencies!);
  const earlier: StageRole[] = stage === 'manager' ? ['self'] : stage === 'reviewer' ? ['self', 'manager'] : [];
  const levelLabel = (value: string) => {
    if (value === 'n/a') return t('Does not apply');
    const level = levels.find((l) => Number(l.value) === Number(value));
    return level ? `${plainDecimal(level.value)} · ${level.label}` : plainDecimal(value);
  };
  const whoRated = (r: StageRole) => (r === 'self' ? d.appraisal.employee_name : t('Manager'));
  const nextStep = d.stages.find((s) => s.state === 'upcoming')?.label ?? null;
  const setCompetency = (cid: string, patch: Partial<CompetencyRatingInput>) => {
    setCompetencies((current) => ({ ...current!, [cid]: { ...current![cid]!, ...patch } }));
    setDirty(true);
  };

  return (
    <FormScreen
      tier="tier2"
      submitLabel={t(copy.submit)}
      dirty={dirty}
      closing={closing}
      secondary={{ label: t('Save draft'), loading: draft.pending, onPress: () => void draft.run(undefined).then((ok) => ok && setDirty(false)) }}
      onSubmit={() => {
        if (gaps.length) {
          toast.error(t('Rate these first: {list}', { list: gaps.join(', ') }));
          return;
        }
        const missingReason = d.competencies.find((c) => {
          const r = competencies![c.competency_id];
          return r && !r.is_applicable && !r.not_applicable_reason?.trim();
        });
        if (missingReason) {
          toast.error(t('Say why “{name}” does not apply.', { name: missingReason.name }));
          return;
        }
        setConfirming(true);
      }}
      footerNote={
        preview.data?.rating ? (
          <Txt variant="caption" tone="muted">
            {t('On these ratings: {label}{score}', { label: preview.data.rating.label, score: preview.data.score ? ` (${plainDecimal(preview.data.score)})` : '' })}
          </Txt>
        ) : null
      }
    >
      <Stack gap="tight">
        <Txt variant="displaySmall">{stage === 'self' ? t(copy.title) : d.appraisal.employee_name}</Txt>
        <Txt variant="callout" tone="muted">
          {stage === 'self' ? '' : `${t(copy.title)} · `}
          {d.appraisal.cycle_name} · {formatDate(d.appraisal.period_start)} – {formatDate(d.appraisal.period_end)}
        </Txt>
      </Stack>
      {d.goals.contributing.length && Number(d.template?.goal_weight ?? 0) > 0 ? (
        <Card variant="sunken">
          <Stack gap="tight">
            <Txt variant="headline">{t('Goals')}</Txt>
            <Txt variant="caption" tone="muted">
              {d.goals.score
                ? t('Goal score {score}, from measured progress. Goals are not rated here.', { score: plainDecimal(d.goals.score) })
                : t('Goals count towards the score from measured progress, not from a rating here.')}
            </Txt>
            {d.goals.contributing.map((g) => (
              <KeyValue key={g.goal_id} label={g.title} value={t('{n}% done', { n: Math.round(Number(g.progress)) })} />
            ))}
          </Stack>
        </Card>
      ) : null}
      {d.competencies.map((c) => {
        const r = competencies![c.competency_id]!;
        const indicator = c.indicators.find((i) => i.scale_value === r.rating);
        return (
          <Card key={c.competency_id} variant="sunken">
            <Stack gap="tight">
              <View style={styles.titleRow}>
                <Txt variant="headline" style={styles.flex}>
                  {c.name}
                </Txt>
                <Txt variant="caption" tone="muted">
                  {t('Weight {w}', { w: plainDecimal(c.weight) })}
                </Txt>
              </View>
              {c.description ? (
                <Txt variant="caption" tone="muted">
                  {c.description}
                </Txt>
              ) : null}
              {earlier.map((who) => {
                const given = earlierRating(d.entries, who, c.competency_id);
                return given ? (
                  <Txt key={who} variant="caption" tone="subtle">
                    {t('{who} rated: {rating}', { who: whoRated(who), rating: levelLabel(given) })}
                  </Txt>
                ) : null;
              })}
              {r.is_applicable ? (
                <ScaleChips levels={levels} value={r.rating} onChange={(v) => setCompetency(c.competency_id, { rating: v })} />
              ) : (
                <TextField
                  label={t('Why it does not apply')}
                  value={r.not_applicable_reason ?? ''}
                  onChangeText={(v) => setCompetency(c.competency_id, { not_applicable_reason: v })}
                  maxLength={500}
                />
              )}
              {!c.is_mandatory ? (
                <View style={styles.chips}>
                  <Chip
                    label={t('Does not apply')}
                    selected={!r.is_applicable}
                    onPress={() => setCompetency(c.competency_id, r.is_applicable ? { is_applicable: false, rating: null } : { is_applicable: true, not_applicable_reason: null })}
                  />
                </View>
              ) : null}
              {indicator ? (
                <Txt variant="caption" tone="muted">
                  {indicator.behaviour}
                </Txt>
              ) : null}
              {c.evidence?.has_evidence ? (
                <Txt variant="caption" tone="subtle">
                  {tn(c.evidence.recognition_count, '{count} recognition this period', '{count} recognitions from {people} people this period', { people: c.evidence.distinct_recognisers })}
                </Txt>
              ) : null}
              <TextField label={stage === 'self' ? t('Example (optional)') : t('Comment (optional)')} value={r.comment ?? ''} onChangeText={(v) => setCompetency(c.competency_id, { comment: v })} multiline maxLength={2000} />
            </Stack>
          </Card>
        );
      })}
      {usesValues
        ? d.values.map((v) => (
            <Card key={v.code} variant="sunken">
              <Stack gap="tight">
                <Txt variant="headline">{v.name}</Txt>
                <Txt variant="caption" tone="muted">
                  {v.description}
                </Txt>
                <ScaleChips
                  levels={levels}
                  value={values[v.code]?.rating ?? null}
                  onChange={(rating) => {
                    setValues((current) => ({ ...current, [v.code]: { value_code: v.code, rating } }));
                    setDirty(true);
                  }}
                />
              </Stack>
            </Card>
          ))
        : null}
      <TextField
        label={t(copy.comments)}
        value={comments}
        onChangeText={(v) => {
          setComments(v);
          setDirty(true);
        }}
        multiline
        maxLength={8000}
      />
      {preview.data?.problems.length ? <Notice tone="warning" message={preview.data.problems.join(' ')} /> : null}
      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t(copy.confirmTitle)}
        message={
          stage === 'manager' && nextStep
            ? t('It goes to {next} next. You cannot change it after sending.', { next: nextStep })
            : t(copy.confirm)
        }
        confirmLabel={t('Send')}
        onConfirm={async () => {
          setConfirming(false);
          const sent = await submit.run(undefined);
          if (sent) setClosing(true);
        }}
      />
    </FormScreen>
  );
}

// ── Learning ────────────────────────────────────────────────────────────────

export function LearningScreen() {
  const go = useGo();
  const learning = useQuery({ queryKey: ['learning'], queryFn: growthApi.learning });
  return (
    <Screen tier="tier2" onRefresh={() => learning.refetch()}>
      <QueryView
        query={learning}
        skeleton={<SkeletonList rows={3} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState spot="cap" title={t('No courses assigned')} message={t('Courses HR asks you to take — safety, POSH, policies — show here.')} />}
      >
        {(data) => (
          <ListGroup>
            {data.map((a) => (
              <ListRow
                key={a.id}
                icon={BookOpen}
                title={a.course}
                subtitle={a.completed_at ? t('Completed {date}', { date: formatDate(a.completed_at) }) : t('Due {date}', { date: formatDate(a.due_on) })}
                meta={a.expired ? t('Expired — take it again') : a.expires_on ? t('Valid until {date}', { date: formatDate(a.expires_on) }) : undefined}
                trailing={a.overdue ? <Badge label={t('Overdue')} tone="danger" /> : <StatusBadge status={a.status} />}
                onPress={() => go('CourseDetail', { id: a.id })}
              />
            ))}
          </ListGroup>
        )}
      </QueryView>
    </Screen>
  );
}

export function CourseDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { colors } = useTheme();
  const course = useQuery({ queryKey: ['learning', id], queryFn: () => growthApi.course(id!), enabled: Boolean(id) });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ passed: boolean; score: number | null; pass_mark: number } | null>(null);
  const [opening, setOpening] = useState(false);
  const complete = useAction(
    (picked: number[]) => growthApi.completeCourse(id!, picked),
    {
      // Said where the person is (at the quiz), as well as at the top.
      success: (r) => (r.passed ? t('Passed — course completed') : t('Not passed: {score}% of {mark}% needed', { score: r.score ?? 0, mark: r.pass_mark })),
      invalidate: [['learning']],
      onSuccess: (r) => setResult({ passed: r.passed, score: r.score, pass_mark: r.pass_mark }),
    },
  );

  if (course.isPending) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={6} />
      </Screen>
    );
  }
  if (!course.data) {
    return (
      <Screen tier="tier2">
        <ErrorState error={course.error} onRetry={() => void course.refetch()} />
      </Screen>
    );
  }
  const c = course.data;
  const quiz = c.content.quiz;
  const completed = c.status === 'completed' && !c.expired;
  const unanswered = quiz.filter((_, i) => answers[i] === undefined).length;

  return (
    <Screen
      tier="tier2"
      onRefresh={() => course.refetch()}
      footer={
        !completed ? (
          <Button
            label={quiz.length ? t('Submit answers') : t('Mark as completed')}
            variant="accent"
            loading={complete.pending}
            disabled={quiz.length > 0 && unanswered > 0}
            onPress={() => void complete.run(quiz.map((_, i) => answers[i]!))}
            fullWidth
          />
        ) : undefined
      }
    >
      <Card>
        <Stack gap="tight">
          <Txt variant="title">{c.content.title}</Txt>
          {c.content.description ? (
            <Txt variant="callout" tone="muted">
              {c.content.description}
            </Txt>
          ) : null}
          <KeyValue label={t('Due')} value={formatDate(c.due_on)} />
          {quiz.length ? <KeyValue label={t('Pass mark')} value={`${c.content.pass_mark}%`} /> : null}
          {completed ? <Badge label={t('Completed {date}', { date: formatDate(c.completed_at) })} tone="success" /> : null}
        </Stack>
      </Card>

      {result ? (
        <Notice
          tone={result.passed ? 'success' : 'warning'}
          message={
            result.passed
              ? t('Passed with {score}%. Well done.', { score: result.score ?? 100 })
              : t('You scored {score}%; the pass mark is {mark}%. Read the modules again and retry.', { score: result.score ?? 0, mark: result.pass_mark })
          }
        />
      ) : null}

      <Section title={t('Modules')}>
        <Stack gap="row">
          {c.content.modules.map((m, i) => (
            <Card key={i} variant="sunken">
              <Stack gap="tight">
                <Txt variant="headline">
                  {i + 1}. {m.title}
                </Txt>
                {m.body ? <Txt variant="body">{m.body}</Txt> : null}
                {m.url ? <Button label={t('Open the material')} size="sm" variant="secondary" onPress={() => void openLink(m.url!)} /> : null}
              </Stack>
            </Card>
          ))}
        </Stack>
      </Section>

      {quiz.length && !completed ? (
        <Section title={t('Quiz')} description={unanswered ? t('{count} left to answer', { count: unanswered }) : undefined}>
          <Stack gap="row">
            {quiz.map((q, qi) => (
              <Card key={qi}>
                <Stack gap="inline">
                  <Txt variant="bodyStrong">
                    {qi + 1}. {q.question}
                  </Txt>
                  {q.options.map((option, oi) => {
                    const picked = answers[qi] === oi;
                    return (
                      <Pressable
                        key={oi}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: picked }}
                        onPress={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        style={[styles.option, { borderColor: picked ? colors.primary : colors.border, backgroundColor: picked ? colors.primarySoft : colors.surface }]}
                      >
                        <Txt variant="body">{option}</Txt>
                      </Pressable>
                    );
                  })}
                </Stack>
              </Card>
            ))}
          </Stack>
        </Section>
      ) : null}

      {completed && c.certificate_number ? (
        <Button
          label={t('Open certificate')}
          variant="secondary"
          loading={opening}
          onPress={async () => {
            setOpening(true);
            await openDownloaded(growthApi.certificatePath(c.id), `certificate-${c.certificate_number}.pdf`, 'application/pdf');
            setOpening(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

async function openLink(url: string) {
  await openInBrowser(url);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  check: {
    width: layout.iconLg,
    height: layout.iconLg,
    borderRadius: radius.sm,
    borderWidth: layout.hairline * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcome: { padding: layout.card, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.xxs, marginTop: spacing.sm },
  option: { padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
});

