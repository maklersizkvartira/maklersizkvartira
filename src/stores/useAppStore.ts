import { create } from 'zustand';
import { UserRole, Listing, ReportItem, VerificationRequest, ChatMessage, Conversation, CurrentUser, SignupRole, FraudSignal } from '../types';
import { MOCK_LISTINGS } from '../data/mockListings';
import { MOCK_OWNERS } from '../data/mockUsers';
import { MOCK_REPORTS, MOCK_VERIFICATIONS, MOCK_FRAUD_SIGNALS } from '../data/mockAdminData';
import { ApiService } from '../services/apiService';

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

function loadUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) as CurrentUser : null;
  } catch {
    return null;
  }
}

function loadExtraListings(): Listing[] {
  try {
    const raw = localStorage.getItem(EXTRA_KEY);
    return raw ? JSON.parse(raw) as Listing[] : [];
  } catch {
    return [];
  }
}

interface AppStore {
  currentView: ViewState;
  selectedListingId: string | null;
  setCurrentView: (view: ViewState, listingId?: string | null) => void;

  currentUser: CurrentUser | null;
  currentRole: UserRole;
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

export const useAppStore = create<AppStore>((set, get) => ({
  currency: 'USD',
  setCurrency: (c) => set({ currency: c }),
  currentView: savedUser?.role === 'OWNER' ? 'HOME' : 'HOME',
  selectedListingId: null,
  setCurrentView: (view, listingId = null) => {
    set({ currentView: view, selectedListingId: listingId ?? get().selectedListingId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  currentUser: savedUser,
  currentRole: savedUser?.role === 'OWNER' ? 'OWNER' : savedUser?.role === 'STUDENT' ? 'STUDENT' : 'TENANT',
  login: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({
      currentUser: user,
      currentRole: user.role,
      currentView: user.role === 'OWNER' ? 'HOME' : 'HOME',
      showAuth: false,
      aiMascotMessage: user.role === 'OWNER'
        ? "Xush kelibsiz. Endi e'lon joylashingiz va boshqarishingiz mumkin."
        : "Xush kelibsiz. Endi kvartiralarni o'zingiz, maklersiz ko'rishingiz mumkin.",
    });
  },
  logout: () => {
    localStorage.removeItem(USER_KEY);
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
      const remote = await ApiService.getListings();
      if (remote && remote.length > 0) {
        set((state) => {
          const extras = state.listings.filter((l) => l.id.startsWith('listing-') && !remote.some((r) => r.id === l.id));
          return { listings: [...extras, ...remote] };
        });
      }
    } catch { /* mock fallback */ }
  },
  editingListing: null,
  setEditingListing: (listing) => set({ editingListing: listing }),
  addListing: (newListing) => set((state) => {
    const listings = [newListing, ...state.listings];
    const extras = listings.filter((l) => l.id.startsWith('listing-') && !MOCK_LISTINGS.some((m) => m.id === l.id));
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extras));
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
      aiMascotMessage: "E'lon muvaffaqiyatli joylandi! Bosh sahifa va qidiruvda ham ko'rinarli bo'ldi.",
    };
  }),
  updateListing: (updatedListing) => set((state) => {
    const listings = state.listings.map((l) => (l.id === updatedListing.id ? updatedListing : l));
    const extras = listings.filter((l) => l.id.startsWith('listing-') && !MOCK_LISTINGS.some((m) => m.id === l.id));
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extras));
    return {
      listings,
      editingListing: null,
      aiMascotMessage: "E'lon muvaffaqiyatli tahrirlandi!",
    };
  }),
  removeListing: (listingId) => set((state) => {
    const listings = state.listings.filter((l) => l.id !== listingId);
    const extras = listings.filter((l) => l.id.startsWith('listing-') && !MOCK_LISTINGS.some((m) => m.id === l.id));
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extras));
    return { listings, aiMascotMessage: "E'lon o'chirildi." };
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
