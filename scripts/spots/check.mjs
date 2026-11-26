/**
 * Check candidate spots without writing anything: do they compile, use only
 * what the app can draw (rect, circle, path, ellipse, g; the five tones; the
 * cut), and follow the palette's rules of thumb?
 *
 *   node scripts/spots/check.mjs --extra C:/tmp/candidate.tsx [--extra more.tsx]
 *
 * Prints one line per new spot; exits 1 on an error (warnings do not fail).
 */

import { EXTRA_SPOTS, combinedSource, loadSpots, markup, spotKey } from './lib.mjs';
import { emit, parse } from './native.mjs';

const extra = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--extra') extra.push(argv[++i]);
  else throw new Error(`Unknown flag ${argv[i]}`);
}

const base = new Set(Object.keys(loadSpots(combinedSource())).map(spotKey));
let spots;
try {
  spots = loadSpots(combinedSource([EXTRA_SPOTS, ...extra]));
} catch (error) {
  console.error(`ERROR ${error.message}`);
  process.exit(1);
}

let failed = false;
for (const [exportName, component] of Object.entries(spots)) {
  const key = spotKey(exportName);
  if (base.has(key) && !extra.length) continue;
  if (base.has(key)) continue;
  try {
    const svg = markup(component);
    const nodes = parse(svg);
    nodes.flatMap((node) => emit(node, 0));
    const count = (text) => svg.split(text).length - 1;
    const fills = (tone) => count(`fill="var(--spot-${tone})"`);
    const strokes = (tone) => count(`stroke="var(--spot-${tone})"`);
    const warnings = [];
    if (fills('d') + strokes('d') === 0) warnings.push('no wine (D) mass');
    if (fills('r') + strokes('r') === 0) warnings.push('no red (R) accent');
    if (fills('r') + strokes('r') > 3) warnings.push(`red used ${fills('r') + strokes('r')} times — one accent per picture`);
    if (fills('m') + strokes('m') > 3) warnings.push(`marigold used ${fills('m') + strokes('m')} times — a small highlight, used sparingly`);
    const elements = (svg.match(/<(rect|circle|path|ellipse)\b/g) ?? []).length;
    if (elements > 22) warnings.push(`${elements} shapes — the website's spots use 4–16`);
    console.log(`${warnings.length ? 'WARN ' : 'OK   '}${key}${warnings.length ? ` — ${warnings.join('; ')}` : ''} (${elements} shapes)`);
  } catch (error) {
    failed = true;
    console.log(`ERROR ${key} — ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
