/**
 * A tick box: for choosing several things at once (approvals to decide in
 * bulk). `mixed` is the "some of these" state of a select-all box. The touch
 * area is 48dp even though the box is small.
 */

import { Check, Minus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing } from '../theme/tokens';

export function Checkbox({
  checked,
  mixed = false,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const on = checked || mixed;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: mixed ? 'mixed' : checked, disabled: Boolean(disabled) }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      hitSlop={spacing.md}
      style={styles.hit}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: on ? colors.primary : colors.borderStrong,
            backgroundColor: on ? colors.primary : colors.surface,
          },
          disabled && styles.disabled,
        ]}
      >
        {mixed ? (
          <Minus size={layout.iconSm} color={colors.onPrimary} strokeWidth={3} />
        ) : checked ? (
          <Check size={layout.iconSm} color={colors.onPrimary} strokeWidth={3} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignItems: 'center', justifyContent: 'center' },
  box: {
    width: layout.iconLg - spacing.xxs,
    height: layout.iconLg - spacing.xxs,
    borderRadius: radius.sm,
    borderWidth: spacing.xxs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});
