import { create } from 'zustand';
import { UserRole, Listing, ReportItem, VerificationRequest, ChatMessage, Conversation, CurrentUser, SignupRole } from '../types';
import { MOCK_LISTINGS } from '../data/mockListings';
import { MOCK_OWNERS } from '../data/mockUsers';
import { MOCK_REPORTS, MOCK_VERIFICATIONS } from '../data/mockAdminData';
import { ApiService } from '../services/apiService';

export type ViewState =
  | 'HOME'
  | 'SEARCH'
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

  listings: Listing[];
  fetchListings: () => Promise<void>;
  addListing: (newListing: Listing) => void;
  removeListing: (listingId: string) => void;

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
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<AppStore>) => void;
  resetFilters: () => void;

  reports: ReportItem[];
  verifications: VerificationRequest[];
  resolveReport: (reportId: string, action: 'RESOLVED' | 'REJECTED') => void;
  updateVerification: (verificationId: string, status: 'APPROVED' | 'REJECTED') => void;

  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  openChatWithListing: (listing: Listing) => void;
  sendMessage: (conversationId: string, text: string) => void;

  aiMascotMessage: string | null;
  setAiMascotMessage: (msg: string | null) => void;
  showAuth: boolean;
  setShowAuth: (open: boolean) => void;
}

const savedUser = typeof window !== 'undefined' ? loadUser() : null;
const extraListings = typeof window !== 'undefined' ? loadExtraListings() : [];

