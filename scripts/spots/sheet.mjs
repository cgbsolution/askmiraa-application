/**
 * Draw spots on a contact sheet and photograph it, to judge a drawing by eye.
 *
 *   node scripts/spots/sheet.mjs --out C:/tmp/sheet.png
 *   node scripts/spots/sheet.mjs --extra C:/tmp/candidate.tsx --only calendarStar,calendarPlus \
 *        --compare calendar,calendarClock,calendarLock --out C:/tmp/candidate.png
 *
 * --extra    more drawings (same style as extra.tsx) to load on top; repeatable
 * --only     just these keys (new ones are framed with a dashed line)
 * --compare  existing keys to show beside them, for style
 * --sizes    tile sizes in px (default 96,48,40)
 * --columns  cells per row (default 6)
 * --dark     also show each at small size on the app's dark background
 * --html     keep the HTML here too
 */

import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { EXTRA_SPOTS, combinedSource, loadSpots, markup, screenshot, sheetHtml, spotKey, writeFile } from './lib.mjs';

function args(argv) {
  const out = { extra: [], only: null, compare: [], sizes: [96, 48, 40], columns: 6, out: null, html: null, dark: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => argv[++i];
    if (flag === '--extra') out.extra.push(next());
    else if (flag === '--only') out.only = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (flag === '--compare') out.compare = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (flag === '--sizes') out.sizes = next().split(',').map(Number);
    else if (flag === '--columns') out.columns = Number(next());
    else if (flag === '--out') out.out = next();
    else if (flag === '--html') out.html = next();
    else if (flag === '--dark') out.dark = true;
    else throw new Error(`Unknown flag ${flag}`);
  }
  if (!out.out) throw new Error('--out <file.png> is required');
  return out;
}

const opts = args(process.argv.slice(2));
const base = loadSpots(combinedSource());
const all = loadSpots(combinedSource([EXTRA_SPOTS, ...opts.extra]));
const byKey = new Map(Object.entries(all).map(([name, component]) => [spotKey(name), component]));
const baseKeys = new Set(Object.keys(base).map(spotKey));

const pick = (keys) =>
  keys.map((key) => {
    const component = byKey.get(key);
    if (!component) throw new Error(`No spot called ${key}. Known: ${[...byKey.keys()].join(', ')}`);
    return { key, svg: markup(component), isNew: !baseKeys.has(key) };
  });

const groups = [];
if (opts.only) {
  groups.push({ title: 'Candidates', entries: pick(opts.only) });
  if (opts.compare.length) groups.push({ title: 'Beside the website set', entries: pick(opts.compare) });
} else {
  groups.push({ title: `All spots (${byKey.size})`, entries: pick([...byKey.keys()]) });
}

const html = sheetHtml({ title: 'AskMira spots', groups, sizes: opts.sizes, columns: opts.columns, dark: opts.dark });
const htmlPath = opts.html ?? join(tmpdir(), `spots-${process.pid}.html`);
writeFile(htmlPath, html);

const count = groups.reduce((n, g) => n + g.entries.length, 0);
const rows = groups.reduce((n, g) => n + Math.ceil(g.entries.length / opts.columns), 0);
const cellWidth = opts.sizes.reduce((sum, size) => sum + size + 8, 0) + 24;
const width = Math.max(600, Math.min(2400, cellWidth * opts.columns + 60));
const cellHeight = Math.max(...opts.sizes) + 54 + (opts.dark ? Math.max(...opts.sizes.slice(1), 0) + 30 : 0);
const height = 80 + rows * cellHeight + groups.length * 50;
screenshot(htmlPath, opts.out, { width, height });
console.log(`${count} spots → ${opts.out}`);
