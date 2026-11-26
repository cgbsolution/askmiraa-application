/**
 * Push registration.
 *
 * The device's push token is handed to the notification service
 * (`POST /notifications/devices`) after sign-in, and withdrawn on sign-out
 * (`/notifications/devices/unregister`) so the next person on a shared phone
 * does not receive the last person's payslip alerts.
 *
 * A registration that fails (no permission, no EAS project id in a
 * development build, no signal) must not block the app; push simply stays off
 * until the next launch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { notificationsApi } from '../api/notifications';

const KEY = 'askmira.push-token.v1';
const PLATFORM = 'expo';

export async function registerForPush(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'AskMiraa',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await notificationsApi.registerDevice(token, PLATFORM);
    await AsyncStorage.setItem(KEY, token);
  } catch {
    // Push stays off; everything else works.
  }
}

/** Whether this phone handed a push token to the server, so "On your phone" can reach it. */
export async function pushReady(): Promise<boolean> {
  try {
    return Boolean(await AsyncStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export async function unregisterPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(KEY);
    if (!token) return;
    await notificationsApi.unregisterDevice(token, PLATFORM).catch(() => {});
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Offline sign-out: the server prunes dead tokens on its next send.
  }
}
