import { Listing, VerificationRequest, ReportItem, ChatMessage, CurrentUser } from '../types';
import { MOCK_LISTINGS } from '../data/mockListings';
import { MOCK_REPORTS, MOCK_VERIFICATIONS, MOCK_FRAUD_SIGNALS } from '../data/mockAdminData';
import { ListingScanResult, scanListingLocal } from './aiGuard';
import { scanListingDeep } from './aiEngine';
import {
  API_BASE,
  saveTokens,
  clearTokens,
  fetchWithAuth,
  postJsonAuth,
  getJsonAuth,
  MeResponse,
} from './authService';

// Re-export so existing code that imports API_BASE_URL from here still works
export const API_BASE_URL = API_BASE;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const ApiService = {
  // ── OTP ──────────────────────────────────────────────────────────────────────
  sendOtp: async (phone: string): Promise<{ status: string; message: string; otpId: string }> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/auth/otp/send`, {
        method: 'POST',
        body: JSON.stringify({ phone }),
        skipAuth: true,
      });
      if (res?.ok) return await res.json();
    } catch {
      console.warn('sendOtp: backend unavailable, using mock');
    }
    return { status: 'success', message: `SMS OTP code 1234 sent to ${phone}`, otpId: `otp-${Date.now()}` };
  },

  verifyOtp: async (phone: string, code: string): Promise<{ status: string; verified: boolean }> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/auth/otp/verify`, {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
        skipAuth: true,
      });
      if (res?.ok) return await res.json();
    } catch {
      console.warn('verifyOtp: backend unavailable');
    }
    return { status: 'success', verified: true };
  },

  // ── Login / Register ──────────────────────────────────────────────────────────
  login: async (phone: string, password?: string): Promise<CurrentUser> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ phone, password: password || 'SecureDefault2026!' }),
        skipAuth: true,
      });
      if (res?.ok) {
        const data = await res.json();
        if (data.access_token) saveTokens(data.access_token, data.refresh_token);
        if (data.user) return data.user as CurrentUser;
        // Flat response format
        if (data.id) return data as CurrentUser;
      }
    } catch {
      console.warn('login: backend unavailable');
    }
    return { id: `user-${Date.now()}`, name: phone, phone, role: 'STUDENT' };
  },

  register: async (nameOrPayload: any, phone?: string, role?: any, password?: string): Promise<CurrentUser> => {
    const payloadName =
      typeof nameOrPayload === 'string'
        ? nameOrPayload
        : `${nameOrPayload.first_name || ''} ${nameOrPayload.last_name || ''}`.trim();
    const payloadPhone = typeof nameOrPayload === 'string' ? (phone || '') : nameOrPayload.phone;
    const payloadRole = typeof nameOrPayload === 'string' ? (role || 'STUDENT') : nameOrPayload.role;
    const payloadPassword =
      typeof nameOrPayload === 'string'
        ? (password || 'SecureDefault2026!')
        : (nameOrPayload.password || 'SecureDefault2026!');

    const defaultAvatar =
      payloadRole === 'OWNER'
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300';

    try {
      const res = await fetchWithAuth(`${API_BASE}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({
          name: payloadName,
          phone: payloadPhone,
          role: payloadRole,
          password: payloadPassword,
          avatar: defaultAvatar,
        }),
        skipAuth: true,
      });
      if (res?.ok) {
        const data = await res.json();
        if (data.access_token) saveTokens(data.access_token, data.refresh_token);
        if (data.user) return data.user as CurrentUser;
        if (data.id) return data as CurrentUser;
      }
    } catch {
      console.warn('register: backend unavailable');
    }

    return {
      id: `user-${Date.now()}`,
      name: payloadName || 'Foydalanuvchi',
      phone: payloadPhone,
      role: payloadRole,
      avatar: defaultAvatar,
    };
  },

  // ── Google Auth ───────────────────────────────────────────────────────────────
  loginGoogle: async (googleData: {
    email: string;
    name: string;
    avatar?: string | null;
    uid: string;
    idToken?: string;
  }): Promise<{
    access_token?: string;
    refresh_token?: string;
    user?: CurrentUser;
    // Flat legacy format fallback
    user_id?: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    trust_score?: number;
  } | null> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/auth/google`, {
        method: 'POST',
        body: JSON.stringify(googleData),
        skipAuth: true,
      });
      if (res?.ok) {
        const data = await res.json();
        if (data.access_token) {
          saveTokens(data.access_token, data.refresh_token ?? null);
        }
        return data;
      }
    } catch {
      console.warn('loginGoogle: backend unavailable, using offline fallback');
    }
    // Offline fallback — still saves a mock token so /me can be tried later
    return null;
  },

  // ── /me ───────────────────────────────────────────────────────────────────────
  getMe: async (): Promise<MeResponse | null> => {
    return getJsonAuth<MeResponse>('/auth/me');
  },

  // ── Logout ────────────────────────────────────────────────────────────────────
  logout: async (): Promise<void> => {
    try {
      await fetchWithAuth(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch { /* ignore */ }
    clearTokens();
  },

  // ─── AI Scan ──────────────────────────────────────────────────────────────────
  scanListing: async (
    titleOrDesc: string,
    descriptionOrImages?: any,
    price?: number,
    rooms?: number
  ): Promise<ListingScanResult> => {
    const title = typeof descriptionOrImages === 'string' ? titleOrDesc : "E'lon";
    const description = typeof descriptionOrImages === 'string' ? descriptionOrImages : titleOrDesc;

    try {
      const res = await fetchWithAuth(`${API_BASE}/ai/scan-listing`, {
        method: 'POST',
        body: JSON.stringify({ title, description, price, rooms }),
      });
      if (res?.ok) {
        const remote = await res.json();
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
            message: a.message || (allowed ? "E'lon tekshiruvdan o'tdi." : "Bu e'lon makler yoki firibgar e'loniga o'xshaydi."),
          };
        }
      }
    } catch { /* fallback */ }
    return scanListingDeep(title, description, price, rooms);
  },

  // ─── Listings ─────────────────────────────────────────────────────────────────
  getListings: async (params?: Record<string, any>): Promise<Listing[]> => {
    try {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      const res = await fetchWithAuth(`${API_BASE}/listings${query}`);
      if (res?.ok) {
        const json = await res.json();
        const data = json.data ?? json.listings ?? json;
        if (Array.isArray(data) && data.length > 0) return data as Listing[];
      }
    } catch { /* mock fallback */ }
    return MOCK_LISTINGS;
  },

  /** Get listings owned by the currently logged-in user */
  getMyListings: async (): Promise<Listing[]> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/listings/my`);
      if (res?.ok) {
        const json = await res.json();
        const data = json.data ?? json.listings ?? json;
        if (Array.isArray(data)) return data as Listing[];
      }
    } catch { /* fallback */ }
    return [];
  },

  getListingById: async (id: string): Promise<Listing | undefined> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/listings/${id}`);
      if (res?.ok) {
        const json = await res.json();
        if (json.data) return json.data as Listing;
        if (json.id) return json as Listing;
      }
    } catch { /* mock fallback */ }
    return MOCK_LISTINGS.find((l) => l.id === id);
  },

  createListing: async (listingData: Partial<Listing>): Promise<Listing> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/listings`, {
        method: 'POST',
        body: JSON.stringify(listingData),
      });
      if (res?.ok) {
        const json = await res.json();
        if (json.data) return json.data as Listing;
        if (json.id) return json as Listing;
      }
    } catch { /* fallback */ }
    // Offline fallback with local ID so it still renders
    return { ...MOCK_LISTINGS[0], ...listingData, id: `listing-${Date.now()}` } as Listing;
  },

  updateListing: async (id: string, listingData: Partial<Listing>): Promise<Listing | null> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/listings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(listingData),
      });
      if (res?.ok) {
        const json = await res.json();
        return (json.data ?? json) as Listing;
      }
    } catch { /* fallback */ }
    return null;
  },

  deleteListing: async (id: string): Promise<boolean> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/listings/${id}`, { method: 'DELETE' });
      return res?.ok ?? false;
    } catch {
      return false;
    }
  },

  // ─── Verification ─────────────────────────────────────────────────────────────
  submitVerification: async (data?: any): Promise<{ success: boolean; xpEarned: number }> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/verifications/submit`, {
        method: 'POST',
        body: JSON.stringify({
          type: data?.type || 'PASSPORT',
          document_url: data?.documentUrl || null,
        }),
      });
      if (res?.ok) return { success: true, xpEarned: 50 };
    } catch { /* fallback */ }
    return { success: true, xpEarned: 50 };
  },

  getVerificationQueue: async (): Promise<VerificationRequest[]> => MOCK_VERIFICATIONS,

  // ─── Admin ────────────────────────────────────────────────────────────────────
  getFraudSignals: async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/fraud`);
      if (res?.ok) {
        const json = await res.json();
        return json.signals ?? json;
      }
    } catch { /* fallback */ }
    return MOCK_FRAUD_SIGNALS;
  },

  getReports: async (): Promise<ReportItem[]> => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/reports`);
      if (res?.ok) {
        const json = await res.json();
        return json.reports ?? json;
      }
    } catch { /* fallback */ }
    return MOCK_REPORTS;
  },

  // ─── Chat ─────────────────────────────────────────────────────────────────────
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
