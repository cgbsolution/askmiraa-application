/**
 * What Ask Miraa looked up, rendered natively under its reply.
 *
 * Every card is a record AskMiraa read *as the person*; the model never saw it.
 * The card types mirror the portal's (frontend/src/components/companion):
 * notice, table, policy, report, own_record, record, choices, launch, chart and
 * proposal (an offer the person confirms by replying yes).
 *
 * Rule 7 (CLAUDE.md): no AI-produced figure without its interpretation and a
 * confidence value, so a report card always shows both.
 */

import { ChevronRight, ExternalLink, FileText, Info, TriangleAlert } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  OUTCOME_LABEL,
  cellText,
  chartSeries,
  hasMore,
  nextPageMessage,
  pageLabel,
  singleValue,
  tableLayout,
} from '../../core/companion';
import type { CompanionCard, Citation, ReportResult } from '../../core/types';
import { webToMobileRoute } from '../../core/webToMobileRoute';
import { t } from '../../lib/i18n';
import { followLink, openInBrowser } from '../../lib/links';
import { useGo } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';
import { Badge } from '../Badge';
import { Button, LinkButton } from '../Button';
import { Sheet } from '../Sheet';
import { Notice } from '../States';
import { Txt } from '../Text';
import { MiniChart } from './MiniChart';
import { SCREEN_LABEL } from './screenLabels';

export function CardView({
  card,
  mode,
  onAsk,
  onDecide,
  deciding,
}: {
  card: CompanionCard;
  mode: 'ai' | 'direct';
  onAsk: (text: string) => void;
  /** Confirm or Cancel on an offer, by its own id. */
  onDecide?: (card: Extract<CompanionCard, { type: 'proposal' }>, confirm: boolean) => void;
  /** The offer being decided now, if any. */
  deciding?: string | null;
}) {
  switch (card.type) {
    case 'notice':
      return (
        <Notice
          tone={card.tone === 'warning' ? 'warning' : 'info'}
          icon={card.tone === 'warning' ? TriangleAlert : Info}
          message={card.text}
        />
      );
    case 'table':
      return <TableCard card={card} mode={mode} onAsk={onAsk} />;
    case 'policy':
      return <PolicyCard card={card} />;
    case 'report':
      return <ReportCard card={card} />;
    case 'own_record':
      return <OwnRecordCard text={card.text} open={card.open} />;
    case 'record':
      return <RecordCard card={card} />;
    case 'choices':
      return (
        <Frame>
          <Txt variant="calloutStrong">{card.title}</Txt>
          <Txt variant="caption" tone="muted">
            {card.caption}
          </Txt>
          {card.options.map((option) => (
            <Button
              key={option.text}
              label={option.detail ? `${option.label} · ${option.detail}` : option.label}
              variant="secondary"
              size="sm"
              onPress={() => onAsk(option.text)}
            />
          ))}
        </Frame>
      );
    case 'chart':
      return <ChartCard card={card} />;
    case 'proposal':
      return <ProposalCard card={card} onDecide={onDecide} busy={deciding === card.action_id} />;
    case 'launch':
      return (
        <Button
          label={t('Open {name}', { name: card.name })}
          icon={ExternalLink}
          variant="secondary"
          size="sm"
          onPress={() => void openInBrowser(card.href)}
        />
      );
    case 'connect':
      return (
        <Frame>
          <Txt variant="calloutStrong">{card.title}</Txt>
          <Txt variant="callout" tone="muted">
            {card.action === 'connect'
              ? // On the phone the button opens AskMiraa's Connectors page in the browser; the chat
                // does not resume by itself there.
                t('Connecting {name} opens AskMiraa’s Connectors page in your browser. Connect it there, then come back here and say “connected”.', { name: card.brand })
              : card.text}
          </Txt>
          {card.action ? (
            // Connecting is an admin's job in the portal, where the product's Allow page opens.
            <Button
              label={card.action === 'connect' ? t('Connect {name}', { name: card.brand }) : t('Sync people')}
              icon={ExternalLink}
              variant="secondary"
              size="sm"
              onPress={() => void openInBrowser('/settings/connectors')}
            />
          ) : null}
        </Frame>
      );
    case 'attachment':
      return (
        <Frame>
          <View style={styles.titleRow}>
            <FileText size={16} />
            <Txt variant="calloutStrong" numberOfLines={1} style={styles.flex}>
              {card.name}
            </Txt>
            <Badge label={card.label} tone={card.read === 'none' ? 'neutral' : 'primary'} />
          </View>
          {card.note ? (
            <Txt variant="caption" tone="muted">
              {card.note}
            </Txt>
          ) : null}
        </Frame>
      );
    default:
      return null;
  }
}

