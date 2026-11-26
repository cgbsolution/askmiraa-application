/**
 * Tax: regime (compare and choose), declarations with proofs, house rent,
 * previous employer, the year's projection, Form 12BB and Form 16.
 *
 * Tier 1 — a declaration changes the TDS taken from every payslip.
 * Declarations open and close with the company's windows; outside a window
 * the screens are read-only and say so.
 */

import { useQuery } from '@tanstack/react-query';
import { Building2, FileText, Home, Landmark, Upload } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { taxApi, type RegimeComparison, type RegimeFigures } from '../../api/tax';
import { AttachField } from '../../components/AttachField';
import { Badge, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { AmountField, ChoiceField, SelectField, SwitchRow, TextField } from '../../components/Field';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { Money, RevealToggle, useMoneyText, withReveal } from '../../components/Money';
import { AskMiraChip } from '../../components/mira/AskMiraChip';
import { Row, Screen, Section, Stack } from '../../components/Screen';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, Notice, QueryView } from '../../components/States';
import { useResetOnOpen } from '../../components/sheetContext';
import { Txt } from '../../components/Text';
import { validateAmount } from '../../core/amount';
import { financialYear, formatDate, todayISO } from '../../core/dates';
import { formatINR, isPositiveAmount } from '../../core/money';
import { editable, fyMonths, rentSeed } from '../../core/tax';
import { statusLabel } from '../../core/status';
import type { DeclarationRead, HouseRentRead, PreviousEmployerRead } from '../../core/types';
import { checks } from '../../core/validators';
import type { UploadFile } from '../../lib/api';
import { openDownloaded } from '../../lib/files';
import { t } from '../../lib/i18n';
import { useAction } from '../../lib/useAction';
import { useGo } from '../../navigation/navigate';
import { layout, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

function useFy() {
  return financialYear(todayISO());
}

function useWindows(fy: string) {
  const windows = useQuery({ queryKey: ['tax', 'windows', fy], queryFn: () => taxApi.windows(fy) });
  const declaration = windows.data?.find((w) => w.window_type === 'declaration');
  const proof = windows.data?.find((w) => w.window_type === 'proof');
  return { windows, declarationOpen: Boolean(declaration?.is_open), proofOpen: Boolean(proof?.is_open), declaration, proof };
}

/** Gross income is salary: the figures hide and show together, as on the pay screens. */
export const TaxScreen = withReveal(function TaxBody() {
  const go = useGo();
  const money = useMoneyText();
  const fy = useFy();
  const { windows, declaration, proof } = useWindows(fy);
  const regime = useQuery({ queryKey: ['tax', 'regime', fy], queryFn: () => taxApi.regime(fy) });
  const projection = useQuery({ queryKey: ['tax', 'projection', fy], queryFn: () => taxApi.projection(fy) as Promise<unknown> as Promise<RegimeFigures> });

  return (
    <Screen onRefresh={() => Promise.all([windows.refetch(), regime.refetch(), projection.refetch()])}>
      <Txt variant="callout" tone="muted">
        {t('Financial year {fy}', { fy })}
      </Txt>
      <QueryView query={projection} skeleton={<SkeletonCard lines={4} />}>
        {(data) => (
          <Card>
            <Stack gap="tight">
              <Txt variant="caption" tone="muted">
                {t('Projected tax for the year')}
              </Txt>
              <Money value={data.annual_tax_liability} variant="stat" masked options={{ trimZeros: true }} />
              <KeyValue label={t('Regime')} value={t(data.regime === 'old' ? 'Old regime' : 'New regime')} />
              <KeyValue label={t('Gross income')} value={money(data.gross_annual_income, { trimZeros: true })} />
              <KeyValue label={t('Deductions')} value={money(data.total_deductions, { trimZeros: true })} />
              <KeyValue label={t('Taxable income')} value={money(data.taxable_income, { trimZeros: true })} strong />
              <Txt variant="caption" tone="subtle">
                {t('A projection from your salary and declarations, not tax advice.')}
              </Txt>
            </Stack>
          </Card>
        )}
      </QueryView>

      <Section title={t('Windows')}>
        <ListGroup>
          <ListRow
            title={t('Declarations')}
            subtitle={declaration ? `${formatDate(declaration.opens_at)} – ${formatDate(declaration.closes_at)}` : t('Not opened yet')}
            trailing={<Badge label={declaration?.is_open ? t('Open') : t('Closed')} tone={declaration?.is_open ? 'success' : 'neutral'} />}
          />
          <ListRow
            title={t('Proofs')}
            subtitle={proof ? `${formatDate(proof.opens_at)} – ${formatDate(proof.closes_at)}` : t('Not opened yet')}
            trailing={<Badge label={proof?.is_open ? t('Open') : t('Closed')} tone={proof?.is_open ? 'success' : 'neutral'} />}
          />
        </ListGroup>
      </Section>

      <Section>
        <ListGroup>
          <ListRow
            spot="toggle"
            title={t('Tax regime')}
            subtitle={regime.data ? t('{regime}, chosen {date}', { regime: t(regime.data.regime === 'old' ? 'Old regime' : 'New regime'), date: formatDate(regime.data.elected_at) }) : t('Compare and choose')}
            onPress={() => go('TaxRegime')}
          />
          <ListRow spot="fileSend" title={t('Declarations and proofs')} subtitle={t('80C, 80D, rent, previous employer')} onPress={() => go('TaxDeclarations')} />
          <ListRow spot="certificate" title={t('Form 16')} onPress={() => go('Form16')} />
        </ListGroup>
      </Section>
      <View style={styles.chips}>
        <AskMiraChip question={t('How can I save tax this year?')} />
      </View>
    </Screen>
  );
});

/** Both regimes side by side: one row per figure, so nothing wraps mid-word. */
function RegimeTable({ comparison }: { comparison: RegimeComparison }) {
  const { colors } = useTheme();
  const money = useMoneyText();
  const { old: oldRegime, new: newRegime } = comparison.regimes;
  const lower = comparison.lower_liability_regime;
  const rows: { label: string; key: keyof RegimeFigures; strong?: boolean }[] = [
    { label: t('Tax for the year'), key: 'annual_tax_liability', strong: true },
    { label: t('Gross income'), key: 'gross_annual_income' },
    { label: t('Exemptions'), key: 'total_exemptions' },
    { label: t('Deductions'), key: 'total_deductions' },
    { label: t('Taxable income'), key: 'taxable_income' },
  ];
  const cell = (figures: RegimeFigures, key: keyof RegimeFigures, strong?: boolean) => (
    <Txt variant={strong ? 'bodyStrong' : 'callout'} numeric style={styles.cell} numberOfLines={1} adjustsFontSizeToFit>
      {money(figures[key] as string, { trimZeros: true })}
    </Txt>
  );
  return (
    <Card padded="none">
      <View style={[styles.tableRow, styles.tableHead, { borderColor: colors.divider }]}>
        <View style={styles.labelCell} />
        {(['new', 'old'] as const).map((key) => (
          <View key={key} style={styles.headCell}>
            <Txt variant="label" tone={key === lower ? 'success' : 'muted'} style={styles.cellText}>
              {t(key === 'new' ? 'New regime' : 'Old regime')}
            </Txt>
            {key === lower ? <Badge label={t('Lower tax')} tone="success" /> : null}
          </View>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={row.key} style={[styles.tableRow, index < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider }]}>
          <Txt variant={row.strong ? 'bodyStrong' : 'callout'} tone={row.strong ? 'default' : 'muted'} style={styles.labelCell}>
            {row.label}
          </Txt>
          {cell(newRegime, row.key, row.strong)}
          {cell(oldRegime, row.key, row.strong)}
        </View>
      ))}
    </Card>
  );
}

