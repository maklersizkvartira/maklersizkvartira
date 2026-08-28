/**
 * The bottom sheet, written once.
 *
 * AuthDialog, SearchModal and ListingDetailPage each grew their own copy of
 * the same pattern — portal, overlay, `auth-sheet` panel, a grab handle, an
 * Escape handler — and the copies had already drifted apart. Only one of the
 * three trapped focus. Only one locked the body scroll. Two of them left the
 * previously-focused element behind on close. None of the three padded the
 * footer for the iOS home indicator, so the primary action of every sheet on
 * the site sat underneath the bar people swipe to leave the app.
 *
 * This is that pattern with each of those decided once:
 *
 *   - portalled to <body>, so a parent's `overflow: hidden` or `transform`
 *     cannot clip or re-anchor it;
 *   - focus moved in on open, trapped while open, and returned on close;
 *   - Escape closes, backdrop click closes, the panel's own clicks do not;
 *   - the body scroll is locked at the position it was at, not reset to top;
 *   - `max-h-[92dvh]`, matching the one copy that got the unit right — `vh`
 *     is the *largest* the viewport ever gets on mobile, so a `92vh` sheet is
 *     taller than the screen while the browser's address bar is showing;
 *   - `pb-safe` on the footer, which is the new part;
 *   - an optional drag down to dismiss, because a sheet that appears with a
 *     grab handle and then refuses to be grabbed is a broken affordance.
 *
 * `side="right"` is the same component as a drawer, for the header menu.
 *
 * It renders the classes that already exist in index.css — `auth-overlay`,
 * `auth-sheet`, and the new `auth-sheet-side` — rather than a parallel
 * `sheet-*` set, so there is one sheet vocabulary in the stylesheet.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { cn } from '../../lib/cn';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Past this many pixels of downward drag, releasing dismisses the sheet. */
const DISMISS_AFTER_PX = 96;

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Rendered as the sheet's heading and wired to `aria-labelledby`. */
  title?: string;
  /** A line under the title. */
  description?: string;
  /** Sticky action row. Padded for the home indicator automatically. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** 'bottom' is the sheet, 'right' is the drawer. */
  side?: 'bottom' | 'right';
  /** Widths at the `sm` breakpoint and up, where a bottom sheet becomes a
   *  centred modal. Ignored for `side="right"`, which is always edge-anchored. */
  size?: 'sm' | 'md' | 'lg' | 'full';
  /** Drag the panel down to dismiss it. Bottom sheets only. */
  swipeToDismiss?: boolean;
  /** Set false for a sheet whose work must be finished or explicitly cancelled. */
  dismissOnBackdrop?: boolean;
  /** Set false to hide the corner close button (Escape still works). */
  showClose?: boolean;
  /** Extra classes for the panel. */
  className?: string;
  /** Extra classes for the scrolling body. */
  bodyClassName?: string;
}

