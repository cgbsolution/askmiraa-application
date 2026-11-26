/**
 * A floating action button: the one way to start something new on a list
 * screen (apply leave, raise a ticket), as the older HRMS had. Maroon, round,
 * with a label for screen readers and, when `extended`, on screen too.
 * Pass it to `Screen`'s `overlay` so it sits above the tab bar.
 */

import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { elevation, layout, radius, spacing } from '../theme/tokens';
import { Txt } from './Text';

export function Fab({ icon: Icon, label, onPress, extended = false }: { icon: LucideIcon; label: string; onPress: () => void; extended?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.fab,
        extended && styles.extended,
        elevation.raised,
        { backgroundColor: pressed ? colors.primaryPressed : colors.primary, shadowColor: colors.shadow },
      ]}
    >
      <Icon size={layout.iconLg} color={colors.onPrimary} strokeWidth={2.25} />
      {extended ? (
        <Txt variant="button" tone="onPrimary">
          {label}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    minWidth: layout.fab,
    height: layout.fab,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  extended: { paddingHorizontal: spacing.lg + spacing.xs },
});
