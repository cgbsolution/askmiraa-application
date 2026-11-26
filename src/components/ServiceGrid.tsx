/**
 * Services as the old HRMS showed them on its home screen: two to a row, each
 * a white tile with its picture on the left and its name beside it.
 *
 * The pictures are the website's own icons (components/Spot.tsx), on the soft
 * tile the website gives them; Ask Miraa's tile is Marigold, as on the website.
 * A service with something waiting (approvals, a punch not recorded, a policy
 * to acknowledge) carries its count. Rows are laid out in pairs, so a lone
 * last tile keeps its width instead of stretching across.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { Service } from '../core/services';
import type { SpotName } from '../core/spotNames';
import { t } from '../lib/i18n';
import { useGo } from '../navigation/navigate';
import { useTheme } from '../theme/ThemeProvider';
import { elevation, layout, radius, spacing } from '../theme/tokens';
import { CountBadge } from './Badge';
import { SpotTile } from './Spot';
import { Txt } from './Text';

export interface GridEntry {
  key: string;
  label: string;
  spot: SpotName;
  marigold?: boolean;
  count?: number;
  onPress: () => void;
}

/** The services as tiles; `extra` tiles (Home's "All services") follow them. */
export function ServiceGrid({
  services,
  counts,
  extra = [],
}: {
  services: Service[];
  counts?: Partial<Record<string, number>>;
  extra?: GridEntry[];
}) {
  const go = useGo();
  const entries: GridEntry[] = [
    ...services.map((service) => ({
      key: service.key,
      label: t(service.label),
      spot: service.spot,
      marigold: service.marigold,
      count: counts?.[service.key] ?? 0,
      onPress: () => go(service.route),
    })),
    ...extra,
  ];
  const rows: GridEntry[][] = [];
  for (let i = 0; i < entries.length; i += 2) rows.push(entries.slice(i, i + 2));
  const stacked = useStacked();
  return (
    <View style={styles.grid} onLayout={stacked.onLayout}>
      {rows.map((row) => (
        <View key={row.map((entry) => entry.key).join('|')} style={styles.row}>
          {row.map((entry) => (
            <ServiceTile key={entry.key} entry={entry} stacked={stacked.value} />
          ))}
          {row.length === 1 ? <View style={styles.flex} /> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Whether the tiles put the picture above the name. Beside the picture a name
 * gets what is left of a half-width tile; on a narrow phone or with the
 * phone's text made larger, that is less than a long word ("declaration",
 * "attendance") needs, and Android would break the word in the middle. Then
 * the picture goes on top and the name gets the tile's whole width.
 */
function useStacked(): { value: boolean; onLayout: (event: { nativeEvent: { layout: { width: number } } }) => void } {
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const gridWidth = measured || windowWidth - layout.gutter * 2;
  const tileWidth = (gridWidth - spacing.md) / 2;
  const besidePicture = tileWidth - spacing.md * 2 - layout.spotMd - (spacing.sm + spacing.xxs);
  // About ten and a half characters of Inter Medium at 14 sp, as large as the label may grow.
  const longWord = 10.5 * 8.4 * Math.min(fontScale, MAX_LABEL_SCALE);
  return {
    value: besidePicture < longWord,
    onLayout: (event) => setMeasured(Math.round(event.nativeEvent.layout.width)),
  };
}

/** How far a tile's name grows with the phone's text size. */
const MAX_LABEL_SCALE = 1.3;

export function ServiceTile({ entry, stacked = false }: { entry: GridEntry; stacked?: boolean }) {
  const { colors } = useTheme();
  const count = entry.count ?? 0;
  // One word stays on one line and shrinks a little if it must, rather than breaking in the middle.
  const oneWord = !entry.label.trim().includes(' ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${entry.label}, ${count}` : entry.label}
      onPress={entry.onPress}
      style={({ pressed }) => [
        styles.tile,
        stacked && styles.tileStacked,
        { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
        pressed && { backgroundColor: colors.surfaceSunken, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View>
        <SpotTile name={entry.spot} size="md" tone={entry.marigold ? 'marigold' : 'blush'} />
        {/* On the picture's corner, like an app badge, so the name keeps its width. */}
        {count > 0 ? (
          <View style={styles.count} pointerEvents="none">
            <CountBadge count={count} />
          </View>
        ) : null}
      </View>
      <Txt
        variant="calloutStrong"
        numberOfLines={oneWord ? 1 : 2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        maxFontSizeMultiplier={MAX_LABEL_SCALE}
        align={stacked ? 'center' : undefined}
        style={stacked ? styles.labelStacked : styles.label}
      >
        {entry.label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xxs,
    minHeight: layout.spotMd + spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: layout.hairline,
    ...elevation.card,
  },
  tileStacked: { flexDirection: 'column', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md + spacing.xxs },
  label: { flex: 1 },
  labelStacked: { alignSelf: 'stretch' },
  count: { position: 'absolute', top: -spacing.xs - spacing.xxs, right: -spacing.xs - spacing.xxs },
});
