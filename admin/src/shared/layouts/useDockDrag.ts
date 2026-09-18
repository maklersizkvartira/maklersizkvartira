'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export type DockAxis = 'horizontal' | 'vertical';

interface UseDockDragOptions<T extends string> {
  /** 'horizontal' picks between positions by cursor X (left/right docking).
   *  'vertical' picks between positions by cursor Y (top/bottom docking). */
  axis: DockAxis;
  positions: readonly [T, T];
  current: T;
  onDrop: (next: T) => void;
  /** The panel element that should physically follow the cursor while dragging.
   *  The transform is written imperatively so a live drag never re-renders the
   *  (large) panel subtree — it stays buttery at 60fps. */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Panel extent along the drag axis (width for horizontal, height for
   *  vertical), in px — used to compute how far the panel glides to the other
   *  dock slot on a side change. */
  panelSize: number;
  /** Gutter between the panel and the viewport edge (px). */
  gutter?: number;
  /** How long the pointer must be held before the panel "arms" (picks up).
   *  Kept short enough to feel responsive, long enough to never fire on a
   *  normal click. */
  holdMs?: number;
  disabled?: boolean;
}

interface UseDockDragResult<T extends string> {
  /** Long-press threshold reached — the panel is "picked up". */
  armed: boolean;
  /** Pointer has moved after arming. */
  dragging: boolean;
  /** The panel is animating into its dropped position (post-release glide). */
  dropping: boolean;
  /** Candidate drop position while dragging. */
  preview: T | null;
  /** 0..1 hold progress, for a charging visual before arming. */
  progress: number;
  onPointerDown: (e: React.PointerEvent) => void;
}

const SPRING = 'transform 0.46s cubic-bezier(0.22, 1, 0.36, 1)';
const LIFT = 'transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1)';
// How far (px) you must carry the panel toward the other edge for it to re-dock
// there. Small enough that a deliberate nudge is enough, large enough that a
// jitter never flips it.
const FLIP_THRESHOLD = 70;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Press-and-hold-then-drag gesture: hold anywhere on a panel to "pick it up",
 * then carry it with the cursor across the viewport midpoint (on the given
 * axis) to choose where it docks, and release to drop it there. The panel
 * itself tracks the cursor 1:1 (with a damped cross-axis lean) and, on a side
 * change, glides across to the opposite slot before committing.
 *
 * The gesture can start over interactive controls (nav links, buttons, the
 * search box) — that's most of a sidebar/header's surface — so the completed
 * long-press swallows exactly one synthetic click afterwards to stop the
 * underlying link/button from firing. A quick press-release is never affected:
 * the hold timer is cleared on release long before it ever arms.
 */
