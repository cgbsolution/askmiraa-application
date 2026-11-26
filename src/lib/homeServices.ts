/**
 * The services a person pinned to Home, in their order, kept on this phone.
 *
 * The workspace's quick links (`/dashboard/quick-links`) are set by an admin
 * for everyone, so a person's own choice lives on the device (a backend gap
 * listed in docs/MOBILE_PLAN.md). Null until they choose: Home then shows the
 * defaults from core/services.ts. Held in the query cache, so a choice made in
 * All services shows on Home straight away.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

// v3: Home became the old HRMS's grid (13 tiles); picks from the eight-tile Home start afresh.
const KEY = 'askmira.home-services.v3';
const QUERY_KEY = ['home-services'] as const;

async function readPinned(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : null;
  } catch {
    return null;
  }
}

export function useHomeServices(): [string[] | null, (keys: string[] | null) => void] {
  const queryClient = useQueryClient();
  const pinned = useQuery({ queryKey: QUERY_KEY, queryFn: readPinned, staleTime: Infinity, networkMode: 'always' });
  const save = useCallback(
    (keys: string[] | null) => {
      queryClient.setQueryData(QUERY_KEY, keys);
      if (keys) void AsyncStorage.setItem(KEY, JSON.stringify(keys)).catch(() => {});
      else void AsyncStorage.removeItem(KEY).catch(() => {});
    },
    [queryClient],
  );
  return [pinned.data ?? null, save];
}
