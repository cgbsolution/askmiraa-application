/**
 * The bottom tab bar: Home · Attendance · ( Ask Miraa ) · Leave · Me.
 *
 * It is the portal's nav rail turned on its side: the website hero's maroon
 * gradient, quiet rose-beige icons, and a Marigold chip behind the active
 * tab's icon, with the same lucide icons the portal's menu uses. The centre
 * is the brand moment: a raised Marigold button with a maroon ring, sitting in
 * a notch cut out of the bar. When Miraa has something new it breathes three
 * times and then keeps a still glow; it never moves under the OS reduce-motion
 * setting.
 *
 * Tap opens the chat as a full-screen sheet. Long-press opens quick asks.
 */

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { CalendarDays, Clock, LayoutDashboard, Sparkles, UserRound, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { companionApi } from '../api/companion';
import { ListGroup, ListRow } from '../components/List';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Text';
import { t } from '../lib/i18n';
import { useKeyboardHeight } from '../lib/keyboard';
import { useMiraHasNews } from '../lib/miraSignal';
import { useTheme } from '../theme/ThemeProvider';
import { layout, motion, radius, spacing } from '../theme/tokens';
import { goFromAnywhere } from './navigate';

/** The portal menu's icons for the same sections (frontend/src/lib/access.ts). */
const TAB_META: Record<string, { label: string; icon: LucideIcon }> = {
  HomeTab: { label: 'Home', icon: LayoutDashboard },
  AttendanceTab: { label: 'Attendance', icon: Clock },
  LeaveTab: { label: 'Leave', icon: CalendarDays },
  MeTab: { label: 'Me', icon: UserRound },
};

/** The bar's outline with a round notch around the Miraa button. */
export function notchPath(width: number, height: number): string {
  const cx = width / 2;
  const r = layout.mira / 2 + spacing.sm - spacing.xxs; // a 6dp gap around the button
  const centreY = layout.mira / 2 - layout.miraLift; // button centre, below the bar's top edge
  const half = Math.sqrt(Math.max(r * r - centreY * centreY, 0));
  const shoulder = spacing.sm;
  return [
    `M0 0`,
    `H${cx - half - shoulder}`,
    `Q${cx - half} 0 ${cx - half + spacing.xxs} ${spacing.xs}`,
    `A${r} ${r} 0 0 0 ${cx + half - spacing.xxs} ${spacing.xs}`,
    `Q${cx + half} 0 ${cx + half + shoulder} 0`,
    `H${width}`,
    `V${height}`,
    `H0`,
    'Z',
  ].join(' ');
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const height = layout.tabBar + insets.bottom;
  const [quickOpen, setQuickOpen] = useState(false);
  // Typing on a tab's own screen (Home's search): the keyboard gets the room,
  // as Android apps do; the bar comes back when it closes.
  const keyboardOpen = useKeyboardHeight() > 0;

  const routes = state.routes;
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const renderTab = (route: (typeof routes)[number]) => {
    const index = routes.indexOf(route);
    const focused = state.index === index;
    const meta = TAB_META[route.name] ?? { label: route.name, icon: LayoutDashboard };
    return (
      <TabButton
        key={route.key}
        label={t(meta.label)}
        icon={meta.icon}
        focused={focused}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            void Haptics.selectionAsync();
            navigation.navigate(route.name, route.params);
          } else if (focused && !event.defaultPrevented) {
            // A second tap on the active tab returns to its first screen.
            const stack = route.state as { key?: string; index?: number } | undefined;
            if (stack?.key && (stack.index ?? 0) > 0) navigation.dispatch({ ...StackActions.popToTop(), target: stack.key });
          }
        }}
      />
    );
  };

  if (keyboardOpen && !quickOpen) return null;

  return (
    // The wrapper includes the space the Miraa button rises into: Android only
    // delivers touches inside a view's bounds, so the button must sit inside it.
    <View style={[styles.wrap, { height: height + layout.miraLift }]} pointerEvents="box-none">
      <View style={[styles.bar, { height }]}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.tabBarTop} />
              <Stop offset="1" stopColor={colors.tabBarBottom} />
            </LinearGradient>
          </Defs>
          <Path d={notchPath(width, height)} fill="url(#rail)" stroke={colors.tabBarBorder} strokeWidth={layout.hairline} />
        </Svg>
        <View style={[styles.row, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
          {left.map(renderTab)}
          <View style={styles.centreSpace} />
          {right.map(renderTab)}
        </View>
      </View>
      <MiraButton onPress={() => goFromAnywhere('AskMira')} onLongPress={() => setQuickOpen(true)} />
      <QuickAsks open={quickOpen} onClose={() => setQuickOpen(false)} />
    </View>
  );
}