const sizes: Record<NonNullable<SheetProps['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  full: 'sm:max-w-4xl',
};

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  side = 'bottom',
  size = 'md',
  swipeToDismiss = true,
  dismissOnBackdrop = true,
  showClose = true,
  className,
  bodyClassName,
}) => {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const headingId = useId();
  const descriptionId = useId();

  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  /**
   * `onClose` is read through a ref so the effect below can depend on `open`
   * alone.
   *
   * Every call site writes `onClose={() => setOpen(false)}`, which is a new
   * function on each parent render. With that in the dependency array the
   * effect tore itself down and set itself back up on *every* render of the
   * parent: the scroll lock was released and retaken, and — the part that is
   * actually visible — focus was returned to whatever opened the sheet and
   * then dragged back to the panel. Typing in a field inside a sheet whose
   * parent re-renders per keystroke therefore lost the caret on the first
   * character. The handler itself is only ever called from an event, long
   * after the render that produced it, so the latest one is always the right
   * one to call.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /** How far the panel has been dragged down, in pixels. */
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  const canSwipe = swipeToDismiss && side === 'bottom';

  // -------------------------------------------------------------------------
  // Focus, Escape and the body scroll lock
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    previouslyFocused.current = document.activeElement;

    // Locked by position rather than `overflow: hidden` alone: iOS Safari
    // ignores overflow on <body> and scrolls the page behind the sheet
    // anyway, and when it is released the page has silently moved.
    const scrollY = window.scrollY;
    const { body } = document;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    // Focus the panel itself, not its first control: starting on the close
    // button reads out "close" as the first thing a screen reader announces.
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        // Nothing to move to — keep Tab inside rather than letting it walk
        // out to the page behind the overlay.
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  // Reset the drag whenever the sheet reopens, so a dismissed-by-drag sheet
  // does not come back already 96px down its own travel.
  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  // -------------------------------------------------------------------------
  // Drag to dismiss
  // -------------------------------------------------------------------------
  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!canSwipe || event.pointerType === 'mouse') return;
      dragStart.current = event.clientY;
    },
    [canSwipe],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragStart.current === null) return;
      // Upward drag does nothing: the sheet is already at its top stop, and
      // letting it follow the finger up just detaches it from the screen edge.
      setDragY(Math.max(0, event.clientY - dragStart.current));
    },
    [],
  );

  const endDrag = useCallback(() => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    setDragY((current) => {
      if (current > DISMISS_AFTER_PX) onClose();
      return 0;
    });
  }, [onClose]);

  if (!open || typeof document === 'undefined') return null;

  const isSide = side === 'right';
  const dragging = dragY > 0;

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? headingId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
      // While a finger is on the panel the animation class must not fight the
      // inline transform, so it is dropped for the duration of the drag.
      style={dragging ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      className={cn(
        'relative flex flex-col overflow-hidden border border-line bg-surface shadow-raised outline-none',
        isSide
          ? 'auth-sheet-side ml-auto h-full w-[86%] max-w-sm rounded-l-3xl'
          : cn(
              'auth-sheet max-h-[92dvh] w-full rounded-t-[28px] sm:rounded-3xl',
              sizes[size],
            ),
        // Without this the released panel snaps back instead of settling.
        !dragging && !reducedMotion && 'transition-transform duration-200',
        className,
      )}
    >
      {!isSide && (
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn('shrink-0 pt-3', canSwipe && 'cursor-grab touch-none active:cursor-grabbing')}
        >
          <div
            className="mx-auto h-1.5 w-12 rounded-full bg-surface-3 sm:hidden"
            aria-hidden="true"
          />
        </div>
      )}

      {(title || showClose) && (
        <div
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 px-5 pb-3 sm:px-6',
            isSide ? 'pt-5' : 'pt-3',
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-lg font-black text-content">
                {title}
              </h2>
            )}
            {description && (
              <p id={descriptionId} className="mt-0.5 text-xs text-muted">
                {description}
              </p>
            )}
          </div>
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.sheet.closeAria')}
              className="press -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-surface-2 hover:text-content"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6',
          bodyClassName,
        )}
      >
        {children}
      </div>

      {footer && (
        // The safe-area padding here is the whole reason this component exists
        // in one place: every copy of the pattern put its primary button flush
        // against the bottom edge, which on an iPhone is the strip the home
        // indicator owns and the OS swallows the first tap on.
        //
        // `pb-safe-plus` rather than `pb-safe`: the bare version *replaces*
        // the row's own bottom padding with an inset that is 0 on every
        // desktop, so the buttons ended up touching the border there instead.
        <div className="pb-safe-plus shrink-0 border-t border-line bg-surface px-5 pt-3 sm:px-6">
          {footer}
        </div>
      )}
    </div>
  );

  return createPortal(
    <div
      className={cn(
        'auth-overlay fixed inset-0 z-[200] flex backdrop-blur-sm',
        isSide ? 'justify-end' : 'items-end justify-center sm:items-center sm:p-4',
      )}
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      {panel}
    </div>,
    document.body,
  );
};

export default Sheet;
