/**
 * Figures at a glance: a label over a number, in a grid of equal tiles.
 *
 * Used for a month's attendance (payable days, present, absent…), a leave
 * type's breakdown and a payslip's totals. The first tile can be marked
 * `strong` — the one figure the screen is about.
 */

import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing } from '../theme/tokens';
import { Txt, type TextTone } from './Text';

export interface StatItem {
  label: string;
  value: string;
  tone?: TextTone;
  strong?: boolean;
}

export function StatGrid({ items, columns = 3 }: { items: StatItem[]; columns?: 2 | 3 | 4 }) {
  const { colors } = useTheme();
  const width = columns === 2 ? '50%' : columns === 4 ? '25%' : '33.333%';
  return (
    <View style={[styles.grid, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {items.map((item, index) => {
        const lastInRow = (index + 1) % columns === 0;
        const lastRow = index >= items.length - ((items.length % columns) || columns);
        return (
          <View
            key={item.label}
            style={[
              styles.cell,
              { width, borderColor: colors.divider },
              !lastInRow && styles.rightRule,
              !lastRow && styles.bottomRule,
              item.strong && { backgroundColor: colors.soft },
            ]}
            accessible
            accessibilityLabel={`${item.label}: ${item.value}`}
          >
            <Txt variant="caption" tone="muted" numberOfLines={2}>
              {item.label}
            </Txt>
            <Txt variant="statSmall" tone={item.tone ?? (item.strong ? 'primary' : 'default')} numeric numberOfLines={1}>
              {item.value}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: layout.hairline, borderRadius: radius.tier1, overflow: 'hidden' },
  cell: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.xxs },
  rightRule: { borderRightWidth: layout.hairline },
  bottomRule: { borderBottomWidth: layout.hairline },
});
