import { create } from 'zustand';
import { UserRole, Listing, ReportItem, VerificationRequest, ChatMessage, Conversation, CurrentUser, SignupRole, FraudSignal } from '../types';
import { MOCK_LISTINGS } from '../data/mockListings';
import { MOCK_OWNERS } from '../data/mockUsers';
import { MOCK_REPORTS, MOCK_VERIFICATIONS, MOCK_FRAUD_SIGNALS } from '../data/mockAdminData';
import { ApiService, matchPhone } from '../services/apiService';
import { clearTokens, getAccessToken, initAuthFromStorage } from '../services/authService';

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

const USER_KEY = 'maklersiz-user';
const EXTRA_KEY = 'maklersiz-extra-listings';
const VERIFICATIONS_KEY = 'maklersiz_verifications';
const REPORTS_KEY = 'maklersiz_reports';
const FRAUD_KEY = 'maklersiz_fraud_signals';

function loadUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) as CurrentUser : null;
  } catch {
    return null;
  }
}

export function dedupeListings(items: Listing[]): Listing[] {
  const map = new Map<string, Listing>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

function loadExtraListings(): Listing[] {
  try {
    const raw = localStorage.getItem(EXTRA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Listing[];
      if (Array.isArray(parsed)) {
        return dedupeListings(parsed);
      }
    }
  } catch {}
  return [];
}

function loadVerifications(): VerificationRequest[] {
  try {
    const raw = localStorage.getItem(VERIFICATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as VerificationRequest[];
      if (parsed && parsed.length > 0) return parsed;
    }
  } catch {}
  return MOCK_VERIFICATIONS;
}

function loadReports(): ReportItem[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ReportItem[];
      if (parsed && parsed.length > 0) return parsed;
    }
  } catch {}
  return MOCK_REPORTS;
}

function loadFraudSignals(): FraudSignal[] {
  try {
    const raw = localStorage.getItem(FRAUD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FraudSignal[];
      if (parsed && parsed.length > 0) return parsed;
    }
  } catch {}
  return MOCK_FRAUD_SIGNALS;
}

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

  currency: 'USD' | 'UZS';
  setCurrency: (c: 'USD' | 'UZS') => void;
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
  showAuth: boolean;
  authModalTab: 'LOGIN' | 'REGISTER';
  setShowAuth: (open: boolean, tab?: 'LOGIN' | 'REGISTER') => void;
}

