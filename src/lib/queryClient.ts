/**
 * TanStack Query: caching, retries and background refresh for every screen.
 *
 * What survives a restart is decided here, not by each screen. The README's
 * offline table allows only: the last payslip viewed (so someone can show it
 * at a bank counter), profile basics, and the holiday calendar. Approvals,
 * chat and everything else are online-only and never persisted.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager, type Query } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError, OfflineError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      // A 4xx will not change on retry; an offline error will once signal returns.
      retry: (failureCount, error) => {
        if (error instanceof ApiError) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: false,
      networkMode: 'always',
    },
  },
});

/** Query-key roots that may be written to the device. Everything else stays in memory. */
export const PERSISTED_ROOTS = new Set(['payslip-last', 'profile-basics', 'holidays']);

export function shouldPersist(query: Query): boolean {
  const root = query.queryKey[0];
  return typeof root === 'string' && PERSISTED_ROOTS.has(root) && query.state.status === 'success';
}

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'askmira.query-cache.v1',
  throttleTime: 2000,
});

/** Refetch on return to the foreground; pause and resume with connectivity. */
export function wireQueryLifecycle(): () => void {
  const appState = AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
  });
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    }),
  );
  return () => appState.remove();
}

/** Forget every cached response — on sign-out, so the next person sees nothing. */
export async function clearCache(): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
}

export function isOffline(error: unknown): boolean {
  return error instanceof OfflineError;
}
