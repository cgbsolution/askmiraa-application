/**
 * The map on the punch screens: Google's, as on the portal.
 *
 * The API says which map to draw (GET /attendance/map-config): Google's when
 * the backend's .env has a key, OpenStreetMap's when it does not. Google's map
 * falls back to OpenStreetMap's — as the portal's does — when Google refuses
 * the key, the phone's web view is too old for it, or it has not drawn within
 * twelve seconds; after one refusal the rest of the session uses
 * OpenStreetMap rather than waiting again. Same props as StaticMap.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { attendanceApi } from '../api/attendance';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { GoogleMap } from './GoogleMap';
import { StaticMap, type StaticMapProps } from './StaticMap';

/** Google refused once this session (a bad key, an old web view): stop asking. */
let googleRefused = false;

export function PlaceMap(props: StaticMapProps) {
  const { colors } = useTheme();
  const config = useQuery({
    queryKey: ['attendance', 'map-config'],
    queryFn: attendanceApi.mapConfig,
    staleTime: 6 * 60 * 60_000,
    retry: 1,
  });
  const [refused, setRefused] = useState(googleRefused);
  const key = config.data?.provider === 'google' ? config.data.google_maps_api_key?.trim() : null;

  if (config.isPending) {
    // A moment, the first time only: then the answer is cached.
    return (
      <View
        style={{ height: props.height, backgroundColor: colors.surfaceSunken, borderRadius: props.framed === false ? 0 : radius.control }}
      />
    );
  }
  if (key && !refused) {
    return (
      <GoogleMap
        apiKey={key}
        latitude={props.latitude}
        longitude={props.longitude}
        height={props.height}
        marker={props.marker}
        accuracy={props.accuracy}
        places={props.places}
        zoom={props.zoom}
        interactive={props.controls}
        framed={props.framed}
        accessibilityLabel={props.accessibilityLabel}
        onFailed={(reason) => {
          // Development builds say why, so a refused key or an old web view is easy to tell apart.
          if (__DEV__) console.log(`[map] Google's map was not drawn (${reason}); using OpenStreetMap.`);
          googleRefused = true;
          setRefused(true);
        }}
      />
    );
  }
  return <StaticMap {...props} />;
}
