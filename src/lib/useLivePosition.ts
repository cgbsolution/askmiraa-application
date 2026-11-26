/**
 * Where the phone is, kept current while the punch screen is open, with the
 * address in words.
 *
 * Asks for location the first time (the punch needs it anyway), watches the
 * position only while the screen is focused, and looks the address up with
 * the phone's own geocoder — no map service, no key. Every failure is a
 * state the screen can explain: permission refused, location switched off,
 * no fix yet.
 */

import { useIsFocused } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { addressLine } from '../core/geo';

/**
 * `settings`: location is on, but the phone's accuracy setting (Google
 * location accuracy) refuses the request — Android's own dialog fixes it.
 */
export type PositionProblem = 'denied' | 'off' | 'settings' | 'unavailable' | null;

function isSettingsError(error: unknown): boolean {
  return /unsatisfied device settings|location services are disabled/i.test(String(error));
}

export interface LivePosition {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /**
   * Android says the fix came from a "mock location" app (fake GPS, a
   * joystick app) rather than the phone's own GPS. Never recorded.
   */
  mocked?: boolean;
}

export interface LivePositionState {
  position: LivePosition | null;
  address: string | null;
  problem: PositionProblem;
  /** True until the first fix (or a problem) arrives. */
  locating: boolean;
  /** Ask again: after the person allowed location in settings, or turned it on. */
  retry: () => void;
  /** Ask Android to switch location on (its own dialog). */
  turnOn: () => Promise<void>;
  /**
   * "Find me now", as the locate button on Google Maps: a fresh high-accuracy
   * fix, shown at once. Resolves to it, or null when none came.
   */
  locate: () => Promise<LivePosition | null>;
  /** True while `locate()` runs. */
  locatingNow: boolean;
}

/** The accuracy a workspace asks for when it has not set one (metres). */
export const DEFAULT_ACCURACY_METRES = 100;

/**
 * Whether a fix may be recorded: there is one, and the phone says it is
 * within `needed` metres. A phone that reports no accuracy is taken at its word.
 */
export function fixIsGood(position: LivePosition | null, needed: number): boolean {
  return position !== null && !position.mocked && (position.accuracy === null || position.accuracy <= needed);
}

/** Only look the address up again once the phone has moved this far (metres). */
const READDRESS_AFTER_METRES = 40;

function moved(a: LivePosition, b: LivePosition): number {
  const dLat = (a.latitude - b.latitude) * 111_000;
  const dLon = (a.longitude - b.longitude) * 111_000 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

export function useLivePosition(enabled: boolean): LivePositionState {
  const focused = useIsFocused();
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [problem, setProblem] = useState<PositionProblem>(null);
  const [locating, setLocating] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [locatingNow, setLocatingNow] = useState(false);
  const addressedAt = useRef<LivePosition | null>(null);

  useEffect(() => {
    if (!enabled || !focused) return;
    let alive = true;
    let gotFix = false;
    let subscription: Location.LocationSubscription | null = null;
    let giveUp: ReturnType<typeof setTimeout> | null = null;

    const lookUp = async (fix: LivePosition) => {
      if (addressedAt.current && moved(fix, addressedAt.current) < READDRESS_AFTER_METRES) return;
      addressedAt.current = fix;
      try {
        const [found] = await Location.reverseGeocodeAsync({ latitude: fix.latitude, longitude: fix.longitude });
        if (alive) setAddress(addressLine(found));
      } catch {
        if (alive) setAddress(null);
      }
    };

    const accept = (location: Location.LocationObject) => {
      if (!alive) return;
      gotFix = true;
      const fix = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? null,
        mocked: location.mocked === true,
      };
      setPosition(fix);
      setProblem(null);
      setLocating(false);
      void lookUp(fix);
    };

    void (async () => {
      setLocating(true);
      setProblem(null);
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
      if (!alive) return;
      if (!permission.granted) {
        setProblem('denied');
        setLocating(false);
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        if (alive) {
          setProblem('off');
          setLocating(false);
        }
        return;
      }
      const recent = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 500 }).catch(() => null);
      if (recent) accept(recent);
      // One fix now (as the punch itself asks for one), and updates while the screen is open.
      void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false })
        .then(accept)
        .catch(() => {});
      try {
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5_000, distanceInterval: 10, mayShowUserSettingsDialog: false },
          accept,
        );
      } catch (error) {
        if (alive && !recent) {
          setProblem(isSettingsError(error) ? 'settings' : 'unavailable');
          setLocating(false);
        }
      }
      // No fix after a while: say so rather than spin for ever.
      giveUp = setTimeout(() => {
        if (alive && !gotFix) {
          setProblem((p) => p ?? 'unavailable');
          setLocating(false);
        }
      }, 15_000);
    })();

    return () => {
      alive = false;
      subscription?.remove();
      if (giveUp) clearTimeout(giveUp);
    };
  }, [enabled, focused, attempt]);

  const retry = useCallback(() => {
    addressedAt.current = null;
    setAttempt((n) => n + 1);
  }, []);

  const turnOn = useCallback(async () => {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // The person said no to Android's dialog; the notice stays.
    }
    retry();
  }, [retry]);

  const locate = useCallback(async (): Promise<LivePosition | null> => {
    setLocatingNow(true);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setProblem('denied');
        return null;
      }
      const found = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest, mayShowUserSettingsDialog: true }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 15_000)),
      ]);
      if (!found) {
        setProblem((p) => p ?? 'unavailable');
        return null;
      }
      const fix = {
        latitude: found.coords.latitude,
        longitude: found.coords.longitude,
        accuracy: found.coords.accuracy ?? null,
        mocked: found.mocked === true,
      };
      setPosition(fix);
      setProblem(null);
      setLocating(false);
      addressedAt.current = null;
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: fix.latitude, longitude: fix.longitude });
        addressedAt.current = fix;
        setAddress(addressLine(place));
      } catch {
        // The address is a nicety; the fix stands without it.
      }
      return fix;
    } catch (error) {
      setProblem(isSettingsError(error) ? 'settings' : 'unavailable');
      return null;
    } finally {
      setLocatingNow(false);
    }
  }, []);

  return { position, address, problem, locating, retry, turnOn, locate, locatingNow };
}
