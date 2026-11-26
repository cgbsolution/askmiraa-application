import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TILE_PIXELS,
  addressLine,
  coordinateLine,
  formatDistance,
  haversineMetres,
  metresPerPixel,
  placeLine,
  tileUrl,
  tilesFor,
  worldPixel,
} from '../geo.ts';

describe('map tiles', () => {
  it('puts the equator and the meridian at the middle of the world', () => {
    const centre = worldPixel(0, 0, 0);
    assert.equal(centre.x, TILE_PIXELS / 2);
    assert.ok(Math.abs(centre.y - TILE_PIXELS / 2) < 1e-9);
  });

  it('covers the frame, centred on the point', () => {
    // Kalkaji, New Delhi, at street level.
    const tiles = tilesFor(28.5355, 77.2507, 16, 360, 240);
    assert.ok(tiles.length >= 4 && tiles.length <= 9, `${tiles.length} tiles`);
    for (const tile of tiles) {
      assert.ok(tile.left > -TILE_PIXELS && tile.left < 360, 'tile overlaps the frame horizontally');
      assert.ok(tile.top > -TILE_PIXELS && tile.top < 240, 'tile overlaps the frame vertically');
    }
    // The point sits at the frame's centre: find the tile under (180, 120).
    const under = tiles.find((t) => t.left <= 180 && t.left + TILE_PIXELS > 180 && t.top <= 120 && t.top + TILE_PIXELS > 120)!;
    const centre = worldPixel(28.5355, 77.2507, 16);
    assert.equal(under.x, Math.floor(centre.x / TILE_PIXELS));
    assert.equal(under.y, Math.floor(centre.y / TILE_PIXELS));
  });

  it('wraps round the date line and drops rows past the poles', () => {
    const east = tilesFor(0, 179.99, 2, 512, 256);
    assert.ok(east.every((t) => t.x >= 0 && t.x < 4), 'tile numbers stay inside the world');
    const north = tilesFor(85, 0, 1, 256, 1024);
    assert.ok(north.every((t) => t.y >= 0 && t.y < 2));
  });

  it('fills a URL template', () => {
    assert.equal(tileUrl('https://t/{z}/{x}/{y}.png', { z: 16, x: 46830, y: 27371 }), 'https://t/16/46830/27371.png');
  });

  it('gives a geofence its size on the map', () => {
    // About 2.4 m a pixel at zoom 16 near Delhi.
    const m = metresPerPixel(28.5, 16);
    assert.ok(m > 2 && m < 2.5, String(m));
  });
});

describe('work locations', () => {
  const hq = { name: 'Bengaluru HQ', latitude: 12.9716, longitude: 77.5946, radius_metres: 200 };

  it('measures like the API', () => {
    // Delhi to Bengaluru, roughly 1,740 km.
    const metres = haversineMetres(28.6139, 77.209, 12.9716, 77.5946);
    assert.ok(metres > 1_700_000 && metres < 1_780_000, String(metres));
  });

  it('says At inside the geofence and how far outside it', () => {
    assert.deepEqual(placeLine(12.9716, 77.5947, [hq]), { text: 'At Bengaluru HQ', inside: true });
    const away = placeLine(12.9816, 77.5946, [hq])!;
    assert.equal(away.inside, false);
    assert.match(away.text, /^\d+ m from Bengaluru HQ$/);
    assert.equal(placeLine(12.9716, 77.5946, []), null, 'no work locations, nothing to say');
  });

  it('formats distances', () => {
    assert.equal(formatDistance(850), '850 m');
    assert.equal(formatDistance(11_240), '11.2 km');
  });
});

describe('address line', () => {
  it('joins the parts once each, without plus-codes', () => {
    assert.equal(
      addressLine({ name: 'B439', street: 'B439', district: 'Kalkaji', city: 'New Delhi', region: 'Delhi', postalCode: '110019' }),
      'B439, Kalkaji, New Delhi, Delhi, 110019',
    );
    assert.equal(addressLine({ name: 'GQ8W+R2', city: 'New Delhi', region: 'Delhi' }), 'New Delhi, Delhi');
    assert.equal(addressLine({}), null);
    assert.equal(addressLine(null), null);
  });

  it('falls back to coordinates', () => {
    assert.equal(coordinateLine(28.53551, 77.25071), '28.5355° N, 77.2507° E');
    assert.equal(coordinateLine(-33.8688, -151.2093), '33.8688° S, 151.2093° W');
  });
});