function TabButton({ label, icon: Icon, focused, onPress }: { label: string; icon: LucideIcon; focused: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = reduced ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [focused, lift, reduced]);

  const chip = useAnimatedStyle(() => ({ opacity: lift.value, transform: [{ scaleX: 0.6 + lift.value * 0.4 }] }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.tab}
    >
      <View style={styles.iconArea}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.chip, { backgroundColor: colors.tabBarActive }, chip]} />
        <Icon size={layout.iconLg - 2} color={focused ? colors.tabBarActiveText : colors.tabBarInactive} strokeWidth={focused ? 2.25 : 1.9} />
      </View>
      <Txt variant={focused ? 'tabActive' : 'tab'} style={{ color: focused ? colors.tabBarActiveLabel : colors.tabBarInactive }} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

function MiraButton({ onPress, onLongPress }: { onPress: () => void; onLongPress: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const hasNews = useMiraHasNews();
  const glow = useSharedValue(0);

  useEffect(() => {
    if (hasNews && !reduced) {
      // Three slow breaths, then it holds still: a glow that never stops costs
      // battery on every screen the tab bar sits under.
      glow.value = withRepeat(withTiming(1, { duration: motion.breathe / 2, easing: Easing.inOut(Easing.sin) }), 6, true);
    } else {
      cancelAnimation(glow);
      glow.value = withTiming(0, { duration: motion.fast });
    }
  }, [hasNews, reduced, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: hasNews ? 0.3 + glow.value * 0.3 : 0,
    transform: [{ scale: 1 + glow.value * 0.12 }],
  }));

  return (
    <View style={styles.miraWrap} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { backgroundColor: colors.miraGlow }, glowStyle, reduced && hasNews && styles.glowStill]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Ask Miraa, AI assistant')}
        accessibilityHint={t('Opens the chat. Long press for a new chat or your history.')}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        onLongPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onLongPress();
        }}
        delayLongPress={350}
        style={({ pressed }) => [
          styles.mira,
          { backgroundColor: colors.accent, borderColor: colors.miraRing, shadowColor: colors.shadow },
          pressed && styles.miraPressed,
        ]}
      >
        <Sparkles size={layout.iconXl - 6} color={colors.onAccent} strokeWidth={2} fill={colors.onAccent} fillOpacity={0.12} />
        {hasNews ? <View style={[styles.miraDot, { backgroundColor: colors.danger, borderColor: colors.accent }]} /> : null}
      </Pressable>
    </View>
  );
}

/** Long-press: New chat and History. */
function QuickAsks({ open, onClose }: { open: boolean; onClose: () => void }) {
  const status = useQuery({ queryKey: ['companion', 'status'], queryFn: companionApi.status, enabled: open, staleTime: 60_000 });
  const name = status.data?.name ?? 'Miraa';

  const openChat = (params?: Record<string, string>) => {
    onClose();
    goFromAnywhere('AskMira', params);
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('Ask {name}', { name })}>
      <ListGroup tier="tier2">
        <ListRow spot="mira" title={t('New chat')} onPress={() => openChat({ fresh: '1' })} />
        <ListRow
          spot="auditLog"
          title={t('History')}
          onPress={() => {
            onClose();
            goFromAnywhere('MiraHistory');
          }}
        />
      </ListGroup>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: layout.touch },
  iconArea: {
    width: layout.rowHeight - spacing.xs,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: { borderRadius: radius.md },
  centreSpace: { width: layout.mira + spacing.xl },
  miraWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mira: {
    width: layout.mira,
    height: layout.mira,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: spacing.xs - 1,
    shadowOpacity: 0.3,
    shadowRadius: spacing.md,
    shadowOffset: { width: 0, height: spacing.xs },
    elevation: 8,
  },
  miraPressed: { transform: [{ scale: 0.95 }] },
  miraDot: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.pill,
    borderWidth: spacing.xxs,
  },
  glow: {
    position: 'absolute',
    width: layout.mira + spacing.sm,
    height: layout.mira + spacing.sm,
    top: -spacing.xs,
    borderRadius: radius.pill,
  },
  glowStill: { opacity: 0.35 },
});
