/**
 * Shown instead of the app on a rooted / jailbroken phone or an emulator
 * (lib/deviceIntegrity.ts): there, a fake-GPS app can hide itself, so no
 * punch or visit location from it could be trusted.
 */

import { ShieldAlert } from 'lucide-react-native';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandBackdrop } from '../../components/BrandBackdrop';
import { BrandLogo } from '../../components/Brand';
import { Button } from '../../components/Button';
import { Txt } from '../../components/Text';
import { TierContext } from '../../components/Tier';
import type { DeviceVerdict } from '../../lib/deviceIntegrity';
import { t } from '../../lib/i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';

export function BlockedDeviceScreen({ verdict }: { verdict: Exclude<DeviceVerdict, 'ok'> }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const title = verdict === 'emulator' ? t('AskMiraa does not run on emulators') : t('AskMiraa does not run on rooted phones');
  const message =
    verdict === 'emulator'
      ? t('Punch and visit locations must come from a real phone. Install AskMiraa on your own phone.')
      : t('This phone is rooted or jailbroken, so apps on it can fake your location. To keep everyone’s attendance honest, AskMiraa only runs on phones that are not rooted. Use another phone, or punch from the web portal if your company allows it.');

  return (
    <TierContext.Provider value="tier2">
      <View style={[styles.root, { backgroundColor: colors.brandSurface, paddingTop: insets.top, paddingBottom: insets.bottom + layout.section }]}>
        <BrandBackdrop />
        <View style={styles.body}>
          <BrandLogo height={layout.avatarLg - spacing.md} />
          <View style={[styles.mark, { backgroundColor: colors.brandSurfaceRaised, borderColor: colors.tabBarBorder }]}>
            <ShieldAlert size={layout.avatarLg - spacing.xl} color={colors.accent} strokeWidth={1.5} />
          </View>
          <Txt variant="display" style={{ color: colors.onBrandSurface }} align="center">
            {title}
          </Txt>
          <Txt variant="callout" style={{ color: colors.onBrandSurfaceMuted }} align="center">
            {message}
          </Txt>
        </View>
        {Platform.OS === 'android' ? (
          <Button label={t('Close AskMiraa')} variant="secondary" onPress={() => BackHandler.exitApp()} fullWidth />
        ) : null}
      </View>
    </TierContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: layout.gutter, justifyContent: 'space-between' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  mark: {
    width: layout.avatarXl,
    height: layout.avatarXl,
    borderRadius: radius.pill,
    borderWidth: layout.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
});
