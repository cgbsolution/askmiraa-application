/**
 * The height of the app's root view, as laid out now.
 *
 * Android sometimes shrinks the window when the keyboard opens and sometimes
 * does not (it changed within one session on Android 15). A bottom sheet
 * compares this height with the keyboard's to know how much of the keyboard
 * still covers it.
 */

import { useSyncExternalStore } from 'react';

let height = 0;
const listeners = new Set<() => void>();

export function setRootHeight(next: number): void {
  if (Math.abs(next - height) < 1) return;
  height = next;
  listeners.forEach((listener) => listener());
}

export function useRootHeight(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => height,
  );
}
