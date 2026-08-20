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

// Phone number normalization helper: matches numbers by digits or last 9 digits (Uzbekistan suffix)
export function matchPhone(p1?: string | null, p2?: string | null): boolean {
  if (!p1 || !p2) return false;
  const d1 = String(p1).replace(/\D/g, '');
  const d2 = String(p2).replace(/\D/g, '');
  if (!d1 || !d2) return false;
  if (d1 === d2) return true;
  if (d1.length >= 9 && d2.length >= 9 && d1.slice(-9) === d2.slice(-9)) {
    return true;
  }
  return false;
}

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
    // Check local registered users list first to preserve custom avatar/data/role
    const localUsersRaw = localStorage.getItem('maklersiz_registered_users');
    let localMatched: (CurrentUser & { password?: string }) | null = null;
    if (localUsersRaw) {
      try {
        const usersArr: (CurrentUser & { password?: string })[] = JSON.parse(localUsersRaw);
        localMatched = usersArr.find((u) => matchPhone(u.phone, phone)) || null;
      } catch {}
    }

    // Also check last stored user in USER_KEY if phone matches
    if (!localMatched) {
      try {
        const lastUserRaw = localStorage.getItem('maklersiz-user');
        if (lastUserRaw) {
          const lastU: CurrentUser & { password?: string } = JSON.parse(lastUserRaw);
          if (matchPhone(lastU.phone, phone)) localMatched = lastU;
        }
      } catch {}
    }

    try {
      const res = await fetchWithAuth(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
        skipAuth: true,
      });
      if (res?.ok) {
        const data = await res.json();
        const token = data.access_token || data.token;
        if (token) saveTokens(token, data.refresh_token || null);
        const remoteUser = (data.user || data.data?.user || (data.id ? data : null)) as CurrentUser | null;
        if (remoteUser) {
          return remoteUser;
        }
      } else if (res) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 400) {
          throw new Error(errJson.detail || errJson.message || "Parolingiz noto'g'ri. Iltimos, qayta kiriting.");
        }
        if (res.status === 404) {
          if (localMatched) {
            if (localMatched.password && password && localMatched.password !== password) {
              throw new Error("Parolingiz noto'g'ri. Iltimos, qayta kiriting.");
            }
            return localMatched;
          }
          throw new Error(errJson.detail || errJson.message || "Ushbu telefon raqami bilan hisob topilmadi. Avval Ro'yxatdan o'tish bo'limida hisob yarating.");
        }
        throw new Error(errJson.detail || errJson.message || "Telefon raqami yoki parol noto'g'ri.");
      }
    } catch (err: any) {
      if (err?.message) throw err;
      console.warn('login: backend unavailable');
    }


    throw new Error("Ushbu telefon raqami bilan hisob topilmadi. Avval Ro'yxatdan o'tish bo'limiga o'ting.");
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

    // Check if user already exists locally to preserve custom avatar and existing ID
    const localUsersRaw = localStorage.getItem('maklersiz_registered_users');
    let localExisting: CurrentUser | null = null;
    let existingArr: CurrentUser[] = [];
    if (localUsersRaw) {
      try {
        existingArr = JSON.parse(localUsersRaw);
        localExisting = existingArr.find((u) => matchPhone(u.phone, payloadPhone)) || null;
      } catch {}
    }

    const defaultAvatar =
      payloadRole === 'OWNER'
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=300';

    const chosenAvatar = localExisting?.avatar || defaultAvatar;
    let registeredUser: CurrentUser | null = null;

    try {
      const res = await fetchWithAuth(`${API_BASE}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({
          name: payloadName,
          phone: payloadPhone,
          role: payloadRole,
          password: payloadPassword,
          avatar: chosenAvatar,
        }),
        skipAuth: true,
      });
      if (res?.ok) {
        const data = await res.json();
        const token = data.access_token || data.token;
        if (token) saveTokens(token, data.refresh_token || null);
        const remote = (data.user || data.data?.user || (data.id ? data : null)) as CurrentUser | null;
        if (remote) {
          registeredUser = remote;
        }
      }
    } catch {
      console.warn('register: backend unavailable');
    }

    if (!registeredUser) {
      registeredUser = {
        id: localExisting?.id || `user-${Date.now()}`,
        name: payloadName,
        phone: payloadPhone,
        role: payloadRole as 'OWNER' | 'STUDENT',
        avatar: chosenAvatar,
      };
    }

    // Save to localStorage for offline matching
    try {
      const userWithPass = { ...registeredUser, password: payloadPassword };
      const filtered = existingArr.filter((u) => !matchPhone(u.phone, payloadPhone) && u.id !== registeredUser.id);
      filtered.push(userWithPass);
      localStorage.setItem('maklersiz_registered_users', JSON.stringify(filtered));
      localStorage.setItem('maklersiz-user', JSON.stringify(userWithPass));
    } catch {}

    return registeredUser;
  },

  updateProfileAvatar: async (phone: string, avatar: string, userObj?: CurrentUser): Promise<void> => {
    // Update local registered users list
    try {
      const localUsersRaw = localStorage.getItem('maklersiz_registered_users');
      if (localUsersRaw) {
        const usersArr: CurrentUser[] = JSON.parse(localUsersRaw);
        const updated = usersArr.map((u) => (matchPhone(u.phone, phone) || (userObj?.id && u.id === userObj.id) ? { ...u, avatar } : u));
        localStorage.setItem('maklersiz_registered_users', JSON.stringify(updated));
      }
    } catch {}

    // Update backend DB if available
    try {
      await fetchWithAuth(`${API_BASE}/auth/profile`, {
        method: 'POST',
        body: JSON.stringify({
          phone,
          avatar,
          id: userObj?.id,
          name: userObj?.name,
          role: userObj?.role,
        }),
      });
    } catch {
      /* ignore */
    }
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
        const token = data.access_token || data.token;
        if (token) {
          saveTokens(token, data.refresh_token || null);
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