export const TaxRegimeScreen = withReveal(function TaxRegimeBody() {
  const fy = useFy();
  const money = useMoneyText();
  const regime = useQuery({ queryKey: ['tax', 'regime', fy], queryFn: () => taxApi.regime(fy) });
  const compare = useQuery({ queryKey: ['tax', 'compare', fy], queryFn: () => taxApi.compare(fy) });
  const [choosing, setChoosing] = useState<'old' | 'new' | null>(null);
  const choose = useAction((r: 'old' | 'new') => taxApi.chooseRegime(fy, r), {
    success: t('Regime saved. Your next payslip uses it.'),
    invalidate: [['tax']],
  });
  const locked = Boolean(regime.data?.locked_at);

  return (
    <Screen onRefresh={() => Promise.all([regime.refetch(), compare.refetch()])}>
      <QueryView query={compare} skeleton={<SkeletonCard lines={5} />}>
        {(data) => (
          <>
            <RevealToggle />
            <RegimeTable comparison={data} />
            <Notice
              tone="info"
              message={
                isPositiveAmount(data.saving)
                  ? t('On what you have declared so far, the {regime} means {amount} less tax this year. A projection, not tax advice.', {
                      regime: t(data.lower_liability_regime === 'new' ? 'new regime' : 'old regime'),
                      amount: money(data.saving, { trimZeros: true }),
                    })
                  : t('On what you have declared so far, both regimes come to the same tax. A projection, not tax advice.')
              }
            />
            {data.regimes[data.lower_liability_regime].pending_if_unclaimed.length ? (
              <Section
                title={t('Taxable unless you claim it')}
                description={t('Allowances with no accepted bill become taxable salary at the end of the year.')}
              >
                <ListGroup>
                  {data.regimes[data.lower_liability_regime].pending_if_unclaimed.map((item, index) => (
                    <ListRow
                      key={`${item.code}-${index}`}
                      title={item.label.replace(/^Unclaimed\s+/i, '')}
                      value={money(item.amount, { trimZeros: true })}
                    />
                  ))}
                </ListGroup>
              </Section>
            ) : null}
          </>
        )}
      </QueryView>

      {regime.data ? (
        <Card variant="sunken">
          <Stack gap="tight">
            <KeyValue label={t('Your choice')} value={t(regime.data.regime === 'old' ? 'Old regime' : 'New regime')} strong />
            {regime.data.locked_at ? (
              <Txt variant="caption" tone="muted">
                {t('Locked on {date}. To change it now, ask HR.', { date: formatDate(regime.data.locked_at) })}
              </Txt>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {!locked ? (
        <Row>
          <View style={styles.flex}>
            <Button label={t('Choose new')} variant={regime.data?.regime === 'new' ? 'secondary' : 'accent'} onPress={() => setChoosing('new')} disabled={regime.data?.regime === 'new'} fullWidth />
          </View>
          <View style={styles.flex}>
            <Button label={t('Choose old')} variant={regime.data?.regime === 'old' ? 'secondary' : 'accent'} onPress={() => setChoosing('old')} disabled={regime.data?.regime === 'old'} fullWidth />
          </View>
        </Row>
      ) : null}

      <ConfirmSheet
        open={choosing !== null}
        onClose={() => setChoosing(null)}
        title={t('Switch to the {regime}?', { regime: t(choosing === 'old' ? 'Old regime' : 'New regime') })}
        message={t('Tax on your remaining payslips this year is worked out again under it.')}
        confirmLabel={t('Switch')}
        tone="accent"
        onConfirm={async () => {
          const target = choosing;
          setChoosing(null);
          if (target) await choose.run(target);
        }}
      />
    </Screen>
  );
});

const COMMON_SECTIONS = ['80C', '80D', '80CCD1B', '80E', '80G', '80TTA', '24B', 'LTA'];

export function TaxDeclarationsScreen() {
  const fy = useFy();
  const { windows, declarationOpen, proofOpen } = useWindows(fy);
  const declarations = useQuery({ queryKey: ['tax', 'declarations', fy], queryFn: () => taxApi.declarations(fy) });
  const houseRent = useQuery({ queryKey: ['tax', 'house-rent', fy], queryFn: () => taxApi.houseRent(fy) });
  const previous = useQuery({ queryKey: ['tax', 'previous-employer', fy], queryFn: () => taxApi.previousEmployer(fy) });
  const [adding, setAdding] = useState(false);
  const [proofFor, setProofFor] = useState<DeclarationRead | null>(null);
  const [submitting, setSubmitting] = useState<DeclarationRead | null>(null);
  const [rentOpen, setRentOpen] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const submit = useAction((id: string) => taxApi.submitDeclaration(id), { success: t('Submitted'), invalidate: [['tax']] });

  return (
    <Screen onRefresh={() => Promise.all([windows.refetch(), declarations.refetch(), houseRent.refetch(), previous.refetch()])}>
      {windows.isSuccess && !declarationOpen ? <Notice tone="info" message={t('The declaration window is closed, so these are read-only.')} /> : null}

      <Section title={t('Investments and expenses')} action={declarationOpen ? { label: t('Add'), onPress: () => setAdding(true) } : undefined}>
        <QueryView
          query={declarations}
          skeleton={<SkeletonList rows={3} />}
          isEmpty={(data) => data.length === 0}
          empty={<EmptyState inline spot="fileSend" title={t('Nothing declared yet')} message={t('Add what you plan to claim — PPF, insurance, tuition fees — so less tax is taken each month.')} />}
        >
          {(data) => (
            <Stack gap="row">
              {data.map((d) => (
                <Card key={d.id}>
                  <Stack gap="tight">
                    <View style={styles.titleRow}>
                      <Txt variant="headline" style={styles.flex}>
                        {d.section}
                        {d.sub_category ? ` · ${d.sub_category}` : ''}
                      </Txt>
                      <StatusBadge status={d.status} />
                    </View>
                    {d.description ? (
                      <Txt variant="callout" tone="muted">
                        {d.description}
                      </Txt>
                    ) : null}
                    <KeyValue label={t('Declared')} value={formatINR(d.declared_amount, { trimZeros: true })} />
                    {d.status === 'locked' || isPositiveAmount(d.accepted_amount) ? <KeyValue label={t('Accepted')} value={formatINR(d.accepted_amount, { trimZeros: true })} /> : null}
                    {d.proofs.map((proof) => (
                      <View key={proof.id} style={styles.proof}>
                        <Txt variant="caption" style={styles.flex}>
                          {t('Proof of {amount}', { amount: formatINR(proof.proof_amount, { trimZeros: true }) })}
                          {proof.verifier_remarks ? ` — “${proof.verifier_remarks}”` : ''}
                        </Txt>
                        <StatusBadge status={proof.status} />
                      </View>
                    ))}
                    <Row gap="inline">
                      {d.status === 'draft' && declarationOpen ? (
                        <Button label={t('Submit')} size="sm" variant="primary" onPress={() => setSubmitting(d)} />
                      ) : null}
                      {proofOpen && d.status !== 'draft' ? (
                        <Button label={t('Add proof')} icon={Upload} size="sm" variant="secondary" onPress={() => setProofFor(d)} />
                      ) : null}
                    </Row>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </QueryView>
      </Section>

      <Section title={t('Other income details')}>
        <ListGroup>
          <ListRow
            icon={Home}
            title={t('House rent (HRA)')}
            subtitle={houseRent.data ? t('{amount} a year · {status}', { amount: formatINR(houseRent.data.annual_rent, { trimZeros: true }), status: t(statusLabel(houseRent.data.status)) }) : t('Not added')}
            onPress={declarationOpen ? () => setRentOpen(true) : undefined}
          />
          <ListRow
            icon={Building2}
            title={t('Previous employer this year')}
            subtitle={previous.data ? `${previous.data.employer_name ?? ''} · ${formatINR(previous.data.gross_salary, { trimZeros: true })}` : t('Not added')}
            onPress={declarationOpen ? () => setPrevOpen(true) : undefined}
          />
        </ListGroup>
      </Section>

      <DeclarationSheet open={adding} onClose={() => setAdding(false)} fy={fy} />
      <ProofSheet declaration={proofFor} onClose={() => setProofFor(null)} />
      <HouseRentSheet open={rentOpen} onClose={() => setRentOpen(false)} fy={fy} current={houseRent.data ?? null} />
      <PreviousEmployerSheet open={prevOpen} onClose={() => setPrevOpen(false)} fy={fy} current={previous.data ?? null} />
      <ConfirmSheet
        open={submitting !== null}
        onClose={() => setSubmitting(null)}
        title={t('Submit {section}?', { section: submitting?.section ?? '' })}
        message={t('Payroll uses it from the next run. You can still add proof later.')}
        confirmLabel={t('Submit')}
        onConfirm={async () => {
          const target = submitting;
          setSubmitting(null);
          if (target) await submit.run(target.id);
        }}
      />
    </Screen>
  );
}

function DeclarationSheet({ open, onClose, fy }: { open: boolean; onClose: () => void; fy: string }) {
  const [section, setSection] = useState('80C');
  const [other, setOther] = useState('');
  const [sub, setSub] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setSection('80C');
    setOther('');
    setSub('');
    setAmount('');
    setNote('');
    setTouched(false);
  });
  const code = section === 'OTHER' ? other.trim().toUpperCase() : section;
  const codeError = !/^[A-Z0-9]{2,16}$/.test(code) ? t('Use 2–16 letters or digits, like 80C or 24B.') : null;
  const amountError = validateAmount(amount);
  const save = useAction(
    () => taxApi.saveDeclaration({ financial_year: fy, section: code, sub_category: sub.trim(), declared_amount: amount, description: note.trim() || null }),
    {
      success: t('Saved as a draft. Submit it when you are ready.'),
      invalidate: [['tax']],
      onSuccess: () => {
        setAmount('');
        setSub('');
        setNote('');
        setTouched(false);
        onClose();
      },
    },
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Add a declaration')}
      scrollable
      dirty={Boolean(amount || sub || note || other)}
      footer={
        <Button
          label={t('Save')}
          variant="accent"
          loading={save.pending}
          onPress={() => {
            setTouched(true);
            if (!codeError && !amountError) void save.run(undefined);
          }}
          fullWidth
        />
      }
    >
      <ChoiceField
        label={t('Section')}
        required
        value={section}
        options={[...COMMON_SECTIONS, 'OTHER'].map((value) => ({ value, label: value === 'OTHER' ? t('Other') : value }))}
        onChange={setSection}
      />
      {section === 'OTHER' ? <TextField label={t('Section code')} value={other} onChangeText={(v) => setOther(v.toUpperCase())} autoCapitalize="characters" maxLength={16} error={touched ? codeError : null} /> : null}
      <TextField label={t('What is it?')} value={sub} onChangeText={setSub} placeholder={t('PPF, ELSS, life insurance…')} maxLength={64} />
      <AmountField label={t('Amount for the year')} required value={amount} onChangeText={setAmount} error={touched ? amountError : null} />
      <TextField label={t('Note')} value={note} onChangeText={setNote} maxLength={255} />
    </Sheet>
  );
}

function ProofSheet({ declaration, onClose }: { declaration: DeclarationRead | null; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<UploadFile | null>(null);
  const [touched, setTouched] = useState(false);
  useResetOnOpen(declaration !== null, () => {
    setAmount('');
    setFile(null);
    setTouched(false);
  });
  const amountError = validateAmount(amount, declaration ? { max: declaration.declared_amount } : {});
  const send = useAction(() => taxApi.uploadProof(declaration!.id, amount, file!), {
    success: t('Proof sent for checking'),
    invalidate: [['tax']],
    onSuccess: () => {
      setAmount('');
      setFile(null);
      setTouched(false);
      onClose();
    },
  });
  return (
    <Sheet
      open={declaration !== null}
      onClose={onClose}
      title={t('Proof for {section}', { section: declaration?.section ?? '' })}
      description={declaration ? t('Declared {amount}', { amount: formatINR(declaration.declared_amount, { trimZeros: true }) }) : undefined}
      scrollable
      dirty={Boolean(amount || file)}
      footer={
        <Button
          label={t('Send proof')}
          variant="accent"
          loading={send.pending}
          onPress={() => {
            setTouched(true);
            if (!amountError && file) void send.run(undefined);
          }}
          fullWidth
        />
      }
    >
      <AmountField label={t('Amount this proof shows')} required value={amount} onChangeText={setAmount} error={touched ? amountError : null} />
      <AttachField label={t('Receipt or certificate')} required value={file} onChange={setFile} rules={{ types: ['image/*', 'application/pdf'] }} error={touched && !file ? t('Attach the proof.') : null} />
    </Sheet>
  );
}

function HouseRentSheet({ open, onClose, fy, current }: { open: boolean; onClose: () => void; fy: string; current: HouseRentRead | null }) {
  const months = useMemo(() => fyMonths(fy), [fy]);
  const seed = useMemo(() => rentSeed(current, months), [current, months]);
  const [rent, setRent] = useState(seed.rent);
  const [from, setFrom] = useState(seed.from);
  const [to, setTo] = useState(seed.to);
  const [landlord, setLandlord] = useState(seed.landlord);
  const [pan, setPan] = useState(seed.pan);
  const [address, setAddress] = useState(seed.address);
  const [metro, setMetro] = useState(seed.metro);
  const [touched, setTouched] = useState(false);
  // Each time it opens, start from what is saved now.
  useEffect(() => {
    if (!open) return;
    setRent(seed.rent);
    setFrom(seed.from);
    setTo(seed.to);
    setLandlord(seed.landlord);
    setPan(seed.pan);
    setAddress(seed.address);
    setMetro(seed.metro);
    setTouched(false);
  }, [open, seed]);
  const dirty =
    JSON.stringify([rent, from, to, landlord, pan, address, metro]) !==
    JSON.stringify([seed.rent, seed.from, seed.to, seed.landlord, seed.pan, seed.address, seed.metro]);
  const rentError = validateAmount(rent);
  const rangeError = Number(to) < Number(from) ? t('The last month must be after the first.') : null;
  const panError = pan.trim() ? checks.pan(pan) : null;
  const save = useAction(
    () =>
      taxApi.saveHouseRent({
        financial_year: fy,
        monthly_rent: months.slice(Number(from), Number(to) + 1).map((m) => ({ month: m.month, year: m.year, rent })),
        landlord_name: landlord.trim() || null,
        landlord_pan: pan.trim().toUpperCase() || null,
        property_address: address.trim() || null,
        is_metro: metro,
      }),
    { success: t('Rent saved'), invalidate: [['tax']], onSuccess: onClose },
  );
  const options = months.map((m, i) => ({ value: String(i), label: m.label }));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('House rent')}
      description={t('For the HRA exemption under the old regime.')}
      scrollable
      dirty={dirty}
      footer={
        <Button
          label={t('Save')}
          variant="accent"
          loading={save.pending}
          onPress={() => {
            setTouched(true);
            if (!rentError && !rangeError && !panError) void save.run(undefined);
          }}
          fullWidth
        />
      }
    >
      {seed.uneven ? <Notice tone="info" message={t('Your saved rent differs by month. Saving here sets one amount for the months you choose.')} /> : null}
      <AmountField label={t('Rent per month')} required value={rent} onChangeText={setRent} error={touched ? rentError : null} />
      <SelectField label={t('From')} value={from} options={options} onChange={setFrom} />
      <SelectField label={t('To')} value={to} options={options} onChange={setTo} error={rangeError} />
      <TextField label={t('Landlord’s name')} value={landlord} onChangeText={setLandlord} maxLength={255} />
      <TextField label={t('Landlord’s PAN')} value={pan} onChangeText={(v) => setPan(v.toUpperCase())} autoCapitalize="characters" maxLength={10} helper={t('Needed when rent is over ₹1,00,000 a year.')} error={panError} />
      <TextField label={t('Address of the house')} value={address} onChangeText={setAddress} multiline maxLength={2000} />
      <SwitchRow label={t('In a metro city')} description={t('Delhi, Mumbai, Kolkata or Chennai.')} value={metro} onChange={setMetro} />
    </Sheet>
  );
}

function PreviousEmployerSheet({ open, onClose, fy, current }: { open: boolean; onClose: () => void; fy: string; current: PreviousEmployerRead | null }) {
  const seed = useMemo(
    () => ({
      name: current?.employer_name ?? '',
      gross: editable(current?.gross_salary),
      tds: editable(current?.tds_deducted),
      pf: editable(current?.pf_deducted),
      pt: editable(current?.professional_tax),
    }),
    [current],
  );
  const [name, setName] = useState(seed.name);
  const [gross, setGross] = useState(seed.gross);
  const [tds, setTds] = useState(seed.tds);
  const [pf, setPf] = useState(seed.pf);
  const [pt, setPt] = useState(seed.pt);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(seed.name);
    setGross(seed.gross);
    setTds(seed.tds);
    setPf(seed.pf);
    setPt(seed.pt);
    setTouched(false);
  }, [open, seed]);
  const dirty = JSON.stringify([name, gross, tds, pf, pt]) !== JSON.stringify([seed.name, seed.gross, seed.tds, seed.pf, seed.pt]);
  const grossError = validateAmount(gross);
  const save = useAction(
    () =>
      taxApi.savePreviousEmployer({
        financial_year: fy,
        employer_name: name.trim() || null,
        gross_salary: gross,
        tds_deducted: tds || '0',
        pf_deducted: pf || '0',
        professional_tax: pt || '0',
      }),
    { success: t('Saved'), invalidate: [['tax']], onSuccess: onClose },
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Previous employer')}
      description={t('If you joined this year, what your last employer paid and deducted.')}
      scrollable
      dirty={dirty}
      footer={
        <Button
          label={t('Save')}
          variant="accent"
          loading={save.pending}
          onPress={() => {
            setTouched(true);
            if (!grossError) void save.run(undefined);
          }}
          fullWidth
        />
      }
    >
      <TextField label={t('Employer')} value={name} onChangeText={setName} maxLength={255} />
      <AmountField label={t('Gross salary')} required value={gross} onChangeText={setGross} error={touched ? grossError : null} />
      <AmountField label={t('TDS deducted')} value={tds} onChangeText={setTds} />
      <AmountField label={t('PF deducted')} value={pf} onChangeText={setPf} />
      <AmountField label={t('Professional tax')} value={pt} onChangeText={setPt} />
    </Sheet>
  );
}

export const Form16Screen = withReveal(function Form16Body() {
  const fy = useFy();
  const money = useMoneyText();
  const years = useQuery({ queryKey: ['tax', 'form16'], queryFn: taxApi.form16 });
  const twelveBB = useQuery({ queryKey: ['tax', '12bb', fy], queryFn: () => taxApi.form12bbDocuments(fy) });
  const [opening, setOpening] = useState<string | null>(null);
  return (
    <Screen onRefresh={() => Promise.all([years.refetch(), twelveBB.refetch()])}>
      <Section title={t('Form 16')}>
        <QueryView query={years} isEmpty={(d) => d.length === 0} empty={<EmptyState inline spot="certificate" title={t('No Form 16 yet')} />}>
          {(data) => (
            <Stack gap="row">
              {data.some((y) => y.available && (y.taxable_income || y.tds_deducted)) ? <RevealToggle /> : null}
              {data.map((year) => (
                <Card key={year.financial_year}>
                  <Stack gap="tight">
                    <Txt variant="headline">{t('FY {fy} (AY {ay})', { fy: year.financial_year, ay: year.assessment_year })}</Txt>
                    {year.available ? (
                      <>
                        {year.taxable_income ? <KeyValue label={t('Taxable income')} value={money(year.taxable_income, { trimZeros: true })} /> : null}
                        {year.tds_deducted ? <KeyValue label={t('TDS deducted')} value={money(year.tds_deducted, { trimZeros: true })} /> : null}
                        <Button
                          label={t('Open Form 16')}
                          icon={FileText}
                          variant="primary"
                          loading={opening === year.financial_year}
                          onPress={async () => {
                            setOpening(year.financial_year);
                            await openDownloaded(taxApi.form16Path(year.financial_year), `form16-${year.financial_year}.pdf`);
                            setOpening(null);
                          }}
                        />
                      </>
                    ) : (
                      <Txt variant="callout" tone="muted">
                        {year.reason}
                      </Txt>
                    )}
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </QueryView>
      </Section>
      <Section title={t('Form 12BB')} description={t('Your declarations as issued by HR.')}>
        <QueryView query={twelveBB} isEmpty={(d) => d.length === 0} empty={<Txt variant="callout" tone="muted">{t('Not issued yet.')}</Txt>}>
          {(data) => (
            <ListGroup>
              {data.map((doc) => (
                <ListRow
                  key={doc.letter_id}
                  icon={Landmark}
                  title={doc.reference_number}
                  subtitle={doc.issued_at ? formatDate(doc.issued_at) : t(statusLabel(doc.status))}
                  onPress={() => void openDownloaded(taxApi.form12bbPdfPath(doc.letter_id), `form12bb-${doc.reference_number.replace(/\W+/g, '-')}.pdf`)}
                />
              ))}
            </ListGroup>
          )}
        </QueryView>
      </Section>
    </Screen>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: layout.card, paddingVertical: layout.row, gap: spacing.sm },
  tableHead: { borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' },
  labelCell: { flex: 1.15 },
  headCell: { flex: 1, alignItems: 'flex-end', gap: spacing.xs },
  cell: { flex: 1, textAlign: 'right' },
  cellText: { textAlign: 'right' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  proof: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

