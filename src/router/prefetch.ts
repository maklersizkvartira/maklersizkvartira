/**
 * Fetching a view's code before it is asked for.
 *
 * Every screen is a separate chunk, so the first visit to one costs a network
 * round trip that happens *after* the tap: the old page leaves, `<Suspense>`
 * puts a spinner in its place, and the new page appears whenever the chunk
 * lands. On a good connection that is a flicker. On a phone on cellular data
 * it is the pause that reads as the app freezing between pages.
 *
 * The fix is to start the download a moment earlier. A finger resting on a
 * bottom-nav icon, or a cursor arriving over it, is a strong enough signal —
 * most of the time the tap follows, and when it does not, the cost is one
 * cached file nobody used.
 *
 * Deliberately not a preload of everything on boot: that would trade a pause
 * between pages for a slower first paint, which is the screen that decides
 * whether there is a second one.
 */

import type { ViewState } from './views';

/**
 * The same import specifiers `App.tsx` passes to `lazy()`.
 *
 * Only the views that are actually code-split belong here. `LISTINGS` is
 * statically imported by `App.tsx`, so its code is in the main bundle already
 * — prefetching it would download nothing and the bundler says so out loud.
 *
 * They have to match character for character. A bundler keys its chunk map on
 * the literal, so `'./components/map/MapView'` and `'../components/map/MapView'`
 * are two different entries and prefetching the second would download a second
 * copy while the first still stalls.
 */
const LOADERS: Partial<Record<ViewState, () => Promise<unknown>>> = {
  HOME: () => import('../components/home/HomePage'),
  MAP: () => import('../components/map/MapView'),
  LISTING_DETAIL: () => import('../components/listing/ListingDetailPage'),
  FAVORITES: () => import('../components/favorites/FavoritesPage'),
  PROFILE: () => import('../components/profile/ProfilePage'),
  MY_LISTINGS: () => import('../components/owner/MyListingsPage'),
  CREATE_LISTING: () => import('../components/owner/CreateListingPage'),
  CHAT: () => import('../components/chat/ChatPage'),
  LOGIN: () => import('../components/auth/AuthPage'),
  REGISTER: () => import('../components/auth/AuthPage'),
  FORGOT_PASSWORD: () => import('../components/auth/AuthPage'),
};

/** Views already asked for, so a hovered tab downloads once and not per frame. */
const started = new Set<ViewState>();

/**
 * Start loading a view's code. Safe to call repeatedly and from an event
 * handler: it never throws, never awaits, and does nothing the second time.
 *
 * A failure here is not worth reporting. The chunk will be requested again
 * when the view actually mounts, and that request has real error handling
 * behind it; this one is an optimisation that either helped or did not.
 */
export function prefetchView(view: ViewState): void {
  if (started.has(view)) return;
  const load = LOADERS[view];
  if (!load) return;
  started.add(view);
  void load().catch(() => started.delete(view));
}
