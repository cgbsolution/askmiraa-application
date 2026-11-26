/**
 * Loading placeholders in the shape of what is coming.
 *
 * Never a full-screen spinner: a skeleton keeps the layout still, so nothing
 * jumps when the data lands. The pulse stops when the OS asks for reduced
 * motion.
 */

import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing } from '../theme/tokens';
import { Card } from './Card';

export function Skeleton({
  width = '100%',
  height = spacing.lg,
  round,
}: {
  width?: DimensionValue;
  height?: number;
  round?: boolean;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
  }, [opacity, reduced]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: round ? radius.pill : radius.sm, backgroundColor: colors.skeleton },
        animated,
      ]}
    />
  );
}

/** A card of skeleton rows, the shape of a list. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <Card padded="none" accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={layout.iconTile} height={layout.iconTile} />
          <View style={styles.lines}>
            <Skeleton width="60%" height={spacing.md + spacing.xxs} />
            <Skeleton width="40%" height={spacing.md} />
          </View>
        </View>
      ))}
    </Card>
  );
}

/** A card-shaped block, for a hero or a summary. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <View style={styles.lines}>
        <Skeleton width="45%" height={spacing.lg + spacing.xs} />
        {Array.from({ length: lines - 1 }).map((_, index) => (
          <Skeleton key={index} width={index % 2 ? '70%' : '90%'} />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.row,
    minHeight: layout.rowHeight,
    paddingHorizontal: layout.card,
    paddingVertical: spacing.md,
  },
  lines: { flex: 1, gap: spacing.sm },
});
