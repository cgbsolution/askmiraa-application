/**
 * Toasts: a short line confirming something happened ("Leave applied").
 *
 * Call `toast.success('…')` from anywhere — a mutation's onSuccess, a hook.
 * The host sits once at the root, above the tab bar, and announces each toast
 * to screen readers. Errors that need reading stay inline on the screen; a
 * toast is for success and brief notes.
 */

import { CheckCircle2, CircleAlert, Info } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '../lib/keyboard';
import { useToastLift } from '../lib/toastLift';
import { useTheme } from '../theme/ThemeProvider';
import { elevation, layout, radius, spacing } from '../theme/tokens';
import { Txt } from './Text';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

type Listener = (item: ToastItem) => void;
const listeners = new Set<Listener>();
let next = 1;

function emit(message: string, tone: ToastTone) {
  const item = { id: next++, message, tone };
  listeners.forEach((listener) => listener(item));
  AccessibilityInfo.announceForAccessibility(message);
}

export const toast = {
  success: (message: string) => emit(message, 'success'),
  error: (message: string) => emit(message, 'error'),
  info: (message: string) => emit(message, 'info'),
};

export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ToastItem | null>(null);
  const keyboard = useKeyboardHeight();
  const lift = useToastLift();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Above the keyboard when it is open (`keyboard`): a message about what was
  // just typed must not sit hidden behind it.
  useEffect(() => {
    const listener: Listener = (incoming) => {
      setItem(incoming);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setItem(null), incoming.tone === 'error' ? 5000 : 3000);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!item) return null;
  const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? CircleAlert : Info;
  const iconColor = item.tone === 'success' ? colors.success : item.tone === 'error' ? colors.danger : colors.info;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.host,
        {
          bottom:
            keyboard > 0
              ? keyboard + spacing.sm
              : // Above the focused screen's bottom bar (Save, Reply), else above the tab bar.
                Math.max(lift + spacing.sm, insets.bottom + layout.tabBar + layout.miraLift + spacing.sm),
        },
      ]}
    >
      <Animated.View
        key={item.id}
        entering={FadeInDown.duration(200)}
        exiting={FadeOutDown.duration(150)}
        style={[styles.toast, elevation.raised, { backgroundColor: colors.text, shadowColor: colors.shadow }]}
        accessibilityLiveRegion="polite"
      >
        <Icon size={layout.icon} color={iconColor} />
        <Txt variant="calloutStrong" style={{ color: colors.background, flex: 1 }}>
          {item.message}
        </Txt>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: layout.gutter, right: layout.gutter, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
    paddingHorizontal: layout.card,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    maxWidth: layout.readingWidth,
    alignSelf: 'stretch',
  },
});
