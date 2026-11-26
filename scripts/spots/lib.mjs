/**
 * Shared by the spot scripts: load the website's spot illustrations (plus the
 * app's own in extra.tsx), draw each to static SVG with React, and lay them
 * out on a contact sheet that Chrome photographs.
 *
 * The website (website/src/components/illustrations/spots.tsx) is the source
 * of truth for the drawings. extra.tsx adds the ones only the app needs, in
 * the same style and with the same helpers in scope (it is appended to the
 * website's file before compiling, so it has no imports of its own).
 *
 * Dev-time only: uses the website's React to render and the app's TypeScript
 * to compile. Nothing here ships in the app.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MOBILE = resolve(HERE, '../..');
export const ROOT = resolve(MOBILE, '..');
export const WEBSITE_SPOTS = join(ROOT, 'website/src/components/illustrations/spots.tsx');
export const EXTRA_SPOTS = join(HERE, 'extra.tsx');

const mobileRequire = createRequire(join(MOBILE, 'package.json'));
const websiteRequire = createRequire(join(ROOT, 'website/package.json'));

function load(requireFrom, id, hint) {
  try {
    return requireFrom(id);
  } catch {
    throw new Error(`Cannot load ${id}. ${hint}`);
  }
}

const ts = load(mobileRequire, 'typescript', 'Run npm install in mobile/.');
const React = load(websiteRequire, 'react', 'Run npm install in website/ (the drawings render with its React).');
const jsxRuntime = load(websiteRequire, 'react/jsx-runtime', 'Run npm install in website/.');
const { renderToStaticMarkup } = load(websiteRequire, 'react-dom/server', 'Run npm install in website/.');

/** The website's file with the app's extras appended, ready to compile. */
export function combinedSource(extraFiles = [EXTRA_SPOTS]) {
  if (!existsSync(WEBSITE_SPOTS)) throw new Error(`The website's spots are missing: ${WEBSITE_SPOTS}`);
  const site = readFileSync(WEBSITE_SPOTS, 'utf8').replace(
    /^import \{ cn \} from "@\/lib\/utils";$/m,
    'const cn = (...parts: unknown[]) => parts.filter(Boolean).join(" ");',
  );
  const extras = extraFiles
    .filter((file) => existsSync(file))
    .map((file) => `\n/* ---- ${file.replace(ROOT, '')} ---- */\n` + readFileSync(file, 'utf8').replace(/^import .*$/gm, ''));
  return site + extras.join('\n');
}

/** Every exported Spot* drawing, by its export name. */
export function loadSpots(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  const problems = (compiled.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  if (problems.length) throw new Error(`The spots do not compile:\n${problems.join('\n')}`);
  const module = { exports: {} };
  const requireShim = (id) => {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsxRuntime;
    throw new Error(`A spot may not import ${id}`);
  };
  new Function('require', 'module', 'exports', compiled.outputText)(requireShim, module, module.exports);
  const spots = {};
  for (const [name, value] of Object.entries(module.exports)) {
    if (/^Spot[A-Z]/.test(name) && name !== 'SpotTile' && typeof value === 'function') spots[name] = value;
  }
  return spots;
}

/** "SpotCalendarClock" → "calendarClock". */
export function spotKey(exportName) {
  const bare = exportName.replace(/^Spot/, '');
  return bare.charAt(0).toLowerCase() + bare.slice(1);
}

export function markup(Component) {
  return renderToStaticMarkup(React.createElement(Component, { className: '' }));
}

/* ------------------------------------------------------------ contact sheet */

// The website's tones (website/src/app/globals.css, `.spot`).
const SHEET_CSS = `
:root { --d:#5c0a11; --r:#eb061d; --p:#ffabb3; --m:#fab236; --w:#fffdfb;
        --blush:#fde8dd; --marigold:#feebc4; --cream:#f9efe8; --page:#fef8f4; --ink:#1a1110; }
* { box-sizing: border-box; margin: 0; }
body { background: var(--page); font: 13px/1.3 Inter, Segoe UI, sans-serif; color: var(--ink); padding: 24px; }
h1 { font-size: 15px; margin: 0 0 14px; }
h2 { font-size: 13px; margin: 22px 0 10px; color: #645853; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
.grid { display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: 14px 10px; }
.cell { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 4px; border-radius: 14px; }
.cell.new { background: #fff; outline: 2px dashed #df840b; }
.sizes { display: flex; align-items: flex-end; gap: 8px; }
.name { font-size: 12px; font-weight: 600; text-align: center; word-break: break-word; }
.tile { display: grid; place-items: center; flex-shrink: 0; }
.tile.blush { background: var(--blush); --spot-tile: var(--blush); }
.tile.marigold { background: var(--marigold); --spot-tile: var(--marigold); }
.tile.cream { background: var(--cream); --spot-tile: var(--cream); }
.tile.white { background: #fff; --spot-tile: #fff; }
.tile .spot { width: 100%; height: 100%; }
.spot { --spot-d: var(--d); --spot-r: var(--r); --spot-p: var(--p); --spot-m: var(--m); --spot-w: var(--w);
        --spot-bg: var(--spot-tile, var(--blush)); display: block; overflow: visible; }
.dark { background: #1f1312; padding: 12px; border-radius: 14px; }
`;

function tile(svg, size, tone) {
  // The website's tile proportions: padding ≈ 12.5–15% of the side, corner ≈ 25–33%.
  const pad = Math.round(size * (size <= 40 ? 0.15 : 0.125));
  const corner = Math.round(size * (size >= 64 ? 0.25 : 0.32));
  return `<div class="tile ${tone}" style="width:${size}px;height:${size}px;padding:${pad}px;border-radius:${corner}px">${svg}</div>`;
}

/**
 * entries: [{ key, svg, isNew? }]. Sizes are CSS pixels (the sheet is shot at
 * 2×, like a phone).
 */
export function sheetHtml({ title, groups, sizes = [96, 48, 40], tones = ['blush'], columns = 6, dark = false }) {
  const body = groups
    .map(
      (group) =>
        `${group.title ? `<h2>${group.title}</h2>` : ''}<div class="grid" style="--cols:${columns}">` +
        group.entries
          .map(
            (entry) =>
              `<div class="cell${entry.isNew ? ' new' : ''}"><div class="sizes">${tones
                .flatMap((tone) => sizes.map((size) => tile(entry.svg, size, tone)))
                .join('')}</div>${dark ? `<div class="sizes dark">${sizes
                .slice(1)
                .map((size) => tile(entry.svg, size, 'blush'))
                .join('')}</div>` : ''}<div class="name">${entry.key}</div></div>`,
          )
          .join('') +
        '</div>',
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${SHEET_CSS}</style></head><body><h1>${title}</h1>${body}</body></html>`;
}

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/** Photograph an HTML file with headless Chrome (or Edge). */
export function screenshot(htmlPath, pngPath, { width = 1200, height = 900, scale = 2 } = {}) {
  const browser = BROWSERS.find((path) => existsSync(path));
  if (!browser) throw new Error('No Chrome or Edge found for the contact sheet.');
  mkdirSync(dirname(pngPath), { recursive: true });
  const result = spawnSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      `--force-device-scale-factor=${scale}`,
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );
  if (!existsSync(pngPath)) throw new Error(`The browser did not write ${pngPath}:\n${result.stderr || result.stdout}`);
  return pngPath;
}

export function writeFile(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
