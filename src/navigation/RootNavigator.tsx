/**
 * Navigation.
 *
 * A root stack holds the five-slot tab bar (Home · Attendance · Ask Miraa ·
 * Leave · Me) and, over it: the Inbox (notifications, approvals, tasks),
 * pushed like a page from the bell on every tab; Ask Miraa full screen; and the
 * creation forms (apply leave, regularise, raise ticket…) as modals. Each tab
 * has its own stack, so a detail screen pushes inside its tab and Back returns
 * to where the person was.
 *
 * The screen list comes from `core/routes.ts`; `screens.tsx` says which
 * component draws each one.
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import { useMemo, type ComponentType, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '../components/Button';
import { PageShell } from '../components/PageShell';
import { Screen } from '../components/Screen';
import { ModuleOffState } from '../components/States';
import { Txt } from '../components/Text';
import { ROUTE_MODULES, moduleOffFor } from '../core/routeModules';
import { ROUTES, TAB_NAMES, isCardRoute, type ScreenRoute, type TabName } from '../core/routes';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, layout, spacing, typography } from '../theme/tokens';
import { TAB_ROOTS } from './navigate';
import { SCREENS } from './screens';
import { TabBar } from './TabBar';

const Root = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const tabStacks = Object.fromEntries(TAB_NAMES.map((tab) => [tab, createNativeStackNavigator()])) as Record<
  TabName,
  ReturnType<typeof createNativeStackNavigator>
>;

const colourNavigationBar = Platform.OS === 'android' && Number(Platform.Version) < 35;

function useStackOptions(): NativeStackNavigationOptions {
  const { colors, dark } = useTheme();
  return useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.header },
      headerShadowVisible: false,
      headerTintColor: colors.onHeader,
      headerTitleStyle: { fontFamily: fonts.semibold, fontSize: typography.headline.fontSize + 1, color: colors.onHeader },
      headerBackButtonDisplayMode: 'minimal',
      contentStyle: { backgroundColor: colors.background },
      animation: 'slide_from_right',
      // The app draws under a see-through status bar (App.tsx). Saying so here
      // lets the native header pad itself for the bar on every screen. Without
      // it the header assumed a solid bar, and once anything made the bar
      // see-through (returning from the camera did) headers slid under it and
      // modals came up a status bar short.
      statusBarTranslucent: true,
      // And see-through: otherwise the stack re-applies the bar colour it first
      // saw, which paints over the app (sheet shading stopped below the bar).
      statusBarBackgroundColor: 'transparent',
      // Dark icons on the cream background, light ones in dark mode.
      statusBarStyle: dark ? 'light' : 'dark',
      // Below Android 15 the navigation bar is the app's to colour, and before
      // Android 8.1 its buttons are always white: the tab bar's colour keeps
      // them visible. Set per screen so it is re-applied on every focus
      // (another app or a system dialog can reset it). See SystemBars.tsx.
      ...(colourNavigationBar ? { navigationBarColor: colors.tabBar } : {}),
    }),
    [colors, dark],
  );
}

function screensFor(tab: TabName) {
  return (Object.keys(ROUTES) as ScreenRoute[]).filter((name) => ROUTES[name].tab === tab);
}

function TabStack({ tab }: { tab: TabName }) {
  const Stack = tabStacks[tab];
  const options = useStackOptions();
  const names = screensFor(tab);
  const root = TAB_ROOTS[tab];
  // The root first, so it is the stack's initial screen.
  const ordered = [root, ...names.filter((name) => name !== root)] as ScreenRoute[];
  return (
    <Stack.Navigator screenOptions={options}>
      {ordered.map((name) => {
        const entry = SCREENS[name];
        return (
          <Stack.Screen
            key={name}
            name={name}
            component={GATED[name]}
            options={{ title: t(entry.title), headerShown: name !== root && entry.header !== false }}
          />
        );
      })}
    </Stack.Navigator>
  );
}

const HomeStack = () => <TabStack tab="HomeTab" />;
const AttendanceStack = () => <TabStack tab="AttendanceTab" />;
const LeaveStack = () => <TabStack tab="LeaveTab" />;
const MeStack = () => <TabStack tab="MeTab" />;

function TabsNavigator() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, lazy: true }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="HomeTab" component={HomeStack} options={{ title: t('Home') }} />
      <Tabs.Screen name="AttendanceTab" component={AttendanceStack} options={{ title: t('Attendance') }} />
      <Tabs.Screen name="LeaveTab" component={LeaveStack} options={{ title: t('Leave') }} />
      <Tabs.Screen name="MeTab" component={MeStack} options={{ title: t('Me') }} />
    </Tabs.Navigator>
  );
}

/**
 * Modals draw their own header (close + title) rather than the native one:
 * on Android, a native header inside a modal made the screen's height flip
 * between two values, which pushed sticky submit bars under the bottom edge.
 */
