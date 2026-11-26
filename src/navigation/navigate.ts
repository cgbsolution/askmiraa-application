/**
 * Going somewhere in the app.
 *
 * One function, `go(route, params)`, used by screens, push taps, deep links
 * and Ask Miraa's cards. It resolves a route name (or alias) to its tab and
 * screen via `core/routes.ts`, keeps the tab's root under a detail screen so
 * Back works, and opens modals over the tabs.
 */

import { CommonActions, createNavigationContainerRef, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback } from 'react';

import { targetFor, type RouteName, type TabName } from '../core/routes';

export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

/** The first screen of each tab's stack. */
export const TAB_ROOTS: Record<TabName, string> = {
  HomeTab: 'Home',
  AttendanceTab: 'Attendance',
  LeaveTab: 'Leave',
  MeTab: 'MeHub',
};

type Params = Record<string, unknown> | undefined;

function actionFor(route: RouteName, params?: Params) {
  const target = targetFor(route, params as Record<string, string> | undefined);
  const merged = { ...(target.params ?? {}), ...(params ?? {}) };
  const screenParams = Object.keys(merged).length ? merged : undefined;
  if (target.tab === null) {
    return CommonActions.navigate(target.screen, screenParams);
  }
  if (TAB_ROOTS[target.tab] === target.screen) {
    // A tab root: switch tab and show the root, with any params (a segment).
    return CommonActions.navigate('Tabs', { screen: target.tab, params: { screen: target.screen, params: screenParams } });
  }
  return CommonActions.navigate('Tabs', {
    screen: target.tab,
    // initial: false keeps the tab's root under the detail screen, so Back works.
    params: { screen: target.screen, params: screenParams, initial: false },
  });
}

/** Navigate from outside React (a push tap, a deep link). Waits until the navigator is ready. */
export function goFromAnywhere(route: RouteName, params?: Params, attempt = 0): void {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(actionFor(route, params));
    return;
  }
  if (attempt < 40) setTimeout(() => goFromAnywhere(route, params, attempt + 1), 150);
}

/** `const go = useGo(); go('LeaveDetail', { id })`. */
export function useGo() {
  const navigation = useNavigation();
  return useCallback(
    (route: RouteName, params?: Params) => {
      navigation.dispatch(actionFor(route, params));
    },
    [navigation],
  );
}

/** The current screen's params. */
export function useParams<T extends Record<string, unknown>>(): Partial<T> {
  const route = useRoute();
  return (route.params ?? {}) as Partial<T>;
}
