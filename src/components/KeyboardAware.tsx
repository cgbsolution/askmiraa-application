/**
 * Keeps a screen's bottom (a composer, a submit bar) above the keyboard.
 *
 * Android changed under us: up to Android 14 the system resized the window
 * for the keyboard ("adjustResize"); Android 15 draws apps edge to edge and
 * does not, so the keyboard covers whatever sits at the bottom. Padding by the
 * keyboard's height would fix 15 and leave a double gap on older phones.
 *
 * So this measures. It remembers its own height with the keyboard closed;
 * when the keyboard opens it checks how much the system already shrank it,
 * and pads only what is left. iOS never resizes, and gets the full height.
 */

import { useRef, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useKeyboardHeight } from '../lib/keyboard';

export function useKeyboardInset(): { inset: number; onLayout: (event: LayoutChangeEvent) => void; open: boolean } {
  const keyboard = useKeyboardHeight();
  const [height, setHeight] = useState(0);
  const baseline = useRef(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setHeight(next);
    if (keyboard === 0 || next > baseline.current) baseline.current = next;
  };

  const shrunkBySystem = keyboard > 0 && baseline.current > 0 ? Math.max(0, baseline.current - height) : 0;
  const inset = keyboard > 0 ? Math.max(0, keyboard - shrunkBySystem) : 0;
  return { inset, onLayout, open: keyboard > 0 };
}

/**
 * A full-height container whose content stays above the keyboard. The
 * `bottomOffset` is space the keyboard already covers anyway (the bottom
 * safe-area inset), subtracted so the gap is not counted twice.
 */
export function KeyboardAware({
  children,
  style,
  bottomOffset = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  bottomOffset?: number;
}) {
  const { inset, onLayout } = useKeyboardInset();
  return (
    <View style={[{ flex: 1 }, style]} onLayout={onLayout}>
      <View style={{ flex: 1, paddingBottom: Math.max(0, inset - bottomOffset) }}>{children}</View>
    </View>
  );
}
