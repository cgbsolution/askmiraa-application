/**
 * Loans and salary advances, flexi benefits, earned wage access, insurance
 * and stock options.
 *
 * Tier 1: every figure here is money, and every figure is the server's. EMIs,
 * what can be drawn, and what options are worth are never worked out on the
 * phone. Amounts hide and show together, as on the other pay screens.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { PiggyBank } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { perksApi, type BenefitMember, type MyBenefit } from '../../api/perks';
import { Badge, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { AmountField, ChoiceField, DateField, SelectField, TextField } from '../../components/Field';
import { FigureTable } from '../../components/FigureTable';
import { FormScreen } from '../../components/FormScreen';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { Money, RevealToggle, useMoneyText, withReveal } from '../../components/Money';
import { Row, Screen, Section, Stack } from '../../components/Screen';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { useResetOnOpen } from '../../components/sheetContext';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState, Notice, ProgressBar, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { validateAmount } from '../../core/amount';
import { MONTHS, financialYear, formatDate, formatDateShort, todayISO } from '../../core/dates';
import { compareDecimals, formatCount, formatINR, isPositiveAmount, sumDecimals } from '../../core/money';
import { statusLabel } from '../../core/status';
import { t, tn } from '../../lib/i18n';
import { useAction } from '../../lib/useAction';
import { useGo, useParams } from '../../navigation/navigate';
import { spacing } from '../../theme/tokens';

// ── Loans ───────────────────────────────────────────────────────────────────

export const LoansScreen = withReveal(function LoansBody() {
  const go = useGo();
  const money = useMoneyText();
  const loans = useQuery({ queryKey: ['loans', 'mine'], queryFn: perksApi.myLoans });
  const schemes = useQuery({ queryKey: ['loans', 'schemes'], queryFn: perksApi.schemes });
  const active = (schemes.data ?? []).filter((s) => s.active);
  return (
    <Screen onRefresh={() => Promise.all([loans.refetch(), schemes.refetch()])}>
      {loans.data?.length ? <RevealToggle /> : null}
      <Section title={t('My loans')}>
        <QueryView
          query={loans}
          skeleton={<SkeletonList rows={2} />}
          isEmpty={(d) => d.length === 0}
          empty={<Txt variant="callout" tone="muted">{t('You have no loans or advances.')}</Txt>}
        >
          {(data) => (
            <Stack gap="row">
              {data.map((l) => (
                <Card key={l.id}>
                  <Stack gap="tight">
                    <View style={styles.titleRow}>
                      <Txt variant="headline" style={styles.flex}>
                        {l.scheme_name ?? t('Loan')}
                      </Txt>
                      <StatusBadge status={l.status} />
                    </View>
                    <KeyValue label={t('Amount')} value={money(l.principal)} />
                    {isPositiveAmount(l.emi_amount) ? <KeyValue label={t('Monthly instalment')} value={money(l.emi_amount)} /> : null}
                    <KeyValue label={t('Still to repay')} value={money(l.outstanding_principal)} strong />
                    <Txt variant="caption" tone="muted">
                      {[
                        tn(l.tenure_months, '{count} month', '{count} months'),
                        isPositiveAmount(l.interest_rate) ? t('{rate}% a year', { rate: Number(l.interest_rate) }) : t('No interest'),
                        l.applied_at ? t('applied {date}', { date: formatDateShort(l.applied_at) }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Txt>
                    {l.decision_note ? <Txt variant="callout" tone="muted">“{l.decision_note}”</Txt> : null}
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </QueryView>
      </Section>
      <Section title={t('What you can apply for')}>
        <QueryView query={schemes} skeleton={<SkeletonList rows={2} />} isEmpty={() => active.length === 0} empty={<Txt variant="callout" tone="muted">{t('No loan schemes are open.')}</Txt>}>
          {() => (
            <ListGroup tier="tier1">
              {active.map((s) => (
                <ListRow
                  key={s.id}
                  icon={PiggyBank}
                  title={s.name}
                  subtitle={[
                    s.max_amount ? t('up to {amount}', { amount: formatINR(s.max_amount, { trimZeros: true }) }) : s.max_amount_as_multiple_of_salary ? t('up to {n}× monthly salary', { n: Number(s.max_amount_as_multiple_of_salary) }) : null,
                    tn(s.max_tenure_months, 'up to {count} month', 'up to {count} months'),
                    isPositiveAmount(s.interest_rate) ? t('{rate}% interest', { rate: Number(s.interest_rate) }) : t('interest-free'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  meta={s.eligibility_min_service_months ? tn(s.eligibility_min_service_months, 'After {count} month of service', 'After {count} months of service') : undefined}
                  onPress={() => go('ApplyLoan', { id: s.id })}
                />
              ))}
            </ListGroup>
          )}
        </QueryView>
      </Section>
    </Screen>
  );
});

export function ApplyLoanScreen() {
  const navigation = useNavigation();
  const { id } = useParams<{ id: string }>();
  const schemes = useQuery({ queryKey: ['loans', 'schemes'], queryFn: perksApi.schemes });
  const [schemeId, setSchemeId] = useState<string | null>(id ?? null);
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('');
  const [purpose, setPurpose] = useState('');
  const [touched, setTouched] = useState(false);
  const scheme = (schemes.data ?? []).find((s) => s.id === schemeId) ?? null;
  const tenureNumber = Number(tenure);
  const errors = {
    scheme: !scheme ? t('Choose what to apply for.') : null,
    amount: validateAmount(amount, scheme?.max_amount ? { max: scheme.max_amount } : {}),
    tenure:
      !/^\d+$/.test(tenure) || tenureNumber < 1
        ? t('Enter the number of months.')
        : scheme && tenureNumber > scheme.max_tenure_months
          ? tn(scheme.max_tenure_months, 'At most {count} month for this scheme.', 'At most {count} months for this scheme.')
          : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const apply = useAction(
    () => perksApi.applyLoan({ scheme_id: scheme!.id, principal: amount, tenure_months: tenureNumber, purpose: purpose.trim() || null }),
    {
      success: (l) => (isPositiveAmount(l.emi_amount) ? t('Applied. Your instalment would be {emi} a month.', { emi: formatINR(l.emi_amount) }) : t('Applied. HR will review it.')),
      invalidate: [['loans']],
    },
  );
  if (schemes.isPending) {
    return (
      <Screen>
        <SkeletonCard lines={4} />
      </Screen>
    );
  }
  return (
    <FormScreen
      submitLabel={t('Apply')}
      dirty={Boolean(amount || tenure || purpose)}
      submitDisabled={touched && invalid}
      onSubmit={async () => {
        setTouched(true);
        if (invalid) return;
        if (await apply.run(undefined)) navigation.goBack();
      }}
    >
      <SelectField
        label={t('Scheme')}
        required
        value={schemeId}
        options={(schemes.data ?? []).filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
        onChange={setSchemeId}
        error={touched ? errors.scheme : null}
      />
      {scheme ? (
        <Card variant="sunken">
          <Stack gap="tight">
            {scheme.max_amount ? <KeyValue label={t('Most you can borrow')} value={formatINR(scheme.max_amount, { trimZeros: true })} /> : null}
            {scheme.max_amount_as_multiple_of_salary ? <KeyValue label={t('Most you can borrow')} value={t('{n}× monthly salary', { n: Number(scheme.max_amount_as_multiple_of_salary) })} /> : null}
            <KeyValue label={t('Longest repayment')} value={tn(scheme.max_tenure_months, '{count} month', '{count} months')} />
            <KeyValue label={t('Interest')} value={isPositiveAmount(scheme.interest_rate) ? t('{rate}% a year, {type}', { rate: Number(scheme.interest_rate), type: t(statusLabel(scheme.interest_type)).toLowerCase() }) : t('None')} />
            {isPositiveAmount(scheme.minimum_net_pay) ? (
              <Txt variant="caption" tone="muted">
                {t('Your take-home pay must stay above {amount} after the instalment.', { amount: formatINR(scheme.minimum_net_pay, { trimZeros: true }) })}
              </Txt>
            ) : null}
          </Stack>
        </Card>
      ) : null}
      <AmountField label={t('Amount')} required value={amount} onChangeText={setAmount} error={touched ? errors.amount : null} />
      <TextField
        label={t('Repay over (months)')}
        required
        value={tenure}
        onChangeText={(v) => setTenure(v.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
        error={touched ? errors.tenure : null}
      />
      <TextField label={t('What it is for')} value={purpose} onChangeText={setPurpose} multiline maxLength={500} placeholder={t('Optional')} />
      <Txt variant="caption" tone="muted">
        {t('The instalment is worked out by payroll when you apply, and recovered from your salary each month.')}
      </Txt>
    </FormScreen>
  );
}

// ── Flexi benefits ──────────────────────────────────────────────────────────

export function FlexiScreen() {
  const fy = financialYear(todayISO(), 'long');
  const flexi = useQuery({ queryKey: ['flexi', fy], queryFn: () => perksApi.flexi(fy) });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!flexi.data) return;
    setAmounts(Object.fromEntries(flexi.data.components.map((c) => [c.code, isPositiveAmount(c.amount) ? String(Number(c.amount)) : ''])));
  }, [flexi.data]);
  const save = useAction((submit: boolean) => perksApi.declareFlexi(fy, Object.fromEntries(Object.entries(amounts).map(([k, v]) => [k, v || '0'])), submit), {
    success: (_, submit) => (submit ? t('Sent to HR for approval') : t('Saved as a draft')),
    invalidate: [['flexi']],
  });

  const data = flexi.data;
  const total = useMemo(() => sumDecimals(Object.values(amounts).map((v) => v || '0')), [amounts]);
  if (flexi.isPending) {
    return (
      <Screen>
        <SkeletonCard lines={5} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <ErrorState error={flexi.error} onRetry={() => void flexi.refetch()} />
      </Screen>
    );
  }
  if (!isPositiveAmount(data.pot)) {
    return (
      <Screen onRefresh={() => flexi.refetch()}>
        <EmptyState spot="sliders" title={t('No flexi benefits for you this year')} message={t('HR has not set a flexi pot in your salary for {fy}. If your offer has one, ask HR.', { fy })} />
      </Screen>
    );
  }
  const locked = data.status === 'approved' || data.status === 'submitted';
  const over = compareDecimals(total, data.pot) === 1;
  const errors = Object.fromEntries(
    data.components.map((c) => [c.code, amounts[c.code] ? validateAmount(amounts[c.code]!, { allowZero: true, max: c.limit }) : null]),
  ) as Record<string, string | null>;
  const invalid = Object.values(errors).some(Boolean) || over;

  return (
    <Screen
      onRefresh={() => flexi.refetch()}
      footer={
        locked ? undefined : (
          <Row>
            <View style={styles.flex}>
              <Button label={t('Save draft')} variant="secondary" loading={save.pending} onPress={() => { setTouched(true); if (!invalid) void save.run(false); }} fullWidth />
            </View>
            <View style={styles.flex}>
              <Button label={t('Submit')} variant="accent" onPress={() => { setTouched(true); if (!invalid) setConfirming(true); }} fullWidth />
            </View>
          </Row>
        )
      }
    >
      <Card>
        <Stack gap="tight">
          <View style={styles.titleRow}>
            <Txt variant="headline" style={styles.flex}>
              {t('Your flexi pot, {fy}', { fy })}
            </Txt>
            <StatusBadge status={data.status === 'none' ? 'not_started' : data.status} />
          </View>
          <Money value={data.pot} variant="stat" masked />
          <KeyValue label={t('Declared')} value={formatINR(total)} />
          <KeyValue label={t('Left as taxable salary')} value={over ? '—' : formatINR(sumDecimals([data.pot, `-${total}`]))} />
          {over ? <Txt variant="caption" tone="danger">{t('That is more than your pot.')}</Txt> : null}
          <Txt variant="caption" tone="muted">
            {data.note}
          </Txt>
          {data.decision_note ? <Notice tone="info" message={t('HR: {note}', { note: data.decision_note })} /> : null}
        </Stack>
      </Card>
      <Section title={t('Split it')}>
        <Stack gap="row">
          {data.components.map((c) => (
            <AmountField
              key={c.code}
              label={c.name}
              value={amounts[c.code] ?? ''}
              onChangeText={(v) => setAmounts((a) => ({ ...a, [c.code]: v }))}
              helper={t('Up to {limit} a year', { limit: formatINR(c.limit, { trimZeros: true }) })}
              error={touched ? errors[c.code] : null}
              editable={!locked}
            />
          ))}
        </Stack>
      </Section>
      {locked ? <Txt variant="caption" tone="muted">{data.status === 'approved' ? t('Approved. To change it, ask HR to reopen it.') : t('With HR for approval.')}</Txt> : null}
      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('Send your split to HR?')}
        message={t('Once approved, payroll uses it for the rest of the year.')}
        confirmLabel={t('Submit')}
        onConfirm={async () => {
          setConfirming(false);
          await save.run(true);
        }}
      />
    </Screen>
  );
}

// ── Earned wage access ──────────────────────────────────────────────────────

/** "2026-10" -> "Oct 2026". */
function formatPeriod(period: string | undefined): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period ?? '');
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : (period ?? null);
}

