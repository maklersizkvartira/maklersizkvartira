import { Listing, VerificationRequest, ReportItem, ChatMessage, CurrentUser, SignupRole, UserRole } from '../types';
import { MOCK_LISTINGS } from '../data/mockListings';
import { MOCK_REPORTS, MOCK_VERIFICATIONS, MOCK_FRAUD_SIGNALS } from '../data/mockAdminData';
import { ListingScanResult, scanListingLocal } from './aiGuard';
import { scanListingDeep } from './aiEngine';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://maklersizkvartira-production.up.railway.app/api/v1';

const getHeaders = (token?: string) => {
  const authToken = token || localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(),
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
  // Auth API
  sendOtp: async (phone: string): Promise<{ status: string; message: string; otpId: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/otp/send`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Backend API connection fallback for sendOtp');
    }
    return {
      status: 'success',
      message: `SMS OTP code 1234 sent to ${phone}`,
      otpId: `otp-${Date.now()}`
    };
  },

  verifyOtp: async (phone: string, code: string): Promise<{ status: string; verified: boolean }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/otp/verify`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ phone, code }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Backend API connection fallback for verifyOtp');
    }
    return { status: 'success', verified: true };
  },

  login: async (phone: string, password?: string): Promise<CurrentUser> => {
    const remote = await postJson<{ status: string; user?: CurrentUser; access_token?: string; detail?: string }>(`/auth/login`, { phone, password: password || 'SecureDefault2026!' });
    if (remote?.access_token) {
      localStorage.setItem('access_token', remote.access_token);
    }
    if (remote?.user) return remote.user;
    return {
      id: `user-${Date.now()}`,
      name: phone,
      phone,
      role: 'STUDENT'
    };
  },

  register: async (nameOrPayload: any, phone?: string, role?: any, password?: string): Promise<CurrentUser> => {
    let payloadName = typeof nameOrPayload === 'string' ? nameOrPayload : `${nameOrPayload.first_name || ''} ${nameOrPayload.last_name || ''}`.trim();
    let payloadPhone = typeof nameOrPayload === 'string' ? (phone || '') : nameOrPayload.phone;
    let payloadRole = typeof nameOrPayload === 'string' ? (role || 'STUDENT') : nameOrPayload.role;
    let payloadPassword = typeof nameOrPayload === 'string' ? (password || 'SecureDefault2026!') : (nameOrPayload.password || 'SecureDefault2026!');

    const defaultAvatar = payloadRole === 'OWNER'
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300';

    const remote = await postJson<{ status: string; user?: CurrentUser; access_token?: string }>(`/auth/register`, {
      name: payloadName,
      phone: payloadPhone,
      role: payloadRole,
      password: payloadPassword,
      avatar: defaultAvatar
    });

    if (remote?.access_token) {
      localStorage.setItem('access_token', remote.access_token);
    }
    if (remote?.user) return remote.user;

    return {
      id: `user-${Date.now()}`,
      name: payloadName || 'Foydalanuvchi',
      phone: payloadPhone,
      role: payloadRole,
      avatar: defaultAvatar,
    };
  },

  loginGoogle: async (googleData: {
    email: string;
    name: string;
    avatar?: string | null;
    uid: string;
    idToken?: string;
  }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(googleData),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem('access_token', data.access_token);
        }
        return data;
      }
    } catch (e) {
      console.warn('Backend API connection fallback for loginGoogle');
    }
    return {
      access_token: `mock-google-token-${Date.now()}`,
      user_id: googleData.uid,
      first_name: googleData.name.split(' ')[0] || 'Google',
      last_name: googleData.name.split(' ')[1] || 'Foydalanuvchisi',
      role: 'STUDENT',
      trust_score: 30
    };
  },

  getMe: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Backend API connection fallback for getMe');
    }
    return null;
  },

  scanListing: async (titleOrDesc: string, descriptionOrImages?: any, price?: number, rooms?: number): Promise<ListingScanResult> => {
    const title = typeof descriptionOrImages === 'string' ? titleOrDesc : 'E\'lon';
    const description = typeof descriptionOrImages === 'string' ? descriptionOrImages : titleOrDesc;

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

  getListings: async (params?: Record<string, any>): Promise<Listing[]> => {
    try {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      const res = await fetch(`${API_BASE_URL}/listings${query}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) return json.data as Listing[];
      }
    } catch { /* mock fallback */ }
    return MOCK_LISTINGS;
  },

  getListingById: async (id: string): Promise<Listing | undefined> => {
    try {
      const res = await fetch(`${API_BASE_URL}/listings/${id}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data as Listing;
      }
    } catch { /* mock fallback */ }
    return MOCK_LISTINGS.find((l) => l.id === id);
  },

  createListing: async (listingData: Partial<Listing>): Promise<Listing> => {
    const remote = await postJson<{ status: string; data?: Listing; error?: string }>(`/listings`, listingData);
    if (remote?.data) return remote.data;
    return { ...MOCK_LISTINGS[0], ...listingData, id: `listing-${Date.now()}` } as Listing;
  },

  submitVerification: async (data?: any): Promise<{ success: boolean; xpEarned: number }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/verifications/submit`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          type: data?.type || 'PASSPORT',
          document_url: data?.documentUrl || null
        }),
      });
      if (res.ok) {
        return { success: true, xpEarned: 50 };
      }
    } catch (e) {
      console.warn('Backend API connection fallback for submitVerification');
    }
    return { success: true, xpEarned: 50 };
  },

  getVerificationQueue: async (): Promise<VerificationRequest[]> => MOCK_VERIFICATIONS,

  getFraudSignals: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/fraud`, {
        method: 'GET',
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        return json.signals;
      }
    } catch (e) {
      console.warn('Backend API connection fallback for getFraudSignals');
    }
    return MOCK_FRAUD_SIGNALS;
  },

  getReports: async (): Promise<ReportItem[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports`, {
        method: 'GET',
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        return json.reports;
      }
    } catch (e) {
      console.warn('Backend API connection fallback for getReports');
    }
    return MOCK_REPORTS;
  },

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

