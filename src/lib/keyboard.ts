/**
 * One app-wide view of the keyboard: open or not, and how far to lift above
 * it (see core/keyboard.ts). Sheets, form footers and toasts all read this.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

import { liftFor, nextTallest } from '../core/keyboard';

const KEY = 'askmira.keyboard.tallest';

let visible = false;
let reported = 0;
let tallest = 0;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      const saved = Number(raw);
      if (saved > 0) {
        tallest = nextTallest(tallest, saved, Dimensions.get('window').height);
        emit();
      }
    })
    .catch(() => {});
  Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
    visible = true;
    reported = event.endCoordinates.height;
    const next = nextTallest(tallest, reported, Dimensions.get('window').height);
    if (next !== tallest) {
      tallest = next;
      AsyncStorage.setItem(KEY, String(tallest)).catch(() => {});
    }
    emit();
  });
  Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
    visible = false;
    reported = 0;
    emit();
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** How far the keyboard reaches up from the bottom of the screen now; 0 when closed. */
export function useKeyboardHeight(): number {
  return useSyncExternalStore(subscribe, () => liftFor(visible, reported, tallest));
}
