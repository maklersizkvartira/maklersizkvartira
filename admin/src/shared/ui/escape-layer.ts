'use client';

import { useEffect, useRef } from 'react';

/**
 * The one Escape order, the way `z-layers` is the one stacking order.
 *
 * Every layer that closes on Escape used to bind its own bare `keydown`
 * listener on `document` — and `document` is a single node, so one press ran
 * all of them. Closing the photo viewer over a moderation sheet closed the
 * sheet underneath it as well, and the moderator lost the note they had typed:
 * `ListingSheet` holds it in local state and is mounted with `key={row.id}`,
 * so there is nothing to come back to. Neither `stopPropagation` nor
 * `preventDefault` can fix that from inside one of the listeners —
 * `stopPropagation` stops the event reaching OTHER nodes, never a listener
 * co-registered on the same one, and the layer that would have to check
 * `defaultPrevented` is the one that subscribed first and therefore runs first.
 *
 * So the layers are held in one stack, in MOUNT order, and only the topmost
 * acts. One press peels exactly one layer, which is what a stack of dialogs is
 * expected to do.
 */
const stack: Array<() => void> = [];

/**
 * Close this layer when Escape is pressed and it is the topmost open one.
 *
 * `open` is deliberately the only dependency. Every call site passes an inline
 * arrow, so depending on the callback would re-subscribe on every render — and
 * re-push the layer in RENDER order, which puts a parent sheet back on top of
 * the lightbox it opened. The callback is read through a ref instead, so it is
 * always the current one without the subscription moving.
 */
export function useEscapeToClose(open: boolean, onClose: () => void): void {
  const latest = useRef(onClose);
  // Refreshed after every commit, never during render. A keypress can only
  // arrive after a commit, so the handler below always reads the current one.
  useEffect(() => {
    latest.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const entry = () => latest.current();
    stack.push(entry);

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (stack[stack.length - 1] !== entry) return;
      // The stack above is what keeps the other layers out of it — they sit on
      // this same node, where `stopPropagation` has no say. This call is for
      // anything bound further up the path, on `window`, which a layer that
      // was never told a dialog is open should not act on either.
      //
      // `preventDefault` is deliberately not called: a bare Escape has native
      // work to do — cancelling an IME composition, aborting an in-flight
      // image decode — and this panel defers ~8 MB verification documents onto
      // exactly that.
      event.stopPropagation();
      entry();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      const at = stack.indexOf(entry);
      if (at !== -1) stack.splice(at, 1);
    };
  }, [open]);
}
