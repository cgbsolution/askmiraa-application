/**
 * Google's map, drawn the way the portal draws it: the Maps JavaScript API,
 * here inside a web view, with the key the API hands out after sign-in
 * (GET /attendance/map-config — keys live only in the backend's .env).
 *
 * It shows what StaticMap shows: the person's dot and how accurate the fix
 * is, or the pin where a punch was made, and the work locations' geofence
 * circles. Later moves of the dot are sent to the page rather than reloading
 * it. The page reports back when Google has drawn the map ("ready") or
 * refused (a key it will not take, a browser too old, a script that fails);
 * PlaceMap then falls back to OpenStreetMap, as the portal does.
 */

import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { WorkPlace } from '../core/geo';
import { API_BASE } from '../lib/api';
import { t } from '../lib/i18n';
import { webAppUrl } from '../lib/links';
import { useTheme } from '../theme/ThemeProvider';
import { layout, radius } from '../theme/tokens';

/** No word from Google in this long and the map counts as refused (the portal waits 10 s). */
const READY_TIMEOUT_MS = 12_000;

interface Scene {
  lat: number;
  lng: number;
  marker: 'here' | 'pin';
  accuracy: number;
  places: { lat: number; lng: number; radius: number }[];
}

export interface GoogleMapProps {
  apiKey: string;
  latitude: number;
  longitude: number;
  height: number;
  marker?: 'here' | 'pin';
  accuracy?: number | null;
  places?: WorkPlace[];
  zoom?: number;
  /** Pan and zoom (two fingers, so the page still scrolls with one) and the zoom buttons. */
  interactive?: boolean;
  framed?: boolean;
  accessibilityLabel?: string;
  onFailed: (reason: string) => void;
}

/**
 * The page in the web view. Everything it needs comes in as JSON (no colour
 * or key is written into this file); the script only draws.
 */
