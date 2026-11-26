/**
 * A segmented control: Notifications · Approvals · Tasks.
 *
 * The FRD's mobile pattern for switching between a screen's three or four
 * most-used views, in place of a hamburger nobody taps.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing } from '../theme/tokens';
import { CountBadge } from './Badge';
import { Txt } from './Text';

export interface Segment<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** The count is a plain tally, not something waiting on the person. */
  quiet?: boolean;
}

export function Segmented<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.segmentedTrack }]} accessibilityRole="tablist">
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.count ? `${segment.label}, ${segment.count}` : segment.label}
            onPress={() => onChange(segment.value)}
            style={[styles.segment, selected && { backgroundColor: colors.segmentedActive }]}
          >
            <Txt
              variant="calloutStrong"
              numberOfLines={1}
              // Shrinks (with an ellipsis) inside its segment rather than spilling past both edges.
              style={[styles.label, { color: selected ? colors.onSegmentedActive : colors.segmentedText }]}
              // Three tabs must fit across a phone at large text; the screen below grows fully.
              maxFontSizeMultiplier={1.2}
            >
              {segment.label}
            </Txt>
            {segment.count ? <CountBadge count={segment.count} tone={selected ? 'inverse' : segment.quiet ? 'quiet' : 'alert'} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: spacing.xs, borderRadius: radius.pill, gap: spacing.xs },
  segment: {
    // Wider labels get more room; all share what is left.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: layout.controlSmall + spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  label: { flexShrink: 1 },
});
