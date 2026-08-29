/**
 * The fixed header's height, written once.
 *
 * The bar is `position: fixed`, so its height is not a private detail of
 * Header.tsx — it is a number every surface that has to start below it needs
 * to know. That number used to be copied by hand into three files, and the
 * copies drifted: a commit shortened the bar and changed `<main>`, but
 * ListingsPage kept the pre-commit figure, so the catalogue's sticky filter
 * bar parked ~30px too low and a strip of the page scrolled through the gap.
 * Importing a constant is the only version of this that cannot rot.
 *
 * ONE height at every breakpoint, deliberately. A `sm:` variant doubles every
 * number in this contract for a difference nobody can perceive on a phone,
 * and doubling the numbers is exactly how they got out of step the first
 * time. 64px of bar (`h-16`) plus the 1px bottom border is 65px, and the
 * border is present in BOTH scroll states — only its colour changes — so the
 * outer height never shifts as the bar elevates.
 *
 * These are COMPLETE literal class strings, not fragments to concatenate.
 * Tailwind v4 scans source text for whole class names; `'pt-' + size` would
 * generate nothing at all, with no error and no missing-class warning — the
 * header would simply overlap the page.
 */

/** The inner row's height. 64px + the 1px border below it = 65px outer. */
export const HEADER_H = 'h-16';

/** What `<main>` in App.tsx pads by to clear the fixed bar. */
export const HEADER_CLEARANCE = 'pt-[65px]';

/**
 * Where a `sticky` element parks so it stops under the bar rather than
 * beneath it. Measured from the viewport, not from the padded `<main>`.
 */
export const HEADER_STICKY_TOP = 'top-[65px]';
