/** Shown when the fingerprint prompt was cancelled: try again, or sign out. */

import { Fingerprint } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandBackdrop } from '../../components/BrandBackdrop';
import { BrandLogo } from '../../components/Brand';
import { Button } from '../../components/Button';
import { Txt } from '../../components/Text';
import { TierContext } from '../../components/Tier';
import { unlockWithBiometrics } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';

export function LockScreen({ onUnlocked, onSignOut }: { onUnlocked: () => void; onSignOut: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const unlock = async () => {
    setBusy(true);
    try {
      const result = await unlockWithBiometrics(true);
      if (result && result !== 'cancelled') onUnlocked();
      else if (!result) onSignOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <TierContext.Provider value="tier2">
      <View style={[styles.root, { backgroundColor: colors.brandSurface, paddingTop: insets.top, paddingBottom: insets.bottom + layout.section }]}>
        <BrandBackdrop />
        <View style={styles.body}>
          <BrandLogo height={layout.avatarLg - spacing.md} />
          <View style={[styles.mark, { backgroundColor: colors.brandSurfaceRaised, borderColor: colors.tabBarBorder }]}>
            <Fingerprint size={layout.avatarLg - spacing.xl} color={colors.accent} strokeWidth={1.5} />
          </View>
          <Txt variant="display" style={{ color: colors.onBrandSurface }} align="center">
            {t('AskMiraa is locked')}
          </Txt>
          <Txt variant="callout" style={{ color: colors.onBrandSurfaceMuted }} align="center">
            {t('Unlock with your fingerprint, face or phone passcode.')}
          </Txt>
        </View>
        <View style={styles.actions}>
          <Button label={t('Unlock')} variant="accent" onPress={() => void unlock()} loading={busy} fullWidth />
          <Button label={t('Sign out instead')} variant="secondary" onPress={onSignOut} fullWidth />
        </View>
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
  actions: { gap: spacing.sm },
});
