/**
 * Figures in columns: a label, then one right-aligned value per column
 * ("Monthly", "Yearly"). Two numbers squeezed into one cell with a dot
 * between them were hard to read and wrapped at large text sizes.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { layout, spacing } from '../theme/tokens';
import { Card } from './Card';
import { Txt } from './Text';

export interface FigureRow {
  key: string;
  label: string;
  values: string[];
  /** A total: bold, with a rule above it. */
  total?: boolean;
}

export function FigureTable({ columns, rows, footer }: { columns: string[]; rows: FigureRow[]; footer?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card padded="none">
      <View style={[styles.row, styles.head, { borderColor: colors.divider }]}>
        <View style={styles.label} />
        {columns.map((column) => (
          <Txt key={column} variant="label" tone="muted" style={styles.value}>
            {column}
          </Txt>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.key} style={[styles.row, row.total && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.divider }]}>
          <Txt variant={row.total ? 'bodyStrong' : 'callout'} tone={row.total ? 'default' : 'muted'} style={styles.label}>
            {row.label}
          </Txt>
          {row.values.map((value, index) => (
            <Txt key={index} variant={row.total ? 'bodyStrong' : 'callout'} numeric style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {value}
            </Txt>
          ))}
        </View>
      ))}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: layout.card, paddingVertical: spacing.sm },
  head: { borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: layout.row },
  label: { flex: 1.5 },
  value: { flex: 1, textAlign: 'right' },
  footer: { paddingHorizontal: layout.card, paddingBottom: layout.row },
});
