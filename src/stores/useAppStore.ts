import { create } from 'zustand';
import { UserRole, Listing, ReportItem, VerificationRequest, ChatMessage, Conversation, CurrentUser, SignupRole, FraudSignal } from '../types';
import { MOCK_LISTINGS } from '../data/mockListings';
import { MOCK_OWNERS } from '../data/mockUsers';
import { MOCK_REPORTS, MOCK_VERIFICATIONS, MOCK_FRAUD_SIGNALS } from '../data/mockAdminData';
import { ApiService, matchPhone } from '../services/apiService';
import { API_BASE, clearTokens, getAccessToken, initAuthFromStorage } from '../services/authService';


export type ViewState =
  | 'HOME'
  | 'SEARCH'
  | 'MAP'
  | 'LISTING_DETAIL'
  | 'VERIFICATION'
  | 'CREATE_LISTING'
  | 'CHAT'
  | 'REFERRAL'
  | 'ADMIN'
  | 'STUDENT_PROGRAM'
  | 'ECOSYSTEM_PREVIEW'
  | 'FAVORITES'
  | 'MY_LISTINGS'
  | 'PROFILE';


interface AppStore {
  currentView: ViewState;
  selectedListingId: string | null;
  setCurrentView: (view: ViewState, listingId?: string | null) => void;

  currentUser: CurrentUser | null;
  currentRole: UserRole;
  /** Called on app mount: restores session from token via /auth/me */
  initAuth: () => Promise<void>;
  login: (user: CurrentUser) => void;
  logout: () => void;
  switchRole: (newRole: SignupRole) => void;
  updateAvatar: (avatar: string) => void;
  setActiveConversation: (id: string | null) => void;
  setCurrentRole: (role: UserRole) => void;
  userXp: number;
  userBadges: string[];
  addXp: (amount: number, reason: string) => void;

  isAiSystemActive: boolean;
  setAiSystemActive: (isActive: boolean) => void;

  currency: 'USD' | 'UZS';
  setCurrency: (c: 'USD' | 'UZS') => void;
  themeMode: 'dark' | 'light';
  toggleThemeMode: () => void;
  listings: Listing[];
  fetchListings: () => Promise<void>;
  addListing: (newListing: Listing) => void;
  updateListing: (updatedListing: Listing) => void;
  removeListing: (listingId: string) => void;
  clearAllExtraListings: () => void;
  incrementListingStat: (listingId: string, stat: 'views' | 'favorites' | 'contacts') => void;
  editingListing: Listing | null;
  setEditingListing: (listing: Listing | null) => void;

  favorites: string[];
  toggleFavorite: (listingId: string) => void;

  searchQuery: string;
  selectedRegion: string;
  selectedDistrict: string;
  selectedUniversity: string;
  selectedMetro: string;
  maxPrice: number;
  roomsCount: number | null;
  onlyVerified: boolean;
  minTrustScore: number;
  sortBy: 'AI' | 'TRUST' | 'PRICE_LOW' | 'PRICE_HIGH' | 'NEWEST';
  audience: 'ALL' | 'STUDENT' | 'FAMILY';
  rentalType: 'ALL' | 'FULL' | 'ROOMMATE';
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<AppStore>) => void;
  resetFilters: () => void;

  reports: ReportItem[];
  fraudSignals: FraudSignal[];
  verifications: VerificationRequest[];
  addReport: (report: ReportItem) => void;
  addFraudSignal: (signal: FraudSignal) => void;
  resolveReport: (reportId: string, action: 'RESOLVED' | 'REJECTED') => void;
  updateVerification: (verificationId: string, status: 'APPROVED' | 'REJECTED') => void;
  refreshAdminData: () => Promise<void>;

  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  openChatWithListing: (listing: Listing) => void;
  sendMessage: (conversationId: string, text: string, extra?: { listingData?: any; imageUrl?: string }) => void;

  aiMascotMessage: string | null;
  setAiMascotMessage: (msg: string | null) => void;
  aiSystemActive: boolean;
  showAuth: boolean;
  authModalTab: 'LOGIN' | 'REGISTER';
  setShowAuth: (open: boolean, tab?: 'LOGIN' | 'REGISTER') => void;
}


