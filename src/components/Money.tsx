/**
 * An amount, optionally masked until tapped.
 *
 * Salary and bank figures are hidden by default on a phone that is shown
 * around a factory floor. Tapping reveals; the reveal does not persist.
 *
 * On a pay screen (`withReveal`) every figure shares one switch: tapping the
 * eye shows them all, tapping again hides them all. A screen never shows the
 * gross on one line while the net is hidden on the next.
 */

const RevealContext = createContext<{ revealed: boolean; toggle: () => void } | null>(null);

/** Wrap a screen so all its amounts hide and show together. */
export function withReveal<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  function Revealable(props: P) {
    const [revealed, setRevealed] = useState(false);
    const value = useMemo(() => ({ revealed, toggle: () => setRevealed((r) => !r) }), [revealed]);
    return (
      <RevealContext.Provider value={value}>
        <Screen {...props} />
      </RevealContext.Provider>
    );
  }
  Revealable.displayName = `withReveal(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return Revealable;
}

/** Format an amount, or the mask while the screen's figures are hidden. */
export function useMoneyText(): (value: string | number | null | undefined, options?: MoneyOptions) => string {
  const reveal = useContext(RevealContext);
  const revealed = reveal ? reveal.revealed : true;
  return (value, options) => (revealed ? formatINR(value, options) : MASK);
}

import { Eye, EyeOff } from 'lucide-react-native';
import { createContext, useContext, useMemo, useState, type ComponentType } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { MASK, formatINR, type MoneyOptions } from '../core/money';
import { t } from '../lib/i18n';
import { useTheme } from '../theme/ThemeProvider';
import { layout, spacing, type TypeVariant } from '../theme/tokens';
import { Txt, type TextTone } from './Text';

export function Money({
  value,
  variant = 'calloutStrong',
  tone = 'default',
  masked = false,
  options,
}: {
  value: string | number | null | undefined;
  variant?: TypeVariant;
  tone?: TextTone;
  /** Hide until tapped. */
  masked?: boolean;
  options?: MoneyOptions;
}) {
  const { colors } = useTheme();
  const reveal = useContext(RevealContext);
  const [localShown, setLocalShown] = useState(!masked);
  const shown = reveal ? reveal.revealed : localShown;
  const toggle = reveal ? reveal.toggle : () => setLocalShown((s) => !s);
  const text = formatINR(value, options);

  if (!masked) {
    return (
      <Txt variant={variant} tone={tone} numeric>
        {text}
      </Txt>
    );
  }
  const Icon = shown ? EyeOff : Eye;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown ? text : t('Amount hidden. Tap to show')}
      onPress={toggle}
      hitSlop={{ top: spacing.md, bottom: spacing.md }}
      style={styles.row}
    >
      <Txt variant={variant} tone={tone} numeric>
        {shown ? text : MASK}
      </Txt>
      <Icon size={layout.iconSm} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start' },
  toggle: { alignSelf: 'flex-end' },
});

/** "Show amounts" / "Hide amounts", for a pay screen with no headline figure to tap. */
export function RevealToggle() {
  const reveal = useContext(RevealContext);
  const { colors } = useTheme();
  if (!reveal) return null;
  const Icon = reveal.revealed ? EyeOff : Eye;
  const label = reveal.revealed ? t('Hide amounts') : t('Show amounts');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={reveal.toggle}
      hitSlop={{ top: spacing.md, bottom: spacing.md }}
      style={[styles.row, styles.toggle]}
    >
      <Icon size={layout.iconSm} color={colors.primary} />
      <Txt variant="calloutStrong" tone="primary">
        {label}
      </Txt>
    </Pressable>
  );
}
