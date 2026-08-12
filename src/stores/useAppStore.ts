import { create } from 'zustand';
import { UserRole, Listing, ReportItem, VerificationRequest, ChatMessage, Conversation } from '../types';
import { MOCK_LISTINGS } from '../data/mockListings';
import { MOCK_OWNERS } from '../data/mockUsers';
import { MOCK_REPORTS, MOCK_VERIFICATIONS } from '../data/mockAdminData';

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
  | 'FAVORITES';

interface AppStore {
  // Navigation & View
  currentView: ViewState;
  selectedListingId: string | null;
  setCurrentView: (view: ViewState, listingId?: string | null) => void;

  // Role & Auth
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  userXp: number;
  userBadges: string[];
  addXp: (amount: number, reason: string) => void;

  // Listings state
  listings: Listing[];
  addListing: (newListing: Listing) => void;

  // Favorites
  favorites: string[];
  toggleFavorite: (listingId: string) => void;

  // Search & Filter state
  searchQuery: string;
  selectedRegion: string;
  selectedDistrict: string;
  selectedUniversity: string;
  selectedMetro: string;
  maxPrice: number;
  roomsCount: number | null;
  onlyVerified: boolean;
  minTrustScore: number;
  sortBy: 'TRUST' | 'PRICE_LOW' | 'PRICE_HIGH' | 'NEWEST';
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<AppStore>) => void;
  resetFilters: () => void;

  // Admin Data state
  reports: ReportItem[];
  verifications: VerificationRequest[];
  resolveReport: (reportId: string, action: 'RESOLVED' | 'REJECTED') => void;
  updateVerification: (verificationId: string, status: 'APPROVED' | 'REJECTED') => void;

  // Chat state
  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  openChatWithListing: (listing: Listing) => void;
  sendMessage: (conversationId: string, text: string) => void;

  // Toast / Shield AI notifications
  aiMascotMessage: string | null;
  setAiMascotMessage: (msg: string | null) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentView: 'HOME',
  selectedListingId: null,
  setCurrentView: (view, listingId = null) => {
    set({ currentView: view, selectedListingId: listingId ?? get().selectedListingId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  currentRole: 'TENANT',
  setCurrentRole: (role) => set({ currentRole: role }),

  userXp: 280,
  userBadges: ['Verified Phone', 'Early Adopter', 'Bronze Member'],
  addXp: (amount, reason) => set((state) => {
    const newXp = state.userXp + amount;
    set({ aiMascotMessage: `🎉 +${amount} XP yig'ildi! Sabab: ${reason}` });
    return { userXp: newXp };
  }),

  listings: MOCK_LISTINGS,
  addListing: (newListing) => set((state) => ({
    listings: [newListing, ...state.listings],
    currentView: 'SEARCH',
    aiMascotMessage: '✨ Yangi e\'lon yaratildi! AI tekshiruvidan o\'tmoqda.',
  })),

  favorites: ['listing-1'],
  toggleFavorite: (listingId) => set((state) => {
    const isFav = state.favorites.includes(listingId);
    const updated = isFav 
      ? state.favorites.filter((id) => id !== listingId)
      : [...state.favorites, listingId];
    return { favorites: updated };
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
  sortBy: 'TRUST',

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
    sortBy: 'TRUST',
  }),

  reports: MOCK_REPORTS,
  verifications: MOCK_VERIFICATIONS,
  resolveReport: (reportId, status) => set((state) => ({
    reports: state.reports.map((r) => r.id === reportId ? { ...r, status } : r),
    aiMascotMessage: `Shikoyat statusi yangilandi: ${status}`,
  })),
  updateVerification: (verificationId, status) => set((state) => ({
    verifications: state.verifications.map((v) => v.id === verificationId ? { ...v, status } : v),
    aiMascotMessage: `Verification holati o'zgardi: ${status}`,
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
      ownerName: 'Jasur Karimov (Verified Owner)',
      ownerAvatar: MOCK_OWNERS.owner_jasur.avatar,
      tenantId: 'tenant_current',
      tenantName: 'Siz (Tenant)',
      tenantAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300',
      lastMessage: 'Assalomu alaykum! Erta kuni kvartirani ko\'rsam bo\'ladimi?',
      lastMessageTime: '10:42',
      unreadCount: 0,
    }
  ],
  messages: {
    'conv-1': [
      {
        id: 'm1',
        conversationId: 'conv-1',
        senderId: 'owner_jasur',
        senderName: 'Jasur Karimov',
        senderRole: 'OWNER',
        text: 'Assalomu alaykum! Xush kelibsiz. Kvartira bo\'sh, barcha hujjatlari tayyor.',
        timestamp: '10:30',
      },
      {
        id: 'm2',
        conversationId: 'conv-1',
        senderId: 'tenant_current',
        senderName: 'Siz',
        senderRole: 'TENANT',
        text: 'Assalomu alaykum! Erta kuni kvartirani ko\'rsam bo\'ladimi?',
        timestamp: '10:42',
      }
    ]
  },

  openChatWithListing: (listing) => set((state) => {
    const existing = state.conversations.find((c) => c.listingId === listing.id);
    if (existing) {
      return { activeConversationId: existing.id, currentView: 'CHAT' };
    }
    const newConvId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id: newConvId,
      listingId: listing.id,
      listingTitle: listing.title,
      listingPrice: listing.price,
      listingImage: listing.images[0],
      ownerId: listing.owner.id,
      ownerName: listing.owner.name,
      ownerAvatar: listing.owner.avatar,
      tenantId: 'tenant_current',
      tenantName: 'Siz (Tenant)',
      tenantAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300',
      lastMessage: `Assalomu alaykum! Ushbu kvartira bo'yicha bog'lanmoqdaman: ${listing.title}`,
      lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unreadCount: 0,
    };
    const initialMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      conversationId: newConvId,
      senderId: 'tenant_current',
      senderName: 'Siz',
      senderRole: 'TENANT',
      text: `Assalomu alaykum! Ushbu e'loningiz bo'yicha ma'lumot olmoqchiman.`,
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
    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      conversationId: convId,
      senderId: 'tenant_current',
      senderName: 'Siz',
      senderRole: state.currentRole,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSafetyWarning: isScamWord,
      warningText: isScamWord ? "⚠️ Shield AI Ogohlantirish: Shaxsiy pul o'tkazmalari yoki oldindan zaklad berishda ehtiyot bo'ling! Hech qachon ko'rmasdan pul yubormang." : undefined,
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

  aiMascotMessage: "Assalomu alaykum! Men Shield AI yordamchiman. Barcha e'lonlar xavfsizlik tekshiruvidan o'tadi! 🛡️",
  setAiMascotMessage: (msg) => set({ aiMascotMessage: msg }),
}));