export function useDockDrag<T extends string>({
  axis,
  positions,
  current,
  onDrop,
  panelRef,
  panelSize,
  gutter = 12,
  holdMs = 550,
  disabled = false,
}: UseDockDragOptions<T>): UseDockDragResult<T> {
  const [armed, setArmed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [preview, setPreview] = useState<T | null>(null);
  const [progress, setProgress] = useState(0);

  // Mirrors of the reactive state for the long-lived window listeners, which
  // are attached once rather than re-bound on every state change.
  const armedRef = useRef(false);
  const draggingRef = useRef(false);
  const previewRef = useRef<T | null>(null);

  // Latest props/geometry mirrored for the long-lived window listeners, which
  // read `.current` at event time so they never need re-binding when the panel
  // collapses/expands or the docked side changes. Updated in an effect (never
  // during render) so a live drag doesn't fight React's ref rules.
  const currentRef = useRef(current);
  const axisRef = useRef(axis);
  const positionsRef = useRef(positions);
  const panelSizeRef = useRef(panelSize);
  const gutterRef = useRef(gutter);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    currentRef.current = current;
    axisRef.current = axis;
    positionsRef.current = positions;
    panelSizeRef.current = panelSize;
    gutterRef.current = gutter;
    onDropRef.current = onDrop;
  });

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const appliedRef = useRef({ x: 0, y: 0 });
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (dropTimerRef.current) {
      clearTimeout(dropTimerRef.current);
      dropTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const clearPanelStyle = useCallback(() => {
    const el = panelRef.current;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.willChange = '';
    }
  }, [panelRef]);

  // Reset all state flags (does not touch the panel transform — callers that
  // animate a drop clear the transform themselves at the right moment).
  const resetState = useCallback(() => {
    clearTimers();
    startRef.current = null;
    appliedRef.current = { x: 0, y: 0 };
    armedRef.current = false;
    draggingRef.current = false;
    previewRef.current = null;
    document.body.classList.remove('dock-dragging');
    setArmed(false);
    setDragging(false);
    setDropping(false);
    setPreview(null);
    setProgress(0);
  }, [clearTimers]);

  // Hard reset — snaps the panel back immediately (used for cancel/abort).
  const reset = useCallback(() => {
    clearPanelStyle();
    resetState();
  }, [clearPanelStyle, resetState]);

  useEffect(() => {
    if (disabled) return;

    const handleMove = (e: PointerEvent) => {
      if (!startRef.current) return;

      if (!armedRef.current) {
        // Wandering off before the hold completes cancels the gesture, so it
        // never fights a scroll, a text selection, or a normal click-drag.
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        if (Math.hypot(dx, dy) > 10) reset();
        return;
      }

      // Armed: block native scroll/selection while steering the drop target.
      e.preventDefault();

      if (!draggingRef.current) {
        draggingRef.current = true;
        setDragging(true);
      }

      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const horizontal = axisRef.current === 'horizontal';
      // Full follow on the drag axis; a small, capped lean on the cross axis so
      // the panel feels physically carried without drifting off its lane.
      const tx = horizontal ? dx : clamp(dx * 0.12, -48, 48);
      const ty = horizontal ? clamp(dy * 0.12, -48, 48) : dy;
      appliedRef.current = { x: tx, y: ty };

      const el = panelRef.current;
      if (el) {
        el.style.transition = 'none';
        el.style.transform = `translate(${tx}px, ${ty}px) scale(0.96)`;
      }

      // Drop target follows the DIRECTION you carry the panel: a modest,
      // deliberate drag toward the other edge flips the target there. This is
      // panel-relative and forgiving — you don't have to haul the panel all the
      // way across the screen, just nudge it toward the side you want.
      const delta = horizontal ? dx : dy;
      let next = currentRef.current;
      if (delta > FLIP_THRESHOLD) next = positionsRef.current[1];
      else if (delta < -FLIP_THRESHOLD) next = positionsRef.current[0];
      if (previewRef.current !== next) {
        previewRef.current = next;
        setPreview(next);
      }
    };

    const finishDrop = (next: T, changed: boolean) => {
      clearTimers();
      armedRef.current = false;
      draggingRef.current = false;
      document.body.classList.remove('dock-dragging');
      setArmed(false);
      setDragging(false);
      setPreview(null);
      setProgress(1);
      setDropping(true);

      const el = panelRef.current;
      if (!el) {
        if (changed) onDropRef.current(next);
        resetState();
        return;
      }

      if (changed) {
        // Commit the new side IMMEDIATELY and synchronously — the dock must
        // actually change on release, independent of any animation. flushSync
        // repositions the panel's base (via its left/right|top/bottom) before
        // the browser paints, so it never flashes at the old spot.
        const horizontal = axisRef.current === 'horizontal';
        const extent = (horizontal ? window.innerWidth : window.innerHeight)
          - 2 * gutterRef.current - panelSizeRef.current;
        const signed = next === positionsRef.current[1] ? Math.max(0, extent) : -Math.max(0, extent);
        const applied = appliedRef.current;

        flushSync(() => onDropRef.current(next));

        // Base has moved to the new side; hold the panel visually at the release
        // point with a compensating transform, then spring it into the slot.
        const compX = horizontal ? applied.x - signed : applied.x;
        const compY = horizontal ? applied.y : applied.y - signed;
        el.style.transition = 'none';
        el.style.transform = `translate(${compX}px, ${compY}px) scale(0.98)`;
        rafRef.current = requestAnimationFrame(() => {
          const el2 = panelRef.current;
          if (el2) {
            el2.style.transition = SPRING;
            el2.style.transform = 'translate(0px, 0px) scale(1)';
          }
        });
        dropTimerRef.current = setTimeout(() => {
          clearPanelStyle();
          resetState();
        }, 520);
      } else {
        // No side change — spring the panel back to where it was picked up.
        el.style.transition = SPRING;
        el.style.transform = 'translate(0px, 0px) scale(1)';
        dropTimerRef.current = setTimeout(() => {
          clearPanelStyle();
          resetState();
        }, 480);
      }
    };

    const handleUp = () => {
      if (!startRef.current) return;

      if (armedRef.current) {
        // A completed long-press synthesizes a stray click on whatever the
        // gesture started over — swallow just that one click so links/buttons
        // underneath don't fire.
        const blockNextClick = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
        };
        document.addEventListener('click', blockNextClick, { capture: true, once: true });
        setTimeout(() => document.removeEventListener('click', blockNextClick, true), 60);

        const next = draggingRef.current && previewRef.current ? previewRef.current : currentRef.current;
        const changed = !!next && next !== currentRef.current;
        finishDrop(next, changed);
      } else {
        reset();
      }
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', reset);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', reset);
    };
  }, [disabled, reset, resetState, clearTimers, clearPanelStyle, panelRef]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      startRef.current = { x: e.clientX, y: e.clientY };
      const startTime = Date.now();

      const tick = () => {
        const elapsed = Date.now() - startTime;
        setProgress(Math.min(1, elapsed / holdMs));
        if (elapsed < holdMs && startRef.current) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      holdTimerRef.current = setTimeout(() => {
        if (!startRef.current) return;
        armedRef.current = true;
        document.body.classList.add('dock-dragging');
        setArmed(true);
        setProgress(1);
        // Pick-up pop — the panel lifts before the carry begins.
        const el = panelRef.current;
        if (el) {
          el.style.willChange = 'transform';
          el.style.transition = LIFT;
          el.style.transform = 'scale(1.03)';
        }
      }, holdMs);
    },
    [disabled, holdMs, panelRef],
  );

  useEffect(() => reset, [reset]);

  return { armed, dragging, dropping, preview, progress, onPointerDown };
}
