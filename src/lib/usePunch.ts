/**
 * The one-tap punch.
 *
 * Follows the workspace's attendance settings: location off / optional /
 * required, a selfie off / optional / required. The punch is written to this
 * person's offline queue first and sent after, so a dead zone never loses it;
 * the queue decides what the UI may call "recorded".
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import { attendanceApi } from '../api/attendance';
import { isoFromDate, todayISO } from '../core/dates';
import { nextDirection } from '../core/home';
import { describeState, type PunchDirection, type QueuedPunch } from '../core/offlineQueue';
import { asDataUrl, takePhoto } from './files';
import { t } from './i18n';
import { punchQueueFor } from './punchQueue';
import { useSession } from './session';
import { DEFAULT_ACCURACY_METRES } from './useLivePosition';

const LOCATION_TIMEOUT_MS = 6_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/**
 * A position fix within the timeout, or null. When the phone's location
 * setting is off ("unsatisfied device settings"), Android's own dialog asks
 * the person to turn it on, and the fix is tried once more.
 */
async function currentPosition(accuracy: Location.Accuracy): Promise<Location.LocationObject | null> {
  const attempt = () => withTimeout(Location.getCurrentPositionAsync({ accuracy }), LOCATION_TIMEOUT_MS);
  try {
    return await attempt();
  } catch (error) {
    if (!/unsatisfied device settings|location services are disabled/i.test(String(error))) return null;
    try {
      await Location.enableNetworkProviderAsync();
      return await attempt();
    } catch {
      return null;
    }
  }
}

export function localDay(iso: string): string {
  return isoFromDate(new Date(iso));
}

