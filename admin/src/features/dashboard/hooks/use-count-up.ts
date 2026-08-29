'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Eases a number up to its target with requestAnimationFrame.
 *
 * Two behaviours are load-bearing rather than cosmetic:
 *
 *  1. It starts at 0 on the server AND on the first client render, so the
 *     markup React hydrates against matches, and so the count is always
 *     actually seen — a counter that has already finished by the time the
 *     browser paints is just a number that cost a frame budget.
 *  2. A new target animates from the value CURRENTLY ON SCREEN, not from the
 *     previous target. The stats query refetches on an interval, so a second
 *     value can land mid-flight; without the ref the display would snap
 *     backwards to the old start before easing forward again.
 *
 * Under `prefers-reduced-motion: reduce` it lands in one frame. The CSS block
 * cannot do this one — the value is JS state, not a transition.
 */
export function useCountUp(value: number, duration = 700): number {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const from = shownRef.current;
    const delta = value - from;

    if (reduced || delta === 0 || duration <= 0) {
      shownRef.current = value;
      setShown(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic: fast out of the gate, settling rather than stopping.
      const eased = 1 - (1 - t) ** 3;
      const next = from + delta * eased;
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        shownRef.current = value;
        setShown(value);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}
