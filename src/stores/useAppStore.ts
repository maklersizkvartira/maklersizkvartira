/**
 * Application store.
 *
 * Changes from the previous version:
 *  - The server is the only source of truth for the session. No user object,
 *    and certainly no password, is cached in localStorage.
 *  - Mock data is gone. A failed fetch surfaces as an error state instead of
 *    silently rendering invented listings.
 *  - Favorites are server-side, so they survive a reload and are visible to
 *    the admin panel.
 *  - Toast copy is stored as a translation key plus params, so notifications
 *    are localised like everything else.
 */

import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  browserLanguage,
  detectInitialLanguage as getStoredLanguage,
  persistLanguage,
  storedLanguage,
} from '../i18n/storage';
import { DEFAULT_LANGUAGE, type Language } from '../i18n/types';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import type { ViewState } from '../router/views';
import { stripLanguagePrefix } from '../router/language';
import {
  localisedPath,
  matchUrl,
  routeForListing,
  routeForView,
  type RouteMatch,
} from '../seo/routes';
import { AuthApi, type ApiUser } from '../services/authApi';
import {
  ApiError,
  clearTokens,
  getAccessToken,
  http,
  purgeLegacyStorage,
} from '../services/http';
import { trackEvent } from '../services/analytics';
import { isAutomatedAgent } from '../services/crawler';
import { ListingsApi, type ListingQuery } from '../services/listingsApi';
import { chatApi } from '../services/chatApi';
import type { Listing } from '../types';
import { canPublishListings } from '../types/roles';

export type { ViewState };

export type SignupRole = 'STUDENT' | 'OWNER';

export interface Toast {
  id: number;
  /** A translation key; the renderer resolves it. */
  key: string;
  params?: Record<string, string | number>;
  tone: 'info' | 'success' | 'warning' | 'error';
}

export interface Filters {
  search: string;
  region: string;
  district: string;
  metroStation: string;
  universityName: string;
  rooms: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  propertyType: string;
  rentalType: 'ALL' | 'FULL' | 'ROOMMATE';
  /** 'ALL' is the sentinel; 'GIRLS'/'BOYS' also match rooms left open to anyone. */
  roommateGender: 'ALL' | 'GIRLS' | 'BOYS';
  audience: 'ALL' | 'STUDENT' | 'FAMILY';
  onlyVerified: boolean;
  minTrustScore: number;
  sortBy: ListingQuery['sortBy'];
  amenities: string[];
}

/** 'ALL' is the sentinel; the label comes from `common.filters.all`. */
export const DEFAULT_FILTERS: Filters = {
  search: '',
  region: 'ALL',
  district: 'ALL',
  metroStation: 'ALL',
  universityName: 'ALL',
  rooms: null,
  minPrice: null,
  maxPrice: null,
  minArea: null,
  propertyType: 'ALL',
  rentalType: 'ALL',
  roommateGender: 'ALL',
  audience: 'ALL',
  onlyVerified: false,
  minTrustScore: 0,
  sortBy: 'RECOMMENDED',
  amenities: [],
};

// ---------------------------------------------------------------------------
// Quick filters
// ---------------------------------------------------------------------------
/**
 * The canned searches, defined once.
 *
 * They live here rather than in the catalogue page because the home page's
 * category tiles open exactly the same searches, and two copies of "what
 * 'for families' means" drift apart the first time one of them is tuned.
 *
 * Every delta is *complete* over the dimensions the group owns. The previous
 * version patched only the keys a chip cared about, which meant tapping
 * 'family' (audience=FAMILY + rentalType=FULL) and then 'roommate'
 * (rentalType=ROOMMATE) left audience=FAMILY standing: the backend resolves
 * that pair to `rooms >= 2 AND is_roommate IS FALSE AND is_roommate IS TRUE`,
 * an unsatisfiable query that returns nothing with no chip on screen to
 * explain why. Committing a whole filter set makes the group genuinely
 * single-select and makes that state unreachable.
 */
export type QuickFilterId =
  | 'all'
  | 'roommate'
  | 'student'
  | 'family'
  | 'metro'
  | 'qizlarga'
  | 'komfort'
  | 'center'
  | 'hovli'
  | 'budget'
  | 'premium';

