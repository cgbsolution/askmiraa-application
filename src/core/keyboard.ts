/**
 * How far to keep things above the on-screen keyboard.
 *
 * React Native reports the keyboard's height once, when it opens. It does not
 * report a keyboard that then grows: moving from a password field to a text
 * field adds a suggestion strip, and a number pad can be shorter than letters.
 * So the app remembers the tallest keyboard this phone has shown and lifts by
 * that: at worst a little extra gap, never a button hidden behind the strip.
 */

/** Taller than this share of the screen is not a docked keyboard (a full-screen IME, a glitch). */
const MAX_SHARE = 0.6;

export function nextTallest(previous: number, reported: number, screenHeight: number): number {
  if (!(reported > 0) || reported > screenHeight * MAX_SHARE) return previous;
  return Math.max(previous, Math.round(reported));
}

export function liftFor(visible: boolean, reported: number, tallest: number): number {
  if (!visible) return 0;
  return Math.max(reported, tallest);
}
