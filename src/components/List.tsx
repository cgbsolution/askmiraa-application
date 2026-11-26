/**
 * Grouped lists: rows in one card, separated by hairlines.
 *
 * Settings-style menus, records and line items are lists, not a stack of
 * separate cards ("everything's a card" is the commonest tell of a generated
 * app). Every row has the same height, padding and icon tile, so menus on
 * different screens line up.
 */

import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing, type Colors } from '../theme/tokens';
import { Badge, StatusBadge } from './Badge';
import { Card } from './Card';
import { SpotTile, type SpotName } from './Spot';
import { Txt, type TextTone } from './Text';
import type { Tier } from '../theme/tokens';

export type IconTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function iconTileColors(colors: Colors, tone: IconTone): { background: string; foreground: string } {
  switch (tone) {
    case 'accent':
      return { background: colors.accentSoft, foreground: colors.accentText };
    case 'success':
      return { background: colors.successSoft, foreground: colors.success };
    case 'warning':
      return { background: colors.warningSoft, foreground: colors.warning };
    case 'danger':
      return { background: colors.dangerSoft, foreground: colors.danger };
    case 'info':
      return { background: colors.infoSoft, foreground: colors.info };
    case 'neutral':
      return { background: colors.neutralSoft, foreground: colors.textMuted };
    default:
      return { background: colors.iconChip, foreground: colors.onIconChip };
  }
}

/** The rounded square behind a row's icon. */
export function IconTile({ icon: Icon, tone = 'primary', size = layout.iconTile }: { icon: LucideIcon; tone?: IconTone; size?: number }) {
  const { colors } = useTheme();
  const c = iconTileColors(colors, tone);
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: c.background }]}>
      <Icon size={Math.round(size * 0.5)} color={c.foreground} strokeWidth={2} />
    </View>
  );
}

/** A card of rows with hairline separators. */
export function ListGroup({ children, tier }: { children: ReactNode; tier?: Tier }) {
  const { colors } = useTheme();
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <Card padded="none" tier={tier}>
      {items.map((child, index) => (
        <Fragment key={(child.key as string) ?? index}>
          {index > 0 ? <View style={[styles.separator, { backgroundColor: colors.divider }]} /> : null}
          {child}
        </Fragment>
      ))}
    </Card>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** A second muted line, e.g. a date under a subtitle. */
  meta?: string;
  icon?: LucideIcon;
  iconTone?: IconTone;
  /**
   * The website-style picture for a row that leads somewhere (a menu entry,
   * a service). Wins over `icon`; status rows keep a line icon in its tone.
   */
  spot?: SpotName;
  /** Something at the leading edge instead of an icon (an avatar). */
  leading?: ReactNode;
  /** Text at the trailing edge (an amount, a count). */
  value?: string;
  valueTone?: TextTone;
  /** A badge or control at the trailing edge. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Show a chevron. Defaults to true when the row is tappable. */
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  numberOfLines?: number;
}

export function ListRow({
  title,
  subtitle,
  meta,
  icon,
  iconTone = 'primary',
  spot,
  leading,
  value,
  valueTone = 'default',
  trailing,
  onPress,
  chevron,
  destructive,
  disabled,
  accessibilityHint,
  numberOfLines = 2,
}: ListRowProps) {
  const { colors } = useTheme();
  const showChevron = chevron ?? Boolean(onPress);
  // With the phone's text made larger, a line more before cutting a title or a date off.
  const large = useWindowDimensions().fontScale > 1.15;
  const lines = large ? numberOfLines + 1 : numberOfLines;
  // A status badge beside a title leaves the title a narrow column at large text; it goes under it.
  const badgeBelow = large && isValidElement(trailing) && (trailing.type === Badge || trailing.type === StatusBadge);

  const body = (
    <>
      {leading ?? (spot ? <SpotTile name={spot} size="sm" /> : icon ? <IconTile icon={icon} tone={destructive ? 'danger' : iconTone} /> : null)}
      <View style={styles.texts}>
        <Txt variant="bodyStrong" tone={destructive ? 'danger' : 'default'} numberOfLines={lines}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="callout" tone="muted" numberOfLines={lines}>
            {subtitle}
          </Txt>
        ) : null}
        {meta ? (
          <Txt variant="caption" tone="subtle" numberOfLines={large ? 2 : 1}>
            {meta}
          </Txt>
        ) : null}
        {badgeBelow ? <View style={styles.badgeBelow}>{trailing}</View> : null}
      </View>
      {value ? (
        <Txt variant="calloutStrong" tone={valueTone} numeric style={styles.value}>
          {value}
        </Txt>
      ) : null}
      {badgeBelow ? null : trailing}
      {showChevron ? <ChevronRight size={layout.icon} color={colors.textSubtle} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSunken }, disabled && styles.disabled]}
    >
      {body}
    </Pressable>
  );
}

/** A label and its value on one line: "Gross pay ……… ₹82,000.00". */
export function KeyValue({
  label,
  value,
  strong,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  tone?: TextTone;
}) {
  return (
    <View style={styles.kv} accessible accessibilityLabel={`${label}: ${typeof value === 'string' ? value : ''}`}>
      <Txt variant={strong ? 'bodyStrong' : 'callout'} tone={strong ? 'default' : 'muted'} style={styles.kvLabel}>
        {label}
      </Txt>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Txt variant={strong ? 'bodyStrong' : 'calloutStrong'} tone={tone} numeric style={styles.kvValue}>
          {value}
        </Txt>
      ) : (
        value
      )}
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.divider }]} />;
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.row,
    minHeight: layout.rowHeight,
    paddingHorizontal: layout.card,
    paddingVertical: spacing.md,
  },
  texts: { flex: 1, gap: spacing.xxs },
  badgeBelow: { flexDirection: 'row', paddingTop: spacing.xxs },
  value: { flexShrink: 0, maxWidth: '45%', textAlign: 'right' },
  separator: { height: layout.hairline, marginLeft: layout.card },
  kv: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: layout.row },
  kvLabel: { flex: 1 },
  kvValue: { textAlign: 'right', flexShrink: 0, maxWidth: '60%' },
  divider: { height: layout.hairline },
  disabled: { opacity: 0.5 },
});