export const QUICK_FILTER_DELTAS: Record<QuickFilterId, Partial<Filters>> = {
  all: {},
  roommate: { rentalType: 'ROOMMATE' },
  student: { audience: 'STUDENT' },
  family: { audience: 'FAMILY', rentalType: 'FULL', rooms: 2 },
  // The API has no "near any metro" flag, so the shortcut opens the busiest
  // interchange and leaves the station dropdown for the rest.
  metro: { metroStation: 'Yunusobod' },
  // A shared room the owner marked "girls only", plus the ones open to
  // anyone — a room with no preference recorded is open to her too, so the
  // backend folds ANY and NULL into this filter rather than returning the
  // handful of listings whose owners happened to fill the field in.
  qizlarga: { rentalType: 'ROOMMATE', roommateGender: 'GIRLS' },
  komfort: { amenities: ['furnished', 'airConditioning', 'washingMachine', 'internet'] },
  // `district` is a single ILIKE, not a set, so "the central districts" is
  // not expressible in one query. Mirobod is the one the centre is in; the
  // district dropdown covers the rest.
  center: { district: 'Mirobod' },
  // The one chip that narrows by what a place IS rather than by who it is
  // for or where it stands. HOUSE is the backend's own PropertyType member —
  // any other spelling is dropped by the filter model before it reaches SQL.
  hovli: { propertyType: 'HOUSE' },
  // Matches the "up to 3 mln" promise in the shared category description.
  budget: { maxPrice: 3_000_000, sortBy: 'PRICE_LOW' },
  premium: { onlyVerified: true, minTrustScore: 80, sortBy: 'TRUST' },
};

/**
 * The chips the catalogue rail renders, in order.
 *
 * `roommate` and `metro` are deliberately absent: the rail sits directly
 * under the ALL / FULL / ROOMMATE segmented control, and a chip that sets the
 * same field as the control one row above it is a second switch for one
 * setting. They stay in the delta map because the home page's tiles use them.
 */
export const QUICK_FILTER_RAIL: readonly QuickFilterId[] = [
  'all',
  'student',
  'family',
  'qizlarga',
  'komfort',
  'center',
  'hovli',
  'budget',
  'premium',
];

/**
 * The whole filter set a quick filter stands for.
 *
 * `search` is carried across rather than reset: it is the visitor's own
 * words, and a chip is a way of narrowing them, not of discarding them.
 */
export function quickFilterState(id: QuickFilterId, search = ''): Filters {
  return { ...DEFAULT_FILTERS, ...QUICK_FILTER_DELTAS[id], search };
}