const savedUser = typeof window !== 'undefined' ? loadUser() : null;
const extraListings = typeof window !== 'undefined' ? loadExtraListings() : [];

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
  currentView: initialListingId ? 'LISTING_DETAIL' : (savedUser?.role === 'OWNER' ? 'HOME' : 'HOME'),
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

  currentUser: savedUser,
  currentRole: savedUser?.role === 'OWNER' ? 'OWNER' : savedUser?.role === 'STUDENT' ? 'STUDENT' : 'TENANT',

  initAuth: async () => {
    // If no token exists, nothing to restore
    if (!getAccessToken()) return;
    try {
      const meData = await initAuthFromStorage();
      if (!meData) return; // Token invalid or expired

      const localSaved = loadUser();
      const restoredUser: CurrentUser = {
        id: localSaved?.id || meData.id,
        name: (localSaved?.name && localSaved.name !== 'Foydalanuvchi')
          ? localSaved.name
          : (meData.name || `${meData.first_name ?? ''} ${meData.last_name ?? ''}`.trim() || meData.email || 'Foydalanuvchi'),
        phone: localSaved?.phone || meData.phone || meData.email || '',
        role: (localSaved?.role || meData.role || 'STUDENT') as CurrentUser['role'],
        avatar: (localSaved?.avatar && !localSaved.avatar.includes('unsplash.com'))
          ? localSaved.avatar
          : (meData.avatar || meData.avatar_url || localSaved?.avatar),
      };
      localStorage.setItem(USER_KEY, JSON.stringify(restoredUser));
      set({
        currentUser: restoredUser,
        currentRole: restoredUser.role,
      });

      // Also refresh the user's own listings if they're an owner
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
      // Session expired — clean up
      clearTokens();
    }
  },

  login: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    try {
      const localUsersRaw = localStorage.getItem('maklersiz_registered_users');
      const usersArr = localUsersRaw ? JSON.parse(localUsersRaw) : [];
      const filtered = usersArr.filter((u) => !matchPhone(u.phone, user.phone) && u.id !== user.id);
      filtered.push(user);
      localStorage.setItem('maklersiz_registered_users', JSON.stringify(filtered));
    } catch {}
    set((state) => {
      let verifications = [...state.verifications];
      const exists = verifications.some((v) => (v.userPhone && v.userPhone === user.phone) || (v.userId && v.userId === user.id));
      if (!exists) {
        const newVerif: VerificationRequest = {
          id: `verif-${Date.now()}`,
          userId: user.id,
          userName: user.name,
          userPhone: user.phone,
          targetLevel: user.role === 'OWNER' ? 3 : 2,
          documentType: 'PASSPORT',
          status: 'PENDING',
          submittedAt: "Hozirgina (Yangi ro'yxatdan o'tgan)",
        };
        verifications = [newVerif, ...verifications];
        localStorage.setItem(VERIFICATIONS_KEY, JSON.stringify(verifications));
      }
      return {
        currentUser: user,
        currentRole: user.role,
        verifications,
        currentView: 'HOME',
        showAuth: false,
        aiMascotMessage: user.role === 'OWNER'
          ? "Xush kelibsiz! Siz Admin panel va verificatsiya navbatida ro'yxatga olindingiz."
          : "Xush kelibsiz. Endi kvartiralarni o'zingiz, maklersiz ko'rishingiz mumkin.",
      };
    });
  },

  logout: () => {
    localStorage.removeItem(USER_KEY);
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
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    try {
      const localUsersRaw = localStorage.getItem('maklersiz_registered_users');
      const usersArr = localUsersRaw ? JSON.parse(localUsersRaw) : [];
      const updated = usersArr.map((u: any) =>
        u.id === updatedUser.id || (u.phone && updatedUser.phone && u.phone.replace(/\D/g, '') === updatedUser.phone.replace(/\D/g, ''))
          ? updatedUser
          : u
      );
      localStorage.setItem('maklersiz_registered_users', JSON.stringify(updated));
    } catch {}

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
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));

    // Also update registered users storage so logging back in preserves the new avatar
    try {
      const localUsersRaw = localStorage.getItem('maklersiz_registered_users');
      const usersArr = localUsersRaw ? JSON.parse(localUsersRaw) : [];
      const updated = usersArr.map((u) => (matchPhone(u.phone, currentUser.phone) || u.id === currentUser.id ? currentUser : u));
      if (!updated.some((u) => u.id === currentUser.id)) {
        updated.push(currentUser);
      }
      localStorage.setItem('maklersiz_registered_users', JSON.stringify(updated));
    } catch {}

    ApiService.updateProfileAvatar(currentUser.phone, avatar, currentUser).catch(() => {});

    const listings = state.listings.map((l) =>
      l.owner.id === currentUser.id ? { ...l, owner: { ...l.owner, avatar } } : l
    );
    const extras = listings.filter((l) => l.id.startsWith('listing-') && !MOCK_LISTINGS.some((m) => m.id === l.id));
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extras));
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

  listings: [],
  fetchListings: async () => {
    try {
      // Clear legacy local mock data to prevent ghost listings
      if (typeof window !== 'undefined') {
        localStorage.removeItem('maklersiz-extra-listings');
      }
      const publicListings = await ApiService.getListings();
      if (Array.isArray(publicListings)) {
        set({ listings: publicListings });
      } else {
        set({ listings: [] });
      }
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
    return { listings: updatedListings };
  }),

  editingListing: null,
  setEditingListing: (listing) => set({ editingListing: listing }),
  addListing: (newListing) => set((state) => {
    const listings = dedupeListings([newListing, ...state.listings]);
    localStorage.setItem(EXTRA_KEY, JSON.stringify(listings));
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
    localStorage.setItem(EXTRA_KEY, JSON.stringify(listings));
    return {
      listings,
      editingListing: null,
      aiMascotMessage: "E'lon muvaffaqiyatli tahrirlandi!",
    };
  }),
  removeListing: (listingId) => set((state) => {
    ApiService.deleteListing(listingId).catch(() => {});
    const listings = state.listings.filter((l) => l.id !== listingId);
    localStorage.setItem(EXTRA_KEY, JSON.stringify(listings));
    const extras = listings.filter((l) => l.id.startsWith('listing-') && !MOCK_LISTINGS.some((m) => m.id === l.id));
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extras));
    return { listings, aiMascotMessage: "E'lon o'chirildi." };
  }),
  clearAllExtraListings: () => set(() => {
    localStorage.removeItem(EXTRA_KEY);
    return {
      listings: [],
      aiMascotMessage: "Barcha kiritilgan e'lonlar va kesh ma'lumotlari tozalab yuborildi!",
    };
  }),

  favorites: ['listing-1'],
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

  setSearchQuery: (query) => set({ searchQuery: query, currentView: 'SEARCH' }),
  setFilters: (newFilters) => set(newFilters),
  resetFilters: () => set({
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
  }),

  reports: typeof window !== 'undefined' ? loadReports() : MOCK_REPORTS,
  fraudSignals: typeof window !== 'undefined' ? loadFraudSignals() : MOCK_FRAUD_SIGNALS,
  verifications: typeof window !== 'undefined' ? loadVerifications() : MOCK_VERIFICATIONS,
  addReport: (report) => set((state) => {
    const reports = [report, ...state.reports];
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    return { reports };
  }),
  addFraudSignal: (signal) => set((state) => {
    const fraudSignals = [signal, ...state.fraudSignals];
    localStorage.setItem(FRAUD_KEY, JSON.stringify(fraudSignals));
    return { fraudSignals };
  }),
  resolveReport: (reportId, status) => set((state) => {
    const reports = state.reports.map((r) => r.id === reportId ? { ...r, status } : r);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    return { reports };
  }),
  updateVerification: (verificationId, status) => set((state) => {
    const verifications = state.verifications.map((v) => v.id === verificationId ? { ...v, status } : v);
    localStorage.setItem(VERIFICATIONS_KEY, JSON.stringify(verifications));
    return { verifications };
  }),
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
  conversations: [
    {
      id: 'mock-conv-1',
      listingId: 'listing-1',
      listingTitle: 'Chilonzor 3-xona, Metro yonida',
      listingPrice: 400,
      listingImage: 'https://images.unsplash.com/photo-1502672260266-1c1de2d96674?auto=format&fit=crop&q=80&w=600',
      ownerId: 'owner-1',
      ownerName: 'Vosilhoja',
      ownerAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=300',
      tenantId: 'tenant-999',
      tenantName: 'Azizbek',
      tenantAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300',
      lastMessage: "Assalomu alaykum, uy hali bo'shmi?",
      lastMessageTime: '14:30',
      unreadCount: 1,
    }
  ],
  messages: {
    'mock-conv-1': [
      {
        id: 'mock-msg-1',
        conversationId: 'mock-conv-1',
        senderId: 'tenant-999',
        senderName: 'Azizbek',
        senderRole: 'STUDENT',
        text: "Assalomu alaykum, uy hali bo'shmi?",
        timestamp: '14:30',
      }
    ]
  },

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
  showAuth: false,
  authModalTab: 'LOGIN',
  setShowAuth: (open, tab = 'LOGIN') => set({ showAuth: open, authModalTab: tab }),
}));
