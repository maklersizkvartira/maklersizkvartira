import { create } from 'zustand';
import { UserRole, Listing, ReportItem, VerificationRequest, ChatMessage, Conversation, CurrentUser, SignupRole, FraudSignal } from '../types';
import { MOCK_LISTINGS } from '../data/mockListings';
import { MOCK_OWNERS } from '../data/mockUsers';
import { MOCK_REPORTS, MOCK_VERIFICATIONS, MOCK_FRAUD_SIGNALS } from '../data/mockAdminData';
import { ApiService } from '../services/apiService';
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
    // Purge legacy extra listings from localStorage to eliminate flicker and duplicate state
    localStorage.removeItem(EXTRA_KEY);
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

      // Normalise backend response to CurrentUser shape
      const restoredUser: CurrentUser = {
        id: meData.id,
        name: meData.name ||
          `${meData.first_name ?? ''} ${meData.last_name ?? ''}`.trim() ||
          (meData.email ?? 'Foydalanuvchi'),
        phone: meData.phone ?? meData.email ?? '',
        role: (meData.role as CurrentUser['role']) ?? 'STUDENT',
        avatar: meData.avatar ?? meData.avatar_url,
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
  updateAvatar: (avatar) => set((state) => {
    if (!state.currentUser) return {};
    const currentUser = { ...state.currentUser, avatar };
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
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

  listings: [...extraListings, ...MOCK_LISTINGS],
  fetchListings: async () => {
    try {
      const publicListings = await ApiService.getListings();
      if (!Array.isArray(publicListings) || publicListings.length === 0) {
        // Do not clear state if network flickers or returns empty
        return;
      }
      set((state) => {
        const cleanPublic = publicListings.filter(
          (l) =>
            l.owner?.name !== 'Jasur Karimov' &&
            l.owner?.name !== 'Nodira Alimova' &&
            l.owner?.name !== 'Bekzod Rahimov'
        );

        const existingLocal = state.listings.filter(
          (l) =>
            !cleanPublic.some((r) => r.id === l.id) &&
            l.owner?.name !== 'Jasur Karimov' &&
            l.owner?.name !== 'Nodira Alimova' &&
            l.owner?.name !== 'Bekzod Rahimov'
        );

        // Auto-upload any local listings to Railway server asynchronously
        existingLocal.forEach((listing) => {
          if (listing.id.startsWith('listing-')) {
            ApiService.createListing(listing).catch(() => {});
          }
        });

        const merged = dedupeListings([...cleanPublic, ...existingLocal]);
        return { listings: merged };
      });
    } catch {
      /* Keep existing listings untouched during network glitch */
    }
  },
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
    return {
      listings,
      editingListing: null,
      aiMascotMessage: "E'lon muvaffaqiyatli tahrirlandi!",
    };
  }),
  removeListing: (listingId) => set((state) => {
    ApiService.deleteListing(listingId).catch(() => {});
    const listings = state.listings.filter((l) => l.id !== listingId);
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
    return {
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

  activeConversationId: 'conv-1',
  conversations: [
    {
      id: 'conv-1',
      listingId: 'listing-1',
      listingTitle: 'Oybek metrosi yaqinida shinam 2 xonali modern kvartira',
      listingPrice: 5500000,
      listingImage: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=70&w=600',
      ownerId: 'owner_jasur',
      ownerName: 'Jasur Karimov',
      ownerAvatar: MOCK_OWNERS.owner_jasur.avatar,
      tenantId: 'st-dilnoza',
      tenantName: 'Dilnoza Aliyeva',
      tenantAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      lastMessage: "Albatta, bemalol kelishingiz mumkin. Manzil: Oybek ko'chasi 24-uy.",
      lastMessageTime: '11:05',
      unreadCount: 1,
    },
    {
      id: 'conv-2',
      listingId: 'listing-sherik-1',
      listingTitle: '🤝 Yunusobod TATU qarshisida 2 ta talaba yigitga sherikchilikka o\'rin',
      listingPrice: 1200000,
      listingImage: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=70&w=600',
      ownerId: 'owner_nodira',
      ownerName: 'Nodira Alimova',
      ownerAvatar: MOCK_OWNERS.owner_nodira.avatar,
      tenantId: 'st-sardor',
      tenantName: 'Sardor Usmonov',
      tenantAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
      lastMessage: "Assalomu alaykum Sardorbek. Ha, 1 ta o'g'il bolaga o'rin bor.",
      lastMessageTime: '09:40',
      unreadCount: 0,
    },
    {
      id: 'conv-3',
      listingId: 'listing-3',
      listingTitle: 'Chilonzor 5-kvartal Metro Mirzo Ulug\'bek yaqinida shinam Studio',
      listingPrice: 3800000,
      listingImage: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&q=70&w=600',
      ownerId: 'owner_bekzod',
      ownerName: 'Bekzod Rahimov',
      ownerAvatar: MOCK_OWNERS.owner_bekzod.avatar,
      tenantId: 'st-madina',
      tenantName: 'Madina Karimova',
      tenantAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      lastMessage: 'Va alaykum assalom! Ha, Wi-Fi 100Mbps va kir yuvish mashinasi bor.',
      lastMessageTime: 'Kecha',
      unreadCount: 0,
    },
  ],
  messages: {
    'conv-1': [
      {
        id: 'm1',
        conversationId: 'conv-1',
        senderId: 'st-dilnoza',
        senderName: 'Dilnoza Aliyeva',
        senderRole: 'STUDENT',
        text: "Assalomu alaykum! Oybek metrosidagi 2 xonali kvartirangiz hali bo'shmi?",
        timestamp: '10:45',
      },
      {
        id: 'm2',
        conversationId: 'conv-1',
        senderId: 'owner_jasur',
        senderName: 'Jasur Karimov',
        senderRole: 'OWNER',
        text: "Va alaykum assalom! Ha, kvartira bo'sh. Hamma hujjatlari va sharoitlari taxt.",
        timestamp: '10:52',
      },
      {
        id: 'm3',
        conversationId: 'conv-1',
        senderId: 'st-dilnoza',
        senderName: 'Dilnoza Aliyeva',
        senderRole: 'STUDENT',
        text: "Kvartirani bugun soat 17:00 da ko'rsam bo'ladimi? Vestminster universiteti talabalarimiz, komissiyasiz egasidan ekanidan xursandmiz.",
        timestamp: '11:00',
      },
      {
        id: 'm4',
        conversationId: 'conv-1',
        senderId: 'owner_jasur',
        senderName: 'Jasur Karimov',
        senderRole: 'OWNER',
        text: "Albatta, bemalol kelishingiz mumkin. Manzil: Oybek ko'chasi 24-uy.",
        timestamp: '11:05',
      },
    ],
    'conv-2': [
      {
        id: 'c2m1',
        conversationId: 'conv-2',
        senderId: 'st-sardor',
        senderName: 'Sardor Usmonov',
        senderRole: 'STUDENT',
        text: "Assalomu alaykum Nodira opa! TATU ro'parasidagi sherikchilikka o'rin hali bormi?",
        timestamp: '09:30',
      },
      {
        id: 'c2m2',
        conversationId: 'conv-2',
        senderId: 'owner_nodira',
        senderName: 'Nodira Alimova',
        senderRole: 'OWNER',
        text: "Assalomu alaykum Sardorbek. Ha, 1 ta o'g'il bolaga o'rin bor. Kishi boshiga 1.2 mln so'm.",
        timestamp: '09:40',
      },
    ],
    'conv-3': [
      {
        id: 'c3m1',
        conversationId: 'conv-3',
        senderId: 'st-madina',
        senderName: 'Madina Karimova',
        senderRole: 'STUDENT',
        text: "Assalomu alaykum Bekzod aka! Studioda Wi-Fi va kir yuvish mashinasi bormi?",
        timestamp: '18:10',
      },
      {
        id: 'c3m2',
        conversationId: 'conv-3',
        senderId: 'owner_bekzod',
        senderName: 'Bekzod Rahimov',
        senderRole: 'OWNER',
        text: "Va alaykum assalom! Ha, Wi-Fi 100Mbps va kir yuvish mashinasi bor. 0% makler.",
        timestamp: '18:25',
      },
    ],
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
