/**
 * Expenses: my claims, one claim, a new claim (receipt photo → policy check →
 * submit), travel requests and advances.
 *
 * Tier 1 — a claim is money. The policy check is the server's: a claim is
 * saved as a draft and judged before anything is submitted, and the verdict
 * is shown as the server wrote it. When ExpenseGenie is linked, claims live
 * there and this section opens it instead.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Plus, ReceiptIndianRupee as Receipt } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { expensesApi, type CaptureResult } from '../../api/expenses';
import { AttachField } from '../../components/AttachField';
import { Badge, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Fab } from '../../components/Fab';
import { AmountField, ChoiceField, DateField, SelectField, TextField } from '../../components/Field';
import { FormScreen } from '../../components/FormScreen';
import { Divider, KeyValue, ListGroup, ListRow } from '../../components/List';
import { ProductLauncher } from '../../components/ProductLauncher';
import { Row, Screen, Section, Stack } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState, Notice, QueryView } from '../../components/States';
import { useResetOnOpen } from '../../components/sheetContext';
import { Txt } from '../../components/Text';
import { validateAmount } from '../../core/amount';
import { addDays, formatDate, formatRange, todayISO } from '../../core/dates';
import { compareDecimals, formatINR, isPositiveAmount, plainDecimal } from '../../core/money';
import { claimNeedsReason, claimSubmittable } from '../../core/expenses';
import { statusLabel, type Tone } from '../../core/status';
import type { CityTierEnum, ClaimKindEnum, ExpenseMeta, ExpensesClaimRead, TravelRequestRead } from '../../core/types';
import type { UploadFile } from '../../lib/api';
import { openDownloaded, type FileRules } from '../../lib/files';
import { t, tn } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { useAction } from '../../lib/useAction';
import { useGo, useParams } from '../../navigation/navigate';
import { spacing } from '../../theme/tokens';

const OPEN = new Set(['draft', 'pending_manager', 'submitted', 'approved']);

const KIND_LABEL: Record<ClaimKindEnum, string> = {
  receipted: 'With a bill',
  mileage: 'Mileage',
  per_diem: 'Daily allowance',
};

const TIER_LABEL: Record<CityTierEnum, string> = {
  a: 'Tier A city',
  b: 'Tier B city',
  c: 'Tier C city',
  international: 'Abroad',
};

const VERDICT: Record<string, { label: string; tone: Tone }> = {
  within_policy: { label: 'Within policy', tone: 'success' },
  no_rule: { label: 'No policy rule', tone: 'neutral' },
  needs_justification: { label: 'Needs a reason', tone: 'warning' },
  flagged: { label: 'Flagged for approver', tone: 'warning' },
  blocked: { label: 'Not allowed', tone: 'danger' },
  receipt_required: { label: 'Needs a receipt', tone: 'danger' },
  pre_approval_required: { label: 'Needs an approved trip', tone: 'danger' },
};

function verdictOf(kind: string): { label: string; tone: Tone } {
  return VERDICT[kind] ?? { label: statusLabel(kind), tone: 'neutral' };
}

/** "travel_local" -> "Travel local". */
export function categoryLabel(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

function useMeta() {
  return useQuery({ queryKey: ['expenses', 'meta'], queryFn: expensesApi.meta, staleTime: 30 * 60_000 });
}

function receiptRules(meta: ExpenseMeta | undefined): FileRules {
  const types = meta?.receipt_types.length ? meta.receipt_types : ['image/*', 'application/pdf'];
  // The server says the workspace's upload limit; until it has, the session's.
  const maxMb = meta?.receipt_max_bytes ? Math.max(1, Math.floor(meta.receipt_max_bytes / (1024 * 1024))) : undefined;
  return { maxMb, types };
}

export function ExpensesScreen() {
  const go = useGo();
  const { linked } = useSession();
  const claims = useQuery({ queryKey: ['expenses', 'claims'], queryFn: () => expensesApi.claims(), enabled: !linked('expenses') });
  const [segment, setSegment] = useState<'open' | 'closed'>('open');

  if (linked('expenses')) {
    return (
      <Screen>
        <ProductLauncher product="expense" what={t('Expense claims')} />
      </Screen>
    );
  }

  const all = claims.data ?? [];
  const open = all.filter((c) => OPEN.has(c.status));
  const closed = all.filter((c) => !OPEN.has(c.status));
  const shown = segment === 'open' ? open : closed;

  return (
    <Screen onRefresh={() => claims.refetch()} overlay={<Fab icon={Plus} label={t('New claim')} onPress={() => go('NewExpense')} />}>
      <ListGroup>
        <ListRow spot="plane" title={t('Travel requests')} subtitle={t('Get a trip approved before you go')} onPress={() => go('TravelRequests')} />
        <ListRow spot="cash" title={t('Advances')} subtitle={t('Money given to you ahead of a trip')} onPress={() => go('Advances')} />
      </ListGroup>
      <Segmented
        segments={[
          { value: 'open', label: t('In progress'), count: open.length, quiet: true },
          { value: 'closed', label: t('Done'), count: closed.length, quiet: true },
        ]}
        value={segment}
        onChange={setSegment}
      />
      <QueryView query={claims} skeleton={<SkeletonList rows={5} />}>
        {() =>
          shown.length ? (
            <ListGroup tier="tier1">
              {shown.map((claim) => (
                <ClaimRow key={claim.id} claim={claim} onPress={() => go('ExpenseDetail', { id: claim.id })} />
              ))}
            </ListGroup>
          ) : (
            <EmptyState
              spot="receipt"
              title={segment === 'open' ? t('No claims in progress') : t('Nothing here yet')}
              message={segment === 'open' ? t('Take a photo of a bill to claim it back.') : t('Paid, rejected and withdrawn claims show here.')}
            />
          )
        }
      </QueryView>
    </Screen>
  );
}

function ClaimRow({ claim, onPress }: { claim: ExpensesClaimRead; onPress: () => void }) {
  return (
    <ListRow
      icon={Receipt}
      title={categoryLabel(claim.category_key)}
      subtitle={[formatDate(claim.incurred_on), t(statusLabel(claim.status === 'pending_manager' ? 'awaiting_manager' : claim.status))].join(' · ')}
      meta={claim.description ?? undefined}
      value={formatINR(claim.amount)}
      onPress={onPress}
    />
  );
}

export function ExpenseDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigation = useNavigation();
  const claim = useQuery({ queryKey: ['expenses', 'claim', id], queryFn: () => expensesApi.claim(id!), enabled: Boolean(id) });
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [opening, setOpening] = useState(false);
  const submit = useAction((justification: string | null) => expensesApi.submit(id!, { justification }), {
    success: t('Claim submitted'),
    invalidate: [['expenses'], ['approvals']],
  });
  const withdraw = useAction(() => expensesApi.cancel(id!), {
    success: t('Claim withdrawn'),
    invalidate: [['expenses']],
    onSuccess: () => navigation.goBack(),
  });

  if (claim.isPending) {
    return (
      <Screen tier="tier1">
        <SkeletonCard lines={6} />
      </Screen>
    );
  }
  if (!claim.data) {
    return (
      <Screen tier="tier1">
        <ErrorState error={claim.error} onRetry={() => void claim.refetch()} />
      </Screen>
    );
  }
  const c = claim.data;
  const verdict = verdictOf(c.policy_verdict);
  const foreign = c.original_currency && c.original_currency !== 'INR';
  const needsReason = claimNeedsReason(c.policy_verdict);
  const canSubmit = c.status === 'draft' && claimSubmittable(c.policy_verdict);

  return (
    <Screen tier="tier1" onRefresh={() => claim.refetch()}>
      <Card tier="tier1">
        <Stack gap="row">
          <View style={styles.titleRow}>
            <Txt variant="title" style={styles.flex}>
              {categoryLabel(c.category_key)}
            </Txt>
            <StatusBadge status={c.status === 'pending_manager' ? 'awaiting_manager' : c.status} />
          </View>
          <Txt variant="stat" numeric>
            {formatINR(c.amount)}
          </Txt>
          {foreign ? (
            <Txt variant="caption" tone="muted">
              {t('{amount} {currency} at {rate}', { amount: c.original_amount, currency: c.original_currency, rate: c.exchange_rate ?? '—' })}
            </Txt>
          ) : null}
          <KeyValue label={t('Spent on')} value={formatDate(c.incurred_on)} />
          <KeyValue label={t('Type')} value={t(KIND_LABEL[c.kind])} />
          <KeyValue label={t('Where')} value={t(TIER_LABEL[c.city_tier])} />
          {c.kind === 'mileage' && c.distance_km ? <KeyValue label={t('Distance')} value={`${plainDecimal(c.distance_km)} km${c.vehicle_type ? ` · ${c.vehicle_type}` : ''}`} /> : null}
          {c.kind === 'per_diem' && c.per_diem_days ? <KeyValue label={t('Days')} value={String(c.per_diem_days)} /> : null}
          {c.description ? (
            <Txt variant="callout" tone="muted">
              {c.description}
            </Txt>
          ) : null}
        </Stack>
      </Card>

      <Section title={t('Policy check')}>
        <Card tier="tier1" variant="sunken">
          <Stack gap="tight">
            <Badge label={t(verdict.label)} tone={verdict.tone} />
            <Txt variant="callout">{c.verdict_message}</Txt>
            <KeyValue label={t('Limit')} value={c.limit_amount === null ? t('No limit') : formatINR(c.limit_amount)} />
            <KeyValue label={t('Already claimed')} value={formatINR(c.already_claimed)} />
            {isPositiveAmount(c.overage) ? <KeyValue label={t('Over the limit')} value={formatINR(c.overage)} tone="danger" /> : null}
            {c.exceeds_route_tolerance ? (
              <Txt variant="caption" tone="warning">
                {t('The distance is more than the route allows; your approver will see that.')}
              </Txt>
            ) : null}
            {c.justification ? (
              <Txt variant="callout" tone="muted">
                {t('Your reason: “{reason}”', { reason: c.justification })}
              </Txt>
            ) : null}
          </Stack>
        </Card>
      </Section>

      <Section title={t('Progress')}>
        <ListGroup tier="tier1">
          <ListRow title={t('Saved')} subtitle={formatDate(c.created_at ?? c.evaluated_at)} />
          {c.submitted_at ? <ListRow title={t('Submitted')} subtitle={formatDate(c.submitted_at)} /> : null}
          {c.manager_decided_at ? (
            <ListRow
              title={t('Manager: {name}', { name: c.manager_decided_by_name ?? t('decided') })}
              subtitle={[formatDate(c.manager_decided_at), c.manager_decision_note].filter(Boolean).join(' · ')}
              numberOfLines={4}
            />
          ) : null}
          {c.decided_at ? (
            <ListRow title={t(c.status === 'rejected' ? 'Rejected by finance' : 'Approved by finance')} subtitle={[formatDate(c.decided_at), c.decision_note].filter(Boolean).join(' · ')} numberOfLines={4} />
          ) : null}
          {c.reimbursed_at ? (
            <ListRow title={t('Paid')} subtitle={[formatDate(c.reimbursed_at), c.reimbursed_in_period ? t('with {period} salary', { period: c.reimbursed_in_period }) : c.payment_note].filter(Boolean).join(' · ')} />
          ) : null}
        </ListGroup>
      </Section>

      {c.receipt_document_id ? (
        <Button
          label={t('Open receipt')}
          icon={Receipt}
          variant="secondary"
          loading={opening}
          onPress={async () => {
            setOpening(true);
            await openDownloaded(expensesApi.receiptPath(c.receipt_document_id!), `receipt-${c.receipt_document_id!.slice(0, 8)}`);
            setOpening(false);
          }}
        />
      ) : null}

      {c.status === 'draft' ? (
        <Stack gap="inline">
          {canSubmit ? <Button label={t('Submit claim')} variant="accent" onPress={() => setSubmitting(true)} fullWidth /> : null}
          {!canSubmit ? <Notice tone="warning" message={t('The policy does not let this claim be submitted as it is. Withdraw it and claim again.')} /> : null}
          <Button label={t('Withdraw')} variant="ghost" onPress={() => setWithdrawing(true)} fullWidth />
        </Stack>
      ) : null}

      <SubmitSheet
        open={submitting}
        onClose={() => setSubmitting(false)}
        needsReason={needsReason}
        initial={c.justification ?? ''}
        onSubmit={async (reason) => {
          const done = await submit.run(reason || null);
          if (done) setSubmitting(false);
        }}
        pending={submit.pending}
      />
      <ConfirmSheet
        open={withdrawing}
        onClose={() => setWithdrawing(false)}
        title={t('Withdraw this claim?')}
        message={c.receipt_document_id ? t('The draft is cancelled. Its receipt can be used on a new claim.') : t('The draft is cancelled.')}
        confirmLabel={t('Withdraw')}
        cancelLabel={t('Keep it')}
        tone="danger"
        onConfirm={async () => {
          setWithdrawing(false);
          await withdraw.run(undefined);
        }}
      />
    </Screen>
  );
}