export const useAppStore = create<AppStore>((set, get) => ({
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
  addListing: (newListing) => set((state) => {
    const listings = [newListing, ...state.listings];
    const extras = listings.filter((l) => l.id.startsWith('listing-') && !MOCK_LISTINGS.some((m) => m.id === l.id));
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extras));
    return {
      listings,
      currentView: 'MY_LISTINGS',
      aiMascotMessage: "E'lon joylandi. Odamlar endi ko'ra oladi.",
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
  }),

  reports: MOCK_REPORTS,
  verifications: MOCK_VERIFICATIONS,
  resolveReport: (reportId, status) => set((state) => ({
    reports: state.reports.map((r) => r.id === reportId ? { ...r, status } : r),
  })),
  updateVerification: (verificationId, status) => set((state) => ({
    verifications: state.verifications.map((v) => v.id === verificationId ? { ...v, status } : v),
  })),

  activeConversationId: 'conv-1',
  conversations: [
    {
      id: 'conv-1',
      listingId: 'listing-1',
      listingTitle: 'Oybek metrosi yaqinida shinam 2 xonali modern kvartira',
      listingPrice: 5500000,
      listingImage: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=300',
      ownerId: 'owner_jasur',
      ownerName: 'Jasur Karimov',
      ownerAvatar: MOCK_OWNERS.owner_jasur.avatar,
      tenantId: 'st-dilnoza',
      tenantName: 'Dilnoza Aliyeva',
      tenantAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      lastMessage: "Erta kuni kvartirani ko'rsam bo'ladimi?",
      lastMessageTime: '10:42',
      unreadCount: 2,
    },
    {
      id: 'conv-2',
      listingId: 'listing-1',
      listingTitle: 'Oybek metrosi yaqinida shinam 2 xonali modern kvartira',
      listingPrice: 5500000,
      listingImage: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=300',
      ownerId: 'owner_jasur',
      ownerName: 'Jasur Karimov',
      ownerAvatar: MOCK_OWNERS.owner_jasur.avatar,
      tenantId: 'st-sardor',
      tenantName: 'Sardor Usmonov',
      tenantAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
      lastMessage: 'Narxida tushib berolasizmi?',
      lastMessageTime: '09:15',
      unreadCount: 1,
    },
    {
      id: 'conv-3',
      listingId: 'listing-2',
      listingTitle: 'Yunusobodda talabalar uchun kvartira',
      listingPrice: 4000000,
      listingImage: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=300',
      ownerId: 'owner_nodira',
      ownerName: 'Nodira Alimova',
      ownerAvatar: MOCK_OWNERS.owner_nodira.avatar,
      tenantId: 'st-madina',
      tenantName: 'Madina Karimova',
      tenantAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      lastMessage: 'Kommunal kiritilganmi?',
      lastMessageTime: 'Kecha',
      unreadCount: 0,
    },
    {
      id: 'conv-4',
      listingId: 'listing-1',
      listingTitle: 'Oybek metrosi yaqinida shinam 2 xonali modern kvartira',
      listingPrice: 5500000,
      listingImage: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=300',
      ownerId: 'owner_jasur',
      ownerName: 'Jasur Karimov',
      ownerAvatar: MOCK_OWNERS.owner_jasur.avatar,
      tenantId: 'st-javlon',
      tenantName: 'Javlon Rahimov',
      tenantAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      lastMessage: 'Bugun 18:00 da kelishim mumkin.',
      lastMessageTime: 'Kecha',
      unreadCount: 0,
    },
    {
      id: 'conv-5',
      listingId: 'listing-3',
      listingTitle: 'Chilonzorda 3 xonali oilaviy uy',
      listingPrice: 7000000,
      listingImage: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=300',
      ownerId: 'owner_bekzod',
      ownerName: 'Bekzod Rahimov',
      ownerAvatar: MOCK_OWNERS.owner_bekzod.avatar,
      tenantId: 'st-nigora',
      tenantName: 'Nigora Toshpulatova',
      tenantAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200',
      lastMessage: 'Rasmlardagi mebel qoladimi?',
      lastMessageTime: 'Dush',
      unreadCount: 3,
    },
    {
      id: 'conv-6',
      listingId: 'listing-2',
      listingTitle: 'Yunusobodda talabalar uchun kvartira',
      listingPrice: 4000000,
      listingImage: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=300',
      ownerId: 'owner_nodira',
      ownerName: 'Nodira Alimova',
      ownerAvatar: MOCK_OWNERS.owner_nodira.avatar,
      tenantId: 'st-aziz',
      tenantName: 'Azizbek Ergashev',
      tenantAvatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=200',
      lastMessage: 'Talabalarga beriladimi?',
      lastMessageTime: 'Dush',
      unreadCount: 0,
    },
  ],
  messages: {
    'conv-1': [
      {
        id: 'm1',
        conversationId: 'conv-1',
        senderId: 'owner_jasur',
        senderName: 'Jasur Karimov',
        senderRole: 'OWNER',
        text: "Assalomu alaykum! Kvartira bo'sh, hujjatlari tayyor.",
        timestamp: '10:30',
      },
      {
        id: 'm2',
        conversationId: 'conv-1',
        senderId: 'st-dilnoza',
        senderName: 'Dilnoza Aliyeva',
        senderRole: 'STUDENT',
        text: "Assalomu alaykum! Erta kuni kvartirani ko'rsam bo'ladimi?",
        timestamp: '10:42',
      }
    ],
    'conv-2': [
      { id: 'c2m1', conversationId: 'conv-2', senderId: 'st-sardor', senderName: 'Sardor Usmonov', senderRole: 'STUDENT', text: 'Assalomu alaykum, narxida tushib berolasizmi?', timestamp: '09:15' },
    ],
    'conv-3': [
      { id: 'c3m1', conversationId: 'conv-3', senderId: 'st-madina', senderName: 'Madina Karimova', senderRole: 'STUDENT', text: 'Kommunal kiritilganmi?', timestamp: 'Kecha' },
    ],
    'conv-4': [
      { id: 'c4m1', conversationId: 'conv-4', senderId: 'st-javlon', senderName: 'Javlon Rahimov', senderRole: 'STUDENT', text: 'Bugun 18:00 da kelishim mumkin.', timestamp: 'Kecha' },
    ],
    'conv-5': [
      { id: 'c5m1', conversationId: 'conv-5', senderId: 'st-nigora', senderName: 'Nigora Toshpulatova', senderRole: 'STUDENT', text: "Rasmlardagi mebel qoladimi?", timestamp: 'Dush' },
    ],
    'conv-6': [
      { id: 'c6m1', conversationId: 'conv-6', senderId: 'st-aziz', senderName: 'Azizbek Ergashev', senderRole: 'STUDENT', text: 'Talabalarga beriladimi?', timestamp: 'Dush' },
    ],
  },

  openChatWithListing: (listing) => set((state) => {
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

  sendMessage: (convId, text) => set((state) => {
    const isScamWord = /plastik|karta|oldindan|zaklad|kod|telegram|pul/i.test(text);
    const me = state.currentUser;
    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      conversationId: convId,
      senderId: me?.id || 'tenant_current',
      senderName: me?.name || 'Siz',
      senderRole: me?.role === 'OWNER' ? 'OWNER' : 'STUDENT',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSafetyWarning: isScamWord,
      warningText: isScamWord ? "Ogohlantirish: Ko'rmasdan kartaga pul o'tkazmang." : undefined,
    };
    const updatedMsgs = [...(state.messages[convId] || []), newMsg];
    const updatedConvs = state.conversations.map((c) => c.id === convId ? {
      ...c,
      lastMessage: text,
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
  setShowAuth: (open) => set({ showAuth: open }),
}));
