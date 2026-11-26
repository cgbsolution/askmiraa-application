/**
 * askmira:// URLs, built from the same route list as the navigator.
 *
 *   askmira://LeaveDetail/<id>      askmira://AttendanceDetail/2026-10-06
 *   askmira://Inbox?segment=approvals   askmira://AskMira
 */

import type { LinkingOptions, PathConfigMap } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import { ROUTES, type ScreenRoute, type TabName } from '../core/routes';
import { TAB_ROOTS } from './navigate';

function pathFor(name: ScreenRoute): string {
  const param = (ROUTES[name] as { param?: string }).param;
  return param ? `${name}/:${param}` : name;
}

export function buildLinking(): LinkingOptions<Record<string, object | undefined>> {
  const tabs: Record<TabName, PathConfigMap<Record<string, object | undefined>>> = {
    HomeTab: {},
    AttendanceTab: {},
    LeaveTab: {},
    MeTab: {},
  };
  const modals: PathConfigMap<Record<string, object | undefined>> = {};
  for (const name of Object.keys(ROUTES) as ScreenRoute[]) {
    const tab = ROUTES[name].tab;
    if (tab) tabs[tab][name] = pathFor(name);
    else modals[name] = pathFor(name);
  }
  const config = {
      screens: {
        Tabs: {
          screens: {
            // The tab's hub sits under a linked screen, so Back leads home
            // instead of out of the app (a notification opens a detail).
            HomeTab: { initialRouteName: TAB_ROOTS.HomeTab, screens: tabs.HomeTab },
            AttendanceTab: { initialRouteName: TAB_ROOTS.AttendanceTab, screens: tabs.AttendanceTab },
            LeaveTab: { initialRouteName: TAB_ROOTS.LeaveTab, screens: tabs.LeaveTab },
            MeTab: { initialRouteName: TAB_ROOTS.MeTab, screens: tabs.MeTab },
          },
        },
        ...modals,
      },
  };
  return {
    // askmira:// in a build; Expo's own URL (exp://…/--/) while developing.
    prefixes: Array.from(new Set(['askmira://', Linking.createURL('/')])),
    // The nested shape is right; React Navigation's types cannot follow a
    // config built from a list, so it is asserted here once.
    config: config as unknown as LinkingOptions<Record<string, object | undefined>>['config'],
  };
}
