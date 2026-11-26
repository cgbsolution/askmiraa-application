/**
 * Culture: shoutouts (give one, react), clubs (join, post), polls (vote,
 * results once voted), events (RSVP), surveys (answer anonymously) and
 * award results.
 *
 * Tier 2. Counts and results are the server's: a poll shows results only when
 * the server sends them, a survey never shows anyone's answer.
 */

import { useNavigation } from '@react-navigation/native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { BarChart3, Heart, Sparkles, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { REACTIONS, cultureApi, type CompanyEvent, type Poll, type SurveyInstrument } from '../../api/culture';
import { Avatar } from '../../components/Avatar';
import { Badge, Chip, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ChoiceField, SwitchRow, TextField } from '../../components/Field';
import { FormScreen } from '../../components/FormScreen';
import { ListGroup, ListRow } from '../../components/List';
import { PersonPicker, type PickedPerson } from '../../components/PersonPicker';
import { Row, Screen, Section, Stack } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { useResetOnOpen } from '../../components/sheetContext';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState, Notice, ProgressBar, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { formatDate, formatDateShort, formatDateTime, timeAgo } from '../../core/dates';
import { formatCount } from '../../core/money';
import type { ShoutoutRead } from '../../core/types';
import { t, tn } from '../../lib/i18n';
import { useAction } from '../../lib/useAction';
import { useGo, useParams } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';

// ── Hub ─────────────────────────────────────────────────────────────────────

export function CultureScreen() {
  const go = useGo();
  const polls = useQuery({ queryKey: ['culture', 'polls'], queryFn: cultureApi.polls });
  const events = useQuery({ queryKey: ['culture', 'events'], queryFn: cultureApi.events });
  const surveys = useQuery({ queryKey: ['culture', 'surveys'], queryFn: cultureApi.mySurveys });
  const openPolls = (polls.data ?? []).filter((p) => p.is_open && p.your_vote === null).length;
  const upcoming = (events.data ?? []).filter((e) => !e.cancelled).length;
  const toAnswer = (surveys.data ?? []).filter((s) => s.is_open_now && !s.has_responded).length;
  return (
    <Screen tier="tier2" onRefresh={() => Promise.all([polls.refetch(), events.refetch(), surveys.refetch()])}>
      <Button label={t('Give a shoutout')} icon={Heart} variant="accent" onPress={() => go('GiveShoutout')} fullWidth />
      <ListGroup>
        <ListRow spot="medal" title={t('Shoutouts')} subtitle={t('Who thanked whom, and for what')} onPress={() => go('Shoutouts')} />
        <ListRow
          spot="checklist"
          title={t('Surveys')}
          subtitle={toAnswer ? t('{count} waiting for your answer', { count: toAnswer }) : t('Anonymous pulse surveys')}
          trailing={toAnswer ? <Badge label={String(toAnswer)} tone="warning" /> : undefined}
          onPress={() => go('Surveys')}
        />
        <ListRow
          spot="poll"
          title={t('Polls')}
          subtitle={openPolls ? t('{count} open', { count: openPolls }) : t('Quick votes')}
          trailing={openPolls ? <Badge label={String(openPolls)} tone="info" /> : undefined}
          onPress={() => go('Polls')}
        />
        <ListRow spot="calendar" title={t('Events')} subtitle={upcoming ? t('{count} coming up', { count: upcoming }) : t('Nothing scheduled')} onPress={() => go('Events')} />
        <ListRow spot="team" title={t('Clubs')} subtitle={t('Book club, cricket, running…')} onPress={() => go('Clubs')} />
        <ListRow spot="certificate" title={t('Awards')} subtitle={t('Recent winners')} onPress={() => go('Awards')} />
      </ListGroup>
    </Screen>
  );
}

// ── Shoutouts ───────────────────────────────────────────────────────────────

