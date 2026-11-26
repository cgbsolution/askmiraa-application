/**
 * Reward points, referrals, interviews I sit on, my onboarding and
 * resignation.
 *
 * Resignation is Tier 1 and deliberate: it says what happens next, asks for
 * a confirmation, and can be withdrawn only while nobody has accepted it.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Mic } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { careerApi, type MyInterview, type Recommendation } from '../../api/career';
import { onboardingApi } from '../../api/onboarding';
import { Badge, Chip, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ChoiceField, DateField, SelectField, TextField } from '../../components/Field';
import { FormScreen } from '../../components/FormScreen';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { Screen, Section, Stack } from '../../components/Screen';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { useResetOnOpen } from '../../components/sheetContext';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState, Notice, ProgressBar, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { addDays, formatDate, formatDateShort, formatDateTime, formatTime, todayISO } from '../../core/dates';
import { formatCount, formatINR } from '../../core/money';
import { statusLabel } from '../../core/status';
import { checks } from '../../core/validators';
import { t, tn } from '../../lib/i18n';
import { openInBrowser } from '../../lib/links';
import { useSession, useUser } from '../../lib/session';
import { useAction } from '../../lib/useAction';
import { useGo, useParams } from '../../navigation/navigate';
import { ProductLauncher } from '../../components/ProductLauncher';
import { spacing } from '../../theme/tokens';

// ── Reward points ───────────────────────────────────────────────────────────

const ENTRY_LABEL: Record<string, string> = {
  awarded: 'Awarded',
  redeemed: 'Redeemed',
  expired: 'Expired',
  reversed: 'Reversed',
};

export function RewardsScreen() {
  const statement = useQuery({ queryKey: ['rewards', 'statement'], queryFn: careerApi.rewards });
  return (
    <Screen tier="tier2" onRefresh={() => statement.refetch()}>
      <QueryView query={statement} skeleton={<SkeletonCard lines={4} />}>
        {(s) => (
          <>
            <Card variant="soft">
              <Stack gap="tight">
                <Txt variant="caption" tone="muted">
                  {t('Your balance')}
                </Txt>
                <Txt variant="stat" numeric>
                  {tn(s.balance_points, '{count} point', '{count} points', { count: formatCount(s.balance_points) })}
                </Txt>
                <Txt variant="callout" tone="muted">
                  {t('Worth {amount}', { amount: formatINR(s.balance_rupees, { trimZeros: true }) })}
                </Txt>
              </Stack>
            </Card>
            {s.expiring.length ? (
              <Notice
                tone="warning"
                message={s.expiring.map((e) => t('{points} points expire on {date}.', { points: formatCount(e.points), date: formatDate(e.expires_on) })).join(' ')}
              />
            ) : null}
            {s.expiry_disclosure ? (
              <Txt variant="caption" tone="muted">
                {s.expiry_disclosure}
              </Txt>
            ) : null}
            <Section title={t('History')}>
              {s.rows.length ? (
                <ListGroup>
                  {[...s.rows].reverse().map((row) => (
                    <ListRow
                      key={row.entry_id}
                      title={t(ENTRY_LABEL[row.type] ?? statusLabel(row.type))}
                      subtitle={formatDate(row.occurred_at)}
                      value={`${row.points > 0 ? '+' : ''}${formatCount(row.points)}`}
                      valueTone={row.points > 0 ? 'success' : 'default'}
                    />
                  ))}
                </ListGroup>
              ) : (
                <Txt variant="callout" tone="muted">
                  {t('No points yet. Points come with awards and recognition.')}
                </Txt>
              )}
            </Section>
            {s.tax ? (
              <Txt variant="caption" tone="subtle">
                {/* The perquisite is on what was redeemed, never on points held. */}
                {t('Redeemed in {fy}: {total}, of which {taxable} is taxable as a perquisite. Points are taxed only when redeemed.', {
                  total: formatINR(s.tax.total_value, { trimZeros: true }),
                  fy: s.tax.financial_year,
                  taxable: formatINR(s.tax.taxable_value, { trimZeros: true }),
                })}
              </Txt>
            ) : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

// ── Referrals ───────────────────────────────────────────────────────────────

