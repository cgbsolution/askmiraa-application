/**
 * A small bar or line chart for a report card, drawn with react-native-svg.
 * No chart library: the card needs a shape at a glance, and the table under
 * it carries the exact figures.
 */

import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';

import type { Series } from '../../core/companion';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, spacing } from '../../theme/tokens';
import { Txt } from '../Text';

const HEIGHT = 140;

export function MiniChart({ series, kind }: { series: Series; kind: 'bar' | 'line' }) {
  const { colors } = useTheme();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen - layout.gutter * 4 - layout.card * 2, layout.readingWidth);
  const max = Math.max(...series.values, 0) || 1;
  const count = series.values.length;
  const slot = width / Math.max(count, 1);
  const y = (value: number) => HEIGHT - (Math.max(value, 0) / max) * (HEIGHT - spacing.lg) - 1;

  const shown = series.labels.length <= 6 ? series.labels : [series.labels[0]!, series.labels[series.labels.length - 1]!];

  return (
    <View
      accessible
      accessibilityLabel={`${series.valueLabel}: ${series.labels.map((label, i) => `${label} ${series.values[i]}`).join(', ')}`}
      style={styles.wrap}
    >
      <Svg width={width} height={HEIGHT}>
        <Line x1={0} y1={HEIGHT - 1} x2={width} y2={HEIGHT - 1} stroke={colors.border} strokeWidth={1} />
        {kind === 'bar'
          ? series.values.map((value, i) => (
              <Rect
                key={i}
                x={i * slot + slot * 0.18}
                y={y(value)}
                width={slot * 0.64}
                height={HEIGHT - 1 - y(value)}
                rx={3}
                fill={colors.primary}
              />
            ))
          : (
              <>
                <Polyline
                  points={series.values.map((value, i) => `${i * slot + slot / 2},${y(value)}`).join(' ')}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={2.5}
                />
                {series.values.map((value, i) => (
                  <Circle key={i} cx={i * slot + slot / 2} cy={y(value)} r={3.5} fill={colors.accent} />
                ))}
              </>
            )}
      </Svg>
      <View style={[styles.labels, { width }]}>
        {shown.map((label, i) => (
          <Txt key={`${label}-${i}`} variant="caption" tone="subtle" numberOfLines={1} style={styles.label}>
            {label}
          </Txt>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { flexShrink: 1 },
});
