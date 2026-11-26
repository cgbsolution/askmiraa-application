/**
 * A small map around a point: where the person is, or where a punch was made.
 *
 * Drawn from standard web-map tiles laid side by side (core/geo.ts) — the
 * portal's own fallback map, OpenStreetMap — so it needs no API key and no
 * native map module, and works the same in development and in a store build.
 * The tile source is `extra.mapTileUrl` in app.config.ts, so a licensed
 * provider can replace OpenStreetMap's public tiles without a code change.
 *
 * Work locations show as their geofence circles, so "inside" and "outside"
 * can be seen, not only read.
 */

import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { MapPin, Minus, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { metresPerPixel, tileUrl, tilesFor, worldPixel, type WorkPlace } from '../core/geo';
import { t } from '../lib/i18n';
import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing } from '../theme/tokens';
import { IconButton } from './Button';
import { Txt } from './Text';

const DEFAULT_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_TEMPLATE: string =
  (Constants.expoConfig?.extra as { mapTileUrl?: string } | undefined)?.mapTileUrl?.trim() || DEFAULT_TILES;
const ATTRIBUTION: string =
  (Constants.expoConfig?.extra as { mapAttribution?: string } | undefined)?.mapAttribution?.trim() || '© OpenStreetMap contributors';
/** OpenStreetMap's tile policy asks every app to say who it is. */
const TILE_HEADERS = { 'User-Agent': 'AskMira-Mobile (HR attendance app)' };

/** A tile is drawn this many dp across: a little under 256 keeps it crisp on dense screens. */
const TILE_DP = 224;
const MIN_ZOOM = 12;
const MAX_ZOOM = 18;

export interface StaticMapProps {
  latitude: number;
  longitude: number;
  height: number;
  /** `here` is a live "you are here" dot; `pin` marks where a punch was made. */
  marker?: 'here' | 'pin';
  /** Metres: the fix's accuracy, drawn round the dot. */
  accuracy?: number | null;
  places?: WorkPlace[];
  zoom?: number;
  /** Show the + and − buttons. */
  controls?: boolean;
  /** Its own rounded border; off when the map fills a card's top. */
  framed?: boolean;
  accessibilityLabel?: string;
}

export function StaticMap({
  latitude,
  longitude,
  height,
  marker = 'here',
  accuracy,
  places = [],
  zoom: initialZoom = 16,
  controls = false,
  framed = true,
  accessibilityLabel,
}: StaticMapProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(initialZoom);
  const scale = TILE_DP / 256;

  const tiles = useMemo(
    () => (width ? tilesFor(latitude, longitude, zoom, width / scale, height / scale) : []),
    [latitude, longitude, zoom, width, height, scale],
  );

  // Geofence circles, in frame dp, for the work locations near enough to show.
  const circles = useMemo(() => {
    if (!width) return [];
    const centre = worldPixel(latitude, longitude, zoom);
    const perPixel = metresPerPixel(latitude, zoom);
    return places
      .map((place) => {
        const at = worldPixel(place.latitude, place.longitude, zoom);
        return {
          key: `${place.name}-${place.latitude}-${place.longitude}`,
          cx: width / 2 + (at.x - centre.x) * scale,
          cy: height / 2 + (at.y - centre.y) * scale,
          r: (place.radius_metres / perPixel) * scale,
        };
      })
      .filter((c) => c.cx + c.r > 0 && c.cx - c.r < width && c.cy + c.r > 0 && c.cy - c.r < height);
  }, [places, latitude, longitude, zoom, width, height, scale]);

  const accuracyRadius = accuracy && width ? Math.min((accuracy / metresPerPixel(latitude, zoom)) * scale, Math.max(width, height)) : 0;

  return (
    <View
      style={[styles.frame, framed && styles.framed, { height, backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? t('Map')}
    >
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tileUrl(TILE_TEMPLATE, tile), headers: TILE_HEADERS }}
          cachePolicy="memory-disk"
          transition={120}
          style={[styles.tile, { left: tile.left * scale, top: tile.top * scale, width: TILE_DP, height: TILE_DP }]}
        />
      ))}

      {width ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          {circles.map((c) => (
            <Circle key={c.key} cx={c.cx} cy={c.cy} r={c.r} fill={colors.success} fillOpacity={0.12} stroke={colors.success} strokeWidth={1.5} />
          ))}
          {marker === 'here' && accuracyRadius > spacing.md ? (
            <Circle cx={width / 2} cy={height / 2} r={accuracyRadius} fill={colors.primary} fillOpacity={0.1} stroke={colors.primary} strokeOpacity={0.35} strokeWidth={1} />
          ) : null}
        </Svg>
      ) : null}

      {marker === 'here' ? (
        <View pointerEvents="none" style={[styles.centre, { top: height / 2 - spacing.sm, left: width / 2 - spacing.sm }]}>
          <View style={[styles.dot, { backgroundColor: colors.primary, borderColor: colors.surface, shadowColor: colors.shadow }]} />
        </View>
      ) : (
        <View pointerEvents="none" style={[styles.centre, { top: height / 2 - layout.iconXl, left: width / 2 - layout.iconXl / 2 }]}>
          <MapPin size={layout.iconXl} color={colors.surface} fill={colors.primary} strokeWidth={1.5} />
        </View>
      )}

      {controls ? (
        <View style={[styles.controls, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconButton icon={Plus} label={t('Zoom in')} disabled={zoom >= MAX_ZOOM} onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))} />
          <View style={[styles.controlDivider, { backgroundColor: colors.divider }]} />
          <IconButton icon={Minus} label={t('Zoom out')} disabled={zoom <= MIN_ZOOM} onPress={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))} />
        </View>
      ) : null}

      <View style={[styles.attribution, { backgroundColor: colors.surface }]} pointerEvents="none">
        <Txt variant="caption" tone="muted" maxFontSizeMultiplier={1}>
          {ATTRIBUTION}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  framed: { borderRadius: radius.control, borderWidth: layout.hairline },
  tile: { position: 'absolute' },
  centre: { position: 'absolute' },
  dot: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: spacing.xs - 1,
    shadowOpacity: 0.3,
    shadowRadius: spacing.xs,
    shadowOffset: { width: 0, height: spacing.xxs },
    elevation: 3,
  },
  controls: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    borderRadius: radius.control,
    borderWidth: layout.hairline,
    overflow: 'hidden',
  },
  controlDivider: { height: layout.hairline },
  attribution: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xs + spacing.xxs,
    paddingVertical: spacing.xxs,
    borderTopLeftRadius: radius.sm,
    opacity: 0.85,
  },
});
