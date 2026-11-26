/**
 * Is this phone one AskMiraa can trust with a punch?
 *
 * A rooted (or jailbroken) phone can hide a fake-GPS app from Android's own
 * "mock location" flag, and an emulator can be put anywhere in the world with
 * one command. Either makes every location the app records worthless, so the
 * app does not run on them at all (asked 2026-11-26).
 *
 * The check is expo-device's: su binaries, test-keys builds, Cydia and the
 * like. It is a deterrent, not proof: a determined person can hide root from
 * any app check. A check that fails to run lets the app open rather than lock
 * out an honest person.
 *
 * Development builds skip it (the team tests on emulators), unless
 * EXPO_PUBLIC_ENFORCE_DEVICE_CHECK=1 is set to try the block itself.
 */

import * as Device from 'expo-device';

export type DeviceVerdict = 'ok' | 'rooted' | 'emulator';

const ENFORCE = !__DEV__ || process.env.EXPO_PUBLIC_ENFORCE_DEVICE_CHECK === '1';

export async function checkDevice(): Promise<DeviceVerdict> {
  if (!ENFORCE) return 'ok';
  if (!Device.isDevice) return 'emulator';
  try {
    return (await Device.isRootedExperimentalAsync()) ? 'rooted' : 'ok';
  } catch {
    return 'ok';
  }
}
