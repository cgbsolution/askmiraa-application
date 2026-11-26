/**
 * The company's logo at the top of Home, as the old HRMS opened with it.
 *
 * The person's own company: the logo an admin sets on their legal entity in
 * the portal (Settings → Organisation — a sister company, a client the group
 * staffs), else the workspace's logo (Settings → Company), both from the
 * session. Without a logo (or if it cannot be fetched), the company's name
 * instead; never a stand-in picture. An API too old to send the company falls
 * back to the workspace's public sign-in page.
 */

import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { sessionApi } from '../api/auth';
import { useSession } from '../lib/session';
import { useTheme } from '../theme/ThemeProvider';
import { elevation, layout, radius, spacing } from '../theme/tokens';
import { photoUri } from './Avatar';
import { Skeleton } from './Skeleton';
import { Txt } from './Text';

export function CompanyCard() {
  const { colors } = useTheme();
  const { session } = useSession();
  const company = session?.company;
  const slug = session?.tenant.slug ?? null;
  const name = company?.name || session?.tenant.name || '';
  const legacy = Boolean(slug) && company === undefined;
  const brand = useQuery({
    queryKey: ['workspace-brand', slug],
    queryFn: () => sessionApi.workspace(slug!),
    enabled: legacy,
    // A logo changes rarely; its URL carries a version, so a new one shows on the next fetch.
    staleTime: 6 * 60 * 60_000,
  });
  const [failed, setFailed] = useState<string | null>(null);
  const uri = photoUri(legacy ? brand.data?.logo_url : company?.logo_url);
  const showLogo = Boolean(uri) && failed !== uri;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[styles.card, { backgroundColor: colors.logoPlate, borderColor: colors.border, shadowColor: colors.shadow }]}
    >
      {legacy && brand.isPending ? (
        <Skeleton width="55%" height={layout.spotMd} />
      ) : showLogo ? (
        <Image source={{ uri: uri! }} style={styles.logo} contentFit="contain" transition={150} onError={() => setFailed(uri)} />
      ) : (
        <Txt variant="display" align="center" numberOfLines={2} style={{ color: colors.onLogoPlate }}>
          {name}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.spotXl + spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: layout.hairline,
    ...elevation.card,
  },
  logo: { width: '78%', height: layout.spotLg },
});
