import { Listing, VerificationRequest, ReportItem, ChatMessage, CurrentUser, SignupRole } from '../types';
import { MOCK_LISTINGS } from '../data/mockListings';
import { MOCK_REPORTS, MOCK_VERIFICATIONS, MOCK_FRAUD_SIGNALS } from '../data/mockAdminData';
import { ListingScanResult, scanListingLocal } from './aiGuard';
import { scanListingDeep } from './aiEngine';

export const API_BASE_URL = '/api/v1';

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return err ?? null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

export const ApiService = {
  register: async (name: string, phone: string, role: SignupRole): Promise<CurrentUser> => {
    const remote = await postJson<{ status: string; user?: CurrentUser }>(`/auth/register`, { name, phone, role });
    if (remote?.user) return remote.user;
    return {
      id: `user-${Date.now()}`,
      name,
      phone,
      role,
    };
  },

  scanListing: async (title: string, description: string, price?: number, rooms?: number): Promise<ListingScanResult> => {
    const remote = await postJson<{ status: string; aiAnalysis?: ListingScanResult & { aiCheckStatus?: string; allowed?: boolean } }>(
      `/ai/scan-listing`,
      { title, description, price, rooms }
    );
    if (remote?.aiAnalysis) {
      const a = remote.aiAnalysis;
      const allowed = a.allowed ?? (a.status === 'APPROVED' || a.aiCheckStatus === 'APPROVED');
      return {
        allowed,
        status: (a.status as ListingScanResult['status']) || (allowed ? 'APPROVED' : 'REJECTED'),
        trustScore: a.trustScore,
        riskScore: a.riskScore,
        brokerProbability: a.brokerProbability,
        reasons: a.reasons || [],
        message: a.message || (allowed
          ? "E'lon tekshiruvdan o'tdi."
          : "Bu e'lon makler yoki firibgar e'loniga o'xshaydi. Joylashtirilmadi."),
      };
    }
    return scanListingDeep(title, description, price, rooms);
  },

  getListings: async (): Promise<Listing[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/listings`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 1) return json.data as Listing[];
      }
    } catch { /* mock fallback */ }
    return MOCK_LISTINGS;
  },

  getListingById: async (id: string): Promise<Listing | undefined> => {
    return MOCK_LISTINGS.find((l) => l.id === id);
  },

  createListing: async (listingData: Partial<Listing>): Promise<Listing> => {
    const remote = await postJson<{ status: string; data?: Listing; error?: string }>(`/listings`, listingData);
    if (remote?.data) return remote.data;
    return { ...MOCK_LISTINGS[0], ...listingData, id: `listing-${Date.now()}` } as Listing;
  },

  submitVerification: async (): Promise<{ success: boolean; xpEarned: number }> => {
    return { success: true, xpEarned: 50 };
  },

  getVerificationQueue: async (): Promise<VerificationRequest[]> => MOCK_VERIFICATIONS,
  getFraudSignals: async () => MOCK_FRAUD_SIGNALS,
  getReports: async (): Promise<ReportItem[]> => MOCK_REPORTS,

  sendMessage: async (conversationId: string, text: string): Promise<ChatMessage> => ({
    id: `msg-${Date.now()}`,
    conversationId,
    senderId: 'tenant_current',
    senderName: 'Siz',
    senderRole: 'STUDENT',
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }),
};
