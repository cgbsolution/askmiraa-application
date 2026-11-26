/**
 * The splash.
 *
 * Its first frame is the native splash's (app.config.ts): the logo, 168dp
 * wide, centred on the rail's maroon — so the hand-over from the native
 * screen cannot be seen. Then the logo settles a little higher, the line from
 * the website fades in under it with a quiet progress pulse, and once the app
 * knows who is signed in the whole screen fades into it. Never shorter than a
 * beat (so it does not flash) and never longer than the app needs. Under the
 * OS reduce-motion setting nothing moves: it only fades.
 */

import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../lib/i18n';
import { useTheme } from '../theme/ThemeProvider';
import { motion, radius, spacing } from '../theme/tokens';
import { BrandBackdrop } from './BrandBackdrop';
import { BrandLogo } from './Brand';
import { Txt } from './Text';

/** The native splash draws the logo this wide (expo-splash-screen's imageWidth). */
const LOGO_WIDTH = 168;
const LOGO_HEIGHT = Math.round(LOGO_WIDTH / (1150 / 340));
export const APP_VERSION: string = Constants.expoConfig?.version ?? '';

/** Shortest time on screen, so the splash never just flashes. */
const MIN_VISIBLE_MS = 1100;

export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const shownAt = useRef(Date.now());
  const [leaving, setLeaving] = useState(false);

  const settle = useSharedValue(0);
  const tagline = useSharedValue(0);
  const pulse = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      settle.value = 1;
      tagline.value = withTiming(1, { duration: motion.base });
      return;
    }
    settle.value = withDelay(motion.fast, withTiming(1, { duration: motion.splash, easing: Easing.out(Easing.cubic) }));
    tagline.value = withDelay(motion.splash, withTiming(1, { duration: motion.slow }));
    pulse.value = withDelay(
      motion.splash,
      withRepeat(withSequence(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 0 })), -1),
    );
  }, [reduced, settle, tagline, pulse]);

  // Leave once the app is ready and the splash has had its beat.
  useEffect(() => {
    if (!ready || leaving) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    const timer = setTimeout(() => {
      setLeaving(true);
      fade.value = withTiming(0, { duration: motion.slow, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [ready, leaving, fade, onDone]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -settle.value * spacing.xxl }, { scale: 1 - settle.value * 0.08 }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: (1 - tagline.value) * spacing.sm }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: tagline.value * (0.9 - pulse.value * 0.6),
    transform: [{ translateX: (pulse.value - 0.5) * spacing.xxxl }],
  }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.brandSurface }, rootStyle]}
      pointerEvents={leaving ? 'none' : 'auto'}
      // The JS splash is drawn: the native one can go, with nothing to see in between.
      onLayout={() => void SplashScreen.hideAsync().catch(() => {})}
      accessibilityLabel={t('AskMiraa is starting')}
    >
      <StatusBar style="light" />
      <BrandBackdrop />
      <Animated.View style={logoStyle}>
        <BrandLogo height={LOGO_HEIGHT} />
      </Animated.View>
      <Animated.View style={[styles.below, taglineStyle]}>
        <Txt variant="callout" align="center" style={{ color: colors.onBrandSurfaceMuted }}>
          {t('HR, payroll and culture for Indian companies')}
        </Txt>
        <View style={[styles.track, { backgroundColor: colors.brandSurfaceRaised }]}>
          <Animated.View style={[styles.runner, { backgroundColor: colors.accent }, pulseStyle]} />
        </View>
      </Animated.View>
      <View style={[styles.footer, { bottom: insets.bottom + spacing.xl }]}>
        <Txt variant="caption" align="center" style={{ color: colors.onBrandSurfaceMuted }}>
          {t('Version {version}', { version: APP_VERSION })}
        </Txt>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  below: {
    position: 'absolute',
    top: '50%',
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  track: { width: spacing.xxxl + spacing.xxl, height: spacing.xs - 1, borderRadius: radius.pill, overflow: 'hidden' },
  runner: { width: spacing.xl, height: '100%', borderRadius: radius.pill, alignSelf: 'center' },
  footer: { position: 'absolute', left: 0, right: 0 },
});
