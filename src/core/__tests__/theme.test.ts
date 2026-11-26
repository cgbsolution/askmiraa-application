/**
 * Slice 06 gates: the Tier 1 / Tier 2 split, and no hardcoded hex in screens.
 *
 * The tiering test matters because the split erodes one pull request at a
 * time. Someone rounds a payslip card "to match the rest of the app" and the
 * payroll screens quietly become casual — which is exactly where the product
 * most needs to look precise.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { SCREEN_TIERS, darkColors, layout, lightColors, palette, radius, spacing, spotInk, spotTiles, surface, tierFor } from '../../theme/tokens.ts';

const SRC = join(fileURLToPath(new URL('../../', import.meta.url)));

function filesUnder(directory: string, extension = '.tsx'): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(extension)) out.push(full);
    }
  };
  walk(directory);
  return out;
}

describe('design tokens', () => {
  it('carries the AskMiraa brand palette, as on the portal', () => {
    assert.equal(palette.maroon600, '#7d0712', 'Maroon — the website hero, the portal primary');
    assert.equal(palette.blush100, '#fde8dd', 'Blush');
    assert.equal(palette.marigold500, '#f8a01a', 'Marigold');
    assert.equal(palette.cream50, '#fef8f4', 'Cream');
    assert.equal(palette.ink950, '#100404', 'Ink');
    assert.equal(lightColors.primary, palette.maroon600, 'primary is the maroon');
  });

  it('keeps the bright logo red inside the logo', () => {
    // The user's call (2026-10-28): no bright or light red in the product UI.
    // Only artwork carries it: the logo, and the spots' one accent (2026-10-29).
    for (const colors of [lightColors, darkColors]) {
      for (const [key, value] of Object.entries(colors)) {
        assert.notEqual(value.toLowerCase(), palette.logoRed, `${key} must not be the logo red`);
      }
    }
  });

  it("draws the spots in the website's own tones, the red only as their accent", () => {
    // website/src/app/globals.css `.spot`: brand-900, brand-500, brand-200, marigold-400, cream-25.
    assert.deepEqual(
      { ...spotInk },
      { d: '#5c0a11', r: '#eb061d', p: '#ffabb3', m: '#fab236', w: '#fffdfb' },
      'the same tones as the website, so the icons are the same icons',
    );
    assert.equal(spotInk.r, palette.logoRed);
    for (const colors of [lightColors, darkColors]) {
      for (const [key, value] of Object.entries(colors)) {
        assert.notEqual(value.toLowerCase(), palette.spotPink, `${key} must not be the spots' pink`);
      }
    }
    // The tiles stay light in both themes (as the website sets them on its dark bands).
    assert.equal(spotTiles.blush, palette.blush100);
  });

  it('does not contain the dropped Rani Pink', () => {
    // FRD 5.13: dropped from the palette; mustard alone carries the warmth.
    const values = Object.values(palette).map((v) => v.toLowerCase());
    for (const pink of ['#e91e63', '#ff2d78', '#f72585', '#e754a1']) {
      assert.ok(!values.includes(pink), `${pink} is not in the AskMiraa palette`);
    }
  });
});

describe('dark mode', () => {
  it('defines every semantic colour in both themes', () => {
    assert.deepEqual(Object.keys(darkColors).sort(), Object.keys(lightColors).sort());
    for (const [key, value] of Object.entries(darkColors)) assert.ok(/^#[0-9a-f]{6,8}$/i.test(value), key);
  });

  it('keeps body text readable on the background in both themes', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
      );
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contrast = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x! + 0.05) / (y! + 0.05);
    };
    for (const colors of [lightColors, darkColors]) {
      assert.ok(contrast(colors.text, colors.background) >= 7, 'text on background');
      assert.ok(contrast(colors.textMuted, colors.surface) >= 4.5, 'muted text on a card (WCAG AA)');
      assert.ok(contrast(colors.onAccent, colors.accent) >= 4.5, 'label on the Marigold button');
      assert.ok(contrast(colors.onPrimary, colors.primary) >= 4.5, 'label on a primary button');
      assert.ok(contrast(colors.onBrandSurface, colors.brandSurface) >= 7, 'text beside the logo on sign-in');
      assert.ok(contrast(colors.onLogoPlate, colors.logoPlate) >= 7, "the company's name on Home's logo plate");
      assert.ok(contrast(colors.tabBarActiveText, colors.tabBarActive) >= 4.5, 'active tab label');
      for (const tag of ['Full', 'Partial', 'Absent', 'WeekOff', 'Holiday', 'OptionalHoliday', 'ApprovedLeave', 'UnapprovedLeave'] as const) {
        const fill = colors[`day${tag}`];
        const label = colors[`onDay${tag}`];
        assert.ok(contrast(label, fill) >= 4.5, `the date on a ${tag} day on the calendar`);
      }
      assert.ok(contrast(colors.onCalendarBand, colors.calendarBand) >= 7, 'month and weekdays on the calendar band');
      assert.ok(contrast(colors.calendarMark, colors.surface) >= 3, 'the ring round the selected day, on the card');
      assert.ok(contrast(colors.tabBarInactive, colors.tabBar) >= 4.5, 'inactive tab label');
      // The brand is red, so a destructive button must still look different from a primary one.
      assert.notEqual(colors.danger.toLowerCase(), colors.primary.toLowerCase(), 'danger is not the brand red');
      assert.notEqual(colors.dayAbsent.toLowerCase(), colors.primary.toLowerCase(), 'absent is not the brand red');
    }
  });
});

describe('screen tiering', () => {
  it('puts money and statutory screens in Tier 1', () => {
    // The rule: if a mistake costs money or triggers a filing, Tier 1.
    for (const screen of ['Payslips', 'TaxDeclarations', 'Attendance', 'YourVoice'] as const) {
      assert.equal(tierFor(screen), 'tier1', `${screen} must be Tier 1`);
    }
  });

  it('puts people-connecting screens in Tier 2', () => {
    for (const screen of ['Today', 'Recognition', 'Clubs', 'Profile'] as const) {
      assert.equal(tierFor(screen), 'tier2', `${screen} must be Tier 2`);
    }
  });

  it('gives Tier 1 a flat, undecorated surface', () => {
    const style = surface('tier1');
    assert.equal(style.borderRadius, radius.tier1);
    assert.equal(style.allowsIllustration, false, 'no botanical accents on a payslip');
    assert.ok(style.shadowOpacity < 0.05, 'flat, not floating');
  });

  it('gives Tier 2 a soft, warm surface', () => {
    const style = surface('tier2');
    assert.equal(style.borderRadius, radius.tier2);
    assert.equal(style.allowsIllustration, true);
    // The portal's card-tier2 (20px) against card-tier1 (14px): visibly rounder.
    assert.ok(style.borderRadius >= surface('tier1').borderRadius * 1.5);
  });

  it('keeps the two tiers visibly distinct', () => {
    // If these ever converge, the split has been flattened — which is the
    // specific thing FRD 5.13 says not to do.
    const one = surface('tier1');
    const two = surface('tier2');
    assert.notEqual(one.borderRadius, two.borderRadius);
    assert.notEqual(one.allowsIllustration, two.allowsIllustration);
  });

  it('assigns every declared screen a tier', () => {
    for (const [screen, tier] of Object.entries(SCREEN_TIERS)) {
      assert.ok(['tier1', 'tier2'].includes(tier), `${screen} has no valid tier`);
    }
  });
});

const ALL_UI = () => [
  ...filesUnder(join(SRC, 'screens')),
  ...filesUnder(join(SRC, 'components')),
  ...filesUnder(join(SRC, 'navigation')),
];

function everySourceFile(): string[] {
  const out: string[] = [];
  for (const dir of ['screens', 'components', 'navigation', 'lib', 'api', 'core', 'i18n']) {
    out.push(...filesUnder(join(SRC, dir), '.tsx'), ...filesUnder(join(SRC, dir), '.ts'));
  }
  return out.filter((file) => !file.includes('__tests__') && !file.endsWith('api.gen.ts'));
}

describe('no hardcoded colours', () => {
  it('finds no hex value outside the theme', () => {
    // A reskin must be a change to tokens.ts, not an archaeology exercise.
    const hex = /['"`]#[0-9a-fA-F]{3,8}\b/g;
    const offenders: string[] = [];
    for (const file of everySourceFile()) {
      const matches = readFileSync(file, 'utf8').match(hex);
      if (matches) offenders.push(`${file.replace(SRC, '')}: ${[...new Set(matches)].join(', ')}`);
    }
    assert.deepEqual(offenders, [], `Use tokens from theme/tokens.ts:\n  ${offenders.join('\n  ')}`);
  });

  it('finds no rgb() or hsl() literal outside the theme either', () => {
    const colourFn = /\b(rgb|rgba|hsl|hsla)\s*\(/;
    const offenders = everySourceFile().filter((file) => colourFn.test(readFileSync(file, 'utf8')));
    assert.deepEqual(offenders.map((f) => f.replace(SRC, '')), []);
  });
});

describe('even spacing', () => {
  // Uneven gaps come from one-off numbers. Screens, components and navigation
  // space things with `spacing` and `layout` tokens only; 0 is allowed.
  const rules: [string, RegExp][] = [
    ['raw spacing', /\b(padding|margin|gap|rowGap|columnGap)(Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?\s*:\s*-?[1-9]\d*(\.\d+)?\b/g],
    ['raw font size', /\bfontSize\s*:\s*\d/g],
    ['raw line height', /\blineHeight\s*:\s*\d/g],
    ['raw radius', /\bborderRadius\s*:\s*[1-9]/g],
    // An icon with no colour falls back to black, unreadable in dark mode.
    ['icon without a theme colour', /color=\{undefined\}/g],
  ];

  for (const [name, pattern] of rules) {
    it(`has no ${name} in a screen, component or navigation file`, () => {
      const offenders: string[] = [];
      for (const file of ALL_UI()) {
        const source = readFileSync(file, 'utf8');
        const matches = source.match(pattern);
        if (matches) offenders.push(`${file.replace(SRC, '')}: ${[...new Set(matches)].join(', ')}`);
      }
      assert.deepEqual(offenders, [], `Use spacing/layout/typography/radius tokens:\n  ${offenders.join('\n  ')}`);
    });
  }

  it('gives every card the same inner padding in both tiers', () => {
    assert.equal(layout.card, spacing.lg);
    assert.ok(layout.section > layout.row, 'sections sit further apart than rows');
    assert.ok(layout.row > layout.tight);
  });
});
