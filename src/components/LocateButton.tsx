/**
 * "Find my location", as on Google Maps: a round button over a map that asks
 * the phone for a fresh, precise fix; and the line under the map that says
 * how precise the current fix is against what the company asks for.
 *
 * The punch and visit buttons stay off until that line is green.
 */

import { CheckCircle2, LocateFixed, MapPinOff } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { t } from '../lib/i18n';
import type { LivePosition } from '../lib/useLivePosition';
import { useTheme } from '../theme/ThemeProvider';
import { elevation, layout, radius, spacing } from '../theme/tokens';
import { Txt } from './Text';

export function LocateButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Find my location')}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        styles.button,
        elevation.raised,
        { backgroundColor: pressed ? colors.surfaceSunken : colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.primaryText} />
      ) : (
        <LocateFixed size={layout.iconLg} color={colors.primaryText} strokeWidth={2} />
      )}
    </Pressable>
  );
}

/** "Location found (±18 m)", or what is wrong and what fixes it. */
export function FixLine({
  position,
  needed,
  locating,
  action,
}: {
  position: LivePosition | null;
  needed: number;
  locating: boolean;
  /** What the buttons are waiting for, e.g. "Punch in and out". */
  action: string;
}) {
  const { colors } = useTheme();
  const accuracy = position?.accuracy ?? null;
  const good = position !== null && !position.mocked && (accuracy === null || accuracy <= needed);
  const text = position?.mocked
    ? t('A fake location app is changing your location. Turn it off (Settings → Developer options → Select mock location app → No app), then tap the locate button. {action} stay off until then.', { action })
    : !position
    ? locating
      ? t('Finding your location… {action} unlock once it is found.', { action })
      : t('No location yet. Turn on location and tap the locate button. {action} unlock once it is found.', { action })
    : good
      ? accuracy !== null
        ? t('Location found (±{metres} m)', { metres: String(Math.round(accuracy)) })
        : t('Location found')
      : t('Location found to ±{found} m; your company needs it within {needed} m. Tap the locate button, or step outside or near a window. {action} unlock once it is found.', {
          found: String(Math.round(accuracy ?? 0)),
          needed: String(needed),
          action,
        });
  const Icon = good ? CheckCircle2 : MapPinOff;
  return (
    <View style={styles.line} accessibilityLiveRegion="polite">
      <Icon size={layout.iconSm} color={good ? colors.success : colors.danger} strokeWidth={2} />
      <Txt variant="caption" tone={good ? 'success' : 'danger'} style={styles.flex}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: layout.iconTile,
    height: layout.iconTile,
    borderRadius: radius.pill,
    borderWidth: layout.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs + spacing.xxs },
  flex: { flex: 1 },
});