function ShoutoutCard({ shoutout }: { shoutout: ShoutoutRead }) {
  const { colors } = useTheme();
  const [reactions, setReactions] = useState(shoutout.reactions);
  const react = useAction((args: { emoji: string; active: boolean }) => cultureApi.react(shoutout.id, args.emoji, args.active), {
    onSuccess: setReactions,
  });
  const shown = REACTIONS.map((emoji) => reactions.find((r) => r.emoji === emoji) ?? { emoji, count: 0, reacted: false });
  return (
    <Card>
      <Stack gap="row">
        <View style={styles.titleRow}>
          <Avatar name={shoutout.recipient.name} url={shoutout.recipient.photo_url} />
          <View style={styles.flex}>
            <Txt variant="bodyStrong">
              {shoutout.kind === 'award'
                ? t('{name} won an award', { name: shoutout.recipient.name })
                : shoutout.kind === 'milestone'
                  ? t('{name}: {years} years with us', { name: shoutout.recipient.name, years: shoutout.milestone_years ?? '' })
                  : t('{from} → {to}', { from: shoutout.sender?.name ?? t('Someone'), to: shoutout.recipient.name })}
            </Txt>
            <Txt variant="caption" tone="muted">
              {timeAgo(shoutout.created_at)}
              {shoutout.value_name ? ` · ${shoutout.value_name}` : ''}
            </Txt>
          </View>
          {shoutout.is_pinned ? <Badge label={t('Pinned')} tone="info" /> : null}
        </View>
        <Txt variant="body">{shoutout.message}</Txt>
        <View style={styles.reactions}>
          {shown.map((r) => (
            <Pressable
              key={r.emoji}
              accessibilityRole="button"
              accessibilityState={{ selected: r.reacted }}
              accessibilityLabel={t('{emoji}, {count}', { emoji: r.emoji, count: r.count })}
              onPress={() => void react.run({ emoji: r.emoji, active: !r.reacted })}
              style={[styles.reaction, { borderColor: r.reacted ? colors.primary : colors.border, backgroundColor: r.reacted ? colors.primarySoft : colors.surface }]}
            >
              <Txt variant="callout">{r.emoji}</Txt>
              {r.count ? (
                <Txt variant="label" tone={r.reacted ? 'primary' : 'muted'} numeric>
                  {r.count}
                </Txt>
              ) : null}
            </Pressable>
          ))}
        </View>
      </Stack>
    </Card>
  );
}

export function ShoutoutsScreen() {
  const go = useGo();
  const feed = useInfiniteQuery({
    queryKey: ['culture', 'shoutouts'],
    queryFn: ({ pageParam }) => cultureApi.shoutouts(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length * 20 < last.total ? pages.length + 1 : undefined),
  });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Screen tier="tier2" onRefresh={() => feed.refetch()}>
      <Button label={t('Give a shoutout')} icon={Heart} variant="accent" onPress={() => go('GiveShoutout')} fullWidth />
      {feed.isPending ? (
        <SkeletonList rows={3} />
      ) : feed.error && !items.length ? (
        <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
      ) : items.length ? (
        <Stack gap="row">
          {items.map((s) => (
            <ShoutoutCard key={s.id} shoutout={s} />
          ))}
          {feed.hasNextPage ? (
            <Button label={t('Show more')} variant="ghost" loading={feed.isFetchingNextPage} onPress={() => void feed.fetchNextPage()} />
          ) : null}
        </Stack>
      ) : (
        <EmptyState spot="medal" title={t('No shoutouts yet')} message={t('Be the first to thank someone.')} />
      )}
    </Screen>
  );
}