function ModalShell({ title, children }: { title: string; children: ReactNode }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.modalHeader, { paddingTop: insets.top, backgroundColor: colors.header }]}>
        <IconButton icon={X} label={t('Close')} onPress={() => navigation.goBack()} />
        <Txt variant="headline" numberOfLines={1} style={styles.flex} accessibilityRole="header">
          {title}
        </Txt>
      </View>
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

/**
 * A screen whose module the workspace has switched off shows only that, with
 * no buttons that would fail (core/routeModules.ts). Decided per render, so a
 * module switched back on shows the screen again on the next session load.
 */
function gated(name: ScreenRoute, Inner: ComponentType): ComponentType {
  if (!ROUTE_MODULES[name]) return Inner;
  function Gated() {
    const modules = useSession().access?.modules;
    const off = modules ? moduleOffFor(name, modules) : null;
    if (!off) return <Inner />;
    return (
      <Screen>
        <ModuleOffState module={off} />
      </Screen>
    );
  }
  Gated.displayName = `Gated(${name})`;
  return Gated;
}

const GATED = Object.fromEntries((Object.keys(SCREENS) as ScreenRoute[]).map((name) => [name, gated(name, SCREENS[name].component as ComponentType)])) as Record<
  ScreenRoute,
  ComponentType
>;

const MODAL_NAMES = (Object.keys(ROUTES) as ScreenRoute[]).filter((name) => ROUTES[name].tab === null);

const MODAL_COMPONENTS = Object.fromEntries(
  MODAL_NAMES.map((name) => {
    const entry = SCREENS[name];
    const Inner = GATED[name];
    if (isCardRoute(name)) {
      // A page over the tabs (the Inbox) draws its own header too: see PageShell.
      const Page = () => (
        <PageShell title={t(entry.title)}>
          <Inner />
        </PageShell>
      );
      Page.displayName = `Page(${name})`;
      return [name, Page];
    }
    const Wrapped = () =>
      entry.header === false ? (
        <Inner />
      ) : (
        <ModalShell title={t(entry.title)}>
          <Inner />
        </ModalShell>
      );
    Wrapped.displayName = `Modal(${name})`;
    return [name, Wrapped];
  }),
) as Partial<Record<ScreenRoute, () => JSX.Element>>;

export function RootNavigator() {
  const options = useStackOptions();

  return (
    <Root.Navigator screenOptions={options}>
      <Root.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
      {MODAL_NAMES.map((name) => (
        <Root.Screen
          key={name}
          name={name}
          component={MODAL_COMPONENTS[name]!}
          options={
            isCardRoute(name)
              ? { title: t(SCREENS[name].title), headerShown: false, animation: 'slide_from_right' }
              : {
                  title: t(SCREENS[name].title),
                  presentation: name === 'AskMira' ? 'fullScreenModal' : 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }
          }
        />
      ))}
    </Root.Navigator>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs, minHeight: layout.rowHeight },
});
