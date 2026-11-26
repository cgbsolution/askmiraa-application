/**
 * Whether Ask Miraa has something the person has not seen: a reply that
 * arrived after they closed the chat, or a prompt to try Miraa for the first
 * time. Drives the centre button's glow. Remembered across launches.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'askmira.mira-signal.v1';

interface State {
  unseenReply: boolean;
  /** The conversation the unseen reply landed in, so reopening shows it. */
  lastConversationId: string | null;
  everOpened: boolean;
  chatOpen: boolean;
}

let state: State = { unseenReply: false, lastConversationId: null, everOpened: true, chatOpen: false };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(
    KEY,
    JSON.stringify({ unseenReply: state.unseenReply, everOpened: state.everOpened, lastConversationId: state.lastConversationId }),
  ).catch(
    () => {},
  );
}

export const miraSignal = {
  async load() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const stored = raw ? (JSON.parse(raw) as Partial<State>) : {};
      state = {
        ...state,
        unseenReply: Boolean(stored.unseenReply),
        lastConversationId: stored.lastConversationId ?? null,
        everOpened: raw ? Boolean(stored.everOpened) : false,
      };
      listeners.forEach((listener) => listener());
    } catch {
      // Not knowing is fine: the button simply stays still.
    }
  },
  chatOpened() {
    set({ chatOpen: true, unseenReply: false, everOpened: true });
  },
  chatClosed() {
    set({ chatOpen: false });
  },
  /** A reply landed. If the chat is no longer on screen, the button glows. */
  replyArrived(conversationId: string) {
    set({ lastConversationId: conversationId, ...(state.chatOpen ? {} : { unseenReply: true }) });
  },
  /** The conversation to reopen when the chat opens without one: the one with an unseen reply. */
  unseenConversation(): string | null {
    return state.unseenReply ? state.lastConversationId : null;
  },
  /** Forget everything on sign-out. */
  reset() {
    set({ unseenReply: false, lastConversationId: null, chatOpen: false });
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMiraHasNews(): boolean {
  return useSyncExternalStore(subscribe, () => state.unseenReply || !state.everOpened);
}
