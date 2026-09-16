/**
 * A horizontal swipe, recognised by hand.
 *
 * The listing card and the detail gallery both show one photo at a time out
 * of a stack — a crossfade, not a scroll-snap strip — so the browser has
 * nothing to scroll and a finger dragged across the picture did nothing at
 * all. On a phone that is the one gesture everybody tries first.
 *
 * Touch events rather than pointer events, on purpose: a mouse drag on a
 * card is a text selection or a drag-to-scroll, not a swipe, and the arrow
 * buttons exist for the cursor. The recognition is deliberately strict —
 * mostly horizontal, and further than a thumb wobbles while scrolling the
 * page — because the same surface sits inside a vertically scrolling list,
 * and a swipe that fires on a diagonal scroll would flip photos while the
 * person is trying to read the next card.
 *
 * `swipedRecently()` lets the caller swallow the click a swipe leaves behind.
 * Browsers do not synthesise a click after a real drag, but a short, fast
 * flick can end inside the tap tolerance of some of them, and on a card
 * that click opens the listing — so the card asks before it navigates.
 */

import { useCallback, useRef } from 'react';
import type React from 'react';

/** Farther than this, mostly sideways, and it is a swipe. */
const MIN_DISTANCE_PX = 40;
/** A swipe must be at least this many times wider than it is tall. */
const AXIS_RATIO = 1.5;
/** How long after a swipe a click is still "the same gesture". */
const CLICK_SHADOW_MS = 400;

export interface SwipeHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
  onTouchCancel: () => void;
}

export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  enabled = true,
): { handlers: SwipeHandlers; swipedRecently: () => boolean } {
  const start = useRef<{ x: number; y: number } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const swipedAt = useRef(0);

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled || event.touches.length !== 1) {
        start.current = null;
        return;
      }
      const touch = event.touches[0];
      start.current = { x: touch.clientX, y: touch.clientY };
      last.current = start.current;
    },
    [enabled],
  );

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    if (!start.current || event.touches.length !== 1) return;
    const touch = event.touches[0];
    last.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      const from = start.current;
      const to = last.current;
      start.current = null;
      last.current = null;
      if (!from || !to) return;

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return;

      swipedAt.current = Date.now();
      // The gesture was ours; nothing above should treat it as a tap.
      event.stopPropagation();
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    },
    [onSwipeLeft, onSwipeRight],
  );

  const onTouchCancel = useCallback(() => {
    start.current = null;
    last.current = null;
  }, []);

  const swipedRecently = useCallback(() => Date.now() - swipedAt.current < CLICK_SHADOW_MS, []);

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
    swipedRecently,
  };
}
