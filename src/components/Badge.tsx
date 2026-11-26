/** Status badges, count badges and chips. */

import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { statusLabel, toneFor, type Tone } from '../core/status';
import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing, type Colors } from '../theme/tokens';
import { Txt } from './Text';

export function toneColors(colors: Colors, tone: Tone): { background: string; foreground: string } {
  switch (tone) {
    case 'success':
      return { background: colors.successSoft, foreground: colors.success };
    case 'warning':
      return { background: colors.warningSoft, foreground: colors.warning };
    case 'danger':
      return { background: colors.dangerSoft, foreground: colors.danger };
    case 'info':
      return { background: colors.infoSoft, foreground: colors.info };
    case 'primary':
      return { background: colors.primarySoft, foreground: colors.primaryText };
    default:
      return { background: colors.neutralSoft, foreground: colors.textMuted };
  }
}

/** A status word from the API in its tone: `<StatusBadge status="pending" />`. */
export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  return <Badge tone={toneFor(status)} label={label ?? statusLabel(status)} />;
}

export function Badge({ label, tone = 'neutral', icon: Icon }: { label: string; tone?: Tone; icon?: LucideIcon }) {
  const { colors } = useTheme();
  const c = toneColors(colors, tone);
  return (
    <View style={[styles.badge, { backgroundColor: c.background }]}>
      {Icon ? <Icon size={layout.iconSm - 4} color={c.foreground} strokeWidth={2.5} /> : null}
      <Txt variant="label" style={{ color: c.foreground }} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/** A small count bubble (unread notifications). */
/**
 * A number on a tab or icon. `alert` (red) is for things waiting on the
 * person; `quiet` is a plain tally, like how many claims are in progress.
 */
export function CountBadge({ count, max = 99, tone = 'alert' }: { count: number; max?: number; tone?: 'alert' | 'quiet' | 'inverse' }) {
  const { colors } = useTheme();
  if (count <= 0) return null;
  // `inverse` sits on a maroon fill (the active segment): white with a maroon number.
  const background = tone === 'quiet' ? colors.neutralSoft : tone === 'inverse' ? colors.onPrimary : colors.danger;
  const foreground = tone === 'quiet' ? colors.textMuted : tone === 'inverse' ? colors.primary : colors.surface;
  return (
    <View style={[styles.count, { backgroundColor: background }]}>
      {/* A count sits in a small round badge: it grows a little with large text, never out of the badge. */}
      <Txt variant="label" style={{ color: foreground }} maxFontSizeMultiplier={1.2}>
        {count > max ? `${max}+` : String(count)}
      </Txt>
    </View>
  );
}

/**
 * An outlined pill stating a fact, as the portal's punch card does: "Not
 * punched in", "General shift · 09:30–18:30". A dot in front gives its tone.
 */
export function Pill({ label, dot, icon: Icon }: { label: string; dot?: Tone; icon?: LucideIcon }) {
  const { colors } = useTheme();
  const dotColor = dot ? (dot === 'neutral' ? colors.textSubtle : toneColors(colors, dot).foreground) : null;
  return (
    <View style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {dotColor ? <View style={[styles.pillDot, { backgroundColor: dotColor }]} /> : null}
      {Icon ? <Icon size={layout.iconSm - 2} color={colors.textMuted} strokeWidth={2} /> : null}
      <Txt variant="label" numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/** A selectable chip, used for filters and quick choices. */
export function Chip({
  label,
  selected,
  onPress,
  icon: Icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: LucideIcon;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: spacing.xs, bottom: spacing.xs }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      {Icon ? <Icon size={layout.iconSm} color={selected ? colors.onPrimary : colors.primaryText} /> : null}
      <Txt variant="calloutStrong" tone={selected ? 'onPrimary' : 'default'} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  count: {
    minWidth: spacing.lg + spacing.xs,
    minHeight: spacing.lg + spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + spacing.xxs,
    paddingHorizontal: spacing.md - spacing.xxs,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: layout.hairline,
    maxWidth: '100%',
  },
  pillDot: { width: spacing.sm - spacing.xxs, height: spacing.sm - spacing.xxs, borderRadius: radius.pill },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.controlSmall,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: layout.hairline,
  },
});