function Frame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.frame, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>;
}

function TableCard({
  card,
  mode,
  onAsk,
}: {
  card: Extract<CompanionCard, { type: 'table' }>;
  mode: 'ai' | 'direct';
  onAsk: (text: string) => void;
}) {
  const { colors } = useTheme();
  const go = useGo();
  const layoutKind = tableLayout(card.columns);
  const label = pageLabel(card.page, card.rows.length);
  const openRow = (index: number) => {
    const href = card.links?.[index];
    if (href) followLink(href, go);
  };

  return (
    <Frame>
      <View style={styles.titleRow}>
        <Txt variant="calloutStrong" style={styles.flex}>
          {card.title}
        </Txt>
        {card.source ? <Badge label={t('From {source}', { source: card.source })} tone="info" /> : null}
      </View>
      {card.caption ? (
        <Txt variant="caption" tone="muted">
          {card.caption}
        </Txt>
      ) : null}

      {layoutKind === 'stacked' ? (
        <View style={[styles.stack, { borderColor: colors.divider }]}>
          {card.rows.map((row, index) => {
            const link = card.links?.[index];
            const body = (
              <>
                <View style={styles.flex}>
                  <Txt variant="calloutStrong" numberOfLines={2}>
                    {cellText(row[0])}
                  </Txt>
                  {card.columns.slice(1).map((column, i) => (
                    <Txt key={column} variant="caption" tone="muted" numberOfLines={2}>
                      {column}: {cellText(row[i + 1])}
                    </Txt>
                  ))}
                </View>
                {link ? <ChevronRight size={layout.iconSm} color={colors.textSubtle} /> : null}
              </>
            );
            return link ? (
              <Pressable
                key={index}
                accessibilityRole="button"
                onPress={() => openRow(index)}
                style={({ pressed }) => [styles.stackRow, { borderColor: colors.divider }, pressed && { backgroundColor: colors.surfaceSunken }]}
              >
                {body}
              </Pressable>
            ) : (
              <View key={index} style={[styles.stackRow, { borderColor: colors.divider }]}>
                {body}
              </View>
            );
          })}
        </View>
      ) : (
        <WideTable columns={card.columns} rows={card.rows} links={card.links} onOpen={openRow} />
      )}

      {label ? (
        <View style={styles.titleRow}>
          <Txt variant="caption" tone="muted" style={styles.flex}>
            {label}
          </Txt>
          {mode === 'ai' && hasMore(card.page) ? <LinkButton label={t('Show more')} onPress={() => onAsk(nextPageMessage(card))} /> : null}
        </View>
      ) : null}
      {card.source && card.open ? (
        <Button
          label={t('Open in {source}', { source: card.source })}
          icon={ExternalLink}
          variant="secondary"
          size="sm"
          onPress={() => void openInBrowser(card.open!)}
        />
      ) : null}
    </Frame>
  );
}

const CELL_WIDTH = 132;
const ROW_HEIGHT = 40;

