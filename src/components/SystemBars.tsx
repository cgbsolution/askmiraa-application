/**
 * The Android navigation bar (Back, Home, Recents) under the app.
 *
 * Android 15 draws apps edge to edge and picks the button colour itself, so
 * nothing is set there. The stacks also set it per screen (RootNavigator),
 * which re-applies it whenever a screen gains focus. Before that the bar is the app's to colour, and before
 * Android 8.1 (API 27) its buttons can only be white: a transparent bar over
 * the cream background left them invisible. So below Android 15 the bar takes
 * the tab bar's colour, with light buttons, on every Android version.
 */

import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

const EDGE_TO_EDGE_API = 35;

export function SystemBars() {
  const { colors } = useTheme();
  useEffect(() => {
    if (Platform.OS !== 'android' || Number(Platform.Version) >= EDGE_TO_EDGE_API) return;
    const apply = () => {
      void NavigationBar.setBackgroundColorAsync(colors.tabBar).catch(() => {});
      void NavigationBar.setButtonStyleAsync('light').catch(() => {});
    };
    apply();
    // Back from the camera, a browser or another app: the bar may have been reset.
    const sub = AppState.addEventListener('change', (state) => state === 'active' && apply());
    return () => sub.remove();
  }, [colors.tabBar]);
  return null;
}
