/**
 * App entry.
 *
 * Before the first screen renders:
 *   1. Fonts load behind the splash screen (Inter and Fraunces).
 *   2. A stored session is restored from the Keystore, behind a fingerprint
 *      when the device has one and the person has not switched it off.
 * Once signed in:
 *   3. Push is registered with the notification service; a tapped
 *      notification opens its own screen, including from a cold start.
 *   4. The person's offline punch queue drains on launch and on every return
 *      to the foreground — that is usually the moment signal came back.
 *   5. On a Tier 1 screen (pay, tax, attendance), the app switcher shows a
 *      cover instead of the screen.
 */

import { Fraunces_400Regular, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplash } from './src/components/AnimatedSplash';
import { BrandBackdrop } from './src/components/BrandBackdrop';
import { BrandLogo } from './src/components/Brand';
import { BlockedDeviceScreen } from './src/screens/auth/BlockedDeviceScreen';
import { LockScreen } from './src/screens/auth/LockScreen';
import { SignInScreen } from './src/screens/auth/SignInScreen';
import { KeyboardWatch } from './src/components/KeyboardWatch';
import { SystemBars } from './src/components/SystemBars';
import { ToastHost, toast } from './src/components/Toast';
import { destinationFor } from './src/core/deepLinks';
import { onSessionExpired } from './src/lib/api';
import { setRootHeight } from './src/lib/rootHeight';
import { loadSession, signOut as endSession, unlockWithBiometrics } from './src/lib/auth';
import { checkDevice, type DeviceVerdict } from './src/lib/deviceIntegrity';
import { t } from './src/lib/i18n';
import { miraSignal } from './src/lib/miraSignal';
import { registerForPush, unregisterPush } from './src/lib/push';
import { clearCache, persister, queryClient, shouldPersist, wireQueryLifecycle } from './src/lib/queryClient';
import { SessionProvider, useSession } from './src/lib/session';
import { SettingsProvider, useSettings } from './src/lib/settings';
import { punchQueueFor } from './src/lib/punchQueue';
import { startNotificationStream } from './src/lib/notificationStream';
import { buildLinking } from './src/navigation/linking';
import { goFromAnywhere, navigationRef } from './src/navigation/navigate';
import { RootNavigator } from './src/navigation/RootNavigator';
import { isTier1Route } from './src/navigation/tiers';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { layout } from './src/theme/tokens';

void SplashScreen.preventAutoHideAsync().catch(() => {});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/** Lock again after this long in the background. */
const RELOCK_AFTER_MS = 5 * 60 * 1000;

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_400Regular,
    Fraunces_600SemiBold,
  });
  // The animated splash covers the app until the gate knows who is signed in.
  const [gateReady, setGateReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  return (
    <GestureHandlerRootView style={styles.flex} onLayout={(event) => setRootHeight(event.nativeEvent.layout.height)}>
      <SafeAreaProvider>
        <SettingsProvider>
          <ThemeProvider>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{ persister, dehydrateOptions: { shouldDehydrateQuery: shouldPersist }, maxAge: 7 * 24 * 60 * 60 * 1000 }}
            >
              <BottomSheetModalProvider>{fontsLoaded ? <DeviceGate onReady={() => setGateReady(true)} /> : null}</BottomSheetModalProvider>
              {/* After the sheets' layer, so a message from an open sheet (a
                  failed save) shows above it instead of hidden behind. */}
              {fontsLoaded ? <ToastHost /> : null}
              {fontsLoaded && !splashDone ? <AnimatedSplash ready={gateReady} onDone={() => setSplashDone(true)} /> : null}
              <KeyboardWatch />
              <SystemBars />
            </PersistQueryClientProvider>
          </ThemeProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Nothing opens on a rooted phone or an emulator: a fake-GPS app can hide
 * there, so its punches could not be trusted (lib/deviceIntegrity.ts).
 */
function DeviceGate({ onReady }: { onReady: () => void }) {
  const [verdict, setVerdict] = useState<DeviceVerdict | null>(null);

  useEffect(() => {
    let alive = true;
    void checkDevice().then((found) => alive && setVerdict(found));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (verdict && verdict !== 'ok') onReady();
  }, [verdict, onReady]);

  if (verdict === null) return null;
  if (verdict !== 'ok') {
    return (
      <>
        <StatusBar style="light" backgroundColor="transparent" translucent />
        <BlockedDeviceScreen verdict={verdict} />
      </>
    );
  }
  return <AuthGate onReady={onReady} />;
}

type GateState = 'loading' | 'locked' | 'signedOut' | 'signedIn';

function AuthGate({ onReady }: { onReady: () => void }) {
  const { settings, ready } = useSettings();
  const { dark } = useTheme();
  const [state, setState] = useState<GateState>('loading');
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => wireQueryLifecycle(), []);

  const restore = useCallback(async () => {
    const result = await unlockWithBiometrics(settings.biometric);
    if (result === 'cancelled') setState('locked');
    else setState(result ? 'signedIn' : 'signedOut');
  }, [settings.biometric]);

  useEffect(() => {
    if (!ready) return;
    void miraSignal.load();
    void restore();
  }, [ready, restore]);

  // The animated splash (App) leaves once this knows where to go.
  useEffect(() => {
    if (state !== 'loading') onReady();
  }, [state, onReady]);

  const signOut = useCallback(async () => {
    await unregisterPush();
    await endSession();
    await clearCache();
    setState('signedOut');
  }, []);

  // A refresh that fails ends the session cleanly, wherever it happened.
  useEffect(
    () =>
      onSessionExpired(() => {
        void (async () => {
          if (!(await loadSession())) return;
          await endSession();
          await clearCache();
          setState('signedOut');
          toast.info(t('Your session expired. Please sign in again.'));
        })();
      }),
    [],
  );

  // Re-entry: after a while away, ask for the fingerprint again.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') backgroundedAt.current = Date.now();
      if (next === 'active' && backgroundedAt.current && state === 'signedIn' && settings.biometric) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > RELOCK_AFTER_MS) {
          void unlockWithBiometrics(true).then((result) => {
            if (result === 'cancelled') setState('locked');
          });
        }
      }
    });
    return () => subscription.remove();
  }, [state, settings.biometric]);

  if (state === 'loading') return null;

  return (
    <>
      {/* Translucent: the app draws under the status bar and each screen pads for
          it. A solid bar makes Android report no bottom inset on Android 15,
          which draws edge to edge anyway, and the bottom of screens slides
          under the navigation bar. */}
      <StatusBar
        style={state === 'signedIn' ? (dark ? 'light' : 'dark') : 'light'}
        // Transparent, not a colour: a coloured see-through bar paints over the
        // app, so sheet and dialog shading stopped short of the top.
        backgroundColor="transparent"
        translucent
      />
      {state === 'signedIn' ? (
        <SignedInApp signOut={signOut} />
      ) : state === 'locked' ? (
        <LockScreen onUnlocked={() => setState('signedIn')} onSignOut={() => void signOut()} />
      ) : (
        <SignInScreen
          onSignedIn={() => {
            queryClient.clear();
            setState('signedIn');
          }}
        />
      )}
    </>
  );
}

