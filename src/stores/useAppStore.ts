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
  storedLanguage,
} from '../i18n/storage';
import { DEFAULT_LANGUAGE, type Language } from '../i18n/types';
import type { ViewState } from '../router/views';
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
  propertyType: string;
  rentalType: 'ALL' | 'FULL' | 'ROOMMATE';
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
  propertyType: 'ALL',
  rentalType: 'ALL',
  audience: 'ALL',
  onlyVerified: false,
  minTrustScore: 0,
  sortBy: 'RECOMMENDED',
  amenities: [],
};

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
  language: Language;
  setLanguage: (language: Language) => void;
  /** Applies a language to the live UI. Registered by <I18nProvider>. */
  applyLanguage: (language: Language) => void;
  registerLanguageApplier: (apply: (language: Language) => void) => void;
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
  listingsLoading: boolean;
  listingsError: string | null;
  fetchListings: (options?: { append?: boolean; page?: number }) => Promise<void>;
  fetchFeatured: () => Promise<void>;
  fetchMyListings: () => Promise<void>;
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (listingId: string) => Promise<void>;
  removeListing: (listingId: string) => Promise<void>;
  recordView: (listingId: string) => void;
  recordContact: (listingId: string) => void;

  // -- Filters -------------------------------------------------------------
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
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
    if (!same) window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    /* history unavailable */
  }
}

function replacePath(path: string, scroll = true): void {
  if (typeof window === 'undefined') return;
  try {
    window.history.replaceState({}, '', path);
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
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
    propertyType: filters.propertyType !== 'ALL' ? filters.propertyType : undefined,
    rentalType: filters.rentalType,
    audience: filters.audience,
    onlyVerified: filters.onlyVerified || undefined,
    minTrustScore: filters.minTrustScore || undefined,
    sortBy: filters.sortBy,
    page,
    pageSize,
    ...Object.fromEntries(filters.amenities.map((amenity) => [amenity, true])),
  };
}

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
      set({ authReady: true });
      return;
    }
    try {
      const user = await AuthApi.me();
      set({ currentUser: user, authReady: true });

      // The account's saved language must actually drive the UI, not just sit
      // in the store; applyLanguage is wired to the i18n provider on mount.
      if (user.language && user.language !== get().language) {
        get().applyLanguage(user.language);
      }

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
    set({
      currentUser: user,
      showAuth: false,
      language: user.language ?? get().language,
    });
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
      favorites: [],
      favoriteIds: new Set(),
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
  applyLanguage: (language) => set({ language }),
  registerLanguageApplier: (apply) => set({ applyLanguage: apply }),
  setLanguage: (language) => {
    get().applyLanguage(language);
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

  setCurrentView: (view, listingId = null, conversationId = null) => {
    // The id is scoped to the detail view. Leaving it set across navigations
    // meant a later "open the listing" with no id reopened whichever flat was
    // last viewed, which is how a stale listing could appear under a fresh URL.
    const nextId =
      view === 'LISTING_DETAIL' ? (listingId ?? get().selectedListingId) : null;
    const route =
      view === 'LISTING_DETAIL' && nextId ? routeForListing(nextId) : routeForView(view);

    set({
      currentView: view,
      selectedListingId: nextId,
      route,
      // A conversation survives navigation *inside* chat and nothing else, so
      // that returning to the list does not silently reopen the last thread.
      activeConversationId:
        conversationId ?? (view === 'CHAT' ? get().activeConversationId : null),
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
    if (match.language !== get().language) get().applyLanguage(match.language);
    set({
      currentView: match.route.view,
      selectedListingId: match.route.listingId ?? null,
      route: match.route,
    });
    pushPath(match.redirectTo ?? path, options.replace);
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

    if (preferred !== get().language) get().applyLanguage(preferred);
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
  listingsLoading: false,
  listingsError: null,

  fetchListings: async (options = {}) => {
    const { append = false, page = append ? get().page + 1 : 1 } = options;
    set({ listingsLoading: true, listingsError: null });
    try {
      const result = await ListingsApi.list(toQuery(get().filters, page, get().pageSize));
      set((state) => ({
        listings: append ? [...state.listings, ...result.data] : result.data,
        totalCount: result.totalCount,
        page,
        listingsLoading: false,
      }));
    } catch (error) {
      set({
        listingsLoading: false,
        listingsError:
          error instanceof ApiError ? error.code : 'network',
        ...(append ? {} : { listings: [] }),
      });
    }
  },

  fetchFeatured: async () => {
    try {
      const result = await ListingsApi.featured(8);
      set({ featured: result.data });
    } catch {
      set({ featured: [] });
    }
  },

  fetchMyListings: async () => {
    if (!get().currentUser) return;
    set({ listingsError: null });
    try {
      set({ myListings: await ListingsApi.mine() });
    } catch (error) {
      // Swallowing this made the pages' error states unreachable, so a failed
      // load looked identical to "you have no listings".
      set({
        myListings: [],
        listingsError: error instanceof ApiError ? error.code : 'network',
      });
    }
  },

  fetchFavorites: async () => {
    if (!get().currentUser) {
      set({ favorites: [], favoriteIds: new Set() });
      return;
    }
    try {
      const items = await ListingsApi.favorites();
      set({
        favorites: items,
        favoriteIds: new Set(items.map((item) => item.id)),
        listingsError: null,
      });
    } catch (error) {
      set({ listingsError: error instanceof ApiError ? error.code : 'network' });
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
  setFilters: (patch) => {
    set((state) => ({ filters: { ...state.filters, ...patch }, page: 1 }));
    void get().fetchListings({ page: 1 });
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
    if (filters.propertyType !== 'ALL') count += 1;
    if (filters.rentalType !== 'ALL') count += 1;
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
