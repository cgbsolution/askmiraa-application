/**
 * The active colour set, light or dark.
 *
 * Follows the system setting unless the person chose one in Settings. Screens
 * never pick colours from the palette: they ask for `colors.surface`, and the
 * styles are rebuilt when the set changes (`makeStyles`).
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { useSettings } from '../lib/settings';
import { darkColors, lightColors, type Colors } from './tokens';

interface ThemeValue {
  colors: Colors;
  dark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ colors: lightColors, dark: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const { settings } = useSettings();
  const dark = settings.theme === 'system' ? system === 'dark' : settings.theme === 'dark';
  const value = useMemo(() => ({ colors: dark ? darkColors : lightColors, dark }), [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/**
 * Styles built from the active colours, created once per colour set.
 *
 *     const useStyles = makeStyles((c) => ({ card: { backgroundColor: c.surface } }));
 *     const styles = useStyles();
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (colors: Colors) => T) {
  const cache = new WeakMap<Colors, T>();
  return function useStyles(): T {
    const { colors } = useTheme();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(factory(colors));
      cache.set(colors, styles);
    }
    return styles;
  };
}
