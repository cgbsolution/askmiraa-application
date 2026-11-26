/**
 * A person's photo, or their initials.
 *
 * Photos are served by the API behind auth, so the request carries the
 * bearer token. A photo that fails to load falls back to initials.
 */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { initials } from '../core/status';
import { API_BASE, authHeaders } from '../lib/api';
import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing } from '../theme/tokens';
import { Txt } from './Text';

export function photoUri(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url) || url.startsWith('file:') || url.startsWith('data:')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function Avatar({
  name,
  url,
  size = layout.avatar,
  strong = false,
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: number;
  /** Solid maroon with white initials — the portal's hero avatar. */
  strong?: boolean;
}) {
  const { colors } = useTheme();
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);
  const uri = photoUri(url);

  useEffect(() => {
    let alive = true;
    if (uri) void authHeaders().then((h) => alive && setHeaders(h));
    return () => {
      alive = false;
    };
  }, [uri]);

  const frame = { width: size, height: size, borderRadius: radius.pill };
  if (uri && headers && !failed) {
    return (
      <Image
        source={{ uri, headers }}
        style={[frame, { backgroundColor: colors.primarySoft }]}
        contentFit="cover"
        onError={() => setFailed(true)}
        accessibilityLabel={name ?? undefined}
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.initials, frame, { backgroundColor: strong ? colors.primary : colors.iconChip }]} accessibilityLabel={name ?? undefined}>
      <Txt
        variant={size >= layout.avatarLg - spacing.sm ? 'title' : size >= layout.avatar ? 'calloutStrong' : 'label'}
        tone={strong ? 'onPrimary' : 'primary'}
        maxFontSizeMultiplier={1.2}
      >
        {initials(name)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { alignItems: 'center', justifyContent: 'center' },
});