function SignedInApp({ signOut }: { signOut: () => Promise<void> }) {
  const { colors, dark } = useTheme();
  const { settings } = useSettings();
  const linking = useMemo(() => buildLinking(), []);

  const theme: Theme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.header,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, dark]);

  return (
    <SessionProvider signOut={signOut}>
      <NavigationContainer
        ref={navigationRef}
        theme={theme}
        linking={linking}
        onReady={() => void openColdStartNotification()}
      >
        {/* Changing the language re-renders every screen in it. */}
        <View key={settings.language} style={styles.flex}>
          <RootNavigator />
        </View>
        <SignedInEffects />
      </NavigationContainer>
      <PrivacyCover />
    </SessionProvider>
  );
}

async function openColdStartNotification() {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return;
    const data = response.notification.request.content.data as Record<string, unknown>;
    const destination = destinationFor(String(data.event_key ?? ''), data);
    goFromAnywhere(destination.route, destination.params);
  } catch {
    // No notification opened the app.
  }
}

/** Side effects that need a session: push, the punch queue, live notifications. */
function SignedInEffects() {
  const { session } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    void registerForPush();
  }, [userId]);

  // A tapped notification opens its own screen, not Home.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const destination = destinationFor(String(data.event_key ?? ''), data);
      goFromAnywhere(destination.route, destination.params);
    });
    return () => subscription.remove();
  }, []);

  // Drain this person's queue on launch and whenever the app returns.
  useEffect(() => {
    if (!userId || !session?.user.employee_id) return;
    const queue = punchQueueFor(userId);
    const drain = () =>
      void queue.sync().then((summary) => {
        if (summary.synced || summary.stale || summary.rejected) {
          void queryClient.invalidateQueries({ queryKey: ['attendance'] });
          void queryClient.invalidateQueries({ queryKey: ['punch-queue'] });
        }
      });
    drain();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') drain();
    });
    // Signal coming back is the other moment a queued punch can go.
    let wasOnline = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
      if (online && !wasOnline) drain();
      wasOnline = online;
    });
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, [userId, session?.user.employee_id]);

  // Live notifications while the app is in the foreground.
  useEffect(() => {
    if (!userId) return;
    let stop: (() => void) | null = startNotificationStream();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !stop) stop = startNotificationStream();
      if (next !== 'active' && stop) {
        stop();
        stop = null;
      }
    });
    return () => {
      subscription.remove();
      stop?.();
    };
  }, [userId]);

  return null;
}

/**
 * Covers Tier 1 screens (pay, tax, attendance, approvals) when the app goes to
 * the app switcher, so a salary is not left on a thumbnail.
 */
function PrivacyCover() {
  const { colors } = useTheme();
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const onChange = (next: string) => {
      if (next === 'active') setCovered(false);
      else {
        const route = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
        setCovered(isTier1Route(route));
      }
    };
    const change = AppState.addEventListener('change', onChange);
    const blur = AppState.addEventListener('blur', () => onChange('inactive'));
    const focus = AppState.addEventListener('focus', () => onChange('active'));
    return () => {
      change.remove();
      blur.remove();
      focus.remove();
    };
  }, []);

  if (!covered) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.brandSurface }]}>
      <BrandBackdrop />
      <BrandLogo height={layout.avatarLg} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cover: { alignItems: 'center', justifyContent: 'center' },
});