export function ReferralsScreen() {
  const go = useGo();
  const roles = useQuery({ queryKey: ['referrals', 'roles'], queryFn: careerApi.openRoles });
  const programmes = useQuery({ queryKey: ['referrals', 'programmes'], queryFn: careerApi.programmes });
  const mine = useQuery({ queryKey: ['referrals', 'mine'], queryFn: careerApi.myReferrals });
  const programme = (programmes.data ?? []).find((p) => p.is_active);
  const bonuses = programme ? Object.values(programme.bonus_by_grade).map(Number).filter((n) => n > 0) : [];

  return (
    <Screen tier="tier2" onRefresh={() => Promise.all([roles.refetch(), programmes.refetch(), mine.refetch()])}>
      {programme ? (
        <Card variant="soft">
          <Stack gap="tight">
            <Txt variant="headline">{programme.name}</Txt>
            {programme.description ? <Txt variant="callout">{programme.description}</Txt> : null}
            {bonuses.length ? (
              <Txt variant="caption" tone="muted">
                {t('Bonus {low} to {high}, by the grade of the role.', {
                  low: formatINR(String(Math.min(...bonuses)), { trimZeros: true }),
                  high: formatINR(String(Math.max(...bonuses)), { trimZeros: true }),
                })}
              </Txt>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      <Section title={t('Open roles')}>
        <QueryView
          query={roles}
          skeleton={<SkeletonList rows={2} />}
          isEmpty={(d) => d.length === 0}
          empty={<Txt variant="callout" tone="muted">{t('No roles are open for referral right now.')}</Txt>}
        >
          {(data) => (
            <ListGroup>
              {data.map((r) => (
                <ListRow
                  key={r.id}
                  icon={Briefcase}
                  title={r.title}
                  subtitle={[r.department, r.location].filter(Boolean).join(' · ')}
                  meta={
                    r.experience_min_years !== null
                      ? t('{min}–{max} years', { min: r.experience_min_years, max: r.experience_max_years ?? '+' })
                      : undefined
                  }
                  onPress={programme ? () => go('Refer', { id: r.id }) : undefined}
                  trailing={programme ? <Badge label={t('Refer')} tone="primary" /> : undefined}
                />
              ))}
            </ListGroup>
          )}
        </QueryView>
        {!programme && roles.data?.length ? <Notice tone="info" message={t('No referral programme is running, so referrals are closed for now.')} /> : null}
      </Section>

      <Section title={t('My referrals')}>
        <QueryView
          query={mine}
          skeleton={<SkeletonList rows={2} />}
          isEmpty={(d) => d.length === 0}
          empty={<Txt variant="callout" tone="muted">{t('You have not referred anyone yet.')}</Txt>}
        >
          {(data) => (
            <Stack gap="row">
              {data.map((r) => (
                <Card key={r.id}>
                  <Stack gap="tight">
                    <View style={styles.titleRow}>
                      <Txt variant="bodyStrong" style={styles.flex}>
                        {r.candidate}
                      </Txt>
                      <StatusBadge status={r.status} />
                    </View>
                    <Txt variant="caption" tone="muted">
                      {[r.requisition_title, formatDate(r.submitted_at)].filter(Boolean).join(' · ')}
                    </Txt>
                    {r.duplicate_note ? <Txt variant="caption" tone="warning">{r.duplicate_note}</Txt> : null}
                    {r.ineligibility_reason ? <Txt variant="caption" tone="danger">{r.ineligibility_reason}</Txt> : null}
                    {r.bonus_amount ? <KeyValue label={t('Bonus')} value={formatINR(r.bonus_amount)} /> : null}
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </QueryView>
      </Section>
    </Screen>
  );
}

export function ReferScreen() {
  const navigation = useNavigation();
  const { id } = useParams<{ id: string }>();
  const roles = useQuery({ queryKey: ['referrals', 'roles'], queryFn: careerApi.openRoles });
  const programmes = useQuery({ queryKey: ['referrals', 'programmes'], queryFn: careerApi.programmes });
  const [roleId, setRoleId] = useState<string | null>(id ?? null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const programme = (programmes.data ?? []).find((p) => p.is_active);
  const errors = {
    role: !roleId ? t('Choose the role.') : null,
    name: !name.trim() ? t('Their full name, please.') : null,
    email: !email.trim() ? t('Their email, so the recruiter can reach them.') : checks.email(email.trim()),
    phone: phone.trim() ? checks.phone(phone.trim()) : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const refer = useAction(
    () =>
      careerApi.refer({
        programme_id: programme!.id,
        requisition_id: roleId!,
        candidate_name: name.trim(),
        candidate_email: email.trim(),
        candidate_phone: phone.trim() || null,
        note: note.trim() || null,
      }),
    { success: t('Referral sent. The recruiter takes it from here.'), invalidate: [['referrals']] },
  );

  if (roles.isPending || programmes.isPending) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={4} />
      </Screen>
    );
  }
  if (!programme) {
    return (
      <Screen tier="tier2">
        {programmes.error ? <ErrorState error={programmes.error} /> : <EmptyState spot="recruit" title={t('Referrals are closed')} message={t('No referral programme is running right now.')} />}
      </Screen>
    );
  }
  return (
    <FormScreen
      tier="tier2"
      submitLabel={t('Send referral')}
      dirty={Boolean(name || email || phone || note)}
      submitDisabled={touched && invalid}
      onSubmit={async () => {
        setTouched(true);
        if (invalid) return;
        if (await refer.run(undefined)) navigation.goBack();
      }}
    >
      <SelectField
        label={t('Role')}
        required
        value={roleId}
        options={(roles.data ?? []).map((r) => ({ value: r.id, label: r.title, description: [r.department, r.location].filter(Boolean).join(' · ') }))}
        onChange={setRoleId}
        error={touched ? errors.role : null}
      />
      <TextField label={t('Their name')} required value={name} onChangeText={setName} autoCapitalize="words" maxLength={255} error={touched ? errors.name : null} />
      <TextField label={t('Their email')} required value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={255} error={touched ? errors.email : null} />
      <TextField label={t('Their phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} error={touched ? errors.phone : null} placeholder={t('Optional')} />
      <TextField label={t('Why they would be good')} value={note} onChangeText={setNote} multiline maxLength={1000} placeholder={t('Optional, but it helps the recruiter')} />
      <Txt variant="caption" tone="muted">
        {t('Tell them you are referring them. The recruiter will contact them at this email.')}
      </Txt>
    </FormScreen>
  );
}

// ── Interviews ──────────────────────────────────────────────────────────────

const MODE: Record<string, string> = { video: 'Video', phone: 'Phone', onsite: 'In person', in_person: 'In person' };

export function InterviewsScreen() {
  const go = useGo();
  const { linked } = useSession();
  const interviews = useQuery({ queryKey: ['interviews', 'mine'], queryFn: careerApi.myInterviews, enabled: !linked('interviews') });
  if (linked('interviews')) {
    return (
      <Screen tier="tier2">
        <ProductLauncher product="interview" what={t('Interviews and scorecards')} />
      </Screen>
    );
  }
  const now = new Date().toISOString();
  return (
    <Screen tier="tier2" onRefresh={() => interviews.refetch()}>
      <QueryView
        query={interviews}
        skeleton={<SkeletonList rows={3} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState spot="question" title={t('No interviews for you')} message={t('When you are on an interview panel, it shows here with the scorecard.')} />}
      >
        {(data) => (
          <ListGroup>
            {[...data]
              .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start))
              .map((iv) => {
                const owesFeedback = iv.status === 'completed' && !iv.my_feedback_submitted;
                return (
                  <ListRow
                    key={iv.id}
                    icon={Mic}
                    title={iv.candidate_name}
                    subtitle={[iv.requisition_title, iv.stage_name].filter(Boolean).join(' · ')}
                    meta={`${formatDateTime(iv.scheduled_start)} · ${t(MODE[iv.mode] ?? statusLabel(iv.mode))}`}
                    trailing={
                      owesFeedback ? (
                        <Badge label={t('Feedback due')} tone="warning" />
                      ) : iv.scheduled_start > now ? (
                        <Badge label={t('Upcoming')} tone="info" />
                      ) : (
                        <StatusBadge status={iv.status} />
                      )
                    }
                    onPress={() => go('InterviewDetail', { id: iv.id })}
                  />
                );
              })}
          </ListGroup>
        )}
      </QueryView>
    </Screen>
  );
}

const RECOMMENDATIONS: { value: Recommendation; label: string }[] = [
  { value: 'strong_yes', label: 'Strong yes' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'strong_no', label: 'Strong no' },
];

export function InterviewDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const me = useUser();
  const interview = useQuery({ queryKey: ['interviews', id], queryFn: () => careerApi.interview(id!), enabled: Boolean(id) });
  const feedback = useQuery({ queryKey: ['interviews', id, 'feedback'], queryFn: () => careerApi.interviewFeedback(id!), enabled: Boolean(id) });
  const [giving, setGiving] = useState(false);
  const respond = useAction((response: 'accepted' | 'tentative' | 'declined') => careerApi.respond(id!, me!.id, response), {
    success: (_, response) => (response === 'accepted' ? t('Accepted') : response === 'declined' ? t('Declined — the recruiter has been told') : t('Marked tentative')),
    invalidate: [['interviews']],
  });

  if (interview.isPending) {
    return (
      <Screen tier="tier2">
        <SkeletonCard lines={6} />
      </Screen>
    );
  }
  if (!interview.data) {
    return (
      <Screen tier="tier2">
        <ErrorState error={interview.error} onRetry={() => void interview.refetch()} />
      </Screen>
    );
  }
  const iv: MyInterview = interview.data;
  const upcoming = iv.scheduled_start > new Date().toISOString() && iv.status !== 'cancelled';
  const canGive = !iv.my_feedback_submitted && iv.status !== 'cancelled' && !upcoming;
  const competencies = iv.stage?.required_competencies ?? [];
  const myPanel = iv.panel.find((p) => p.user_id === me?.id);

  return (
    <Screen
      tier="tier2"
      onRefresh={() => Promise.all([interview.refetch(), feedback.refetch()])}
      footer={canGive ? <Button label={t('Give feedback')} variant="accent" onPress={() => setGiving(true)} fullWidth /> : undefined}
    >
      <Card>
        <Stack gap="tight">
          <View style={styles.titleRow}>
            <Txt variant="title" style={styles.flex}>
              {iv.candidate_name}
            </Txt>
            <StatusBadge status={iv.status} />
          </View>
          <Txt variant="callout" tone="muted">
            {[iv.requisition_title, iv.stage?.name].filter(Boolean).join(' · ')}
          </Txt>
          <KeyValue label={t('When')} value={`${formatDateShort(iv.scheduled_start)}, ${formatTime(iv.scheduled_start)}–${formatTime(iv.scheduled_end)}`} />
          <KeyValue label={t('How')} value={t(MODE[iv.mode] ?? statusLabel(iv.mode))} />
          {iv.location_or_link ? (
            /^https?:\/\//.test(iv.location_or_link) ? (
              <Button label={t('Join the call')} size="sm" variant="secondary" onPress={() => void openInBrowser(iv.location_or_link!)} />
            ) : (
              <KeyValue label={t('Where')} value={iv.location_or_link} />
            )
          ) : null}
          {competencies.length ? <KeyValue label={t('Assess')} value={competencies.join(', ')} /> : null}
          {iv.stage?.preparation_notes ? <Notice tone="info" message={iv.stage.preparation_notes} /> : null}
        </Stack>
      </Card>

      {upcoming && myPanel ? (
        <Section title={t('Can you make it?')}>
          <ChoiceField
            label=""
            value={myPanel.response === 'needs_action' ? '' : myPanel.response}
            options={[
              { value: 'accepted', label: t('Yes') },
              { value: 'tentative', label: t('Maybe') },
              { value: 'declined', label: t('No') },
            ]}
            onChange={(v) => void respond.run(v as 'accepted' | 'tentative' | 'declined')}
          />
        </Section>
      ) : null}

      <Section title={t('Panel')}>
        <ListGroup>
          {iv.panel.map((p) => (
            <ListRow
              key={p.user_id}
              title={p.user_id === me?.id ? t('You') : p.name}
              subtitle={t(statusLabel(p.role))}
              trailing={p.feedback_submitted ? <Badge label={t('Feedback in')} tone="success" /> : <Badge label={t(statusLabel(p.response))} tone="neutral" />}
            />
          ))}
        </ListGroup>
      </Section>

      <Section title={t('Feedback')}>
        <QueryView query={feedback} skeleton={<SkeletonList rows={1} />}>
          {(f) => (
            <Stack gap="row">
              {f.feedback.map((item, i) => (
                <Card key={i} variant="sunken">
                  <Stack gap="tight">
                    <View style={styles.titleRow}>
                      <Txt variant="bodyStrong" style={styles.flex}>
                        {item.is_mine ? t('Your feedback') : item.panelist}
                      </Txt>
                      <Badge
                        label={t(RECOMMENDATIONS.find((r) => r.value === item.recommendation)?.label ?? item.recommendation)}
                        tone={item.recommendation.includes('yes') ? 'success' : 'danger'}
                      />
                    </View>
                    {Object.entries(item.ratings).map(([k, v]) => (
                      <KeyValue key={k} label={k} value={t('{n} of 10', { n: v })} />
                    ))}
                    {item.strengths ? <Txt variant="callout">{t('Strengths: {text}', { text: item.strengths })}</Txt> : null}
                    {item.concerns ? <Txt variant="callout">{t('Concerns: {text}', { text: item.concerns })}</Txt> : null}
                  </Stack>
                </Card>
              ))}
              {f.withheld_count ? <Notice tone="info" message={f.withheld_note} /> : null}
              {!f.feedback.length && !f.withheld_count ? (
                <Txt variant="callout" tone="muted">
                  {t('No feedback yet.')}
                </Txt>
              ) : null}
            </Stack>
          )}
        </QueryView>
      </Section>

      <InterviewFeedbackSheet open={giving} onClose={() => setGiving(false)} interviewId={iv.id} competencies={competencies} />
    </Screen>
  );
}

const RATING = /^(10|[1-9])$/;

function InterviewFeedbackSheet({ open, onClose, interviewId, competencies }: { open: boolean; onClose: () => void; interviewId: string; competencies: string[] }) {
  const [recommendation, setRecommendation] = useState<Recommendation | ''>('');
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setRecommendation('');
    setRatings({});
    setStrengths('');
    setConcerns('');
    setTouched(false);
  });
  const against = recommendation === 'no' || recommendation === 'strong_no';
  const error = !recommendation
    ? t('Choose a recommendation.')
    : competencies.find((c) => !RATING.test(ratings[c] ?? ''))
      ? t('Rate {skill} from 1 to 10.', { skill: competencies.find((c) => !RATING.test(ratings[c] ?? ''))! })
      : against && !concerns.trim()
        ? t('Say what the concerns are when recommending against.')
        : null;
  const send = useAction(
    () => careerApi.giveInterviewFeedback(interviewId, { recommendation: recommendation as Recommendation, ratings, strengths: strengths.trim(), concerns: concerns.trim() }),
    { success: t('Feedback submitted'), invalidate: [['interviews']], onSuccess: onClose },
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Interview feedback')}
      description={t('You can submit once. Other panellists’ feedback stays hidden until yours is in.')}
      dirty={Boolean(recommendation || strengths || concerns || Object.keys(ratings).length)}
      footer={
        <Button
          label={t('Submit feedback')}
          variant="accent"
          loading={send.pending}
          onPress={() => {
            setTouched(true);
            if (!error) void send.run(undefined);
          }}
          fullWidth
        />
      }
    >
      <ChoiceField label={t('Recommendation')} required value={recommendation} options={RECOMMENDATIONS.map((r) => ({ value: r.value, label: t(r.label) }))} onChange={(v) => setRecommendation(v as Recommendation)} />
      {competencies.map((c) => (
        <Stack key={c} gap="tight">
          <Txt variant="label" tone="muted">
            {t('{skill} (1–10)', { skill: c })}
          </Txt>
          <View style={styles.chips}>
            {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
              <Chip key={n} label={n} selected={ratings[c] === n} onPress={() => setRatings((r) => ({ ...r, [c]: n }))} />
            ))}
          </View>
        </Stack>
      ))}
      <TextField label={t('Strengths')} value={strengths} onChangeText={setStrengths} multiline maxLength={5000} />
      <TextField label={t('Concerns')} required={against} value={concerns} onChangeText={setConcerns} multiline maxLength={5000} />
      {touched && error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
    </Sheet>
  );
}

// ── Onboarding ──────────────────────────────────────────────────────────────

export function OnboardingScreen() {
  const go = useGo();
  const plan = useQuery({ queryKey: ['onboarding', 'me'], queryFn: onboardingApi.me });
  const summary = useQuery({ queryKey: ['onboarding', 'summary'], queryFn: onboardingApi.summary });
  const p = plan.data?.plan;
  const progress = summary.data?.progress as { done?: number; total?: number; percent?: number } | null | undefined;

  return (
    <Screen tier="tier2" onRefresh={() => Promise.all([plan.refetch(), summary.refetch()])}>
      {plan.isPending ? (
        <SkeletonCard lines={4} />
      ) : plan.error ? (
        <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />
      ) : !p ? (
        <EmptyState
          spot="checklist"
          title={t('No onboarding plan for you')}
          message={
            summary.data?.assigned_pending
              ? t('You do have tasks for new joiners — they are in your Inbox under Tasks.')
              : t('A joining checklist shows here when HR sets one up for you.')
          }
        />
      ) : (
        <>
          <Card variant="soft">
            <Stack gap="tight">
              <Txt variant="headline">{t('Welcome aboard')}</Txt>
              {summary.data?.joining_date ? (
                <Txt variant="callout" tone="muted">
                  {t('Joining on {date}', { date: formatDate(summary.data.joining_date) })}
                </Txt>
              ) : null}
              {progress?.total ? (
                <>
                  <ProgressBar value={(progress.done ?? 0) / progress.total} />
                  <Txt variant="caption" tone="muted">
                    {t('{done} of {total} done', { done: progress.done ?? 0, total: progress.total })}
                  </Txt>
                </>
              ) : null}
            </Stack>
          </Card>
          <Section title={t('Your checklist')}>
            <ListGroup>
              {(p.tasks ?? []).map((task) => (
                <ListRow
                  key={task.id}
                  title={task.title}
                  subtitle={[task.assignee_name ? t('With {name}', { name: task.assignee_name }) : null, t('due {date}', { date: formatDateShort(task.due_date) })].filter(Boolean).join(' · ')}
                  trailing={task.status === 'done' ? <Badge label={t('Done')} tone="success" /> : task.is_overdue ? <Badge label={t('Overdue')} tone="danger" /> : <StatusBadge status={task.status} />}
                  onPress={task.can_complete && task.status === 'pending' ? () => go('Inbox', { segment: 'tasks' }) : undefined}
                />
              ))}
            </ListGroup>
          </Section>
        </>
      )}
    </Screen>
  );
}

// ── Resignation ─────────────────────────────────────────────────────────────

export function ExitScreen() {
  const go = useGo();
  const exit = useQuery({ queryKey: ['exits', 'mine'], queryFn: careerApi.myExit });
  const [withdrawing, setWithdrawing] = useState(false);
  const withdraw = useAction((reason: string) => careerApi.withdrawResignation(exit.data!.id, reason), {
    success: t('Resignation withdrawn'),
    invalidate: [['exits']],
  });
  return (
    <Screen onRefresh={() => exit.refetch()}>
      {exit.isPending ? (
        <SkeletonCard lines={4} />
      ) : exit.error ? (
        <ErrorState error={exit.error} onRetry={() => void exit.refetch()} />
      ) : !exit.data || exit.data.status === 'cancelled' ? (
        <>
          <EmptyState spot="door" title={t('No resignation on record')} message={t('If you have decided to leave, you can resign here. Your manager or HR accepts it and agrees your last day.')} />
          <Button label={t('Resign')} variant="danger" onPress={() => go('Resign')} />
        </>
      ) : (
        <>
          <Card>
            <Stack gap="tight">
              <View style={styles.titleRow}>
                <Txt variant="title" style={styles.flex}>
                  {t('Your resignation')}
                </Txt>
                <Badge label={exit.data.awaiting_acceptance ? t('Awaiting acceptance') : t(statusLabel(exit.data.status))} tone={exit.data.awaiting_acceptance ? 'warning' : 'info'} />
              </View>
              <KeyValue label={t('Resigned on')} value={formatDate(exit.data.resignation_date)} />
              {exit.data.requested_last_working_day ? <KeyValue label={t('Last day you asked for')} value={formatDate(exit.data.requested_last_working_day)} /> : null}
              {exit.data.approved_last_working_day ? <KeyValue label={t('Agreed last day')} value={formatDate(exit.data.approved_last_working_day)} strong /> : null}
              <KeyValue label={t('Notice period')} value={tn(exit.data.notice_period_days, '{count} day', '{count} days')} />
              {exit.data.notice_shortfall_days > 0 ? (
                <Txt variant="caption" tone="warning">
                  {exit.data.notice_waived
                    ? t('Short notice of {days} days was waived.', { days: exit.data.notice_shortfall_days })
                    : tn(exit.data.notice_shortfall_days, 'This is {count} day short of your notice period; HR may recover it from your settlement.', 'This is {count} days short of your notice period; HR may recover it from your settlement.')}
                </Txt>
              ) : null}
              {exit.data.accepted_by_name ? <KeyValue label={t('Accepted by')} value={exit.data.accepted_by_name} /> : null}
              {exit.data.clearance_total ? (
                <KeyValue label={t('Clearance')} value={t('{pending} of {total} still open', { pending: exit.data.clearance_pending_mandatory, total: exit.data.clearance_total })} />
              ) : null}
            </Stack>
          </Card>
          {exit.data.awaiting_acceptance ? (
            <Button label={t('Withdraw resignation')} variant="secondary" onPress={() => setWithdrawing(true)} fullWidth />
          ) : (
            <Txt variant="caption" tone="muted">
              {t('It has been accepted, so changes go through your manager or HR.')}
            </Txt>
          )}
        </>
      )}
      <ConfirmSheet
        open={withdrawing}
        onClose={() => setWithdrawing(false)}
        title={t('Withdraw your resignation?')}
        message={t('You stay on, as before. Your manager is told.')}
        confirmLabel={t('Withdraw')}
        cancelLabel={t('Keep it')}
        note={{ label: t('Why'), required: true }}
        onConfirm={async (reason) => {
          setWithdrawing(false);
          await withdraw.run(reason);
        }}
      />
    </Screen>
  );
}

export function ResignScreen() {
  const today = todayISO();
  const [reason, setReason] = useState('');
  const [lastDay, setLastDay] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const errors = {
    reason: reason.trim().length < 3 ? t('Give a reason, even a short one.') : null,
    lastDay: lastDay && lastDay < today ? t('The last day cannot be before today.') : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const resign = useAction(
    () => careerApi.resign({ reason: reason.trim(), requested_last_working_day: lastDay, comments: comments.trim() || null }),
    { success: t('Resignation sent to your manager'), invalidate: [['exits']] },
  );
  return (
    <FormScreen
      submitLabel={t('Resign')}
      submitVariant="danger"
      dirty={Boolean(reason || lastDay || comments)}
      closing={closing}
      submitDisabled={touched && invalid}
      onSubmit={() => {
        setTouched(true);
        if (!invalid) setConfirming(true);
      }}
    >
      <Notice tone="warning" message={t('This starts your exit. Your manager or HR accepts it and agrees your last working day. Until then you can withdraw it.')} />
      <TextField label={t('Reason')} required value={reason} onChangeText={setReason} multiline maxLength={2000} error={touched ? errors.reason : null} />
      <DateField
        label={t('Last working day you would like')}
        value={lastDay}
        onChange={setLastDay}
        minimumDate={today}
        maximumDate={addDays(today, 365)}
        placeholder={t('Optional — otherwise your notice period')}
        error={touched ? errors.lastDay : null}
      />
      <TextField label={t('Anything else')} value={comments} onChangeText={setComments} multiline maxLength={2000} placeholder={t('Optional')} />
      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('Send your resignation?')}
        message={t('Your manager and HR are told straight away.')}
        confirmLabel={t('Resign')}
        tone="danger"
        onConfirm={async () => {
          setConfirming(false);
          if (await resign.run(undefined)) setClosing(true);
        }}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