export function usePunch() {
  const { session, can } = useSession();
  const userId = session?.user.id ?? 'anonymous';
  const enabled = can('punch');
  const queryClient = useQueryClient();
  const today = todayISO();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the fix is in the phone's settings (location refused for the app).
  const [needsSettings, setNeedsSettings] = useState(false);
  const [last, setLast] = useState<QueuedPunch | null>(null);

  const settings = useQuery({ queryKey: ['attendance', 'settings'], queryFn: attendanceApi.settings, enabled, staleTime: 10 * 60_000 });
  const serverPunches = useQuery({
    queryKey: ['attendance', 'punches', today],
    queryFn: () => attendanceApi.punches(today, today),
    enabled,
  });
  const local = useQuery({
    queryKey: ['punch-queue', userId],
    queryFn: () => punchQueueFor(userId).all(),
    enabled,
    staleTime: 0,
    networkMode: 'always',
  });

  const current = last ? ((local.data ?? []).find((p) => p.id === last.id) ?? last) : null;
  const direction: PunchDirection = nextDirection(today, serverPunches.data ?? [], local.data ?? [], localDay);
  const needsAttention = (local.data ?? []).filter((p) => (p.state === 'stale' || p.state === 'rejected') && !p.resolvedAt);
  const waiting = (local.data ?? []).filter((p) => p.state === 'queued' || p.state === 'failed' || p.state === 'syncing');

  /**
   * Punch, in the given direction or the one that follows the last punch.
   * `seen` is the position the person is looking at on the punch screen's
   * map: when given, that is the place recorded, so the address on screen and
   * the one HR sees agree. Resolves to the settled punch, or null.
   */
  const punch = useCallback(async (requested?: PunchDirection, seen?: { latitude: number; longitude: number; accuracy?: number | null; mocked?: boolean } | null): Promise<QueuedPunch | null> => {
    if (busy) return null;
    const chosen = requested ?? direction;
    setBusy(true);
    setError(null);
    setNeedsSettings(false);
    try {
      const mode = settings.data?.location_mode ?? 'required';
      const photoMode = settings.data?.photo_mode ?? 'off';
      const needed = settings.data?.location_accuracy_metres ?? DEFAULT_ACCURACY_METRES;
      let latitude: number | undefined;
      let longitude: number | undefined;
      let accuracy: number | undefined;
      let mocked = false;

      if (mode !== 'off' && seen) {
        latitude = seen.latitude;
        longitude = seen.longitude;
        accuracy = seen.accuracy ?? undefined;
        mocked = seen.mocked === true;
      } else if (mode !== 'off') {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted) {
          // A fix from the last two minutes is good enough and instant; a GPS
          // fix indoors on a low-end handset can take twenty seconds, and a
          // punch that waits that long is not one tap.
          const recent = await Location.getLastKnownPositionAsync({
            maxAge: mode === 'required' ? 60_000 : 2 * 60_000,
            requiredAccuracy: mode === 'required' ? needed : 500,
          }).catch(() => null);
          let position =
            recent ??
            (await currentPosition(mode === 'required' ? Location.Accuracy.High : Location.Accuracy.Balanced));
          // Without network location (no Play Services, airplane mode with GPS
          // on), only the GPS chip answers. Worth the wait when the company
          // requires a location; otherwise punch without one.
          if (!position && mode === 'required') {
            position = await currentPosition(Location.Accuracy.High);
          }
          if (position) {
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
            accuracy = position.coords.accuracy ?? undefined;
            mocked = position.mocked === true;
          }
        }
        if (mode === 'required' && latitude === undefined) {
          setNeedsSettings(!permission.granted);
          setError(
            permission.granted
              ? t('Your location could not be found. Step outside or turn on location, then try again.')
              : t('Your company needs your location to record a punch. Allow location for AskMiraa in your phone settings.'),
          );
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return null;
        }
      }
      // A fake-GPS (mock location) fix is never sent, whatever the company's rule.
      if (mocked) {
        setError(t('A fake location app is changing your location. Turn it off (Settings → Developer options → Select mock location app → No app), then try again.'));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return null;
      }
      // Required: a fix less precise than the company asks for is not sent.
      if (mode === 'required' && accuracy !== undefined && accuracy > needed) {
        setError(
          t('Your location is only accurate to about {found} m; your company needs it within {needed} m. Tap the locate button on the map, step outside or near a window, then try again.', {
            found: String(Math.round(accuracy)),
            needed: String(needed),
          }),
        );
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return null;
      }

      let photo: string | undefined;
      if (photoMode === 'required') {
        const selfie = await takePhoto({ maxMb: 5, types: ['image/*'] }, { front: true });
        if (!selfie) {
          setError(t('Your company asks for a selfie with each punch. Take one to punch.'));
          return null;
        }
        photo = await asDataUrl(selfie);
      }

      const queue = punchQueueFor(userId);
      const queued = await queue.enqueue({ direction: chosen, latitude, longitude, accuracy, photo });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLast(queued);
      await queue.sync();
      const all = await queue.all();
      const settled = all.find((p) => p.id === queued.id) ?? queued;
      setLast(settled);
      if (settled.state === 'synced') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (settled.state === 'rejected') {
        setError(settled.lastError ?? t('The punch was not recorded.'));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return settled;
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ['punch-queue', userId] });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    }
  }, [busy, settings.data, userId, direction, queryClient]);

  return {
    enabled,
    loading: settings.isPending || serverPunches.isPending,
    direction,
    punch,
    busy,
    error,
    needsSettings,
    last,
    // The queue's current word on the last punch, not the one from the moment
    // it was tapped: a punch sent later in the background must say so.
    lastState: current ? describeState(current) : null,
    serverPunches: serverPunches.data ?? [],
    waiting,
    needsAttention,
    photoRequired: settings.data?.photo_mode === 'required',
    locationMode: settings.data?.location_mode ?? 'required',
    /** Metres: how precise the location must be before a punch (location required) or a visit. */
    accuracyNeeded: settings.data?.location_accuracy_metres ?? DEFAULT_ACCURACY_METRES,
    /** The settings are known: until then the punch buttons wait. */
    settingsReady: settings.data !== undefined,
    /** The workspace's work locations (geofences), to say how far the person is from one. */
    workLocations: settings.data?.work_locations ?? [],
    refresh: () => Promise.all([serverPunches.refetch(), local.refetch()]),
    resolve: async (id: string) => {
      await punchQueueFor(userId).resolve(id);
      void queryClient.invalidateQueries({ queryKey: ['punch-queue', userId] });
    },
  };
}
