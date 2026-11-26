/**
 * Spot illustrations — the website's icons, in the app.
 *
 * Small flat pictures in the brand's artwork tones (theme/tokens.ts
 * `spotInk`), each on a soft tile, the way the website shows them in its
 * menus, cards and lists. The drawings are the website's own
 * (website/src/components/illustrations/spots.tsx) plus the few only the app
 * needs, converted by scripts/spots/build.mjs — so a service looks the same
 * on the website, in its menu and on the phone.
 *
 * Use a spot wherever an icon names a place to go: a service on Home, a row
 * in a menu, an empty state. Glyphs inside controls (back, close, chevrons,
 * the search in a field, a status mark) stay line icons, as on the website.
 */

import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import type { SpotName } from '../core/spotNames';
import { layout, radius, spotInk, spotTiles, type SpotTone } from '../theme/tokens';
import { SPOT_DRAWINGS } from './spots/drawings.gen';

export type { SpotName } from '../core/spotNames';
export type { SpotTone } from '../theme/tokens';

/** A spot drawn `size` square. `tile` is the colour behind it (its cuts take that colour). */
export const Spot = memo(function Spot({ name, size, tile = 'blush' }: { name: SpotName; size: number; tile?: SpotTone }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {SPOT_DRAWINGS[name]({ ...spotInk, bg: spotTiles[tile] })}
    </Svg>
  );
});

export type SpotSize = 'sm' | 'md' | 'lg' | 'xl';

// The website's tile proportions (SpotTile): padding about an eighth of the side, rounder when small.
const TILES: Record<SpotSize, { side: number; corner: number }> = {
  sm: { side: layout.spotSm, corner: radius.control },
  md: { side: layout.spotMd, corner: radius.lg },
  lg: { side: layout.spotLg, corner: radius.lg },
  xl: { side: layout.spotXl, corner: radius.tier2 },
};

/** A spot on its soft tile — in a list row (sm), on a service tile (md), in an empty state (lg). */
export function SpotTile({
  name,
  size = 'md',
  tone = 'blush',
  style,
}: {
  name: SpotName;
  size?: SpotSize;
  tone?: SpotTone;
  style?: StyleProp<ViewStyle>;
}) {
  const { side, corner } = TILES[size];
  const pad = Math.round(side * (size === 'sm' ? 0.15 : 0.125));
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.tile, { width: side, height: side, borderRadius: corner, padding: pad, backgroundColor: spotTiles[tone] }, style]}
    >
      <Spot name={name} size={side - pad * 2} tile={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
