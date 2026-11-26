/**
 * The maroon behind the logo: splash, sign-in and lock.
 *
 * The portal's sign-in brand panel, on a phone: the nav rail's gradient
 * (#6B0A13 → #34040A) with a hairline grid that fades out from the middle
 * (globals.css `auth-grid`). Drawn in SVG, so it is crisp at any density and
 * costs no image.
 */

import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Mask, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';

/** The grid's cell, as on the portal. */
const CELL = 52;

export function BrandBackdrop({ grid = true }: { grid?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="brand" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.brandSurfaceTop} />
            <Stop offset="1" stopColor={colors.brandSurfaceBottom} />
          </LinearGradient>
          <RadialGradient id="glow" cx="50%" cy="34%" rx="60%" ry="38%">
            <Stop offset="0" stopColor={colors.onBrandSurface} stopOpacity={0.08} />
            <Stop offset="1" stopColor={colors.onBrandSurface} stopOpacity={0} />
          </RadialGradient>
          <Pattern id="cells" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <Path d={`M${CELL} 0H0V${CELL}`} fill="none" stroke={colors.onBrandSurface} strokeOpacity={0.09} strokeWidth={1} />
          </Pattern>
          <RadialGradient id="fade" cx="50%" cy="36%" rx="70%" ry="45%">
            <Stop offset="0.2" stopColor={colors.onPrimary} stopOpacity={1} />
            <Stop offset="0.75" stopColor={colors.onPrimary} stopOpacity={0} />
          </RadialGradient>
          <Mask id="fadeMask">
            <Rect width="100%" height="100%" fill="url(#fade)" />
          </Mask>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#brand)" />
        <Rect width="100%" height="100%" fill="url(#glow)" />
        {grid ? <Rect width="100%" height="100%" fill="url(#cells)" mask="url(#fadeMask)" /> : null}
      </Svg>
    </View>
  );
}