function page(apiKey: string, scene: Scene, look: { zoom: number; interactive: boolean; primary: string; success: string; ring: string; background: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${look.background}}</style></head>
<body><div id="map"></div><script>
var look=${JSON.stringify(look)}, scene=${JSON.stringify(scene)};
var map=null, dot=null, halo=null, fences=[], ready=false, failed=false;
function tell(type, reason){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:type, reason:reason||''})); }
function fail(reason){ if (failed || ready) return; failed=true; tell('failed', reason); }
window.gm_authFailure=function(){ ready=false; failed=false; fail('auth'); };
window.onerror=function(message){ fail('script: '+message); };
function draw(next){
  scene=next;
  var at={lat:scene.lat, lng:scene.lng};
  if (dot) dot.setMap(null);
  if (halo) { halo.setMap(null); halo=null; }
  var icon = scene.marker==='pin'
    ? {path:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z', fillColor:look.primary, fillOpacity:1, strokeColor:look.ring, strokeWeight:2, scale:1.7, anchor:new google.maps.Point(12,22)}
    : {path:google.maps.SymbolPath.CIRCLE, fillColor:look.primary, fillOpacity:1, strokeColor:look.ring, strokeWeight:3, scale:8};
  dot=new google.maps.Marker({map:map, position:at, icon:icon, clickable:false, zIndex:3});
  if (scene.marker==='here' && scene.accuracy>0) {
    halo=new google.maps.Circle({map:map, center:at, radius:scene.accuracy, fillColor:look.primary, fillOpacity:0.1, strokeColor:look.primary, strokeOpacity:0.35, strokeWeight:1, clickable:false, zIndex:1});
  }
  fences.forEach(function(f){ f.setMap(null); });
  fences=scene.places.map(function(p){
    return new google.maps.Circle({map:map, center:{lat:p.lat, lng:p.lng}, radius:p.radius, fillColor:look.success, fillOpacity:0.12, strokeColor:look.success, strokeOpacity:0.9, strokeWeight:1.5, clickable:false, zIndex:2});
  });
}
window.askmiraScene=function(next){ if (!map) { scene=next; return; } var moved=next.lat!==scene.lat||next.lng!==scene.lng; draw(next); if (moved) map.panTo({lat:next.lat, lng:next.lng}); };
function start(){
  try {
    map=new google.maps.Map(document.getElementById('map'), {
      center:{lat:scene.lat, lng:scene.lng}, zoom:look.zoom, disableDefaultUI:true, zoomControl:look.interactive,
      zoomControlOptions:{position:google.maps.ControlPosition.RIGHT_TOP},
      gestureHandling: look.interactive ? 'cooperative' : 'none', clickableIcons:false, keyboardShortcuts:false
    });
    draw(scene);
    google.maps.event.addListenerOnce(map, 'tilesloaded', function(){ if (!failed) { ready=true; tell('ready'); } });
  } catch (error) { fail('start: '+error); }
}
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=start&v=weekly&loading=async" onerror="fail('load')"></script>
</body></html>`;
}

export function GoogleMap({
  apiKey,
  latitude,
  longitude,
  height,
  marker = 'here',
  accuracy,
  places = [],
  zoom = 16,
  interactive = false,
  framed = true,
  accessibilityLabel,
  onFailed,
}: GoogleMapProps) {
  const { colors } = useTheme();
  const view = useRef<WebView>(null);
  const ready = useRef(false);
  const failedRef = useRef(onFailed);
  failedRef.current = onFailed;

  // Compared as text: the punch screen redraws every second for its clock, and
  // only a real change (the person moved, a better fix) should reach the page.
  const sceneJson = JSON.stringify({
    lat: latitude,
    lng: longitude,
    marker,
    accuracy: accuracy && accuracy > 0 ? Math.round(accuracy) : 0,
    places: places.map((p) => ({ lat: p.latitude, lng: p.longitude, radius: p.radius_metres })),
  } satisfies Scene);
  // The page is written once; the scene it starts from is the first one seen.
  const first = useRef(sceneJson);
  const latest = useRef(sceneJson);
  latest.current = sceneJson;

  const html = useMemo(
    () =>
      page(apiKey, JSON.parse(first.current) as Scene, {
        zoom,
        interactive,
        primary: colors.primary,
        success: colors.success,
        ring: colors.surface,
        background: colors.surfaceSunken,
      }),
    [apiKey, zoom, interactive, colors.primary, colors.success, colors.surface, colors.surfaceSunken],
  );

  // A new place for the dot (the person moved) goes to the page; no reload.
  useEffect(() => {
    if (ready.current) view.current?.injectJavaScript(`window.askmiraScene(${sceneJson});true;`);
  }, [sceneJson]);

  useEffect(() => {
    ready.current = false;
    const timer = setTimeout(() => {
      if (!ready.current) failedRef.current('timeout');
    }, READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [html]);

  const onMessage = (event: WebViewMessageEvent) => {
    let message: { type?: string; reason?: string } = {};
    try {
      message = JSON.parse(event.nativeEvent.data) as typeof message;
    } catch {
      return;
    }
    if (message.type === 'ready') {
      ready.current = true;
      // The dot may have moved while Google was loading.
      if (latest.current !== first.current) view.current?.injectJavaScript(`window.askmiraScene(${latest.current});true;`);
    } else if (message.type === 'failed') {
      failedRef.current(message.reason ?? 'failed');
    }
  };

  // The page claims the portal's address (or the API's), so a key limited to the portal's site works here too.
  const baseUrl = `${webAppUrl() ?? API_BASE}/`;

  return (
    <View
      style={[styles.frame, framed && styles.framed, { height, backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? t('Map')}
      // A map you cannot move lets the sheet or the page under it take the touch.
      pointerEvents={interactive ? 'auto' : 'none'}
    >
      <WebView
        ref={view}
        source={{ html, baseUrl }}
        originWhitelist={['*']}
        onMessage={onMessage}
        onError={() => failedRef.current('load')}
        onHttpError={() => failedRef.current('http')}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        bounces={false}
        style={[styles.web, { backgroundColor: colors.surfaceSunken }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  framed: { borderRadius: radius.control, borderWidth: layout.hairline },
  web: { flex: 1 },
});