/** More than three columns: the first stays put, the rest scroll sideways. */
function WideTable({
  columns,
  rows,
  links,
  onOpen,
}: {
  columns: string[];
  rows: unknown[][];
  links?: (string | null)[];
  onOpen: (index: number) => void;
}) {
  const { colors } = useTheme();
  const row = (index: number, cells: ReactNode, sticky?: boolean) => {
    const link = links?.[index];
    const style = [styles.tableRow, { borderColor: colors.divider }, sticky && { backgroundColor: colors.surface }];
    return link ? (
      <Pressable key={index} onPress={() => onOpen(index)} accessibilityRole="button" style={({ pressed }) => [style, pressed && { backgroundColor: colors.surfaceSunken }]}>
        {cells}
      </Pressable>
    ) : (
      <View key={index} style={style}>
        {cells}
      </View>
    );
  };
  return (
    <View style={styles.wide}>
      <View>
        <View style={[styles.tableRow, styles.tableHead, { backgroundColor: colors.surfaceSunken, borderColor: colors.divider }]}>
          <Txt variant="label" tone="muted" numberOfLines={1} style={styles.cell}>
            {columns[0]}
          </Txt>
        </View>
        {rows.map((cells, index) =>
          row(
            index,
            <Txt variant="calloutStrong" numberOfLines={1} style={styles.cell}>
              {cellText(cells[0])}
            </Txt>,
            true,
          ),
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.flex}>
        <View>
          <View style={[styles.tableRow, styles.tableHead, { backgroundColor: colors.surfaceSunken, borderColor: colors.divider }]}>
            {columns.slice(1).map((column) => (
              <Txt key={column} variant="label" tone="muted" numberOfLines={1} style={styles.cell}>
                {column}
              </Txt>
            ))}
          </View>
          {rows.map((cells, index) =>
            row(
              index,
              <>
                {cells.slice(1).map((cell, i) => (
                  <Txt key={i} variant="callout" numberOfLines={1} style={styles.cell}>
                    {cellText(cell)}
                  </Txt>
                ))}
              </>,
            ),
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function PolicyCard({ card }: { card: Extract<CompanionCard, { type: 'policy' }> }) {
  const go = useGo();
  const [citation, setCitation] = useState<Citation | null>(null);
  const neutral = card.outcome === 'refused' || card.outcome === 'withheld';
  return (
    <Frame>
      <View style={styles.badges}>
        <Badge
          label={card.answered_from === 'your_record' ? t('From your record') : t('From company policy')}
          tone={card.answered_from === 'your_record' ? 'primary' : 'info'}
        />
        {card.outcome !== 'answered' ? <Badge label={t(OUTCOME_LABEL[card.outcome])} tone="neutral" /> : null}
      </View>
      <Txt variant="callout" tone={neutral ? 'muted' : 'default'}>
        {card.answer}
      </Txt>
      {card.citations.length ? (
        <View style={styles.badges}>
          {card.citations.map((c) => (
            <Button key={c.id} label={`[${c.number}] ${c.label}`} variant="secondary" size="sm" icon={FileText} onPress={() => setCitation(c)} />
          ))}
        </View>
      ) : null}
      <Txt variant="caption" tone="subtle">
        {card.confidence_band ? t('Confidence: {band}', { band: card.confidence_band }) : t('Confidence: not given')}
      </Txt>
      {card.open ? <LinkButton label={t('Open the page')} onPress={() => followLink(card.open, go)} /> : null}

      <Sheet open={citation !== null} onClose={() => setCitation(null)} title={citation ? `[${citation.number}] ${citation.label}` : ''}>
        <Txt variant="callout" tone="muted">
          {t('Source: {source}', { source: citation?.source ?? '' })}
        </Txt>
        {citation?.href ? (
          <Button
            label={t('Open the source')}
            variant="secondary"
            onPress={() => {
              const href = citation.href!;
              setCitation(null);
              followLink(href, go);
            }}
            fullWidth
          />
        ) : (
          <Txt variant="caption" tone="subtle">
            {t('This source has no page to open.')}
          </Txt>
        )}
      </Sheet>
    </Frame>
  );
}

function ReportCard({ card }: { card: Extract<CompanionCard, { type: 'report' }> }) {
  const single = singleValue(card.result);
  const series = card.chart === 'bar' || card.chart === 'line' ? chartSeries(card.result) : null;
  return (
    <Frame>
      <Txt variant="caption" tone="muted">
        {t('Read as')}
      </Txt>
      <Txt variant="calloutStrong" tone={card.interpretation?.trim() ? 'default' : 'muted'}>
        {card.interpretation?.trim() || t('Miraa could not turn that question into a report. Try asking it another way.')}
      </Txt>
      <View style={styles.badges}>
        <Badge label={t('Confidence: {band}', { band: card.confidence_band })} tone="neutral" />
        {!card.answered ? <Badge label={t('Not answered')} tone="neutral" /> : null}
      </View>
      {card.problem ? <Notice tone="warning" title={t('The report could not run')} message={card.problem} /> : null}
      {card.result ? (
        single !== null ? (
          <Txt variant="stat" numeric>
            {single}
          </Txt>
        ) : (
          <>
            {series ? <MiniChart series={series} kind={card.chart as 'bar' | 'line'} /> : null}
            <ResultTable result={card.result} />
          </>
        )
      ) : null}
    </Frame>
  );
}

function ResultTable({ result }: { result: ReportResult }) {
  const columns = result.columns.map((c) => c.label);
  if (tableLayout(columns) === 'scroll') return <WideTable columns={columns} rows={result.rows} onOpen={() => {}} />;
  return (
    <View style={styles.stack}>
      {result.rows.map((row, index) => (
        <View key={index} style={styles.kvRow}>
          <Txt variant="callout" style={styles.flex} numberOfLines={2}>
            {cellText(row[0])}
          </Txt>
          <Txt variant="calloutStrong" numeric>
            {row.slice(1).map(cellText).join(' · ')}
          </Txt>
        </View>
      ))}
    </View>
  );
}

function RecordCard({ card }: { card: Extract<CompanionCard, { type: 'record' }> }) {
  const go = useGo();
  return (
    <Frame>
      <Txt variant="calloutStrong">{card.title}</Txt>
      {card.subtitle ? (
        <Txt variant="caption" tone="muted">
          {card.subtitle}
        </Txt>
      ) : null}
      {card.heading ? <Badge label={card.heading} tone="primary" /> : null}
      {card.figures.map((figure) => (
        <View key={figure.label} style={styles.kvRow}>
          <Txt variant="callout" tone="muted" style={styles.flex}>
            {figure.label}
          </Txt>
          <Txt variant="calloutStrong" numeric>
            {figure.value}
          </Txt>
        </View>
      ))}
      {card.table && card.table.rows.length > 0 ? (
        <View style={styles.stack}>
          {card.table.rows.map((row, index) => (
            <View key={index} style={styles.kvRow}>
              <Txt variant="callout" style={styles.flex} numberOfLines={2}>
                {cellText(row[0])}
              </Txt>
              <Txt variant="calloutStrong" numeric>
                {row.slice(1).map(cellText).join(' · ')}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
      {card.note ? (
        <Txt variant="caption" tone="muted">
          {card.note}
        </Txt>
      ) : null}
      {card.open ? (
        <Button
          label={card.open_label ?? t('Open the page')}
          icon={ChevronRight}
          variant="secondary"
          size="sm"
          onPress={() => followLink(card.open as string, go)}
        />
      ) : null}
    </Frame>
  );
}

/** Amounts the way they are read: ₹45.2L, ₹1.3Cr; counts with Indian grouping. */
function chartValue(unit: string, value: number): string {
  const abs = Math.abs(value);
  if (unit === 'inr') {
    if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)}L`;
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
  }
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value);
}

/**
 * A chart Miraa drew. A trend or comparison is a small line or bar chart (a
 * stacked breakdown is drawn as its totals), a pie is its shares as bars, and
 * the figures follow, so nothing is read off the picture alone.
 */
function ChartCard({ card }: { card: Extract<CompanionCard, { type: 'chart' }> }) {
  const { colors } = useTheme();
  const number = (raw: string | undefined) => {
    const value = raw === undefined || raw === '' ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  const stacked = card.chart === 'stacked_bar' && card.series.length > 1;
  const totals = card.x.map((_, i) =>
    card.series.reduce((sum, series) => sum + (number(series.values[i]) ?? 0), 0),
  );
  const first = card.series[0];
  const values = stacked ? totals : card.x.map((_, i) => number(first?.values[i]) ?? 0);
  const shares = card.chart === 'pie' || card.chart === 'donut';
  const whole = values.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
  return (
    <Frame>
      <Txt variant="calloutStrong">{card.title}</Txt>
      <Txt variant="caption" tone="muted">
        {card.caption}
      </Txt>
      {shares ? (
        <View style={styles.stack}>
          {card.x.map((label, i) => (
            <View key={label} style={styles.shareRow}>
              <View style={styles.kvRow}>
                <Txt variant="callout" style={styles.flex} numberOfLines={1}>
                  {label}
                </Txt>
                <Txt variant="calloutStrong" numeric>
                  {`${chartValue(card.unit, values[i] ?? 0)} · ${(((values[i] ?? 0) / whole) * 100).toFixed(1)}%`}
                </Txt>
              </View>
              <View style={[styles.shareTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.shareFill,
                    { backgroundColor: colors.primary, width: `${Math.max(((values[i] ?? 0) / whole) * 100, 1)}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <>
          <MiniChart
            kind={card.chart === 'line' || card.chart === 'area' ? 'line' : 'bar'}
            series={{
              labels: card.x,
              values,
              valueLabel: stacked ? t('Total') : (first?.name ?? ''),
            }}
          />
          <View style={styles.stack}>
            {card.x.map((label, i) => (
              <View key={label} style={styles.kvRow}>
                <Txt variant="callout" style={styles.flex} numberOfLines={1}>
                  {label}
                </Txt>
                <Txt variant="calloutStrong" numeric>
                  {card.series.length === 1 || stacked
                    ? number(stacked ? String(totals[i]) : first?.values[i]) === null
                      ? '—'
                      : chartValue(card.unit, values[i] ?? 0)
                    : card.series
                        .map((series) => {
                          const value = number(series.values[i]);
                          return `${series.name}: ${value === null ? '—' : chartValue(card.unit, value)}`;
                        })
                        .join(' · ')}
                </Txt>
              </View>
            ))}
          </View>
        </>
      )}
    </Frame>
  );
}

const PROPOSAL_STATUS: Record<string, { label: string; tone: 'primary' | 'success' | 'neutral' | 'danger' }> = {
  proposed: { label: 'Waiting for you', tone: 'primary' },
  done: { label: 'Done', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  failed: { label: 'Not done', tone: 'danger' },
  expired: { label: 'Expired — ask again', tone: 'neutral' },
};

/** An offer: what Miraa will do, and the person's yes or no on this very offer. */
function ProposalCard({
  card,
  onDecide,
  busy,
}: {
  card: Extract<CompanionCard, { type: 'proposal' }>;
  onDecide?: (card: Extract<CompanionCard, { type: 'proposal' }>, confirm: boolean) => void;
  busy: boolean;
}) {
  const held = card.status === 'proposed' && Boolean(card.waiting);
  const state = held ? { label: 'Held', tone: 'neutral' as const } : PROPOSAL_STATUS[card.status] ?? PROPOSAL_STATUS.proposed!;
  const open = card.status === 'proposed' && !held;
  return (
    <Frame>
      <View style={styles.titleRow}>
        <Txt variant="calloutStrong" style={styles.flex}>
          {card.title}
        </Txt>
        <Badge label={t(state.label)} tone={state.tone} />
      </View>
      {card.figures.map((figure) => (
        <View key={`${figure.label}-${figure.value}`} style={styles.kvRow}>
          <Txt variant="callout" tone="muted" style={styles.flex}>
            {figure.label}
          </Txt>
          <Txt variant="calloutStrong" numeric>
            {figure.value}
          </Txt>
        </View>
      ))}
      {card.table?.rows.length ? (
        // A claim's bills, an order's roles: one line each, the columns as label · value.
        <View style={styles.offerLines}>
          {card.table.rows.map((row, index) => (
            <Txt key={index} variant="caption">
              {row.map((cell, i) => `${card.table?.columns[i] ? `${card.table.columns[i]}: ` : ''}${cellText(cell)}`).join(' · ')}
            </Txt>
          ))}
        </View>
      ) : null}
      {card.notes.filter(Boolean).map((note) => (
        <Txt key={note} variant="caption" tone="muted">
          {note}
        </Txt>
      ))}
      {held ? <Txt variant="callout">{card.waiting}</Txt> : null}
      {card.result?.text && card.status !== 'proposed' ? <Txt variant="callout">{card.result.text}</Txt> : null}
      {open && onDecide ? (
        <View style={styles.badges}>
          <Button label={card.confirm_label || t('Yes')} size="sm" loading={busy} disabled={busy} onPress={() => onDecide(card, true)} />
          <Button label={t('No')} variant="secondary" size="sm" disabled={busy} onPress={() => onDecide(card, false)} />
        </View>
      ) : null}
    </Frame>
  );
}

function OwnRecordCard({ text, open }: { text: string; open: string }) {
  const go = useGo();
  const target = webToMobileRoute(open);
  const where = target.kind === 'screen' ? SCREEN_LABEL[target.route] ?? null : null;
  return (
    <Frame>
      <Badge label={t('From your record')} tone="primary" />
      <Txt variant="callout">{text}</Txt>
      <Button
        label={where ? t('Open {screen}', { screen: t(where) }) : t('Open the page')}
        icon={target.kind === 'external' ? ExternalLink : ChevronRight}
        variant="secondary"
        size="sm"
        onPress={() => followLink(open, go)}
      />
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: layout.hairline, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offerLines: { gap: spacing.xs },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  stack: { gap: 0 },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: layout.hairline,
    minHeight: layout.touch,
  },
  wide: { flexDirection: 'row' },
  tableRow: { flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT, borderBottomWidth: layout.hairline },
  tableHead: { height: ROW_HEIGHT - spacing.sm },
  cell: { width: CELL_WIDTH, paddingHorizontal: spacing.sm },
  kvRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  shareRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  shareTrack: { height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  shareFill: { height: 6, borderRadius: radius.sm },
});
