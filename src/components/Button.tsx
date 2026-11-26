/**
 * Buttons.
 *
 * As on the portal:
 * - `primary` (Maroon) for a screen's main action: Submit, Punch in, Approve.
 * - `accent` (Marigold) for the one hero call to action on a hub ("Apply leave").
 * - `secondary` outlined with ink text, `soft` a quiet maroon tint, `ghost`
 *   text-only, `danger` for destructive steps.
 *
 * Every button is the portal's rounded rectangle (12dp), at least 48dp tall,
 * shows pressed feedback, and keeps its label for screen readers while
 * loading. A loading button ignores taps, which is half of "double-tap
 * submit cannot create two records" (the other half is the mutation's own
 * guard).
 */

import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing, type Colors, type Tier } from '../theme/tokens';
import { CountBadge } from './Badge';
import { Txt, type TextTone } from './Text';

export type ButtonVariant = 'accent' | 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';

interface Palette {
  background: string;
  pressed: string;
  border: string;
  text: TextTone;
  icon: string;
  spinner: string;
}

function paletteFor(colors: Colors, variant: ButtonVariant): Palette {
  switch (variant) {
    case 'accent':
      return { background: colors.accent, pressed: colors.accent, border: colors.accent, text: 'onAccent', icon: colors.onAccent, spinner: colors.onAccent };
    case 'primary':
      return { background: colors.primary, pressed: colors.primaryPressed, border: colors.primary, text: 'onPrimary', icon: colors.onPrimary, spinner: colors.onPrimary };
    case 'secondary':
      return { background: colors.surface, pressed: colors.surfaceSunken, border: colors.borderStrong, text: 'default', icon: colors.primaryText, spinner: colors.primary };
    case 'soft':
      return { background: colors.primarySoft, pressed: colors.iconChip, border: colors.primarySoft, text: 'primary', icon: colors.primaryText, spinner: colors.primary };
    case 'danger':
      return { background: colors.danger, pressed: colors.danger, border: colors.danger, text: 'onPrimary', icon: colors.onPrimary, spinner: colors.onPrimary };
    default:
      return { background: 'transparent', pressed: colors.primarySoft, border: 'transparent', text: 'primary', icon: colors.primaryText, spinner: colors.primary };
  }
}

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Accepted for older call sites; both tiers share the portal's shape. */
  tier?: Tier;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const p = paletteFor(colors, variant);
  const inactive = disabled || loading;
  const small = size === 'sm';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={small ? { top: spacing.xs, bottom: spacing.xs } : undefined}
      style={({ pressed }) => [
        styles.base,
        small ? styles.small : styles.medium,
        {
          backgroundColor: inactive && variant !== 'ghost' ? colors.neutralSoft : pressed ? p.pressed : p.background,
          borderColor: inactive && variant !== 'ghost' ? colors.neutralSoft : p.border,
        },
        fullWidth && styles.fullWidth,
        pressed && !inactive && (variant === 'accent' || variant === 'danger') && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.spinner} size="small" />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={small ? layout.iconSm : layout.icon} color={inactive ? colors.textSubtle : p.icon} strokeWidth={2} /> : null}
          <Txt variant={small ? 'buttonSmall' : 'button'} tone={inactive ? 'subtle' : p.text} numberOfLines={1}>
            {label}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

export interface IconButtonProps {
  icon: LucideIcon;
  /** Required: an icon alone says nothing to a screen reader. */
  label: string;
  onPress: () => void;
  /** `outlined` is the portal header's round bordered button. */
  variant?: 'plain' | 'tinted' | 'outlined' | 'onPrimary';
  disabled?: boolean;
  /** A dot on the corner. */
  badge?: boolean;
  /** A number on the corner (unread, waiting). */
  count?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon: Icon, label, onPress, variant = 'plain', disabled, badge, count, style }: IconButtonProps) {
  const { colors } = useTheme();
  const color = variant === 'onPrimary' ? colors.onBrandSurface : variant === 'tinted' ? colors.primaryText : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={variant === 'outlined' ? spacing.xs : undefined}
      style={({ pressed }) => [
        styles.iconButton,
        variant === 'tinted' && { backgroundColor: colors.primarySoft },
        variant === 'outlined' && [styles.outlined, { borderColor: colors.border, backgroundColor: colors.surface }],
        pressed && { backgroundColor: variant === 'onPrimary' ? colors.brandSurfaceRaised : colors.surfaceSunken },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon size={variant === 'outlined' ? layout.icon : layout.iconLg - 2} color={color} strokeWidth={2} />
      {count && count > 0 ? (
        <View style={styles.count} pointerEvents="none">
          <CountBadge count={count} />
        </View>
      ) : badge ? (
        <View style={[styles.dot, { backgroundColor: colors.danger, borderColor: colors.surface }]} />
      ) : null}
    </Pressable>
  );
}

/** A text link inside content: "See all ›", "Change". */
export function LinkButton({
  label,
  onPress,
  tone = 'primary',
  arrow = false,
}: {
  label: string;
  onPress: () => void;
  tone?: TextTone;
  /** A small chevron after the label, for "See all" and the like. */
  arrow?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: spacing.md, bottom: spacing.md, left: spacing.sm, right: spacing.sm }}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Txt variant="calloutStrong" tone={tone}>
        {label}
      </Txt>
      {arrow ? <ChevronRight size={layout.iconSm} color={tone === 'primary' ? colors.primaryText : colors.textMuted} strokeWidth={2.25} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.hairline,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
  },
  medium: { minHeight: layout.touch },
  small: { minHeight: layout.controlSmall, paddingHorizontal: spacing.md },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  iconButton: {
    width: layout.touch,
    height: layout.touch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlined: { width: layout.controlSmall + spacing.xs, height: layout.controlSmall + spacing.xs, borderWidth: layout.hairline },
  count: { position: 'absolute', top: -spacing.xs, right: -spacing.xs },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  dot: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: spacing.sm + spacing.xxs,
    height: spacing.sm + spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: spacing.xxs,
  },
});
