/**
 * Makes Android report the keyboard closing as soon as it closes.
 *
 * React Native checks the keyboard only after a layout pass. On Android 15,
 * where the app draws edge to edge, closing the keyboard with Back changes no
 * layout, so `keyboardDidHide` waited for the next tap and sheets, form
 * footers and toasts stayed lifted over an empty gap. While the keyboard is
 * up, this invisible view changes size twice a second; each change is a
 * layout pass, so the hide is noticed within half a second.
 */

import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useKeyboardHeight } from '../lib/keyboard';

const NUDGE_MS = 400;

export function KeyboardWatch() {
  const up = useKeyboardHeight() > 0 && Platform.OS === 'android';
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!up) return;
    const timer = setInterval(() => setTick((n) => n + 1), NUDGE_MS);
    return () => clearInterval(timer);
  }, [up]);
  if (Platform.OS !== 'android') return null;
  return <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[styles.probe, { width: tick % 2 ? 1 : 2 }]} />;
}

const styles = StyleSheet.create({
  probe: { position: 'absolute', left: 0, top: 0, height: 1, opacity: 0 },
});