function sameAmenities(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

/**
 * Which chip, if any, the current filters are. Compared over everything but
 * the search box, so typing a query does not extinguish the active chip.
 */
export function activeQuickFilter(filters: Filters): QuickFilterId | null {
  return (
    QUICK_FILTER_RAIL.find((id) => {
      const candidate = quickFilterState(id, filters.search);
      return (Object.keys(DEFAULT_FILTERS) as Array<keyof Filters>).every((key) => {
        if (key === 'search') return true;
        if (key === 'amenities') return sameAmenities(filters.amenities, candidate.amenities);
        return filters[key] === candidate[key];
      });
    }) ?? null
  );
}

interface AppState {
  // -- Session -------------------------------------------------------------
  currentUser: ApiUser | null;
  authReady: boolean;
  showAuth: boolean;
  authModalTab: 'LOGIN' | 'REGISTER';
  initAuth: () => Promise<void>;
  login: (user: ApiUser) => void;
  logout: () => Promise<void>;
  setShowAuth: (open: boolean, tab?: 'LOGIN' | 'REGISTER') => void;
  switchRole: (role: SignupRole) => Promise<void>;
  updateAvatar: (avatar: string) => Promise<void>;

  // -- Preferences ---------------------------------------------------------
  /**
   * The active language, and the only copy of it.
   *
   * It used to live here *and* in `<I18nProvider>`'s own state, kept in step
   * by an applier the provider registered in an effect. Child effects run
   * before parent ones, so on mount the router adopted the URL's language
   * before that applier existed: the store switched, the provider did not, and
   * a Russian URL rendered a Russian heading over Uzbek navigation.
   */
  language: Language;
  setLanguage: (language: Language) => void;
  currency: 'UZS' | 'USD';
  setCurrency: (currency: 'UZS' | 'USD') => void;
  fxRate: number;

  // -- Navigation ----------------------------------------------------------
  currentView: ViewState;
  selectedListingId: string | null;
  /**
   * The resolved route, including the facet a landing page filters by. The
   * URL is a projection of this, never the other way round.
   */
  route: RouteMatch;
  setCurrentView: (
    view: ViewState,
    listingId?: string | null,
    conversationId?: string | null,
  ) => void;
  /** Navigates to a path, pushing (or replacing) a history entry. */
  navigate: (path: string, options?: { replace?: boolean }) => void;
  /**
   * Adopts the browser's current address without touching history. Used on
   * mount and from the `popstate` listener, where the URL is already correct
   * and pushing again would add a phantom entry.
   */
  adoptLocation: (pathname: string, search?: string) => void;

  // -- Chat ----------------------------------------------------------------
  activeListingId: string | null;
  activeConversationId: string | null;
  unreadChatCount: number;
  fetchUnreadChatCount: () => Promise<void>;

  // -- Listings ------------------------------------------------------------
  listings: Listing[];
  featured: Listing[];
  myListings: Listing[];
  favorites: Listing[];
  favoriteIds: Set<string>;
  totalCount: number;
  page: number;
  pageSize: number;
  /**
   * Whether the server says another page exists.
   *
   * Not `listings.length < totalCount`: `mergeUnique` deliberately drops rows
   * an earlier page already showed, so one listing published mid-browse
   * leaves the list permanently one short of the total and that comparison
   * stays true forever — a "load more" button that fetches an empty page,
   * changes nothing, and is still there afterwards. The server does its own
   * cursor arithmetic and reports it in `meta.hasNext`.
   */
  hasMoreListings: boolean;
  /**
   * The filter signature the rows in `listings` answer, or null when there
   * are none. `listingsAreCurrent` is the only thing that reads it.
   */
  listingsKey: string | null;
  listingsLoading: boolean;
  /**
   * True only while the in-flight request is a "load more".
   *
   * The page needs the distinction: a fresh query must replace the rows with
   * skeletons, because leaving the previous filter's results on screen while
   * a new one is running is the same lie the mock data used to tell. An
   * append must leave them exactly where they are.
   */
  listingsAppending: boolean;
  listingsError: string | null;
  /**
   * The private lists carry their own status.
   *
   * They used to write `listingsError`, which is the field the catalogue
   * renders its error card from — so a failed my-listings load on the owner
   * dashboard armed an error on a screen the visitor was not even looking at,
   * and a successful catalogue load cleared an error the dashboard still had.
   */
  myListingsLoading: boolean;
  myListingsError: string | null;
  favoritesLoading: boolean;
  favoritesError: string | null;
  fetchListings: (options?: { append?: boolean; page?: number }) => Promise<void>;
  /**
   * True when the rows already in the store answer the filters on screen, so
   * a page that has just mounted can leave them alone instead of refetching
   * page 1 over the top of them.
   */
  listingsAreCurrent: () => boolean;
  fetchFeatured: () => Promise<void>;
  fetchMyListings: () => Promise<void>;
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (listingId: string) => Promise<void>;
  removeListing: (listingId: string) => Promise<void>;
  recordView: (listingId: string) => void;
  recordContact: (listingId: string) => void;

  // -- Filters -------------------------------------------------------------
  filters: Filters;
  /**
   * `options.quickFilter` names the chip or tile a whole-set commit came from.
   * Intent used to be inferred from `'search' in patch`, which every canned
   * search satisfies — see `setFilters` for what that cost the analytics.
   */
  setFilters: (patch: Partial<Filters>, options?: { quickFilter?: QuickFilterId }) => void;
  resetFilters: () => void;
  activeFilterCount: () => number;

  // -- Toasts --------------------------------------------------------------
  toasts: Toast[];
  pushToast: (key: string, tone?: Toast['tone'], params?: Record<string, string | number>) => void;
  dismissToast: (id: number) => void;

  // -- Feature Flags -------------------------------------------------------
  isMonetizationEnabled: boolean;
  setMonetizationEnabled: (enabled: boolean) => void;
}

let toastSequence = 0;

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
function currentAddress(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Top of the new page.
 *
 * `behavior` is read from the visitor's preference rather than hard-coded to
 * 'smooth'. A behaviour passed explicitly to `scrollTo` beats the computed
 * `scroll-behavior`, so index.css's `scroll-behavior: auto !important` under
 * `prefers-reduced-motion` did nothing here: every navigation glided the whole
 * document past somebody who had asked the system for less movement, which is
 * the exact case that makes people motion-sick. Asked per call, not cached —
 * the setting can change mid-session and there is no listener out here.
 */
function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/**
 * Writes a path into the address bar.
 *
 * Navigating to the address you are already at replaces instead of pushes:
 * the mount-time adoption of a deep link used to push a second, identical
 * entry, so the visitor's first Back press appeared to do nothing.
 */
function pushPath(path: string, replace = false): void {
  if (typeof window === 'undefined') return;
  try {
    const same = path === currentAddress();
    window.history[replace || same ? 'replaceState' : 'pushState']({}, '', path);
    if (!same) scrollToTop();
  } catch {
    /* history unavailable */
  }
}

/**
 * Applies a language the visitor did not ask for *in the URL*.
 *
 * The account's saved preference and the browser's are both suggestions; the
 * address is the source of truth. So a preference moves the visitor to that
 * language's URL, and is ignored outright when the URL already names a
 * language — otherwise signing in on `/en/toshkent` would render Russian at
 * an address whose canonical and hreflang both say English.
 */
function adoptPreferredLanguage(language: Language): void {
  const state = useAppStore.getState();
  if (language === state.language) return;
  if (typeof window !== 'undefined') {
    try {
      if (stripLanguagePrefix(window.location.pathname).explicit) return;
    } catch {
      /* malformed URL: fall through and just apply it */
    }
  }
  useAppStore.setState({ language });
  replacePath(localisedPath(state.route.path, language), false);
}

function replacePath(path: string, scroll = true): void {
  if (typeof window === 'undefined') return;
  try {
    window.history.replaceState({}, '', path);
    if (scroll) scrollToTop();
  } catch {
    /* history unavailable */
  }
}

function toQuery(filters: Filters, page: number, pageSize: number): ListingQuery {
  return {
    search: filters.search || undefined,
    region: filters.region !== 'ALL' ? filters.region : undefined,
    district: filters.district !== 'ALL' ? filters.district : undefined,
    metroStation: filters.metroStation !== 'ALL' ? filters.metroStation : undefined,
    universityName: filters.universityName !== 'ALL' ? filters.universityName : undefined,
    rooms: filters.rooms ?? undefined,
    minPrice: filters.minPrice ?? undefined,
    maxPrice: filters.maxPrice ?? undefined,
    minArea: filters.minArea ?? undefined,
    propertyType: filters.propertyType !== 'ALL' ? filters.propertyType : undefined,
    rentalType: filters.rentalType,
    roommateGender:
      filters.roommateGender !== 'ALL' ? filters.roommateGender : undefined,
    audience: filters.audience,
    onlyVerified: filters.onlyVerified || undefined,
    minTrustScore: filters.minTrustScore || undefined,
    sortBy: filters.sortBy,
    page,
    pageSize,
    ...Object.fromEntries(filters.amenities.map((amenity) => [amenity, true])),
  };
}

/**
 * A stable fingerprint of everything a listings query depends on.
 *
 * Stored alongside the rows so a page that remounts — App.tsx swaps views by
 * unmounting, so returning from a listing detail rebuilds the catalogue from
 * scratch — can tell "the store already answers this search" from "these rows
 * belong to a search the visitor has left". Without it the mount fetch threw
 * away every page `load more` had accumulated.
 *
 * `page`/`pageSize` are pinned to 0 because they are not part of *which*
 * search this is, and the amenity list is sorted because tapping the same two
 * chips in the other order is the same query.
 */
function filterSignature(filters: Filters): string {
  return JSON.stringify(
    toQuery({ ...filters, amenities: [...filters.amenities].sort() }, 0, 0),
  );
}

/**
 * Appends page N without repeating a row page N-1 already showed.
 *
 * Offsets are computed against a table that is still being written to: one
 * listing published between two page requests shifts everything down by one,
 * so page 2 legitimately returns a row page 1 already had. Two cards with the
 * same id is a duplicate React key and a wrong count, not a longer list.
 */
function mergeUnique(existing: Listing[], incoming: Listing[]): Listing[] {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !seen.has(item.id))];
}

