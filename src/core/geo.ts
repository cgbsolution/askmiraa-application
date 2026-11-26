/**
 * Where a punch is: map tiles, distance to a work location, an address line.
 *
 * The map is drawn from standard web-map tiles (the portal's own fallback,
 * OpenStreetMap), so it needs no API key and no native map module. The
 * geofence maths is the API's (haversine, metres beyond the nearest edge), so
 * the phone says "At Bengaluru HQ" exactly when the server will.
 */

export const TILE_PIXELS = 256;
const EARTH_RADIUS_METRES = 6_371_000;

/** A point's position in world pixels at a zoom level (Web Mercator). */
export function worldPixel(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const scale = TILE_PIXELS * 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export interface PlacedTile {
  key: string;
  x: number;
  y: number;
  z: number;
  /** Where the tile's top-left corner sits in the frame, in tile pixels. */
  left: number;
  top: number;
}

/**
 * The tiles that cover a frame `width` × `height` (in tile pixels) centred on
 * a point, each with its offset in the frame. Tiles off the east/west edge of
 * the world wrap round; rows beyond the poles are dropped.
 */
export function tilesFor(latitude: number, longitude: number, zoom: number, width: number, height: number): PlacedTile[] {
  const centre = worldPixel(latitude, longitude, zoom);
  const originX = centre.x - width / 2;
  const originY = centre.y - height / 2;
  const count = 2 ** zoom;
  const tiles: PlacedTile[] = [];
  for (let ty = Math.floor(originY / TILE_PIXELS); ty <= Math.floor((originY + height) / TILE_PIXELS); ty += 1) {
    if (ty < 0 || ty >= count) continue;
    for (let tx = Math.floor(originX / TILE_PIXELS); tx <= Math.floor((originX + width) / TILE_PIXELS); tx += 1) {
      const wrapped = ((tx % count) + count) % count;
      tiles.push({ key: `${zoom}/${tx}/${ty}`, x: wrapped, y: ty, z: zoom, left: tx * TILE_PIXELS - originX, top: ty * TILE_PIXELS - originY });
    }
  }
  return tiles;
}

/** "https://tile…/{z}/{x}/{y}.png" with the tile's numbers filled in. */
export function tileUrl(template: string, tile: Pick<PlacedTile, 'x' | 'y' | 'z'>): string {
  return template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
}

/** Metres per tile pixel at a latitude and zoom: how big a geofence circle is on the map. */
export function metresPerPixel(latitude: number, zoom: number): number {
  return (Math.cos((latitude * Math.PI) / 180) * 2 * Math.PI * EARTH_RADIUS_METRES) / (TILE_PIXELS * 2 ** zoom);
}

/** Great-circle distance in metres; the same formula the API uses for geofences. */
export function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(a));
}

export interface WorkPlace {
  name: string;
  latitude: number;
  longitude: number;
  radius_metres: number;
}

/** The work location whose edge is nearest, and how far beyond it (negative inside). */
export function nearestPlace(latitude: number, longitude: number, places: WorkPlace[]): { place: WorkPlace; beyond: number } | null {
  let best: { place: WorkPlace; beyond: number } | null = null;
  for (const place of places) {
    const beyond = haversineMetres(latitude, longitude, place.latitude, place.longitude) - place.radius_metres;
    if (!best || beyond < best.beyond) best = { place, beyond };
  }
  return best;
}

/** 850 → "850 m", 2340 → "2.3 km". */
export function formatDistance(metres: number): string {
  const value = Math.abs(metres);
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
}

/** "At Bengaluru HQ" inside a geofence, "2.3 km from Bengaluru HQ" outside, null with no work locations. */
export function placeLine(latitude: number, longitude: number, places: WorkPlace[]): { text: string; inside: boolean } | null {
  const nearest = nearestPlace(latitude, longitude, places);
  if (!nearest) return null;
  if (nearest.beyond <= 0) return { text: `At ${nearest.place.name}`, inside: true };
  return { text: `${formatDistance(nearest.beyond)} from ${nearest.place.name}`, inside: false };
}

/** The parts the phone's geocoder returns (expo-location's LocationGeocodedAddress). */
export interface AddressParts {
  name?: string | null;
  streetNumber?: string | null;
  street?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
}

/**
 * One line for an address: "B439, Kalkaji, New Delhi, Delhi, 110019".
 * Repeats are dropped (geocoders often give the same place as name and
 * street), and so are parts that are only a plus-code or a number.
 */
export function addressLine(parts: AddressParts | null | undefined): string | null {
  if (!parts) return null;
  const pieces = [parts.name, parts.street, parts.district, parts.city ?? parts.subregion, parts.region, parts.postalCode];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of pieces) {
    const piece = (raw ?? '').trim();
    if (!piece) continue;
    const key = piece.toLowerCase();
    if (seen.has(key)) continue;
    // A Google plus-code ("7MRC+X2") says nothing to a person.
    if (/^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}/i.test(piece)) continue;
    seen.add(key);
    out.push(piece);
  }
  return out.length ? out.join(', ') : null;
}

/** "28.5355° N, 77.2507° E" — shown when no address could be found. */
export function coordinateLine(latitude: number, longitude: number): string {
  const ns = latitude >= 0 ? 'N' : 'S';
  const ew = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(4)}° ${ns}, ${Math.abs(longitude).toFixed(4)}° ${ew}`;
}
