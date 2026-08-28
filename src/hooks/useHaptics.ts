/**
 * A very small haptic vocabulary.
 *
 * The site is a web app that people use as a phone app, and a tap that
 * changes state — a filter chip turning on, a step of the listing wizard
 * committing — reads as "did that register?" without any physical answer.
 * Four named intents are enough for that; anything richer becomes a
 * vibration language nobody asked to learn.
 *
 * Built on `navigator.vibrate`, which Android browsers support and iOS Safari
 * does not. There is no polyfill and no fallback beep: on a device without
 * the API every call is a no-op, which is the correct outcome — haptics are a
 * confirmation of something the UI already shows, never the only signal.
 *
 * Deliberately NOT a Capacitor dependency. When the native shells want real
 * iOS haptics, `@capacitor/haptics` can be layered in behind
 * `Capacitor.isNativePlatform()` exactly the way `main.tsx` gates StatusBar
 * and SplashScreen — the four functions below stay the whole public surface,
 * and only their bodies gain a native branch.
 */

import { useMemo } from 'react';

/** Milliseconds, or a pattern of on/off durations. */
type Pattern = number | number[];

export interface Haptics {
  /** A single light tick: a button press, a chip toggling. */
  tap: () => void;
  /** A selection changed: a segmented control, a carousel moving on. */
  select: () => void;
  /** Something completed: a listing published, a draft saved. */
  success: () => void;
  /** Something needs attention: a validation error, a blocked action. */
  warn: () => void;
  /** Whether the device can actually answer. Useful for a settings toggle. */
  supported: boolean;
}

function canVibrate(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function'
  );
}

function fire(pattern: Pattern): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when the page is not visible or the gesture
    // requirement was not met. A missed buzz is never worth an exception.
  }
}

export function useHaptics(): Haptics {
  return useMemo<Haptics>(
    () => ({
      tap: () => fire(10),
      select: () => fire(18),
      // Two short pulses read as "done" rather than as one longer buzz, which
      // is easy to confuse with an error.
      success: () => fire([14, 60, 26]),
      warn: () => fire([40, 70, 40]),
      supported: canVibrate(),
    }),
    [],
  );
}

export default useHaptics;
