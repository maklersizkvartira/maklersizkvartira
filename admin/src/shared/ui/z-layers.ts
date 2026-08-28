/**
 * The one stacking order for anything that portals to `document.body`.
 *
 * It exists because the panel already had two z-index scales that did not know
 * about each other. The mobile glass dock (`.apple-glass-dock-wrapper`,
 * globals.css) is `position: fixed; z-index: 99999` at every width up to
 * 1024px, and nothing tells it a dialog is open — so anything that opens below
 * that number is painted UNDER a frosted, fully interactive navigation bar
 * sitting in the thumb-rest zone. A tap meant for a modal footer, or for the
 * backdrop, navigates the route away and takes the unsaved edits with it.
 *
 * Three layers, and the order between them is the whole point:
 *
 *   dock  <  dialog  <  dialog popover
 *
 * A popover — the `Select` dropdown, which portals to body rather than nesting
 * inside the dialog that opened it — has to clear the dialog as well as the
 * dock, or raising the dialog is what breaks it.
 */

/** The mobile dock, from globals.css. Not ours to set, only to stay above. */
export const Z_DOCK = 99999;

/** Modals and the moderation sheets. */
export const Z_DIALOG = Z_DOCK + 1;

/** Portalled popovers opened from inside a dialog. */
export const Z_DIALOG_POPOVER = Z_DIALOG + 1;
