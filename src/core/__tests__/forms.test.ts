/**
 * A form (FormScreen, with its sticky Save bar) must open as a modal route.
 * Inside a tab its Save bar sat behind the tab bar and the Miraa button, out of
 * reach — which is how "Edit details" shipped once.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { ROUTES, type ScreenRoute } from '../routes.ts';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

/** Exported screen components whose body renders a FormScreen. */
function formComponents(): Set<string> {
  const found = new Set<string>();
  for (const file of files(join(SRC, 'screens'))) {
    const text = readFileSync(file, 'utf8');
    const parts = text.split(/\nexport (?:function|const) /);
    for (const part of parts.slice(1)) {
      const name = /^(\w+)/.exec(part)?.[1];
      if (name && part.includes('<FormScreen')) found.add(name);
    }
  }
  return found;
}

/** Route -> component, from the navigator's registry. */
function registry(): Map<string, string> {
  const text = readFileSync(join(SRC, 'navigation', 'screens.tsx'), 'utf8');
  const map = new Map<string, string>();
  for (const match of text.matchAll(/^\s+(\w+): \{ component: (\w+)/gm)) map.set(match[1]!, match[2]!);
  return map;
}

describe('forms', () => {
  it('open as modals, never inside a tab', () => {
    const forms = formComponents();
    assert.ok(forms.size >= 5, `expected to find the app's forms, found ${[...forms].join(', ')}`);
    const inTabs = [...registry()]
      .filter(([, component]) => forms.has(component))
      .filter(([route]) => ROUTES[route as ScreenRoute]?.tab !== null)
      .map(([route]) => route);
    assert.deepEqual(inTabs, [], `these forms open inside a tab: ${inTabs.join(', ')}`);
  });
});

describe('screens', () => {
  it('every route has a built screen, none left as a placeholder', () => {
    const map = registry();
    const missing = Object.keys(ROUTES).filter((route) => !map.has(route));
    assert.deepEqual(missing, [], `routes with no screen: ${missing.join(', ')}`);
    const placeholders = [...map].filter(([, component]) => component === 'Pending').map(([route]) => route);
    assert.deepEqual(placeholders, [], `routes still on the placeholder: ${placeholders.join(', ')}`);
  });
});