export function GiveShoutoutScreen() {
  const navigation = useNavigation();
  const values = useQuery({ queryKey: ['culture', 'values'], queryFn: cultureApi.values, staleTime: 30 * 60_000 });
  const [person, setPerson] = useState<PickedPerson | null>(null);
  const [value, setValue] = useState<string>('');
  const [message, setMessage] = useState('');
  const [everyone, setEveryone] = useState(true);
  const [touched, setTouched] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const errors = {
    person: !person ? t('Choose who to thank.') : null,
    message: message.trim().length < 3 ? t('Say what they did — a sentence is enough.') : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const send = useAction(
    () => cultureApi.giveShoutout({ to_employee_id: person!.id, message: message.trim(), value_tag: value || null, visibility: everyone ? 'company' : 'private' }),
    { success: (s) => t('Shoutout sent to {name}', { name: s.recipient.name }), invalidate: [['culture']] },
  );
  const active = (values.data ?? []).filter((v) => v.is_active);

  return (
    <FormScreen
      tier="tier2"
      submitLabel={t('Send shoutout')}
      dirty={Boolean(person || message.trim())}
      submitDisabled={touched && invalid}
      onSubmit={async () => {
        setTouched(true);
        if (invalid) return;
        if (await send.run(undefined)) navigation.goBack();
      }}
    >
      <PersonPicker label={t('Who are you thanking?')} required value={person} onChange={setPerson} error={touched ? errors.person : null} />
      {active.length ? (
        <ChoiceField label={t('Which value did they show?')} value={value} options={active.map((v) => ({ value: v.code, label: v.name }))} onChange={(v) => setValue(v === value ? '' : v)} />
      ) : null}
      <TextField
        label={t('What did they do?')}
        required
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
        error={touched ? errors.message : null}
        placeholder={t('Be specific: what happened, and why it mattered')}
      />
      {person ? <Button label={t('Help me write it')} icon={Sparkles} size="sm" variant="ghost" onPress={() => setDrafting(true)} /> : null}
      <SwitchRow label={t('Show it to everyone')} description={everyone ? t('On the company feed.') : t('Only {name} sees it.', { name: person?.name ?? t('they') })} value={everyone} onChange={setEveryone} />
      <DraftSheet open={drafting} onClose={() => setDrafting(false)} person={person} valueCode={value || null} onUse={setMessage} />
    </FormScreen>
  );
}

/** Miraa drafts from the sender's notes; the sender edits and sends. */
function DraftSheet({
  open,
  onClose,
  person,
  valueCode,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  person: PickedPerson | null;
  valueCode: string | null;
  onUse: (text: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  useResetOnOpen(open, () => {
    setNotes('');
    setDraft(null);
    setEmpty(false);
  });
  const ask = useAction(() => cultureApi.draftShoutout({ to_employee_id: person!.id, notes: notes.trim(), value_code: valueCode }), {
    onSuccess: (r) => {
      const text = typeof r.draft === 'string' ? r.draft.trim() : '';
      // An empty suggestion is said, not shown as nothing happening.
      setEmpty(!text);
      setDraft(text || null);
    },
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Help me write it')}
      description={t('A few words about what {name} did. Miraa suggests a message; nothing is sent until you send it.', { name: person?.name ?? '' })}
      dirty={Boolean(notes.trim())}
      footer={
        draft ? (
          <Row>
            <View style={styles.flex}>
              <Button label={t('Try again')} variant="secondary" loading={ask.pending} onPress={() => void ask.run(undefined)} fullWidth />
            </View>
            <View style={styles.flex}>
              <Button
                label={t('Use this')}
                variant="accent"
                onPress={() => {
                  onUse(draft);
                  onClose();
                }}
                fullWidth
              />
            </View>
          </Row>
        ) : (
          <Button label={t('Suggest a message')} variant="accent" loading={ask.pending} disabled={notes.trim().length < 3} onPress={() => void ask.run(undefined)} fullWidth />
        )
      }
    >
      <TextField label={t('Your notes')} value={notes} onChangeText={setNotes} multiline maxLength={2000} placeholder={t('stayed late to fix the release, calm under pressure')} />
      {draft ? (
        <Card variant="soft">
          <Txt variant="body">{draft}</Txt>
        </Card>
      ) : empty ? (
        <Notice tone="info" message={t('Miraa could not suggest anything from these notes. Add a little more, or write it in your own words.')} />
      ) : null}
    </Sheet>
  );
}

// ── Clubs ───────────────────────────────────────────────────────────────────

export function ClubsScreen() {
  const go = useGo();
  const clubs = useQuery({ queryKey: ['culture', 'clubs'], queryFn: cultureApi.clubs });
  return (
    <Screen tier="tier2" onRefresh={() => clubs.refetch()}>
      <QueryView query={clubs} skeleton={<SkeletonList rows={3} />} isEmpty={(d) => d.length === 0} empty={<EmptyState spot="team" title={t('No clubs yet')} />}>
        {(data) => (
          <ListGroup>
            {data.map((c) => (
              <ListRow
                key={c.id}
                icon={Users}
                title={c.name}
                subtitle={c.description ?? undefined}
                meta={tn(c.member_count, '{count} member', '{count} members')}
                trailing={c.is_member ? <Badge label={t('Member')} tone="success" /> : undefined}
                onPress={() => go('ClubDetail', { id: c.id })}
              />
            ))}
          </ListGroup>
        )}
      </QueryView>
    </Screen>
  );
}

export function ClubDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const clubs = useQuery({ queryKey: ['culture', 'clubs'], queryFn: cultureApi.clubs });
  const club = clubs.data?.find((c) => c.id === id);
  const posts = useQuery({ queryKey: ['culture', 'clubs', id, 'posts'], queryFn: () => cultureApi.clubPosts(id!), enabled: Boolean(id && club?.is_member) });
  const [posting, setPosting] = useState(false);
  const join = useAction(() => cultureApi.joinClub(id!), { success: t('You joined'), invalidate: [['culture', 'clubs']] });
  const leave = useAction(() => cultureApi.leaveClub(id!), { success: t('You left the club'), invalidate: [['culture', 'clubs']] });

  if (clubs.isPending) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={4} />
      </Screen>
    );
  }
  if (!club) {
    return (
      <Screen tier="tier2">
        {clubs.error ? <ErrorState error={clubs.error} onRetry={() => void clubs.refetch()} /> : <EmptyState spot="team" title={t('Club not found')} />}
      </Screen>
    );
  }
  return (
    <Screen
      tier="tier2"
      onRefresh={() => Promise.all([clubs.refetch(), posts.refetch()])}
      footer={
        club.is_member ? (
          <Button label={t('Post in the club')} variant="accent" onPress={() => setPosting(true)} fullWidth />
        ) : (
          <Button label={t('Join')} variant="accent" loading={join.pending} onPress={() => void join.run(undefined)} fullWidth />
        )
      }
    >
      <Card>
        <Stack gap="tight">
          <Txt variant="title">{club.name}</Txt>
          {club.description ? <Txt variant="body" tone="muted">{club.description}</Txt> : null}
          <Txt variant="caption" tone="muted">
            {tn(club.member_count, '{count} member', '{count} members')}
            {club.is_private ? ` · ${t('Private')}` : ''}
          </Txt>
          {club.is_member ? <Button label={t('Leave club')} size="sm" variant="ghost" loading={leave.pending} onPress={() => void leave.run(undefined)} /> : null}
        </Stack>
      </Card>
      {club.is_member ? (
        <Section title={t('Posts')}>
          <QueryView
            query={posts}
            skeleton={<SkeletonList rows={2} />}
            isEmpty={(d) => d.length === 0}
            empty={<Txt variant="callout" tone="muted">{t('No posts yet. Say hello.')}</Txt>}
          >
            {(data) => (
              <Stack gap="row">
                {data.map((p) => (
                  <Card key={p.id} variant="sunken">
                    <Stack gap="tight">
                      <Txt variant="label" tone="muted">
                        {p.mine ? t('You') : p.author_name} · {timeAgo(p.created_at)}
                      </Txt>
                      <Txt variant="body">{p.body}</Txt>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}
          </QueryView>
        </Section>
      ) : (
        <Txt variant="callout" tone="muted">
          {t('Join to see and write posts.')}
        </Txt>
      )}
      <PostSheet open={posting} onClose={() => setPosting(false)} clubId={club.id} />
    </Screen>
  );
}

function PostSheet({ open, onClose, clubId }: { open: boolean; onClose: () => void; clubId: string }) {
  const [body, setBody] = useState('');
  useResetOnOpen(open, () => setBody(''));
  const post = useAction(() => cultureApi.postInClub(clubId, body.trim()), { success: t('Posted'), invalidate: [['culture', 'clubs']], onSuccess: onClose });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Post in the club')}
      dirty={Boolean(body.trim())}
      footer={<Button label={t('Post')} variant="accent" loading={post.pending} disabled={!body.trim()} onPress={() => void post.run(undefined)} fullWidth />}
    >
      <TextField label={t('Message')} value={body} onChangeText={setBody} multiline maxLength={4000} />
    </Sheet>
  );
}

// ── Polls ───────────────────────────────────────────────────────────────────

function PollCard({ poll }: { poll: Poll }) {
  const { colors } = useTheme();
  const vote = useAction((index: number) => cultureApi.vote(poll.id, index), { success: t('Vote recorded'), invalidate: [['culture', 'polls']] });
  const total = poll.results ? poll.results.reduce((a, b) => a + b, 0) : 0;
  return (
    <Card>
      <Stack gap="inline">
        <View style={styles.titleRow}>
          <Txt variant="headline" style={styles.flex}>
            {poll.question}
          </Txt>
          {!poll.is_open ? <Badge label={t('Closed')} tone="neutral" /> : null}
        </View>
        {poll.options.map((option, i) => {
          const picked = poll.your_vote === i;
          const count = poll.results?.[i] ?? null;
          return (
            <Pressable
              key={i}
              accessibilityRole="radio"
              accessibilityState={{ selected: picked, disabled: !poll.is_open }}
              disabled={!poll.is_open || vote.pending}
              onPress={() => void vote.run(i)}
              style={[styles.option, { borderColor: picked ? colors.primary : colors.border, backgroundColor: picked ? colors.primarySoft : colors.surface }]}
            >
              <View style={styles.titleRow}>
                <Txt variant={picked ? 'bodyStrong' : 'body'} style={styles.flex}>
                  {option}
                </Txt>
                {count !== null ? (
                  <Txt variant="calloutStrong" tone="muted" numeric>
                    {total ? `${Math.round((count / total) * 100)}%` : '0%'}
                  </Txt>
                ) : null}
              </View>
              {count !== null ? <ProgressBar value={total ? count / total : 0} /> : null}
            </Pressable>
          );
        })}
        <Txt variant="caption" tone="muted">
          {[tn(poll.responses, '{count} vote', '{count} votes', { count: formatCount(poll.responses) }), poll.is_anonymous ? t('Anonymous') : null, poll.closes_at ? t('closes {date}', { date: formatDateTime(poll.closes_at) }) : null]
            .filter(Boolean)
            .join(' · ')}
        </Txt>
        {poll.results_note && !poll.results ? (
          <Txt variant="caption" tone="subtle">
            {poll.results_note}
          </Txt>
        ) : null}
        {poll.is_open && poll.your_vote !== null ? (
          <Txt variant="caption" tone="subtle">
            {t('Tap another option to change your vote.')}
          </Txt>
        ) : null}
      </Stack>
    </Card>
  );
}

export function PollsScreen() {
  const polls = useQuery({ queryKey: ['culture', 'polls'], queryFn: cultureApi.polls });
  return (
    <Screen tier="tier2" onRefresh={() => polls.refetch()}>
      <QueryView query={polls} skeleton={<SkeletonCard lines={4} />} isEmpty={(d) => d.length === 0} empty={<EmptyState spot="poll" title={t('No polls right now')} />}>
        {(data) => (
          <Stack gap="row">
            {data.map((p) => (
              <PollCard key={p.id} poll={p} />
            ))}
          </Stack>
        )}
      </QueryView>
    </Screen>
  );
}

// ── Events ──────────────────────────────────────────────────────────────────

function EventCard({ event }: { event: CompanyEvent }) {
  const rsvp = useAction((response: 'going' | 'maybe' | 'not_going') => cultureApi.rsvp(event.id, response), {
    success: (_, response) => (response === 'going' ? t('See you there') : response === 'maybe' ? t('Marked as maybe') : t('Marked as not going')),
    invalidate: [['culture', 'events']],
  });
  const closed = Boolean(event.rsvp_by && event.rsvp_by < new Date().toISOString());
  return (
    <Card>
      <Stack gap="tight">
        <View style={styles.titleRow}>
          <Txt variant="headline" style={styles.flex}>
            {event.title}
          </Txt>
          {event.cancelled ? <Badge label={t('Cancelled')} tone="danger" /> : event.is_full ? <Badge label={t('Full')} tone="warning" /> : null}
        </View>
        <Txt variant="callout">{formatDateTime(event.starts_at)}{event.venue ? ` · ${event.venue}` : ''}</Txt>
        {event.description ? <Txt variant="callout" tone="muted">{event.description}</Txt> : null}
        <Txt variant="caption" tone="muted">
          {[
            t('{count} going', { count: event.going }),
            event.maybe ? t('{count} maybe', { count: event.maybe }) : null,
            event.capacity ? tn(event.capacity, '{count} place', '{count} places') : null,
            event.rsvp_by ? t('reply by {date}', { date: formatDateShort(event.rsvp_by) }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Txt>
        {!event.cancelled && !closed ? (
          <ChoiceField
            label={t('Are you coming?')}
            value={event.your_response ?? ''}
            options={[
              { value: 'going', label: t('Going') },
              { value: 'maybe', label: t('Maybe') },
              { value: 'not_going', label: t('Not going') },
            ]}
            onChange={(v) => void rsvp.run(v as 'going' | 'maybe' | 'not_going')}
          />
        ) : event.your_response ? (
          <Txt variant="caption" tone="muted">
            {t('Your reply: {reply}', { reply: t(event.your_response === 'going' ? 'Going' : event.your_response === 'maybe' ? 'Maybe' : 'Not going') })}
          </Txt>
        ) : null}
      </Stack>
    </Card>
  );
}

export function EventsScreen() {
  const events = useQuery({ queryKey: ['culture', 'events'], queryFn: cultureApi.events });
  return (
    <Screen tier="tier2" onRefresh={() => events.refetch()}>
      <QueryView query={events} skeleton={<SkeletonCard lines={4} />} isEmpty={(d) => d.length === 0} empty={<EmptyState spot="calendar" title={t('No events coming up')} />}>
        {(data) => (
          <Stack gap="row">
            {data.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </Stack>
        )}
      </QueryView>
    </Screen>
  );
}

// ── Surveys ─────────────────────────────────────────────────────────────────

export function SurveysScreen() {
  const go = useGo();
  const surveys = useQuery({ queryKey: ['culture', 'surveys'], queryFn: cultureApi.mySurveys });
  return (
    <Screen tier="tier2" onRefresh={() => surveys.refetch()}>
      <Notice tone="info" message={t('Surveys are anonymous. Results are shown only in groups large enough that no answer can be traced to a person.')} />
      <QueryView query={surveys} skeleton={<SkeletonList rows={2} />} isEmpty={(d) => d.length === 0} empty={<EmptyState spot="checklist" title={t('No surveys for you right now')} />}>
        {(data) => (
          <ListGroup>
            {data.map((s) => (
              <ListRow
                key={s.id}
                icon={BarChart3}
                title={s.name}
                subtitle={s.is_open_now ? t('Open until {date}', { date: formatDate(s.closes_on) }) : t('Closed {date}', { date: formatDate(s.closes_on) })}
                trailing={
                  s.has_responded ? <Badge label={t('Answered')} tone="success" /> : s.is_open_now ? <Badge label={t('To answer')} tone="warning" /> : <StatusBadge status={s.status} />
                }
                onPress={s.is_open_now && !s.has_responded ? () => go('SurveyDetail', { id: s.id }) : undefined}
              />
            ))}
          </ListGroup>
        )}
      </QueryView>
    </Screen>
  );
}

export function SurveyDetailScreen() {
  const navigation = useNavigation();
  const { id } = useParams<{ id: string }>();
  const surveys = useQuery({ queryKey: ['culture', 'surveys'], queryFn: cultureApi.mySurveys });
  const survey = surveys.data?.find((s) => s.id === id);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [aiOk, setAiOk] = useState(false);
  const [touched, setTouched] = useState(false);
  const send = useAction(
    () => cultureApi.answerSurvey(id!, { answers, free_text: comment.trim() || null, comment_ai_ok: aiOk }),
    { success: t('Thank you — your answer is in, without your name'), invalidate: [['culture', 'surveys']] },
  );

  if (surveys.isPending) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={5} />
      </Screen>
    );
  }
  if (!survey || !survey.instrument) {
    return (
      <Screen tier="tier2">
        {surveys.error ? <ErrorState error={surveys.error} onRetry={() => void surveys.refetch()} /> : <EmptyState spot="checklist" title={t('Survey not found')} />}
      </Screen>
    );
  }
  if (survey.has_responded || !survey.is_open_now) {
    return (
      <Screen tier="tier2">
        <EmptyState spot="checklist" title={survey.has_responded ? t('You have answered this survey') : t('This survey is closed')} />
      </Screen>
    );
  }
  const instrument = survey.instrument as unknown as SurveyInstrument;
  const [low, high] = instrument.bounds;
  const scale = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const missing = instrument.items.filter((item) => answers[item.key] === undefined).length;

  return (
    <FormScreen
      tier="tier2"
      submitLabel={t('Send answers')}
      dirty={Object.keys(answers).length > 0 || Boolean(comment.trim())}
      submitDisabled={touched && missing > 0}
      footerNote={
        touched && missing ? (
          <Txt variant="caption" tone="danger">
            {tn(missing, '{count} question left to answer.', '{count} questions left to answer.')}
          </Txt>
        ) : null
      }
      onSubmit={async () => {
        setTouched(true);
        if (missing) return;
        if (await send.run(undefined)) navigation.goBack();
      }}
    >
      <Stack gap="tight">
        <Txt variant="displaySmall">{survey.name}</Txt>
        <Txt variant="callout" tone="muted">
          {t('Anonymous. Results appear only once at least {n} people have answered.', { n: survey.min_responses_to_report })}
        </Txt>
      </Stack>
      {instrument.items.map((item, qi) => (
        <Card key={item.key} variant="sunken">
          <Stack gap="inline">
            <Txt variant="bodyStrong">
              {qi + 1}. {item.text}
            </Txt>
            <View style={styles.scale}>
              {scale.map((n) => (
                <Chip key={n} label={String(n)} selected={answers[item.key] === n} onPress={() => setAnswers((a) => ({ ...a, [item.key]: n }))} />
              ))}
            </View>
            <View style={styles.scaleEnds}>
              <Txt variant="caption" tone="subtle">
                {instrument.scale === 'zero_to_ten' ? t('Not at all likely') : t('Strongly disagree')}
              </Txt>
              <Txt variant="caption" tone="subtle">
                {instrument.scale === 'zero_to_ten' ? t('Extremely likely') : t('Strongly agree')}
              </Txt>
            </View>
          </Stack>
        </Card>
      ))}
      <TextField label={t('Anything you want to add?')} value={comment} onChangeText={setComment} multiline maxLength={2000} placeholder={t('Optional, and anonymous')} />
      {comment.trim() ? (
        <SwitchRow
          label={t('Let AI group my comment with others')}
          description={t('It is read for themes only, never shown with your name.')}
          value={aiOk}
          onChange={setAiOk}
        />
      ) : null}
    </FormScreen>
  );
}

// ── Awards ──────────────────────────────────────────────────────────────────

export function AwardsScreen() {
  const awards = useQuery({ queryKey: ['culture', 'awards'], queryFn: cultureApi.awards });
  return (
    <Screen tier="tier2" onRefresh={() => awards.refetch()}>
      <QueryView query={awards} skeleton={<SkeletonList rows={3} />} isEmpty={(d) => d.length === 0} empty={<EmptyState spot="certificate" title={t('No awards announced yet')} />}>
        {(data) => (
          <Stack gap="row">
            {data.map((a) => (
              <Card key={a.id}>
                <Stack gap="tight">
                  <View style={styles.titleRow}>
                    <Avatar name={a.employee.name} url={a.employee.photo_url} />
                    <View style={styles.flex}>
                      <Txt variant="bodyStrong">{a.employee.name}</Txt>
                      <Txt variant="caption" tone="muted">
                        {a.category_name} · {a.programme_name}
                      </Txt>
                    </View>
                  </View>
                  {a.citation ? <Txt variant="body">“{a.citation}”</Txt> : null}
                  <Txt variant="caption" tone="subtle">
                    {formatDate(a.awarded_on)}
                  </Txt>
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: layout.controlSmall,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  option: { padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, gap: spacing.xs },
  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  scaleEnds: { flexDirection: 'row', justifyContent: 'space-between' },
});