/**
 * Request sequencing for the catalogue.
 *
 * Two filter taps inside a few hundred milliseconds used to race: whichever
 * response landed last won, so the older query could paint over the newer one
 * and the chips on screen would describe a list nobody had asked for. The
 * sequence number decides who is allowed to write, and the controller aborts
 * the loser so its connection is not held open for a result nobody wants.
 */
let listingsSequence = 0;
let listingsAbort: AbortController | null = null;

const store = createStore<AppState>((set, get) => ({
  // -- Session -------------------------------------------------------------
  currentUser: null,
  authReady: false,
  showAuth: false,
  authModalTab: 'LOGIN',

  initAuth: async () => {
    // Wipe anything the previous build stored, including plaintext passwords.
    purgeLegacyStorage();

    // Not awaited, and no longer a bare relative fetch.
    //
    // `fetch('/api/v1/settings')` went to the Vercel origin in production,
    // where the SPA catch-all answered with index.html — a 200 whose body is
    // HTML, so `res.json()` threw and the flag silently stayed false. Worse,
    // awaiting it held `authReady` false, which meant every visitor stared at
    // a spinner until a request that could never succeed had finished.
    void http
      .get<{ is_monetization_enabled: boolean }>('/settings', { anonymous: true })
      .then((data) => set({ isMonetizationEnabled: Boolean(data.is_monetization_enabled) }))
      .catch(() => {
        /* the flag defaults to false, which hides the paid surfaces */
      });

    if (!getAccessToken()) {
      // Nothing but the session flag. This used to seed ten fabricated
      // listings, and because App.tsx gates the whole tree on `authReady`,
      // the anonymous visitor's very first painted frame of the catalogue was
      // ten fake cards — so the skeleton branch was never reachable, and the
      // real response replaced them with however many rows the database
      // actually has. Listings appearing and then vanishing was that.
      set({ authReady: true });
      return;
    }
    try {
      const user = await AuthApi.me();
      set({ currentUser: user, authReady: true });

      // The account's saved language follows the user across devices.
      if (user.language) adoptPreferredLanguage(user.language);

      // Without this the hearts are empty after every reload, and clicking one
      // "adds" a listing that was already saved.
      await get().fetchFavorites();
      await get().fetchUnreadChatCount();
      if (canPublishListings(user.role)) void get().fetchMyListings();
    } catch (error) {
      if (error instanceof ApiError && error.isAuth) clearTokens();
      set({ currentUser: null, authReady: true });
    }
  },

  login: (user) => {
    set({ currentUser: user, showAuth: false });
    // Setting `language` in the same breath would have left the address, the
    // canonical tag and the hreflang set describing the language the visitor
    // was reading a moment ago.
    if (user.language) adoptPreferredLanguage(user.language);
    get().pushToast(
      user.role === 'OWNER' ? 'layout.toast.welcomeOwner' : 'layout.toast.welcomeStudent',
      'success',
    );
    void get().fetchFavorites();
    void get().fetchUnreadChatCount();
    if (canPublishListings(user.role)) void get().fetchMyListings();
  },

  logout: async () => {
    await AuthApi.logout();
    set({
      currentUser: null,
      myListings: [],
      myListingsError: null,
      myListingsLoading: false,
      favorites: [],
      favoriteIds: new Set(),
      favoritesError: null,
      favoritesLoading: false,
      unreadChatCount: 0,
    });
    // Through the navigator, so the address bar leaves the private page too.
    // Setting `currentView` directly left the URL on `/profil` after signing
    // out, which is a noindex page the visitor could then bookmark or share.
    get().setCurrentView('HOME');
  },

  setShowAuth: (open, tab = 'LOGIN') => set({ showAuth: open, authModalTab: tab }),

  switchRole: async (role) => {
    const user = get().currentUser;
    if (!user || user.role === role) return;
    const updated = await AuthApi.updateProfile({ role });
    set({ currentUser: updated });
    get().pushToast('layout.toast.roleSwitched', 'success', {
      role: role === 'OWNER' ? 'owner' : 'student',
    });
  },

  updateAvatar: async (avatar) => {
    const updated = await AuthApi.updateProfile({ avatar });
    set({ currentUser: updated });
    get().pushToast('layout.toast.avatarUpdated', 'success');
  },

  // -- Preferences ---------------------------------------------------------
  language: getStoredLanguage(),
  setLanguage: (language) => {
    const previous = get().language;
    set({ language });
    persistLanguage(language);
    if (previous !== language) trackEvent('language_switch', { from: previous, to: language });
    // Each language has its own URL, so switching languages is a navigation.
    // Without this the address would keep claiming to be the Uzbek page while
    // showing Russian, and every hreflang tag on the site would be a lie.
    replacePath(localisedPath(get().route.path, language), false);
    // Persist to the account too, so the choice follows the user's devices.
    if (get().currentUser) {
      void AuthApi.updateProfile({ language }).catch(() => undefined);
    }
  },
  currency: 'UZS',
  setCurrency: (currency) => set({ currency }),
  fxRate: 12700,

  // -- Navigation ----------------------------------------------------------
  currentView: 'HOME',
  selectedListingId: null,
  route: routeForView('HOME'),
  activeListingId: null,
  activeConversationId: null,
  unreadChatCount: 0,

  fetchUnreadChatCount: async () => {
    try {
      const { count } = await chatApi.getUnreadCount();
      set({ unreadChatCount: count });
    } catch {
      // A badge is not worth an error: a failed poll just leaves the last
      // count standing until the next one succeeds.
    }
  },

  setCurrentView: (view, listingId, conversationId) => {
    // The id is scoped to the detail view. Leaving it set across navigations
    // meant a later "open the listing" with no id reopened whichever flat was
    // last viewed, which is how a stale listing could appear under a fresh URL.
    // `undefined` means "not given"; an explicit `null` means "clear it".
    // `??` collapsed the two, which is why the chat back arrow did nothing:
    // it passes null to close the open thread, and null ?? current kept it.
    const nextId =
      view === 'LISTING_DETAIL'
        ? (listingId !== undefined ? listingId : get().selectedListingId)
        : null;
    const route =
      view === 'LISTING_DETAIL' && nextId ? routeForListing(nextId) : routeForView(view);

    set({
      currentView: view,
      selectedListingId: nextId,
      route,
      // A conversation survives navigation *inside* chat and nothing else, so
      // that returning to the list does not silently reopen the last thread.
      activeConversationId:
        conversationId !== undefined
          ? conversationId
          : view === 'CHAT'
            ? get().activeConversationId
            : null,
      // Opening chat is what marks it read; the badge clears at that moment
      // rather than waiting for the next poll to notice.
      ...(view === 'CHAT' ? { unreadChatCount: 0 } : {}),
    });
    // `pushPath` scrolls to the top itself, and only when the address really
    // changed — re-selecting the current tab should not jump the page.
    pushPath(localisedPath(route.path, get().language));
  },

  navigate: (path, options = {}) => {
    const match = matchUrl(path);

    // A path with no /ru or /en in front of it is not a request for Uzbek —
    // it is a route, to be shown in whatever language the visitor is already
    // reading. Every internal link passes the bare path, so treating it as an
    // explicit Uzbek request dropped a Russian visitor back to Uzbek, and
    // stripped the prefix from the address, on their very first click.
    const language = match.languageFromUrl ? match.language : get().language;
    if (language !== get().language) set({ language });

    set({
      currentView: match.route.view,
      selectedListingId: match.route.listingId ?? null,
      route: match.route,
    });
    pushPath(localisedPath(match.route.path, language), options.replace);
  },

  adoptLocation: (pathname, search = '') => {
    const match = matchUrl(pathname, search);

    // A visitor who reads Russian lands on the Uzbek address of whatever they
    // clicked. Move them to their own language's URL rather than rendering
    // Russian at a URL that calls itself Uzbek — the replace below is what
    // makes the address and the content agree.
    //
    // A stored choice outranks the browser's, and a crawler gets neither: its
    // `navigator.language` is whatever the rendering service happens to be
    // configured with, and letting that bounce Googlebot off the Uzbek home
    // page would be a poor way to rank for Uzbek searches.
    const preferred = match.languageFromUrl
      ? match.language
      : (storedLanguage() ??
        (isAutomatedAgent() ? match.language : (browserLanguage() ?? match.language)));

    if (preferred !== get().language) set({ language: preferred });
    set({
      currentView: match.route.view,
      selectedListingId: match.route.listingId ?? null,
      route: match.route,
    });

    // A legacy `/?listing=…` link or a trailing slash resolves to the same
    // page at a different address; replacing it keeps one URL per page in the
    // address bar and out of the index.
    const canonical = localisedPath(match.route.path, preferred);
    if (match.route.kind !== 'NOT_FOUND' && canonical !== `${pathname}${search}`) {
      replacePath(canonical, false);
    }
  },

  // -- Listings ------------------------------------------------------------
  listings: [],
  featured: [],
  myListings: [],
  favorites: [],
  favoriteIds: new Set<string>(),
  totalCount: 0,
  page: 1,
  pageSize: 24,
  hasMoreListings: false,
  listingsKey: null,
  listingsLoading: false,
  listingsAppending: false,
  listingsError: null,
  myListingsLoading: false,
  myListingsError: null,
  favoritesLoading: false,
  favoritesError: null,

  fetchListings: async (options = {}) => {
    const { append = false, page = append ? get().page + 1 : 1 } = options;

    // Everything the response is judged against is read *now*, from the same
    // state the query was built from. The old code re-read the filter count
    // after the await, so a response was decided against filters the visitor
    // had already changed.
    const mine = ++listingsSequence;
    listingsAbort?.abort();
    const controller = new AbortController();
    listingsAbort = controller;
    const requestedFilters = get().filters;
    const query = toQuery(requestedFilters, page, get().pageSize);
    const signature = filterSignature(requestedFilters);

    set({ listingsLoading: true, listingsAppending: append, listingsError: null });
    try {
      const result = await ListingsApi.list(query, controller.signal);
      if (mine !== listingsSequence) return;

      const data = result?.data ?? [];
      // An append that came back with nothing is the end of the list whatever
      // the arithmetic says, and the cursor must not step past it or the next
      // tap would skip a page that does exist.
      const exhausted = append && data.length === 0;
      set((state) => {
        const rows = append ? mergeUnique(state.listings, data) : data;
        const total = result?.totalCount ?? 0;
        return {
          listings: rows,
          totalCount: total,
          // Only the winning request moves the cursor. Writing it from every
          // response let a superseded page-2 reply push `page` forward, so the
          // next "load more" fetched page 4 and page 3 was never shown.
          page: exhausted ? state.page : page,
          hasMoreListings: exhausted ? false : (result?.meta?.hasNext ?? rows.length < total),
          listingsKey: signature,
          listingsLoading: false,
          listingsAppending: false,
        };
      });
    } catch (error) {
      if (mine !== listingsSequence) return;
      set((state) => ({
        listingsLoading: false,
        listingsAppending: false,
        listingsError: error instanceof ApiError ? error.code : 'network',
        // A failed "load more" is not a reason to throw away the seventy-two
        // rows already on screen; it is a reason to say the next page did not
        // arrive. Only a failed first page clears the list.
        listings: append ? state.listings : [],
        totalCount: append ? state.totalCount : 0,
        hasMoreListings: append ? state.hasMoreListings : false,
        // Nothing on screen answers these filters any more, so a page that
        // mounts next must fetch rather than trust the empty list.
        listingsKey: append ? state.listingsKey : null,
      }));
    }
  },

  listingsAreCurrent: () => {
    const state = get();
    return state.listings.length > 0 && state.listingsKey === filterSignature(state.filters);
  },

  fetchFeatured: async () => {
    try {
      const result = await ListingsApi.featured(8);
      set({ featured: result?.data || [] });
    } catch {
      set({ featured: [] });
    }
  },

  fetchMyListings: async () => {
    if (!get().currentUser) return;
    set({ myListingsLoading: true, myListingsError: null });
    try {
      const data = await ListingsApi.mine();
      set({ myListings: data || [], myListingsLoading: false });
    } catch (error) {
      // Swallowing this made the pages' error states unreachable, so a failed
      // load looked identical to "you have no listings".
      set({
        myListings: [],
        myListingsLoading: false,
        myListingsError: error instanceof ApiError ? error.code : 'network',
      });
    }
  },

  fetchFavorites: async () => {
    if (!get().currentUser) {
      set({ favorites: [], favoriteIds: new Set(), favoritesLoading: false, favoritesError: null });
      return;
    }
    set({ favoritesLoading: true, favoritesError: null });
    try {
      const items = await ListingsApi.favorites();
      const data = items || [];
      set({
        favorites: data,
        favoriteIds: new Set(data.map((item) => item.id)),
        favoritesLoading: false,
      });
    } catch (error) {
      set({
        favoritesLoading: false,
        favoritesError: error instanceof ApiError ? error.code : 'network',
      });
    }
  },

  toggleFavorite: async (listingId) => {
    const { currentUser, favoriteIds } = get();
    if (!currentUser) {
      set({ showAuth: true, authModalTab: 'LOGIN' });
      return;
    }
    const wasFavorite = favoriteIds.has(listingId);

    // Optimistic: the star flips immediately, and reverts if the call fails.
    const nextIds = new Set(favoriteIds);
    if (wasFavorite) nextIds.delete(listingId);
    else nextIds.add(listingId);
    set({ favoriteIds: nextIds });

    try {
      await ListingsApi.recordStat(listingId, 'favorites', wasFavorite ? -1 : 1);
      await get().fetchFavorites();
      trackEvent('listing_favorite', { listing_id: listingId, added: !wasFavorite });
      get().pushToast(
        wasFavorite ? 'layout.toast.favoriteRemoved' : 'layout.toast.favoriteAdded',
        'success',
      );
    } catch {
      set({ favoriteIds: favoriteIds });
      get().pushToast('common.error.network', 'error');
    }
  },

  removeListing: async (listingId) => {
    try {
      await ListingsApi.remove(listingId);
      set((state) => ({
        listings: state.listings.filter((item) => item.id !== listingId),
        myListings: state.myListings.filter((item) => item.id !== listingId),
      }));
      get().pushToast('layout.toast.listingDeleted', 'success');
    } catch {
      get().pushToast('common.error.generic', 'error');
    }
  },

  recordView: (listingId) => {
    // A crawler rendering every listing URL would otherwise bias the POPULAR
    // sort towards whatever it fetched first.
    if (isAutomatedAgent()) return;
    void ListingsApi.recordStat(listingId, 'views').catch(() => undefined);
  },

  recordContact: (listingId) => {
    void ListingsApi.recordStat(listingId, 'contacts').catch(() => undefined);
  },

  // -- Filters -------------------------------------------------------------
  filters: { ...DEFAULT_FILTERS },
  setFilters: (patch, options = {}) => {
    set((state) => ({ filters: { ...state.filters, ...patch }, page: 1 }));
    void get().fetchListings({ page: 1 });

    // A typed query and a tapped filter chip are different intents and belong
    // in different reports, but they arrive through the same action — so they
    // are separated here rather than at each of the call sites.
    //
    // The test used to be "does the patch mention `search`", which every chip,
    // tile and search-sheet submit satisfies: they all commit a whole
    // `quickFilterState`, and a whole filter set always carries a `search`
    // key. So a chip tapped with an empty box reported nothing at all and a
    // chip tapped over a typed query reported a search — which is why the
    // three new categories showed zero usage. A commit is a search only when
    // `search` is the *only* thing in it, which is exactly what the two
    // debounced search boxes send.
    const fields = Object.keys(patch);
    const searchOnly = fields.length === 1 && fields[0] === 'search';
    if (options.quickFilter) {
      trackEvent('filter_apply', { fields: 'quick', quick_filter: options.quickFilter });
    } else if (searchOnly) {
      if (patch.search) trackEvent('search_submit', { query_length: patch.search.length });
    } else {
      trackEvent('filter_apply', { fields: fields.join(',') });
    }
  },
  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS }, page: 1 });
    void get().fetchListings({ page: 1 });
  },
  activeFilterCount: () => {
    const filters = get().filters;
    let count = 0;
    if (filters.search) count += 1;
    if (filters.region !== 'ALL') count += 1;
    if (filters.district !== 'ALL') count += 1;
    if (filters.metroStation !== 'ALL') count += 1;
    if (filters.universityName !== 'ALL') count += 1;
    if (filters.rooms !== null) count += 1;
    if (filters.minPrice !== null || filters.maxPrice !== null) count += 1;
    if (filters.minArea !== null) count += 1;
    if (filters.propertyType !== 'ALL') count += 1;
    if (filters.rentalType !== 'ALL') count += 1;
    if (filters.roommateGender !== 'ALL') count += 1;
    if (filters.audience !== 'ALL') count += 1;
    if (filters.onlyVerified) count += 1;
    if (filters.minTrustScore > 0) count += 1;
    return count + filters.amenities.length;
  },

  // -- Toasts --------------------------------------------------------------
  toasts: [],
  pushToast: (key, tone = 'info', params) => {
    const id = ++toastSequence;
    set((state) => ({ toasts: [...state.toasts, { id, key, params, tone }] }));
    setTimeout(() => get().dismissToast(id), 4500);
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  // -- Feature Flags -------------------------------------------------------
  // Setting this to false hides all VIP and Top listings, and payment UI
  isMonetizationEnabled: false,
  setMonetizationEnabled: (enabled: boolean) => set({ isMonetizationEnabled: enabled }),
}));

/**
 * The hook, built from an explicit vanilla store rather than `create()`.
 *
 * `create()` closes over a store object this module cannot reach, and that
 * object's `getInitialState` is what `useSyncExternalStore` calls for its
 * *server* snapshot. During the build-time prerender that meant every
 * component read the store's defaults no matter what the renderer had seeded
 * into it — so all three hundred generated pages rendered the home route, in
 * Uzbek. Owning the store object is what makes `pinServerSnapshot` below
 * possible.
 */
export type UseAppStore = {
  <T>(selector: (state: AppState) => T): T;
} & StoreApi<AppState>;

export const useAppStore: UseAppStore = Object.assign(
  <T,>(selector: (state: AppState) => T): T => useStore(store, selector),
  store,
) as UseAppStore;

/**
 * Makes the server snapshot follow the live state.
 *
 * Called by the prerenderer after it seeds a route, and by nothing else: in a
 * browser the server snapshot is never read, and in the build there is no
 * hydration to keep consistent with.
 */
export function pinServerSnapshot(): void {
  store.getInitialState = store.getState;
}
