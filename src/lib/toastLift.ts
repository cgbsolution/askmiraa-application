/**
 * How far above the bottom of the screen a message must sit so it does not
 * cover the focused screen's bottom bar (a Save or Reply button).
 * The focused screen reports its footer's top edge; 0 means no footer.
 */

import { useSyncExternalStore } from 'react';

let lift = 0;
const listeners = new Set<() => void>();

export function setToastLift(next: number): void {
  if (next === lift) return;
  lift = next;
  listeners.forEach((listener) => listener());
}

export function useToastLift(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => lift,
  );
}
