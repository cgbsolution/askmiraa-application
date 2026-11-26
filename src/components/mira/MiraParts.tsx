/** Small pieces of the Ask Miraa chat: the mark, typing dots, bubbles. */

import * as Clipboard from 'expo-clipboard';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { t } from '../../lib/i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';
import { Badge } from '../Badge';
import { BrandMark } from '../Brand';
import { Txt } from '../Text';
import { toast } from '../Toast';

/** Miraa's avatar: the AskMiraa mark, the red bubble with an "A". */
export function MiraMark({ size = layout.avatarSm }: { size?: number }) {
  return (
    <View style={[styles.mark, { width: size, height: size }]} accessibilityElementsHidden>
      <BrandMark height={size} />
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    lift.value = withDelay(delay, withRepeat(withSequence(withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 })), -1));
  }, [delay, lift, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: colors.textSubtle }, style]} />;
}

/** "Miraa is thinking…" as three dots. */
export function TypingDots({ name }: { name: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.miraRow} accessible accessibilityLabel={t('{name} is thinking…', { name })} accessibilityLiveRegion="polite">
      <MiraMark />
      <View style={[styles.typing, { backgroundColor: colors.bubbleMira, borderColor: colors.bubbleMiraBorder }]}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </View>
  );
}

async function copy(text: string) {
  if (!text) return;
  await Clipboard.setStringAsync(text);
  toast.success(t('Copied'));
}

/** The person's own message, on the right. A message still in flight says so. */
export function UserBubble({ text, pending }: { text: string; pending?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.userRow}>
      <Pressable
        onLongPress={() => void copy(text)}
        accessibilityHint={t('Long press to copy')}
        style={[styles.userBubble, { backgroundColor: colors.bubbleUser }, pending && styles.pending]}
      >
        <Txt variant="callout" style={{ color: colors.onBubbleUser }} selectable={false}>
          {text}
        </Txt>
      </Pressable>
      {pending ? (
        <Txt variant="caption" tone="subtle">
          {t('Sending…')}
        </Txt>
      ) : null}
    </View>
  );
}

/** Miraa's reply, on the left: what it checked, what it said, and the cards. */
export function MiraBubble({
  name,
  text,
  toolTitle,
  children,
}: {
  name: string;
  text: string;
  toolTitle: string | null;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.miraRow}>
      <MiraMark />
      <View style={styles.miraBody}>
        <View style={styles.miraMeta}>
          <Txt variant="label" tone="muted">
            {name}
          </Txt>
          {toolTitle ? <Badge label={t('Checked: {what}', { what: toolTitle })} tone="primary" /> : null}
        </View>
        {text ? (
          <Pressable
            onLongPress={() => void copy(text)}
            accessibilityHint={t('Long press to copy')}
            style={[styles.miraBubble, { backgroundColor: colors.bubbleMira, borderColor: colors.bubbleMiraBorder }]}
          >
            <Txt variant="callout">{text}</Txt>
          </Pressable>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill },
  typing: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    borderWidth: layout.hairline,
  },
  userRow: { alignItems: 'flex-end', gap: spacing.xs },
  userBubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.lg,
    borderTopRightRadius: radius.sm,
  },
  pending: { opacity: 0.7 },
  miraRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  miraBody: { flex: 1, gap: spacing.sm, maxWidth: '92%' },
  miraMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  miraBubble: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    borderWidth: layout.hairline,
  },
});
