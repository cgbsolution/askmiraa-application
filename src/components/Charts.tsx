/**
 * Two small charts, drawn with react-native-svg in the portal's chart colours.
 *
 * - `Donut`: parts of a whole — leave left by type, as the older HRMS's leave
 *   balance screen showed it — with the total in the middle.
 * - `Bars`: a value per month — net pay through the financial year, as its
 *   payslip screen did.
 *
 * Every chart carries a text description for screen readers, and the numbers
 * it draws are also on screen in words (a legend or a list), so nothing is
 * known only from a colour.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing, type Colors } from '../theme/tokens';
import { Txt } from './Text';

/** The chart colours in order, cycling for longer series. */
export function seriesColor(colors: Colors, index: number): string {
  const series = [colors.chart1, colors.chart2, colors.chart4, colors.chart5, colors.chart3];
  return series[index % series.length]!;
}

export interface DonutPart {
  key: string;
  value: number;
  color: string;
}

export function Donut({
  parts,
  size,
  thickness,
  centreValue,
  centreLabel,
  accessibilityLabel,
}: {
  parts: DonutPart[];
  size: number;
  thickness: number;
  centreValue: string;
  centreLabel: string;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const total = parts.reduce((sum, p) => sum + Math.max(0, p.value), 0);
  const gap = parts.filter((p) => p.value > 0).length > 1 ? Math.min(spacing.xs, circumference * 0.01) : 0;
  let offset = 0;

  return (
    <View style={[styles.donut, { width: size, height: size }]} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.chartTrack} strokeWidth={thickness} fill="none" />
          {total > 0
            ? parts.map((part) => {
                if (part.value <= 0) return null;
                const length = (part.value / total) * circumference;
                const dash = Math.max(0, length - gap);
                const node = (
                  <Circle
                    key={part.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={part.color}
                    strokeWidth={thickness}
                    fill="none"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += length;
                return node;
              })
            : null}
        </G>
      </Svg>
      <View style={styles.centre} pointerEvents="none">
        <Txt variant="caption" tone="muted">
          {centreLabel}
        </Txt>
        <Txt variant="stat" numeric>
          {centreValue}
        </Txt>
      </View>
    </View>
  );
}

export interface Bar {
  key: string;
  /** Under the bar: "Apr". */
  label: string;
  value: number;
}

/**
 * Vertical bars with a light grid. Tapping a bar selects it (the screen shows
 * that month's figures); the selected bar is the full maroon, the rest lighter.
 */
export function Bars({
  bars,
  height,
  selected,
  onSelect,
  accessibilityLabel,
}: {
  bars: Bar[];
  height: number;
  selected?: string | null;
  onSelect?: (key: string) => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const max = Math.max(1, ...bars.map((b) => b.value));
  const plot = height - spacing.xl;
  const slots = Math.max(bars.length, 6);
  return (
    <View accessible={!onSelect} accessibilityLabel={accessibilityLabel} style={{ height }}>
      <Svg width="100%" height={plot} style={StyleSheet.absoluteFill}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <Line key={f} x1="0" x2="100%" y1={plot - plot * f * 0.92} y2={plot - plot * f * 0.92} stroke={colors.divider} strokeWidth={1} />
        ))}
        <Line x1="0" x2="100%" y1={plot - 0.5} y2={plot - 0.5} stroke={colors.border} strokeWidth={1} />
      </Svg>
      <View style={[styles.barsRow, { height: plot }]}>
        {Array.from({ length: slots }).map((_, index) => {
          const bar = bars[index];
          if (!bar) return <View key={`empty-${index}`} style={styles.barSlot} />;
          const h = Math.max(spacing.xs, (bar.value / max) * plot * 0.92);
          const isSelected = selected ? selected === bar.key : index === bars.length - 1;
          return (
            <Pressable
              key={bar.key}
              disabled={!onSelect}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={bar.label}
              onPress={() => onSelect?.(bar.key)}
              style={styles.barSlot}
            >
              <View style={[styles.bar, { height: h, backgroundColor: isSelected ? colors.chart1 : colors.chartTrack }]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {Array.from({ length: slots }).map((_, index) => {
          const bar = bars[index];
          const isSelected = bar ? (selected ? selected === bar.key : index === bars.length - 1) : false;
          return (
            <Txt key={bar?.key ?? `l-${index}`} variant="caption" tone={isSelected ? 'primary' : 'muted'} align="center" style={styles.barSlot} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {bar?.label ?? ''}
            </Txt>
          );
        })}
      </View>
    </View>
  );
}

/** A coloured square and its words, for a chart's legend. */
export function LegendDot({ color }: { color: string }) {
  return <View style={[styles.legendDot, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  donut: { alignItems: 'center', justifyContent: 'center' },
  centre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '64%', borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  labelsRow: { flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.xs, height: spacing.xl },
  legendDot: { width: layout.iconSm - spacing.xs, height: layout.iconSm - spacing.xs, borderRadius: radius.xs },
});
