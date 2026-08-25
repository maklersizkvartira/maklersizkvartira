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

import { create } from 'zustand';

import { detectInitialLanguage as getStoredLanguage } from '../i18n/storage';
import type { Language } from '../i18n/types';
import { AuthApi, type ApiUser } from '../services/authApi';
import { ApiError, clearTokens, getAccessToken, purgeLegacyStorage } from '../services/http';
import { ListingsApi, type ListingQuery } from '../services/listingsApi';
import type { Listing } from '../types';
import { canPublishListings } from '../types/roles';

export type ViewState =
  | 'HOME'
  | 'LISTINGS'
  | 'MAP'
  | 'LISTING_DETAIL'
  | 'VERIFICATION'
  | 'CREATE_LISTING'
  | 'MY_LISTINGS'
  | 'PROFILE'
  | 'CHAT'
  | 'REFERRAL'
  | 'STUDENT_PROGRAM'
  | 'ECOSYSTEM_PREVIEW'
  | 'FAVORITES';

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
  setCurrentView: (view: ViewState, listingId?: string | null) => void;

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

export const useAppStore = create<AppState>((set, get) => ({
  // -- Session -------------------------------------------------------------
  currentUser: null,
  authReady: false,
  showAuth: false,
  authModalTab: 'LOGIN',

  initAuth: async () => {
    // Wipe anything the previous build stored, including plaintext passwords.
    purgeLegacyStorage();

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
    if (canPublishListings(user.role)) void get().fetchMyListings();
  },

  logout: async () => {
    await AuthApi.logout();
    set({
      currentUser: null,
      currentView: 'HOME',
      myListings: [],
      favorites: [],
      favoriteIds: new Set(),
    });
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
  setCurrentView: (view, listingId = null) => {
    set({ currentView: view, selectedListingId: listingId ?? get().selectedListingId });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try {
        const target =
          view === 'LISTING_DETAIL' && listingId
            ? `/?listing=${encodeURIComponent(listingId)}`
            : view === 'HOME'
              ? '/'
              : `/?view=${view.toLowerCase()}`;
        window.history.pushState({}, '', target);
      } catch {
        /* history unavailable */
      }
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
