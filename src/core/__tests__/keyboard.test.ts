import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { liftFor, nextTallest } from '../keyboard.ts';

describe('keyboard lift', () => {
  it('remembers the tallest keyboard, so a suggestion strip added later is covered', () => {
    let tallest = 0;
    tallest = nextTallest(tallest, 280, 900); // password keyboard, no strip
    tallest = nextTallest(tallest, 320, 900); // a text field, with the strip
    tallest = nextTallest(tallest, 260, 900); // a number pad
    assert.equal(tallest, 320);
    assert.equal(liftFor(true, 280, tallest), 320, 'lifted by the tallest, not the first report');
  });

  it('lifts nothing when the keyboard is closed', () => {
    assert.equal(liftFor(false, 280, 320), 0);
  });

  it('ignores nonsense heights', () => {
    assert.equal(nextTallest(300, 0, 900), 300);
    assert.equal(nextTallest(300, -5, 900), 300);
    assert.equal(nextTallest(300, Number.NaN, 900), 300);
    assert.equal(nextTallest(300, 700, 900), 300, 'a full-screen input method is not a docked keyboard');
  });
});
