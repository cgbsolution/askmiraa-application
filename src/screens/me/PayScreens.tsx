/**
 * My pay: payslips, a payslip's lines and PDF, salary structure, total
 * rewards.
 *
 * Tier 1. Amounts are decimal strings formatted without float maths, and net
 * pay is masked until tapped. The last payslip viewed is kept on the phone
 * (README offline table), so it can be shown at a bank counter with no
 * signal; the list itself is online only.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Lock, Share2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { payrollApi } from '../../api/payroll';
import { Badge, Chip } from '../../components/Badge';
import { Bars } from '../../components/Charts';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Divider, KeyValue, ListGroup, ListRow } from '../../components/List';
import { AskMiraChip } from '../../components/mira/AskMiraChip';
import { FigureTable } from '../../components/FigureTable';
import { Money, RevealToggle, useMoneyText, withReveal } from '../../components/Money';
import { Row, Screen, Section, Stack } from '../../components/Screen';
import { SkeletonCard } from '../../components/Skeleton';
import { EmptyState, ErrorState, Notice, OfflineBanner, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { MONTHS, MONTHS_LONG, formatDate, formatDateTime } from '../../core/dates';
import { payYears } from '../../core/pay';
import { formatCount, isPositiveAmount, plainDecimal, sumDecimals } from '../../core/money';
import { statusLabel } from '../../core/status';
import type { PayslipRead } from '../../core/types';
import { openDownloaded, shareDownloaded } from '../../lib/files';
import { t } from '../../lib/i18n';
import { isOffline } from '../../lib/queryClient';
import { useGo, useParams } from '../../navigation/navigate';
import { layout, spacing } from '../../theme/tokens';

const monthLabel = (year: number, month: number) => `${t(MONTHS_LONG[month - 1] ?? '')} ${year}`;

export const PayslipsScreen = withReveal(function PayslipsBody() {
  const money = useMoneyText();
  const go = useGo();
  const list = useQuery({ queryKey: ['payslips'], queryFn: payrollApi.payslips });
  const last = useQuery<PayslipRead | null>({ queryKey: ['payslip-last'], queryFn: async () => null, staleTime: Infinity, enabled: false });
  const offline = isOffline(list.error);
  const years = useMemo(() => payYears(list.data ?? []), [list.data]);
  const [fy, setFy] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const year = years.find((y) => y.fy === fy) ?? years[0];
  const month = year ? (year.months.find((m) => m.key === monthKey) ?? year.months[year.months.length - 1]) : undefined;
  const latestSlip = month?.slips.find((s) => s.run_type === 'regular') ?? month?.slips[0];

  return (
    <Screen onRefresh={() => list.refetch()}>
      {offline && !list.data && last.data ? (
        <>
          <OfflineBanner message={t('You’re offline. The list needs a connection; your last viewed payslip is saved on this phone.')} />
          <ListGroup>
            <ListRow
              icon={FileText}
              title={monthLabel(last.data.period_year, last.data.period_month)}
              subtitle={t('Saved on this phone')}
              onPress={() => go('PayslipDetail', { id: last.data!.id })}
            />
          </ListGroup>
        </>
      ) : (
        <QueryView
          query={list}
          skeleton={<SkeletonCard lines={6} />}
          isEmpty={(data) => data.length === 0}
          empty={<EmptyState spot="payslip" title={t('No payslips yet')} message={t('Your payslip appears here once payroll publishes it.')} />}
        >
          {() =>
            year && month ? (
              <>
                <View style={styles.yearRow}>
                  <Txt variant="headline" style={styles.flex}>
                    {t('Financial year {fy}', { fy: year.fy.replace('-', '–') })}
                  </Txt>
                  <RevealToggle />
                </View>
                {years.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
                    {years.map((y) => (
                      <Chip
                        key={y.fy}
                        label={y.fy.replace('-', '–')}
                        selected={y.fy === year.fy}
                        onPress={() => {
                          setFy(y.fy);
                          setMonthKey(null);
                        }}
                      />
                    ))}
                  </ScrollView>
                ) : null}

                <Card>
                  <View style={styles.chartHead}>
                    <Txt variant="calloutStrong">{t('Net pay by month')}</Txt>
                    <Txt variant="caption" tone="muted">
                      {t('Tap a month')}
                    </Txt>
                  </View>
                  <Bars
                    height={layout.avatarXl * 1.6}
                    selected={month.key}
                    onSelect={setMonthKey}
                    accessibilityLabel={t('Net pay by month for {fy}', { fy: year.fy })}
                    bars={year.months.map((m) => ({ key: m.key, label: t(MONTHS[m.month - 1] ?? ''), value: Number(m.net) }))}
                  />
                </Card>

                <Card>
                  <Txt variant="caption" tone="muted">
                    {t('Salary details')}
                  </Txt>
                  <Txt variant="title">{monthLabel(month.year, month.month)}</Txt>
                  <View style={styles.figures}>
                    <KeyValue label={t('Gross earnings')} value={money(month.gross)} />
                    <KeyValue label={t('Deductions')} value={money(month.deductions)} />
                    <Divider />
                    <KeyValue label={t('Net pay')} value={money(month.net)} strong />
                  </View>
                  {latestSlip ? (
                    <View style={styles.buttons}>
                      <Button
                        label={t('Payslip')}
                        icon={Download}
                        variant="primary"
                        loading={busy}
                        onPress={async () => {
                          setBusy(true);
                          await openDownloaded(payrollApi.pdfPath(latestSlip.id), `payslip-${month.key}.pdf`);
                          setBusy(false);
                        }}
                        style={styles.flex}
                      />
                      <Button label={t('View')} icon={FileText} variant="secondary" onPress={() => go('PayslipDetail', { id: latestSlip.id })} style={styles.flex} />
                    </View>
                  ) : null}
                </Card>

                <Card variant="soft">
                  <Txt variant="caption" tone="muted">
                    {t('Year to date')}
                  </Txt>
                  <Txt variant="headline">{t('{fy} · {count} payslips', { fy: year.fy.replace('-', '–'), count: year.ytd.count })}</Txt>
                  <View style={styles.figures}>
                    <KeyValue label={t('Gross earnings')} value={money(year.ytd.gross)} />
                    <KeyValue label={t('Deductions')} value={money(year.ytd.deductions)} />
                    <Divider />
                    <KeyValue label={t('Net pay')} value={money(year.ytd.net)} strong />
                  </View>
                </Card>

                <Section title={t('Every month')}>
                  <ListGroup>
                    {[...year.months].reverse().flatMap((m) =>
                      m.slips.map((slip) => (
                        <ListRow
                          key={slip.id}
                          icon={FileText}
                          title={monthLabel(slip.period_year, slip.period_month)}
                          subtitle={slip.run_type !== 'regular' ? t(statusLabel(slip.run_type)) : t('Net {amount}', { amount: money(slip.net_pay) })}
                          trailing={<Badge label={t(statusLabel(slip.run_status))} tone={slip.run_status === 'paid' ? 'success' : 'neutral'} />}
                          onPress={() => go('PayslipDetail', { id: slip.id })}
                        />
                      )),
                    )}
                  </ListGroup>
                </Section>

                <ListGroup>
                  <ListRow spot="calculator" title={t('Income tax')} subtitle={t('Tax so far, projection and regime')} onPress={() => go('Tax')} />
                  <ListRow spot="fileSend" title={t('IT declaration')} subtitle={t('Investments and proofs')} onPress={() => go('TaxDeclarations')} />
                </ListGroup>
              </>
            ) : null
          }
        </QueryView>
      )}
    </Screen>
  );
});

export const PayslipDetailScreen = withReveal(function PayslipDetailBody() {
  const money = useMoneyText();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const slip = useQuery({ queryKey: ['payslip', id], queryFn: () => payrollApi.payslip(id!), enabled: Boolean(id) });
  const protection = useQuery({ queryKey: ['payslip-protection'], queryFn: payrollApi.protection, staleTime: 60 * 60_000 });
  const cached = queryClient.getQueryData<PayslipRead>(['payslip-last']);
  const [busy, setBusy] = useState<'open' | 'share' | null>(null);

  // Keep the last payslip viewed for offline use (README offline table).
  useEffect(() => {
    if (slip.data) queryClient.setQueryData(['payslip-last'], slip.data);
  }, [slip.data, queryClient]);

  const data = slip.data ?? (cached && cached.id === id ? cached : undefined);
  if (!data) {
    if (slip.isPending) return <Screen><SkeletonCard lines={6} /></Screen>;
    return <Screen><ErrorState error={slip.error} onRetry={() => void slip.refetch()} /></Screen>;
  }

  const earnings = data.lines.filter((l) => l.type === 'earning');
  const hasTdsLine = data.lines.some((l) => l.code.toUpperCase().includes('TDS'));
  const deductions = [
    ...data.lines.filter((l) => l.type === 'deduction'),
    ...(!hasTdsLine && isPositiveAmount(data.tds) ? [{ code: 'TDS', name: t('Income tax (TDS)'), type: 'deduction', amount: data.tds }] : []),
  ];
  const employer = data.lines.filter((l) => l.type === 'employer_contribution');
  const filename = `payslip-${data.period_year}-${String(data.period_month).padStart(2, '0')}.pdf`;
  const month = monthLabel(data.period_year, data.period_month);

  return (
    <Screen onRefresh={() => slip.refetch()}>
      {!slip.data ? <OfflineBanner message={t('Saved copy from this phone. Pull down to refresh when you have signal.')} /> : null}
      <Card>
        <Stack gap="tight">
          <Txt variant="caption" tone="muted">
            {data.legal_entity_name ?? ''}
          </Txt>
          <Txt variant="title">{month}</Txt>
          <Txt variant="caption" tone="muted">
            {t('Net pay')}
          </Txt>
          <Money value={data.net_pay} variant="stat" masked />
          <Row gap="inline">
            <Badge
              label={data.run_status === 'paid' && data.payment_date ? t('Paid {date}', { date: formatDate(data.payment_date) }) : t(statusLabel(data.run_status))}
              tone={data.run_status === 'paid' ? 'success' : 'neutral'}
            />
          </Row>
        </Stack>
      </Card>

      <Section title={t('Days')}>
        <Card>
          <Stack gap="tight">
            <KeyValue label={t('Working days')} value={plainDecimal(data.working_days)} />
            <KeyValue label={t('Paid days')} value={plainDecimal(data.paid_days)} />
            {isPositiveAmount(data.lop_days) ? <KeyValue label={t('Loss of pay')} value={plainDecimal(data.lop_days)} tone="danger" /> : null}
          </Stack>
        </Card>
      </Section>

      <Section title={t('Earnings')}>
        <Card>
          <Stack gap="tight">
            {earnings.map((line) => (
              <KeyValue key={line.code} label={line.name} value={money(line.amount)} />
            ))}
            <Divider />
            <KeyValue label={t('Gross earnings')} value={money(data.gross_earnings)} strong />
          </Stack>
        </Card>
      </Section>

      <Section title={t('Deductions')}>
        <Card>
          <Stack gap="tight">
            {deductions.map((line) => (
              <KeyValue key={line.code} label={line.name} value={money(line.amount)} />
            ))}
            <Divider />
            <KeyValue label={t('Total deductions')} value={money(data.total_deductions)} strong />
          </Stack>
        </Card>
        {data.tds_working ? (
          <Txt variant="caption" tone="muted">
            {t('Tax worked out under the {regime} regime.', { regime: t(String((data.tds_working as { regime?: string }).regime ?? '')) })}
          </Txt>
        ) : null}
      </Section>

      {employer.length ? (
        <Section title={t('Paid by your employer, on top')}>
          <Card>
            <Stack gap="tight">
              {employer.map((line) => (
                <KeyValue key={line.code} label={line.name} value={money(line.amount)} />
              ))}
              <KeyValue label={t('Cost to the company this month')} value={money(data.employer_cost)} strong />
            </Stack>
          </Card>
        </Section>
      ) : null}

      {protection.data?.enabled ? (
        <Notice tone="info" icon={Lock} title={t('The PDF has a password')} message={protection.data.rule} />
      ) : null}
      <Row>
        <View style={styles.flex}>
          <Button
            label={t('Open PDF')}
            icon={Download}
            variant="primary"
            loading={busy === 'open'}
            onPress={async () => {
              setBusy('open');
              await openDownloaded(payrollApi.pdfPath(data.id), filename);
              setBusy(null);
            }}
            fullWidth
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('Share')}
            icon={Share2}
            variant="secondary"
            loading={busy === 'share'}
            onPress={async () => {
              setBusy('share');
              await shareDownloaded(payrollApi.pdfPath(data.id), filename);
              setBusy(null);
            }}
            fullWidth
          />
        </View>
      </Row>
      <View style={styles.chips}>
        <AskMiraChip question={t('Explain the deductions on my {month} payslip', { month })} />
      </View>
      {data.published_at ? (
        <Txt variant="caption" tone="subtle">
          {t('Published {when}', { when: formatDateTime(data.published_at) })}
        </Txt>
      ) : null}
    </Screen>
  );
});

export const SalaryScreen = withReveal(function SalaryBody() {
  const money = useMoneyText();
  const query = useQuery({ queryKey: ['salary'], queryFn: payrollApi.salary });
  return (
    <Screen onRefresh={() => query.refetch()}>
      <QueryView
        query={query}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState spot="rupee" title={t('No salary structure yet')} message={t('HR has not set up your salary in AskMiraa.')} />}
      >
        {(data) => {
          const current = data.find((r) => !r.effective_to) ?? data[0]!;
          const earnings = current.components.filter((c) => c.component_type === 'earning');
          const others = current.components.filter((c) => c.component_type !== 'earning');
          return (
            <>
              <Card>
                <Stack gap="tight">
                  <Txt variant="caption" tone="muted">
                    {t('Annual CTC')}
                  </Txt>
                  <Money value={current.ctc_annual} variant="stat" masked />
                  <Txt variant="caption" tone="subtle">
                    {t('{structure}, from {date}', { structure: current.structure_name ?? '', date: formatDate(current.effective_from) })}
                  </Txt>
                  {current.revision_reason ? (
                    <Txt variant="caption" tone="subtle">
                      {current.revision_reason}
                    </Txt>
                  ) : null}
                </Stack>
              </Card>
              <Section title={t('Earnings')}>
                <FigureTable
                  columns={[t('Monthly'), t('Yearly')]}
                  rows={[
                    ...earnings.map((c) => ({
                      key: c.component_code,
                      label: c.component_name,
                      values: [money(c.monthly_amount, { trimZeros: true }), money(c.annual_amount, { trimZeros: true })],
                    })),
                    {
                      key: 'gross',
                      label: t('Gross'),
                      values: [
                        money(sumDecimals(earnings.map((c) => c.monthly_amount)), { trimZeros: true }),
                        money(sumDecimals(earnings.map((c) => c.annual_amount)), { trimZeros: true }),
                      ],
                      total: true,
                    },
                  ]}
                />
              </Section>
              {others.length ? (
                <Section title={t('Other components')}>
                  <Card>
                    <Stack gap="tight">
                      {others.map((c) => (
                        <KeyValue key={c.component_code} label={`${c.component_name} (${t(statusLabel(c.component_type))})`} value={money(c.monthly_amount)} />
                      ))}
                    </Stack>
                  </Card>
                </Section>
              ) : null}
              {data.length > 1 ? (
                <Section title={t('Earlier')}>
                  <ListGroup>
                    {data
                      .filter((r) => r !== current)
                      .map((r) => (
                        <ListRow
                          key={r.id}
                          title={money(r.ctc_annual, { trimZeros: true })}
                          subtitle={`${formatDate(r.effective_from)} – ${r.effective_to ? formatDate(r.effective_to) : t('now')}`}
                          meta={r.revision_reason ?? undefined}
                        />
                      ))}
                  </ListGroup>
                </Section>
              ) : null}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
});

interface TotalRewards {
  financial_year: string;
  ctc: { annual: string; earnings: string; employer_contributions: string; reimbursements: string; outside_ctc: string };
  paid_this_year: { payslips: number; gross_earnings: string; employer_pf: string; employer_esi: string; net_pay: string };
  recognition?: { points: number; value: string };
  benefits?: { name?: string; plan_name?: string; employer_cost?: string; [key: string]: unknown }[];
  not_included?: string[];
}

export const TotalRewardsScreen = withReveal(function TotalRewardsBody() {
  const money = useMoneyText();
  const query = useQuery({ queryKey: ['total-rewards'], queryFn: () => payrollApi.totalRewards() as Promise<unknown> as Promise<TotalRewards> });
  return (
    <Screen onRefresh={() => query.refetch()}>
      <QueryView query={query} skeleton={<SkeletonCard lines={6} />}>
        {(data) => (
          <>
            <Card>
              <Stack gap="tight">
                <Txt variant="caption" tone="muted">
                  {t('Your CTC')}
                </Txt>
                <Money value={data.ctc.annual} variant="stat" masked />
                <KeyValue label={t('Salary earnings')} value={money(data.ctc.earnings)} />
                <KeyValue label={t('Employer contributions')} value={money(data.ctc.employer_contributions)} />
                <KeyValue label={t('Reimbursements')} value={money(data.ctc.reimbursements)} />
                {isPositiveAmount(data.ctc.outside_ctc) ? <KeyValue label={t('Outside CTC')} value={money(data.ctc.outside_ctc)} /> : null}
              </Stack>
            </Card>
            <Section title={t('Paid so far in {fy}', { fy: data.financial_year })}>
              <Card>
                <Stack gap="tight">
                  <KeyValue label={t('Payslips')} value={String(data.paid_this_year.payslips)} />
                  <KeyValue label={t('Gross earnings')} value={money(data.paid_this_year.gross_earnings)} />
                  <KeyValue label={t('Employer PF')} value={money(data.paid_this_year.employer_pf)} />
                  <KeyValue label={t('Net pay')} value={money(data.paid_this_year.net_pay)} strong />
                </Stack>
              </Card>
            </Section>
            {data.recognition ? (
              <Section title={t('Recognition')}>
                <Card>
                  <KeyValue label={t('{points} reward points', { points: formatCount(data.recognition.points) })} value={money(data.recognition.value)} />
                </Card>
              </Section>
            ) : null}
            {data.not_included?.length ? (
              <Notice tone="info" title={t('Not included')} message={data.not_included.join(' ')} />
            ) : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  years: { gap: spacing.sm },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: layout.row },
  figures: { gap: spacing.sm, paddingTop: layout.row },
  buttons: { flexDirection: 'row', gap: spacing.sm, paddingTop: layout.row + spacing.xs },
});

