/**
 * Expo config.
 *
 * The API address comes from the environment, never from source:
 *
 *   EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000     Android emulator -> this PC
 *   EXPO_PUBLIC_API_BASE_URL=http://localhost:8000    iOS simulator
 *   EXPO_PUBLIC_API_BASE_URL=https://api.example.com  staging / production builds
 *
 * Put it in `.env.development`, `.env.staging` or `.env.production` (see
 * `.env.example`), or export it before `npx expo start`. A staging or
 * production build without one fails here rather than shipping an app that
 * talks to localhost.
 */

import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_ENV = (process.env.APP_ENV ?? 'development') as 'development' | 'staging' | 'production';

function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv;
  if (APP_ENV !== 'development') {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL is required for a ${APP_ENV} build.`);
  }
  // Development default: the Android emulator's address for this computer.
  return 'http://10.0.2.2:8000';
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_ENV === 'production' ? 'AskMiraa' : `AskMiraa (${APP_ENV})`,
  slug: 'askmira',
  version: '0.2.0',
  orientation: 'portrait',
  scheme: 'askmira',
  userInterfaceStyle: 'automatic',
  // Brand colours (theme/tokens.ts): the portal's Maroon rail, Cream, Ink.
  icon: './assets/icon.png',
  backgroundColor: '#fef8f4',
  newArchEnabled: true,
  androidStatusBar: { translucent: true, backgroundColor: '#00000000', barStyle: 'dark-content' },
  androidNavigationBar: { backgroundColor: '#00000000' },
  // The native splash is the first frame of the animated one (screens/auth/
  // SplashScreen.tsx): the logo on the rail's maroon.
  splash: {
    image: './assets/splash-icon.png',
    backgroundColor: '#5c0a11',
    resizeMode: 'contain',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.vizionforge.askmira',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'AskMiraa records where you punch in and out, so your attendance can be confirmed against your work location.',
      NSFaceIDUsageDescription: 'Unlock AskMiraa with Face ID instead of signing in again.',
      NSCameraUsageDescription: 'Take a photo of a receipt, a document or a punch selfie.',
      NSPhotoLibraryUsageDescription: 'Attach a receipt or a document you already have.',
      NSMicrophoneUsageDescription: 'Speak your question to Ask Miraa.',
    },
  },
  android: {
    package: 'com.vizionforge.askmira',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#eb061d' },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'CAMERA',
    ],
    softwareKeyboardLayoutMode: 'resize',
  },
  plugins: [
    'expo-secure-store',
    ['expo-local-authentication', { faceIDPermission: 'Unlock AskMiraa with Face ID instead of signing in again.' }],
    ['expo-location', { locationAlwaysAndWhenInUsePermission: 'AskMiraa records where you punch in and out.' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Attach a receipt or a document you already have.',
        cameraPermission: 'Take a photo of a receipt, a document or a punch selfie.',
      },
    ],
    'expo-font',
    '@react-native-community/datetimepicker',
    'expo-localization',
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#7d0712' }],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        // Android 12+ shows only a circle 2/3 of the 288dp splash square (192dp);
        // a wider logo has its ends cut off. 168dp wide fits inside it.
        imageWidth: 168,
        resizeMode: 'contain',
        backgroundColor: '#5c0a11',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#34040a' },
      },
    ],
  ],
  extra: {
    appEnv: APP_ENV,
    apiBaseUrl: apiBaseUrl(),
    webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL ?? null,
    // The punch screen's map tiles. OpenStreetMap's public tiles (the portal's
    // fallback) by default; set a licensed provider for a large rollout, as
    // OpenStreetMap's tile policy asks of busy apps.
    mapTileUrl: process.env.EXPO_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    mapAttribution: process.env.EXPO_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors',
  },
});