export const EwaScreen = withReveal(function EwaBody() {
  const money = useMoneyText();
  const position = useQuery({ queryKey: ['ewa', 'me'], queryFn: perksApi.ewa });
  const requests = useQuery({ queryKey: ['ewa', 'requests'], queryFn: perksApi.ewaRequests });
  const [asking, setAsking] = useState(false);
  return (
    <Screen onRefresh={() => Promise.all([position.refetch(), requests.refetch()])}>
      <QueryView query={position} skeleton={<SkeletonCard lines={4} />}>
        {(p) =>
          !p.enabled ? (
            <EmptyState spot="cash" title={t('Not available at your company')} message={t('Earned wage access lets you draw part of this month’s pay early. Your company has not switched it on.')} />
          ) : (
            <>
              <Card>
                <Stack gap="tight">
                  <Txt variant="caption" tone="muted">
                    {t('You can draw now')}
                  </Txt>
                  <Money value={p.available} variant="stat" masked />
                  <ProgressBar value={Number(p.days_paid_so_far) / p.days_in_month} />
                  <KeyValue label={t('Earned so far this month')} value={money(p.earned_to_date)} />
                  <KeyValue label={t('Already drawn')} value={money(p.already_drawn)} />
                  <Txt variant="caption" tone="muted">
                    {t('{days} of {total} days worked · up to {percent}% of earned pay · {left} left this month', {
                      days: Number(p.days_paid_so_far),
                      total: p.days_in_month,
                      percent: Number(p.max_percent),
                      left: tn(p.requests_left, '{count} request', '{count} requests'),
                    })}
                  </Txt>
                  <Button
                    label={t('Draw an advance')}
                    variant="accent"
                    disabled={p.requests_left === 0 || !isPositiveAmount(p.available)}
                    onPress={() => setAsking(true)}
                  />
                  {p.requests_left === 0 ? <Txt variant="caption" tone="warning">{t('You have used this month’s requests.')}</Txt> : null}
                </Stack>
              </Card>
              <EwaSheet open={asking} onClose={() => setAsking(false)} available={p.available} min={p.min_amount} />
            </>
          )
        }
      </QueryView>
      <Section title={t('Requests')}>
        <QueryView query={requests} skeleton={<SkeletonList rows={2} />} isEmpty={(d) => d.length === 0} empty={<Txt variant="callout" tone="muted">{t('No advances yet.')}</Txt>}>
          {(data) => (
            <ListGroup tier="tier1">
              {data.map((r) => (
                <ListRow key={r.id} title={money(r.amount)} subtitle={[formatPeriod(r.period), r.created_at ? t('asked {date}', { date: formatDateShort(r.created_at) }) : null].filter(Boolean).join(' · ')} meta={r.decision_note ?? undefined} trailing={<StatusBadge status={r.status} />} />
              ))}
            </ListGroup>
          )}
        </QueryView>
      </Section>
    </Screen>
  );
});

