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

/**
 * The height of a screen that fills the viewport under the fixed header.
 *
 * `dvh`, not `vh`, and this file is the reason it is worth stating: `vh` is
 * the *largest* the viewport ever gets on a phone, so a `100vh` surface is
 * sixty to a hundred pixels taller than the screen for as long as the browser's
 * address bar is showing — and on a map, whose whole bottom edge is where the
 * floating controls live, those pixels are simply off-screen and the map eats
 * the swipe that would have scrolled them back.
 *
 * 65px is `HEADER_H` plus its border, the same number `HEADER_CLEARANCE` pads
 * by. The map used to subtract 3.5rem here and 5.5rem at `sm`, so it overhung
 * by 9px on a phone and left 23px of dead canvas on a laptop.
 */
export const VIEWPORT_UNDER_HEADER_H = 'h-[calc(100dvh-65px)]';

/**
 * What a full-bleed screen pads by so the fixed BottomNav does not cover it.
 *
 * The nav is `position: fixed; bottom: 0; z-index: 80` and `lg:hidden`, and
 * nothing that fills the viewport reserved room for it — so on every phone the
 * map's locate-me button and both engines' zoom controls were drawn underneath
 * it and every tap on them hit a navigation tab instead. 48px of row plus the
 * `pb-safe-plus` gutter is ~61px; 4rem leaves a little daylight, and the inset
 * is added on top for the home indicator.
 */
export const BOTTOM_NAV_CLEARANCE =
  'pb-[calc(env(safe-area-inset-bottom,0px)+4rem)] lg:pb-0';