export function dedupeListings(items: Listing[]): Listing[] {
  const map = new Map<string, Listing>();
  for (const item of items) {
    if (item && item.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

const getInitialUrlListingId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('listing') || urlParams.get('id') || window.location.hash.replace('#', '');
    return param ? param.trim() : null;
  } catch {
    return null;
  }
};

const initialListingId = getInitialUrlListingId();


export const useAppStore = create<AppStore>((set, get) => ({
  currency: 'USD',
  setCurrency: (c) => set({ currency: c }),
  themeMode: 'dark',
  toggleThemeMode: () => set((state) => {
    const nextMode = state.themeMode === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') {
      if (nextMode === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      }
    }
    return { themeMode: nextMode };
  }),
  currentView: initialListingId ? 'LISTING_DETAIL' : 'HOME',
  selectedListingId: initialListingId,
  setCurrentView: (view, listingId = null) => {
    const targetListingId = listingId ?? get().selectedListingId;
    set({ currentView: view, selectedListingId: targetListingId });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof window !== 'undefined') {
      try {
        if (view === 'LISTING_DETAIL' && targetListingId) {
          window.history.pushState({}, '', `/?listing=${targetListingId}`);
        } else if (view === 'HOME') {
          window.history.pushState({}, '', '/');
        }
      } catch (e) {}
    }
  },

  currentUser: null,   // Always null on start — initAuth() populates from backend
  currentRole: 'TENANT',


  initAuth: async () => {
    if (!getAccessToken()) return;
    try {
      // Always fetch fresh user data from backend — no localStorage cache
      const meData = await initAuthFromStorage();
      if (!meData) { clearTokens(); return; }

      const restoredUser: CurrentUser = {
        id: meData.id,
        name: meData.name || `${meData.first_name ?? ''} ${meData.last_name ?? ''}`.trim() || meData.email || 'Foydalanuvchi',
        phone: meData.phone || meData.email || '',
        role: (meData.role || 'STUDENT') as CurrentUser['role'],
        avatar: meData.avatar || meData.avatar_url,
      };
      set({ currentUser: restoredUser, currentRole: restoredUser.role });

      // Fetch owner's listings from backend
      if (restoredUser.role === 'OWNER') {
        try {
          const myListings = await ApiService.getMyListings();
          if (myListings.length > 0) {
            set((state) => {
              const base = state.listings.filter((l) => !myListings.some((m) => m.id === l.id));
              return { listings: [...myListings, ...base] };
            });
          }
        } catch { /* ignore */ }
      }
    } catch {
      clearTokens();
    }
  },

  login: (user) => {
    // Don't cache user in localStorage — backend is source of truth
    // Only tokens are kept in localStorage (handled by authService)
    set((state) => {
      return {
        currentUser: user,
        currentRole: user.role,
        currentView: 'HOME',
        showAuth: false,
        aiMascotMessage: user.role === 'OWNER'
          ? "Xush kelibsiz! Siz Admin panel va verificatsiya navbatiga kirdi."
          : "Xush kelibsiz. Endi kvartiralarni o'zingiz, maklersiz ko'rishingiz mumkin.",
      };
    });
  },

  logout: () => {
    clearTokens();
    ApiService.logout().catch(() => {});
    set({
      currentUser: null,
      currentRole: 'TENANT',
      currentView: 'HOME',
      aiMascotMessage: 'Siz chiqdingiz.',
    });
  },

  switchRole: (newRole) => set((state) => {
    if (!state.currentUser) return {};
    const updatedUser: CurrentUser = { ...state.currentUser, role: newRole };
    // Sync to backend
    ApiService.updateProfileAvatar(updatedUser.phone, updatedUser.avatar || '', updatedUser).catch(() => {});
    return {
      currentUser: updatedUser,
      currentRole: newRole,
      aiMascotMessage: newRole === 'OWNER'
        ? "Rol 'Uy Egasi' ga o'zgartirildi."
        : "Rol 'Talaba' ga o'zgartirildi.",
    };
  }),

  updateAvatar: (avatar) => set((state) => {
    if (!state.currentUser) return {};
    const currentUser = { ...state.currentUser, avatar };
    // Sync to backend
    ApiService.updateProfileAvatar(currentUser.phone, avatar, currentUser).catch(() => {});
    const listings = state.listings.map((l) =>
      l.owner.id === currentUser.id ? { ...l, owner: { ...l.owner, avatar } } : l
    );
    const conversations = state.conversations.map((c) =>
      c.ownerId === currentUser.id ? { ...c, ownerAvatar: avatar } : c
    );
    return { currentUser, listings, conversations };
  }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setCurrentRole: (role) => set({ currentRole: role }),

  userXp: 280,
  userBadges: ['Verified Phone', 'Early Adopter', 'Bronze Member'],
  addXp: (amount, reason) => set((state) => {
    set({ aiMascotMessage: `+${amount} XP. ${reason}` });
    return { userXp: state.userXp + amount };
  }),

  isAiSystemActive: true,
  setAiSystemActive: (isActive) => set({ isAiSystemActive: isActive, aiSystemActive: isActive }),

  listings: [],
  fetchListings: async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('maklersiz-extra-listings');
      }
      const { selectedDistrict, roomsCount, maxPrice, searchQuery } = get();
      const params: Record<string, any> = {};
      if (selectedDistrict && selectedDistrict !== 'Barchasi') params.district = selectedDistrict;
      if (roomsCount !== null) params.rooms = roomsCount;
      if (maxPrice && maxPrice < 100000000) params.maxPrice = maxPrice;
      if (searchQuery && searchQuery.trim()) params.search = searchQuery.trim();

      const publicListings = await ApiService.getListings(params);
      let finalData = Array.isArray(publicListings) ? publicListings : [];

      const { currentUser } = get();
      if (currentUser && currentUser.role === 'OWNER') {
        try {
          const myListings = await ApiService.getMyListings();
          if (Array.isArray(myListings) && myListings.length > 0) {
            const base = finalData.filter((l) => !myListings.some((m) => m.id === l.id));
            finalData = [...myListings, ...base];
          }
        } catch {}
      }

      set({ listings: finalData });
    } catch (e) {
      console.warn('Network error fetching listings:', e);
      set({ listings: [] });
    }
  },

  incrementListingStat: (listingId, stat) => set((state) => {
    const updatedListings = state.listings.map((l) => {
      if (l.id !== listingId) return l;
      const countField = stat === 'views' ? 'viewsCount' : stat === 'favorites' ? 'favoritesCount' : 'contactCount';
      return { ...l, [countField]: (l[countField] || 0) + 1 };
    });
    ApiService.recordListingStat(listingId, stat).then((remoteListing) => {
      if (!remoteListing) return;
      set((current) => ({
        listings: current.listings.map((listing) => listing.id === listingId ? { ...listing, ...remoteListing } : listing),
      }));
    }).catch(() => {});
    return { listings: updatedListings };
  }),

  editingListing: null,
  setEditingListing: (listing) => set({ editingListing: listing }),
  addListing: (newListing) => set((state) => {
    const listings = dedupeListings([newListing, ...state.listings]);
    return {
      listings,
      currentView: 'MY_LISTINGS',
      selectedRegion: 'Barchasi',
      selectedDistrict: 'Barchasi',
      selectedMetro: 'Barchasi',
      selectedUniversity: 'Barchasi',
      roomsCount: null,
      audience: 'ALL',
      rentalType: 'ALL',
      searchQuery: '',
      aiMascotMessage: "E'lon muvaffaqiyatli joylandi! Barcha qurilmalarda ko'rinarli bo'ldi.",
    };
  }),
  updateListing: (updatedListing) => set((state) => {
    const listings = dedupeListings(state.listings.map((l) => (l.id === updatedListing.id ? updatedListing : l)));
    return { listings, editingListing: null, aiMascotMessage: "E'lon muvaffaqiyatli tahrirlandi!" };
  }),
  removeListing: (listingId) => set((state) => {
    ApiService.deleteListing(listingId).catch(() => {});
    const listings = state.listings.filter((l) => l.id !== listingId);
    return { listings, aiMascotMessage: "E'lon o'chirildi." };
  }),
  clearAllExtraListings: () => set(() => {
    if (typeof window !== 'undefined') localStorage.removeItem('maklersiz-extra-listings');
    return { listings: [], aiMascotMessage: "Barcha e'lonlar tozalandi!" };
  }),

  favorites: [],
  toggleFavorite: (listingId) => set((state) => {
    const isFav = state.favorites.includes(listingId);
    
    // Also update the listing's local count
    const updatedListings = state.listings.map((l) => {
      if (l.id !== listingId) return l;
      return { 
        ...l, 
        favoritesCount: Math.max(0, (l.favoritesCount || 0) + (isFav ? -1 : 1)) 
      };
    });

    ApiService.recordListingStat(listingId, 'favorites', isFav ? -1 : 1).then((remoteListing) => {
      if (!remoteListing) return;
      set((current) => ({
        listings: current.listings.map((listing) => listing.id === listingId ? { ...listing, ...remoteListing } : listing),
      }));
    }).catch(() => {});

    return {
      listings: updatedListings,
      favorites: isFav
        ? state.favorites.filter((id) => id !== listingId)
        : [...state.favorites, listingId],
    };
  }),

  searchQuery: '',
  selectedRegion: 'Barchasi',
  selectedDistrict: 'Barchasi',
  selectedUniversity: 'Barchasi',
  selectedMetro: 'Barchasi',
  maxPrice: 10000000,
  roomsCount: null,
  onlyVerified: false,
  minTrustScore: 0,
  sortBy: 'AI',
  audience: 'ALL',
  rentalType: 'ALL',

  setSearchQuery: (query) => {
    set({ searchQuery: query, currentView: 'SEARCH' });
    get().fetchListings();
  },
  setFilters: (newFilters) => {
    set(newFilters);
    get().fetchListings();
  },
  resetFilters: () => {
    set({
      searchQuery: '',
      selectedRegion: 'Barchasi',
      selectedDistrict: 'Barchasi',
      selectedUniversity: 'Barchasi',
      selectedMetro: 'Barchasi',
      maxPrice: 10000000,
      roomsCount: null,
      onlyVerified: false,
      minTrustScore: 0,
      sortBy: 'AI',
      audience: 'ALL',
      rentalType: 'ALL',
    });
    get().fetchListings();
  },

  reports: MOCK_REPORTS,
  fraudSignals: MOCK_FRAUD_SIGNALS,
  verifications: MOCK_VERIFICATIONS,
  addReport: (report) => set((state) => ({ reports: [report, ...state.reports] })),
  addFraudSignal: (signal) => set((state) => ({ fraudSignals: [signal, ...state.fraudSignals] })),
  resolveReport: (reportId, status) => set((state) => ({
    reports: state.reports.map((r) => r.id === reportId ? { ...r, status } : r),
  })),
  updateVerification: (verificationId, status) => set((state) => ({
    verifications: state.verifications.map((v) => v.id === verificationId ? { ...v, status } : v),
  })),
  refreshAdminData: async () => {
    try {
      const apiListings = await ApiService.getListings();
      if (apiListings && apiListings.length > 0) {
        set({ listings: apiListings });
      }
    } catch {
      // Fallback ok
    }
  },

  activeConversationId: null,
  conversations: [],
  messages: {},

  openChatWithListing: (listing) => set((state) => {
    if (!state.currentUser) {
      return { showAuth: true };
    }
    const existing = state.conversations.find((c) => c.listingId === listing.id);
    if (existing) {
      return { activeConversationId: existing.id, currentView: 'CHAT' };
    }
    const newConvId = `conv-${Date.now()}`;
    const me = state.currentUser;
    const newConv: Conversation = {
      id: newConvId,
      listingId: listing.id,
      listingTitle: listing.title,
      listingPrice: listing.price,
      listingImage: listing.images[0],
      ownerId: listing.owner.id,
      ownerName: listing.owner.name,
      ownerAvatar: listing.owner.avatar,
      tenantId: me?.id || 'tenant_current',
      tenantName: me?.name || 'Siz',
      tenantAvatar: me?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300',
      lastMessage: `Assalomu alaykum! ${listing.title}`,
      lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unreadCount: 0,
    };
    const initialMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      conversationId: newConvId,
      senderId: me?.id || 'tenant_current',
      senderName: me?.name || 'Siz',
      senderRole: me?.role === 'OWNER' ? 'OWNER' : 'STUDENT',
      text: "Assalomu alaykum! Ushbu e'lon bo'yicha gaplashmoqchiman.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    return {
      conversations: [newConv, ...state.conversations],
      messages: { ...state.messages, [newConvId]: [initialMsg] },
      activeConversationId: newConvId,
      currentView: 'CHAT',
    };
  }),

  sendMessage: (convId, text, extra) => set((state) => {
    const isScamWord = /plastik|karta|oldindan|zaklad|kod|telegram|pul/i.test(text);
    const me = state.currentUser;
    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      conversationId: convId,
      senderId: me?.id || 'tenant_current',
      senderName: me?.name || 'Siz',
      senderRole: me?.role === 'OWNER' ? 'OWNER' : 'STUDENT',
      text,
      imageUrl: extra?.imageUrl,
      listingData: extra?.listingData,
      listingId: extra?.listingData?.id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSafetyWarning: isScamWord,
      warningText: isScamWord ? "Ogohlantirish: Ko'rmasdan kartaga pul o'tkazmang." : undefined,
    };
    const updatedMsgs = [...(state.messages[convId] || []), newMsg];
    const updatedConvs = state.conversations.map((c) => c.id === convId ? {
      ...c,
      lastMessage: extra?.listingData ? `🏠 E'lon: ${extra.listingData.title}` : text,
      lastMessageTime: newMsg.timestamp,
    } : c);
    return {
      messages: { ...state.messages, [convId]: updatedMsgs },
      conversations: updatedConvs,
    };
  }),

  aiMascotMessage: "Maklersiz.uz — kvartirani egasidan o'zingiz toping.",
  setAiMascotMessage: (msg) => set({ aiMascotMessage: msg }),
  aiSystemActive: true,
  showAuth: false,
  authModalTab: 'LOGIN',
  setShowAuth: (open, tab = 'LOGIN') => set({ showAuth: open, authModalTab: tab }),
}));