function EwaSheet({ open, onClose, available, min }: { open: boolean; onClose: () => void; available: string; min: string }) {
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setAmount('');
    setTouched(false);
  });
  const error =
    validateAmount(amount, { max: available }) ??
    (compareDecimals(amount, min) === -1 ? t('The smallest advance is {min}.', { min: formatINR(min, { trimZeros: true }) }) : null);
  const send = useAction(() => perksApi.requestEwa(amount), { success: t('Requested. It is recovered from this month’s salary.'), invalidate: [['ewa']], onSuccess: onClose });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Draw an advance')}
      description={t('Up to {max}. It comes out of this month’s salary.', { max: formatINR(available) })}
      dirty={Boolean(amount)}
      footer={<Button label={t('Request')} variant="accent" loading={send.pending} onPress={() => { setTouched(true); if (!error) void send.run(undefined); }} fullWidth />}
    >
      <AmountField label={t('Amount')} required value={amount} onChangeText={setAmount} error={touched ? error : null} />
    </Sheet>
  );
}

// ── Insurance and benefits ──────────────────────────────────────────────────

const RELATION: Record<BenefitMember['relationship'], string> = { spouse: 'Spouse', child: 'Child', parent: 'Parent', parent_in_law: 'Parent-in-law' };

export const BenefitsScreen = withReveal(function BenefitsBody() {
  const money = useMoneyText();
  const benefits = useQuery({ queryKey: ['benefits', 'me'], queryFn: perksApi.benefits });
  const [enrolling, setEnrolling] = useState<MyBenefit | null>(null);
  return (
    <Screen onRefresh={() => benefits.refetch()}>
      {benefits.data?.length ? <RevealToggle /> : null}
      <QueryView
        query={benefits}
        skeleton={<SkeletonCard lines={5} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState spot="shield" title={t('No benefit plans yet')} message={t('Group health, life and accident cover show here once HR sets them up.')} />}
      >
        {(data) => (
          <Stack gap="row">
            {data.map((b) => (
              <Card key={b.plan.id}>
                <Stack gap="tight">
                  <View style={styles.titleRow}>
                    <Txt variant="headline" style={styles.flex}>
                      {b.plan.name}
                    </Txt>
                    {b.enrolment ? <StatusBadge status={b.enrolment.status} /> : b.window_open ? <Badge label={t('Enrol now')} tone="warning" /> : null}
                  </View>
                  <Txt variant="caption" tone="muted">
                    {[b.plan.insurer, b.plan.tpa ? t('claims via {tpa}', { tpa: b.plan.tpa }) : null, b.plan.policy_number].filter(Boolean).join(' · ')}
                  </Txt>
                  <KeyValue label={t('Cover')} value={money(b.plan.sum_insured, { trimZeros: true })} strong />
                  <KeyValue label={t('Policy year')} value={`${formatDateShort(b.plan.policy_start)} – ${formatDate(b.plan.policy_end)}`} />
                  <KeyValue label={t('Who can be covered')} value={[t('You'), ...b.plan.covers.map((c) => t(RELATION[c]))].join(', ')} />
                  {b.enrolment ? (
                    <>
                      <KeyValue label={t('Covered with you')} value={b.enrolment.members.length ? b.enrolment.members.map((m) => `${m.name} (${t(RELATION[m.relationship])})`).join(', ') : t('Just you')} />
                      {b.enrolment.top_up_code ? <KeyValue label={t('Top-up')} value={b.plan.top_ups.find((tp) => tp.code === b.enrolment!.top_up_code)?.name ?? b.enrolment.top_up_code} /> : null}
                      {isPositiveAmount(b.enrolment.employee_premium_annual) ? <KeyValue label={t('Your premium')} value={t('{amount} a year, from salary', { amount: money(b.enrolment.employee_premium_annual) })} /> : null}
                    </>
                  ) : null}
                  {b.window_open && b.plan.enrolment_closes ? (
                    <Txt variant="caption" tone="warning">
                      {t('Enrolment open until {date}.', { date: formatDate(b.plan.enrolment_closes) })}
                    </Txt>
                  ) : null}
                  {b.window_open ? (
                    <Button label={b.enrolment ? t('Change who is covered') : t('Enrol')} size="sm" variant={b.enrolment ? 'secondary' : 'accent'} onPress={() => setEnrolling(b)} />
                  ) : null}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </QueryView>
      <EnrolSheet benefit={enrolling} onClose={() => setEnrolling(null)} />
    </Screen>
  );
});

function EnrolSheet({ benefit, onClose }: { benefit: MyBenefit | null; onClose: () => void }) {
  const [members, setMembers] = useState<BenefitMember[]>([]);
  const [topUp, setTopUp] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<BenefitMember['relationship'] | ''>('');
  const [dob, setDob] = useState<string | null>(null);
  useResetOnOpen(benefit !== null, () => {
    setMembers(benefit?.enrolment?.members ?? []);
    setTopUp(benefit?.enrolment?.top_up_code ?? '');
    setAdding(false);
  });
  const plan = benefit?.plan;
  const children = members.filter((m) => m.relationship === 'child').length;
  const addError = !name.trim() ? t('Their name.') : !relation ? t('How they are related to you.') : relation === 'child' && plan?.max_children != null && children >= plan.max_children ? tn(plan.max_children, 'The plan covers at most {count} child.', 'The plan covers at most {count} children.') : null;
  const enrol = useAction(() => perksApi.enrol(plan!.id, { members, top_up_code: topUp || null }), { success: t('Enrolment saved'), invalidate: [['benefits']], onSuccess: onClose });
  const waive = useAction(() => perksApi.enrol(plan!.id, { waive: true, members: [] }), { success: t('You have opted out of this plan'), invalidate: [['benefits']], onSuccess: onClose });
  return (
    <Sheet
      open={benefit !== null}
      onClose={onClose}
      title={plan ? t('Enrol in {plan}', { plan: plan.name }) : ''}
      dirty={adding && Boolean(name)}
      footer={
        <Stack gap="inline">
          <Button label={t('Save enrolment')} variant="accent" loading={enrol.pending} onPress={() => void enrol.run(undefined)} fullWidth />
          <Button label={t('Opt out of this plan')} variant="ghost" loading={waive.pending} onPress={() => void waive.run(undefined)} fullWidth />
        </Stack>
      }
    >
      <Txt variant="label" tone="muted">
        {t('Covered with you')}
      </Txt>
      {members.length ? (
        <ListGroup>
          {members.map((m, i) => (
            <ListRow
              key={`${m.name}-${i}`}
              title={m.name}
              subtitle={[t(RELATION[m.relationship]), m.date_of_birth ? formatDate(m.date_of_birth) : null].filter(Boolean).join(' · ')}
              trailing={<Button label={t('Remove')} size="sm" variant="ghost" onPress={() => setMembers((list) => list.filter((_, j) => j !== i))} />}
              chevron={false}
            />
          ))}
        </ListGroup>
      ) : (
        <Txt variant="callout" tone="muted">
          {t('Just you so far.')}
        </Txt>
      )}
      {adding ? (
        <Card variant="sunken">
          <Stack gap="row">
            <TextField label={t('Name')} required value={name} onChangeText={setName} autoCapitalize="words" maxLength={255} />
            <ChoiceField label={t('Relationship')} required value={relation} options={(plan?.covers ?? []).map((c) => ({ value: c, label: t(RELATION[c]) }))} onChange={(v) => setRelation(v as BenefitMember['relationship'])} />
            <DateField label={t('Date of birth')} value={dob} onChange={setDob} maximumDate={todayISO()} placeholder={t('Optional')} />
            {addError && name ? <Txt variant="caption" tone="danger">{addError}</Txt> : null}
            <Button
              label={t('Add')}
              size="sm"
              variant="primary"
              disabled={Boolean(addError)}
              onPress={() => {
                setMembers((list) => [...list, { name: name.trim(), relationship: relation as BenefitMember['relationship'], date_of_birth: dob }]);
                setName('');
                setRelation('');
                setDob(null);
                setAdding(false);
              }}
            />
          </Stack>
        </Card>
      ) : plan?.covers.length ? (
        <Button label={t('Add a family member')} size="sm" variant="secondary" onPress={() => setAdding(true)} />
      ) : null}
      {plan?.top_ups.length ? (
        <ChoiceField
          label={t('Extra cover')}
          value={topUp}
          options={[{ value: '', label: t('No top-up') }, ...plan.top_ups.map((tp) => ({ value: tp.code, label: t('{name} (+{premium}/yr)', { name: tp.name, premium: formatINR(tp.employee_premium_annual, { trimZeros: true }) }) }))]}
          onChange={setTopUp}
        />
      ) : null}
    </Sheet>
  );
}

// ── Stock options ───────────────────────────────────────────────────────────

export const EsopScreen = withReveal(function EsopBody() {
  const money = useMoneyText();
  const esop = useQuery({ queryKey: ['esop', 'me'], queryFn: perksApi.esop });
  const [price, setPrice] = useState('');
  const projection = useQuery({
    queryKey: ['esop', 'projection', price],
    queryFn: () => perksApi.esopProjection(price),
    enabled: Boolean(price) && !validateAmount(price, { allowZero: true }),
    staleTime: 60_000,
  });
  return (
    <Screen onRefresh={() => esop.refetch()}>
      {esop.data?.grants.length ? <RevealToggle /> : null}
      <QueryView
        query={esop}
        skeleton={<SkeletonCard lines={5} />}
        isEmpty={(d) => d.grants.length === 0}
        empty={<EmptyState spot="growth" title={t('No stock options')} message={t('Grants made to you show here, with how they vest.')} />}
      >
        {(d) => (
          <Stack gap="row">
            {d.grants.map((g) => (
              <Card key={g.id}>
                <Stack gap="tight">
                  <View style={styles.titleRow}>
                    <Txt variant="headline" style={styles.flex}>
                      {g.plan}
                    </Txt>
                    <StatusBadge status={g.status} />
                  </View>
                  <Txt variant="caption" tone="muted">
                    {t('Granted {date} · exercise price {price}', { date: formatDate(g.grant_date), price: formatINR(g.exercise_price) })}
                  </Txt>
                  <ProgressBar value={g.units ? g.vested / g.units : 0} />
                  <FigureTable
                    columns={[t('Units')]}
                    rows={[
                      { key: 'total', label: t('Granted'), values: [formatCount(g.units)] },
                      { key: 'vested', label: t('Vested'), values: [formatCount(g.vested)] },
                      { key: 'exercisable', label: t('You can exercise'), values: [formatCount(g.exercisable)] },
                      { key: 'unvested', label: t('Still to vest'), values: [formatCount(g.unvested)] },
                    ]}
                  />
                  {g.fmv_per_unit ? (
                    <>
                      <KeyValue label={t('Worth now, vested')} value={money(g.value_vested_unexercised)} strong />
                      <Txt variant="caption" tone="muted">
                        {t('At the fair value of {fmv} a unit from {date}, less the exercise price.', { fmv: formatINR(g.fmv_per_unit), date: formatDate(g.fmv_from) })}
                      </Txt>
                    </>
                  ) : (
                    <Txt variant="caption" tone="muted">
                      {t('No fair value has been set, so no value is shown.')}
                    </Txt>
                  )}
                  <Txt variant="label" tone="muted">
                    {t('Vesting')}
                  </Txt>
                  {g.schedule.filter((s) => !s.vested).slice(0, 4).map((s) => (
                    <KeyValue key={s.date} label={formatDate(s.date)} value={tn(s.units, '{count} unit', '{count} units', { count: formatCount(s.units) })} />
                  ))}
                  {g.schedule.every((s) => s.vested) ? <Txt variant="caption" tone="success">{t('Fully vested.')}</Txt> : null}
                </Stack>
              </Card>
            ))}
            <Section title={t('What if the price were…')} description={t('Try a price per share. Nothing is saved.')}>
              <AmountField label={t('Price per share')} value={price} onChangeText={setPrice} />
              {projection.data ? (
                <Card variant="soft">
                  <Stack gap="tight">
                    <KeyValue label={t('Value now')} value={money(projection.data.value_now)} />
                    <KeyValue label={t('When fully vested')} value={money(projection.data.value_when_fully_vested)} strong />
                    <Txt variant="caption" tone="muted">
                      {t('Before tax. Options are taxed as a perquisite when you exercise them.')}
                    </Txt>
                  </Stack>
                </Card>
              ) : null}
            </Section>
          </Stack>
        )}
      </QueryView>
    </Screen>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
