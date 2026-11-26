/**
 * The tiered card.
 *
 * Screens declare their tier (once, on `Screen`) and get the right surface.
 * They do not pick radii or fills themselves — that is how the Tier 1 / Tier 2
 * split erodes one pull request at a time, until the payslip screen looks as
 * casual as the shoutout feed.
 *
 * Every card has the same inner padding (`layout.card`), Tier 1 or Tier 2, so
 * cards side by side line up. `padded="none"` is for cards that hold a list,
 * whose rows carry their own padding.
 */

import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { elevation, layout, radius, surface, type Tier } from '../theme/tokens';
import { useTier } from './Tier';

export interface CardProps {
  children: ReactNode;
  tier?: Tier;
  /** `soft` is the warm Tier 2 fill for a hero or an inset panel; `sunken` sits below the page. */
  variant?: 'surface' | 'soft' | 'sunken' | 'primary';
  padded?: 'default' | 'none';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  tier,
  variant = 'surface',
  padded = 'default',
  onPress,
  accessibilityLabel,
  style,
}: CardProps) {
  const { colors } = useTheme();
  const contextTier = useTier();
  const resolved = tier ?? contextTier;
  const s = surface(resolved, colors);
  const fill =
    variant === 'soft'
      ? colors.soft
      : variant === 'sunken'
        ? colors.surfaceSunken
        : variant === 'primary'
          ? colors.primary
          : s.backgroundColor;
  const border = variant === 'primary' ? colors.primary : variant === 'soft' ? colors.softBorder : s.borderColor;

  const base: ViewStyle = {
    backgroundColor: fill,
    borderRadius: resolved === 'tier2' ? radius.tier2 : radius.tier1,
    borderWidth: layout.hairline,
    borderColor: border,
    padding: padded === 'none' ? 0 : layout.card,
    overflow: padded === 'none' ? 'hidden' : 'visible',
    shadowColor: colors.shadow,
    ...(resolved === 'tier2' && variant === 'surface' ? elevation.card : null),
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { backgroundColor: colors.surfaceSunken }, style]}
    >
      {children}
    </Pressable>
  );
}

/** Historical name: the first slice called it Surface. */
export const Surface = Card;