function SubmitSheet({
  open,
  onClose,
  needsReason,
  initial,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  needsReason: boolean;
  initial: string;
  onSubmit: (reason: string) => Promise<void>;
  pending: boolean;
}) {
  const [reason, setReason] = useState(initial);
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setReason(initial);
    setTouched(false);
  });
  const error = needsReason && !reason.trim() ? t('This claim is over the limit. Say why before submitting.') : null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Submit this claim?')}
      description={t('It goes to your manager, then finance. Once submitted it cannot be changed.')}
      dirty={reason !== initial}
      footer={
        <Button
          label={t('Submit')}
          variant="accent"
          loading={pending}
          onPress={() => {
            setTouched(true);
            if (!error) void onSubmit(reason.trim());
          }}
          fullWidth
        />
      }
    >
      <TextField
        label={needsReason ? t('Why it is over the limit') : t('Note for your approver')}
        required={needsReason}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={2000}
        error={touched ? error : null}
      />
    </Sheet>
  );
}

const DEFAULT_TIERS: CityTierEnum[] = ['a', 'b', 'c', 'international'];

export function NewExpenseScreen() {
  const navigation = useNavigation();
  const go = useGo();
  const params = useParams<{ amount: string; date: string }>();
  const meta = useMeta();
  const trips = useQuery({ queryKey: ['expenses', 'travel'], queryFn: expensesApi.travel });
  const today = todayISO();

  const [kind, setKind] = useState<ClaimKindEnum>('receipted');
  const [category, setCategory] = useState<string | null>(null);
  const [tier, setTier] = useState<CityTierEnum | null>(null);
  const [date, setDate] = useState<string | null>(params.date && params.date <= today ? params.date : today);
  const [amount, setAmount] = useState(params.amount ?? '');
  const [currency, setCurrency] = useState<string | null>(null);
  const [distance, setDistance] = useState('');
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [days, setDays] = useState('1');
  const [description, setDescription] = useState('');
  const [tripId, setTripId] = useState<string>('none');
  const [file, setFile] = useState<UploadFile | null>(null);
  const [receiptId, setReceiptId] = useState<{ uri: string; id: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);

  const m = meta.data;
  const reporting = m?.reporting_currency ?? 'INR';
  const kinds = m?.claim_kinds.length ? m.claim_kinds : (['receipted', 'mileage', 'per_diem'] as ClaimKindEnum[]);
  const tiers = m?.city_tiers.length ? m.city_tiers : DEFAULT_TIERS;
  const currencies = useMemo(() => Array.from(new Set([reporting, ...(m?.currencies ?? [])])), [m?.currencies, reporting]);
  const approvedTrips = (trips.data ?? []).filter((trip) => trip.status === 'approved');
  const rules = receiptRules(m);
  const chosenCurrency = currency ?? reporting;

  const errors = {
    category: !category?.trim() ? t('Choose a category.') : null,
    tier: !tier ? t('Choose where you spent it.') : null,
    date: !date ? t('Choose the date.') : date > today ? t('The date cannot be in the future.') : null,
    amount: kind === 'receipted' ? validateAmount(amount) : null,
    distance: kind === 'mileage' && validateAmount(distance) ? t('Enter the distance in km, like 12 or 12.5.') : null,
    vehicle: kind === 'mileage' && (m?.vehicle_types.length ?? 0) > 0 && !vehicle ? t('Choose the vehicle.') : null,
    days: kind === 'per_diem' && !(/^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 366) ? t('Enter the number of days, 1 or more.') : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  const capture = useAction(
    async () => {
      let receipt: string | null = null;
      if (kind !== 'per_diem' && file) {
        // Upload once per chosen file, even if saving is tried again.
        receipt = receiptId?.uri === file.uri ? receiptId.id : (await expensesApi.uploadReceipt(file)).id;
        setReceiptId({ uri: file.uri, id: receipt });
      }
      return expensesApi.capture({
        kind,
        category_key: category!.trim(),
        city_tier: tier!,
        amount: kind === 'receipted' ? amount : '0',
        currency: kind === 'receipted' ? chosenCurrency : reporting,
        incurred_on: date!,
        has_receipt: kind === 'per_diem' ? true : Boolean(file),
        receipt_document_id: kind === 'per_diem' ? null : receipt,
        description: description.trim() || null,
        travel_request_id: tripId === 'none' ? null : tripId,
        distance_km: kind === 'mileage' ? distance : null,
        vehicle_type: kind === 'mileage' ? vehicle : null,
        per_diem_days: kind === 'per_diem' ? Number(days) : null,
      });
    },
    { invalidate: [['expenses']] },
  );

  const submit = useAction((justification: string | null) => expensesApi.submit(result!.claim_id, { justification }), {
    success: t('Claim submitted'),
    invalidate: [['expenses'], ['approvals']],
  });
  const revise = useAction((claimId: string) => expensesApi.cancel(claimId), { invalidate: [['expenses']] });

  if (meta.isPending) {
    return (
      <Screen tier="tier1">
        <SkeletonCard lines={6} />
      </Screen>
    );
  }
  if (!m) {
    return (
      <Screen tier="tier1">
        <ErrorState error={meta.error} onRetry={() => void meta.refetch()} />
      </Screen>
    );
  }

  // Step two: the server has judged the claim. Submit it, or keep the draft.
  if (result) {
    const v = verdictOf(result.verdict.kind);
    const needsReason = claimNeedsReason(result.verdict.kind);
    const submittable = claimSubmittable(result.verdict.kind, result.may_submit);
    const reasonError = needsReason && !reason.trim() ? t('This claim is over the limit. Say why before submitting.') : null;
    return (
      <FormScreen
        tier="tier1"
        submitLabel={submittable ? t('Submit claim') : t('Change and check again')}
        onSubmit={async () => {
          if (!submittable) {
            // The draft cannot go anywhere: withdraw it and reopen the form
            // with everything as typed, so a receipt or a trip can be added.
            const withdrawn = await revise.run(result.claim_id);
            if (withdrawn) setResult(null);
            return;
          }
          setReasonTouched(true);
          if (reasonError) return;
          const done = await submit.run(reason.trim() || null);
          if (done) navigation.goBack();
        }}
        secondary={{
          label: t('Keep as draft'),
          onPress: () => {
            navigation.goBack();
            go('ExpenseDetail', { id: result.claim_id });
          },
        }}
      >
        <Card tier="tier1">
          <Stack gap="row">
            <Txt variant="caption" tone="muted">
              {t('Saved as a draft')}
            </Txt>
            <Txt variant="stat" numeric>
              {formatINR(result.amount)}
            </Txt>
            {result.original_currency !== reporting ? (
              <Txt variant="caption" tone="muted">
                {t('{amount} {currency}, converted', { amount: result.original_amount, currency: result.original_currency })}
              </Txt>
            ) : null}
            <Divider />
            <Badge label={t(v.label)} tone={v.tone} />
            <Txt variant="callout">{result.verdict.message}</Txt>
            <KeyValue label={t('Limit')} value={result.verdict.limit_amount === null ? t('No limit') : formatINR(result.verdict.limit_amount)} />
            <KeyValue label={t('Already claimed')} value={formatINR(result.verdict.already_claimed)} />
            {isPositiveAmount(result.verdict.overage) ? <KeyValue label={t('Over the limit')} value={formatINR(result.verdict.overage)} tone="danger" /> : null}
          </Stack>
        </Card>
        {!submittable ? (
          <Notice
            tone="warning"
            message={
              result.verdict.kind === 'receipt_required'
                ? t('This claim needs a receipt, so it cannot be submitted as it is.')
                : result.verdict.kind === 'pre_approval_required'
                  ? t('This claim needs an approved travel request, so it cannot be submitted as it is.')
                  : t('The policy does not allow this claim to be submitted.')
            }
          />
        ) : (
          <TextField
            label={needsReason ? t('Why it is over the limit') : t('Note for your approver')}
            required={needsReason}
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={2000}
            error={reasonTouched ? reasonError : null}
          />
        )}
      </FormScreen>
    );
  }

  const categoryOptions = m.categories.map((key) => ({ value: key, label: categoryLabel(key) }));
  const dirty = Boolean(category || tier || amount || file || description || distance);

  return (
    <FormScreen
      tier="tier1"
      submitLabel={t('Check and save')}
      dirty={dirty}
      submitDisabled={touched && invalid}
      footerNote={
        <Txt variant="caption" tone="muted">
          {t('The policy is checked when you save, before anything is submitted.')}
        </Txt>
      }
      onSubmit={async () => {
        setTouched(true);
        if (invalid) return;
        const captured = await capture.run(undefined);
        if (captured) {
          setReason('');
          setResult(captured);
        }
      }}
    >
      <Stack gap="row">
        {kinds.length > 1 ? (
          <ChoiceField label={t('Type of claim')} value={kind} options={kinds.map((k) => ({ value: k, label: t(KIND_LABEL[k]) }))} onChange={setKind} />
        ) : null}
        {categoryOptions.length ? (
          <SelectField label={t('Category')} required value={category} options={categoryOptions} onChange={setCategory} error={touched ? errors.category : null} />
        ) : (
          <TextField
            label={t('Category')}
            required
            value={category ?? ''}
            onChangeText={setCategory}
            maxLength={64}
            helper={t('Finance has not set categories. Name it yourself; it is recorded with no policy rule.')}
            error={touched ? errors.category : null}
          />
        )}
        <ChoiceField label={t('Where')} required value={tier ?? ''} options={tiers.map((value) => ({ value, label: t(TIER_LABEL[value]) }))} onChange={(v) => setTier(v as CityTierEnum)} error={touched ? errors.tier : null} />
        <DateField label={t('Date spent')} required value={date} onChange={setDate} maximumDate={today} minimumDate={addDays(today, -365)} error={touched ? errors.date : null} />

        {kind === 'receipted' ? (
          <Row>
            <View style={styles.flex}>
              <AmountField
                label={t('Amount')}
                required
                value={amount}
                onChangeText={setAmount}
                prefix={chosenCurrency === 'INR' ? '₹' : ''}
                error={touched ? errors.amount : null}
              />
            </View>
            {currencies.length > 1 ? (
              <View style={styles.currency}>
                <SelectField label={t('Currency')} value={chosenCurrency} options={currencies.map((c) => ({ value: c, label: c }))} onChange={setCurrency} />
              </View>
            ) : null}
          </Row>
        ) : null}

        {kind === 'mileage' ? (
          <>
            <AmountField
              label={t('Distance (km)')}
              required
              value={distance}
              onChangeText={setDistance}
              prefix=""
              error={touched ? errors.distance : null}
              helper={t('Paid at the company’s rate per km.')}
            />
            {m.vehicle_types.length ? (
              <ChoiceField label={t('Vehicle')} value={vehicle ?? ''} options={m.vehicle_types.map((v) => ({ value: v, label: categoryLabel(v) }))} onChange={setVehicle} error={touched ? errors.vehicle : null} />
            ) : (
              <Notice tone="warning" message={t('Finance has not set mileage rates yet, so a mileage claim cannot be valued.')} />
            )}
          </>
        ) : null}

        {kind === 'per_diem' ? (
          <>
            <TextField
              label={t('Days')}
              required
              value={days}
              onChangeText={(v) => setDays(v.replace(/\D/g, '').slice(0, 3))}
              keyboardType="number-pad"
              error={touched ? errors.days : null}
            />
            <Txt variant="caption" tone="muted">
              {t('A daily allowance needs no receipt: it is paid at the daily rate for where you were.')}
            </Txt>
          </>
        ) : null}

        <TextField label={t('What was it for?')} value={description} onChangeText={setDescription} maxLength={500} placeholder={t('Optional')} />

        {kind !== 'per_diem' ? (
          <AttachField
            label={t('Receipt')}
            value={file}
            onChange={(chosen) => {
              setFile(chosen);
              setReceiptId(null);
            }}
            rules={rules}
          />
        ) : null}

        {approvedTrips.length ? (
          <SelectField
            label={t('Trip')}
            value={tripId}
            options={[{ value: 'none', label: t('Not part of a trip') }, ...approvedTrips.map((trip) => ({ value: trip.id, label: trip.purpose, description: formatRange(trip.from_date, trip.to_date) }))]}
            onChange={setTripId}
          />
        ) : null}
      </Stack>
    </FormScreen>
  );
}

export function AdvancesScreen() {
  const advances = useQuery({ queryKey: ['expenses', 'advances'], queryFn: expensesApi.advances });
  return (
    <Screen tier="tier1" onRefresh={() => advances.refetch()}>
      <QueryView
        query={advances}
        skeleton={<SkeletonList rows={3} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState spot="cash" title={t('No advances')} message={t('An advance is given against an approved travel request.')} />}
      >
        {(data) => (
          <Stack gap="row">
            {data.map((a) => (
              <Card key={a.id} tier="tier1">
                <Stack gap="tight">
                  <View style={styles.titleRow}>
                    <Txt variant="headline" style={styles.flex}>
                      {a.trip_purpose ?? t('Trip advance')}
                    </Txt>
                    <StatusBadge status={a.status} />
                  </View>
                  <KeyValue label={t('Given')} value={formatINR(a.amount)} />
                  <KeyValue label={t('Issued')} value={formatDate(a.issued_on)} />
                  <KeyValue label={t('Claimed against it')} value={formatINR(a.claimed_against)} />
                  <KeyValue label={t('Still to account for')} value={formatINR(a.outstanding)} strong tone={isPositiveAmount(a.outstanding) ? 'warning' : 'default'} />
                  {a.is_blocking ? (
                    <Txt variant="caption" tone="danger">
                      {tn(a.age_days, 'Open for {count} day. Settle it before a new advance can be given.', 'Open for {count} days. Settle it before a new advance can be given.')}
                    </Txt>
                  ) : null}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </QueryView>
    </Screen>
  );
}

export function TravelRequestsScreen() {
  const trips = useQuery({ queryKey: ['expenses', 'travel'], queryFn: expensesApi.travel });
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<TravelRequestRead | null>(null);
  const cancel = useAction((id: string) => expensesApi.cancelTravel(id), { success: t('Travel request cancelled'), invalidate: [['expenses'], ['approvals']] });
  return (
    <Screen onRefresh={() => trips.refetch()}>
      <Button label={t('New travel request')} icon={Plus} variant="accent" onPress={() => setCreating(true)} fullWidth />
      <QueryView
        query={trips}
        skeleton={<SkeletonList rows={3} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState spot="plane" title={t('No travel requests')} message={t('Ask before a work trip, so claims for it can be approved.')} />}
      >
        {(data) => (
          <Stack gap="row">
            {data.map((trip) => {
              const places = trip.destinations
                .map((d) => (typeof d.city === 'string' ? d.city : null))
                .filter(Boolean)
                .join(', ');
              return (
                <Card key={trip.id}>
                  <Stack gap="tight">
                    <View style={styles.titleRow}>
                      <Txt variant="headline" style={styles.flex}>
                        {trip.purpose}
                      </Txt>
                      <StatusBadge status={trip.status === 'pending_manager' ? 'awaiting_manager' : trip.status} />
                    </View>
                    <Txt variant="callout" tone="muted">
                      {formatRange(trip.from_date, trip.to_date)}
                      {places ? ` · ${places}` : ''}
                    </Txt>
                    <KeyValue label={t('Estimated cost')} value={formatINR(trip.estimated_cost)} />
                    {isPositiveAmount(trip.advance_requested) ? <KeyValue label={t('Advance asked for')} value={formatINR(trip.advance_requested)} /> : null}
                    {isPositiveAmount(trip.advance_issued) ? <KeyValue label={t('Advance given')} value={formatINR(trip.advance_issued)} /> : null}
                    {['pending_manager', 'submitted', 'draft'].includes(trip.status) ? (
                      <View style={styles.actions}>
                        <Button label={t('Cancel request')} variant="ghost" size="sm" onPress={() => setCancelling(trip)} />
                      </View>
                    ) : null}
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </QueryView>
      <TravelSheet open={creating} onClose={() => setCreating(false)} />
      <ConfirmSheet
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={t('Cancel this travel request?')}
        message={cancelling?.purpose}
        confirmLabel={t('Cancel request')}
        cancelLabel={t('Keep it')}
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

function TravelSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = todayISO();
  const [purpose, setPurpose] = useState('');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [tier, setTier] = useState<CityTierEnum | ''>('');
  const [cost, setCost] = useState('');
  const [advance, setAdvance] = useState('');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setPurpose('');
    setFrom(null);
    setTo(null);
    setCity('');
    setTier('');
    setCost('');
    setAdvance('');
    setTouched(false);
  });
  const errors = {
    purpose: !purpose.trim() ? t('Say what the trip is for.') : null,
    from: !from ? t('Choose the first day.') : null,
    to: !to ? t('Choose the last day.') : from && to < from ? t('The trip cannot end before it starts.') : null,
    cost: cost ? validateAmount(cost, { allowZero: true }) : null,
    advance: advance ? validateAmount(advance, { allowZero: true }) : null,
  };
  if (!errors.advance && cost && advance && compareDecimals(advance, cost) === 1) errors.advance = t('The advance cannot be more than the estimated cost.');
  const invalid = Object.values(errors).some(Boolean);
  const save = useAction(
    () =>
      expensesApi.requestTravel({
        purpose: purpose.trim(),
        from_date: from!,
        to_date: to!,
        destinations: city.trim() ? [{ city: city.trim(), ...(tier ? { city_tier: tier } : {}) }] : [],
        estimated_cost: cost || '0',
        advance_requested: advance || '0',
      }),
    {
      success: t('Travel request sent'),
      invalidate: [['expenses'], ['approvals']],
      onSuccess: () => {
        setPurpose('');
        setFrom(null);
        setTo(null);
        setCity('');
        setTier('');
        setCost('');
        setAdvance('');
        setTouched(false);
        onClose();
      },
    },
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('New travel request')}
      scrollable
      dirty={Boolean(purpose || from || to || city || cost || advance)}
      footer={
        <Button
          label={t('Send request')}
          variant="accent"
          loading={save.pending}
          onPress={() => {
            setTouched(true);
            if (!invalid) void save.run(undefined);
          }}
          fullWidth
        />
      }
    >
      <TextField label={t('Purpose')} required value={purpose} onChangeText={setPurpose} maxLength={2000} error={touched ? errors.purpose : null} placeholder={t('Client visit, conference…')} />
      <Row>
        <View style={styles.flex}>
          <DateField label={t('From')} required value={from} onChange={setFrom} minimumDate={addDays(today, -30)} error={touched ? errors.from : null} />
        </View>
        <View style={styles.flex}>
          <DateField label={t('To')} required value={to} onChange={setTo} minimumDate={from ?? addDays(today, -30)} error={touched ? errors.to : null} />
        </View>
      </Row>
      <TextField label={t('City')} value={city} onChangeText={setCity} maxLength={120} />
      {city.trim() ? (
        <ChoiceField label={t('City tier')} value={tier} options={DEFAULT_TIERS.map((value) => ({ value, label: t(TIER_LABEL[value]) }))} onChange={(v) => setTier(v as CityTierEnum)} />
      ) : null}
      <AmountField label={t('Estimated cost')} value={cost} onChangeText={setCost} error={touched ? errors.cost : null} />
      <AmountField label={t('Advance needed')} value={advance} onChangeText={setAdvance} error={touched ? errors.advance : null} helper={t('Leave empty if you do not need money in advance.')} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  currency: { width: 112 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});

