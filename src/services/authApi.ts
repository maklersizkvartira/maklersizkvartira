/**
 * Authentication API.
 *
 * Mirrors the backend's three-step registration:
 *   register()  -> nothing is created yet, an SMS code is sent
 *   verifyCode() -> the account is created and tokens are issued
 *   login()      -> phone + password
 */

import { clearTokens, getRefreshToken, http, saveTokens } from './http';
import type { Language } from '../i18n';

/**
 * Mirrors the server's `UserRole` enum. It has to be complete: a role the
 * server can send but this union does not name type-checks as impossible, so
 * every `role === …` branch written against it silently excludes real
 * accounts. DEVELOPER was missing here for exactly that reason.
 */
export type UserRole =
  | 'STUDENT'
  | 'OWNER'
  | 'AGENT'
  | 'TENANT'
  | 'MODERATOR'
  | 'ADMIN'
  | 'DEVELOPER';

export interface ApiUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  avatar?: string | null;
  role: UserRole;
  status: string;
  /** Set only on an AGENT account, and optional even there. */
  agencyName?: string | null;
  trustScore: number;
  verificationLevel: number;
  isVerified: boolean;
  xpPoints: number;
  language: Language;
  theme: 'light' | 'dark' | 'system';
  referralCode?: string | null;
  mustChangePassword: boolean;
  phoneVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: ApiUser;
}

export interface PendingRegistration {
  status: string;
  message: string;
  /** Masked, e.g. "+998 90 *** ** 67". */
  phone: string;
  resendAfter: number;
  expiresIn: number;
  /** Present only outside production, so the flow is testable without SMS. */
  debugCode?: string | null;
}

/**
 * One signed-in device, as `GET /auth/sessions` returns it (newest first, at
 * most 50 rows).
 */
export interface AuthSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
  /**
   * True for the device that made the request. The server used to send this as
   * `false` on every row, which left no way to tell which session was the one
   * you were reading the list on — so nobody could safely end any of them.
   */
  current?: boolean;
}

export interface RegisterInput {
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: 'STUDENT' | 'OWNER' | 'AGENT';
  agencyName?: string | null;
  language: Language;
}

function persist(response: TokenResponse): ApiUser {
  saveTokens(response.accessToken, response.refreshToken);
  return response.user;
}

export const AuthApi = {
  /** Step 1 — stage the signup and trigger the SMS. */
  register: (input: RegisterInput) =>
    http.post<PendingRegistration>('/auth/register', input, { anonymous: true }),

  /** Step 2 — confirm the code; the account is created here. */
  verifyCode: async (phone: string, code: string): Promise<ApiUser> => {
    const response = await http.post<TokenResponse>(
      '/auth/verify-code',
      { phone, code, purpose: 'REGISTER' },
      { anonymous: true },
    );
    return persist(response);
  },

  resendCode: (phone: string, purpose: 'REGISTER' | 'PASSWORD_RESET' = 'REGISTER') =>
    http.post<PendingRegistration>('/auth/resend-code', { phone, purpose }, { anonymous: true }),

  /**
   * Judges a code without spending it, so a wizard can gate its next screen.
   *
   * The reset flow asks for the code and the new password on separate screens
   * and only `/auth/reset-password` may consume the code. Before this existed
   * the code screen could not ask anything, so it waved through any six digits
   * and the mistake surfaced two screens later — on the one screen where there
   * was nothing to correct. Rejects with the same `otp_*` codes as the calls
   * that do consume it.
   */
  checkCode: (
    phone: string,
    code: string,
    purpose: 'REGISTER' | 'PASSWORD_RESET' = 'PASSWORD_RESET',
  ) =>
    http.post<{ valid: boolean; message: string }>(
      '/auth/check-code',
      { phone, code, purpose },
      { anonymous: true },
    ),

  login: async (phone: string, password: string): Promise<ApiUser> => {
    const response = await http.post<TokenResponse>(
      '/auth/login',
      { phone, password },
      { anonymous: true },
    );
    return persist(response);
  },

  loginWithGoogle: async (
    idToken: string,
    role: 'STUDENT' | 'OWNER' | 'AGENT',
    language: Language,
  ): Promise<ApiUser> => {
    const response = await http.post<TokenResponse>(
      '/auth/google',
      { idToken, role, language },
      { anonymous: true },
    );
    return persist(response);
  },

  me: async (): Promise<ApiUser> => {
    const response = await http.get<{ user: ApiUser }>('/auth/me');
    return response.user;
  },

  updateProfile: async (changes: {
    name?: string;
    avatar?: string;
    role?: 'STUDENT' | 'OWNER' | 'AGENT';
    /** An empty string clears it; omitting the key leaves it untouched. */
    agencyName?: string;
    language?: Language;
    theme?: 'light' | 'dark' | 'system';
  }): Promise<ApiUser> => {
    const response = await http.patch<{ user: ApiUser }>('/auth/profile', changes);
    return response.user;
  },

  logout: async (allDevices = false): Promise<void> => {
    try {
      // Through the accessor, not a second hardcoded copy of the key: the one
      // here was already out of step with `http.ts` once, and a logout that
      // posts `null` revokes nothing — the refresh token stays valid on the
      // server while the browser believes it has signed out.
      await http.post('/auth/logout', {
        refreshToken: getRefreshToken(),
        allDevices,
      });
    } catch {
      // Signing out locally must succeed even if the server is unreachable.
    } finally {
      clearTokens();
    }
  },

  forgotPassword: (phone: string) =>
    http.post<PendingRegistration>('/auth/forgot-password', { phone }, { anonymous: true }),

  resetPassword: (
    phone: string,
    code: string,
    newPassword: string,
    confirmPassword: string,
  ) =>
    http.post<{ message: string }>(
      '/auth/reset-password',
      { phone, code, newPassword, confirmPassword },
      { anonymous: true },
    ),

  /**
   * Changes the password and, when the server allows it, keeps this device in.
   *
   * The server bumps the account's token version and revokes every refresh
   * family, so the access token this very request rode on is dead the instant
   * it returns — including on the device that asked for the change. When the
   * response carries a replacement pair it is persisted here, before any other
   * authenticated call can be made on the dead one; today's backend answers
   * with `{message}` only, so the caller is told (via `null`) that it still
   * has to obtain a session of its own.
   */
  changePassword: async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<ApiUser | null> => {
    const response = await http.post<{ message: string } & Partial<TokenResponse>>(
      '/auth/change-password',
      { currentPassword, newPassword, confirmPassword },
    );
    if (!response.accessToken || !response.user) return null;
    return persist(response as TokenResponse);
  },

  /** Live feedback for the registration form's strength meter. */
  checkPasswordStrength: (password: string) =>
    http.post<{ score: number; acceptable: boolean; code?: string; message?: string }>(
      '/auth/password-strength',
      { password },
      { anonymous: true },
    ),

  sessions: () => http.get<AuthSession[]>('/auth/sessions'),

  /**
   * Ends one device's session without touching the others.
   *
   * Deliberately not the same thing as `logout(true)`: that bumps the account's
   * token version and drops every device at once. This revokes a single refresh
   * family, which is what someone wants when they left a browser signed in on a
   * shared machine and are still reading this page on their phone. The server
   * scopes the id to the caller's own rows, so a foreign id is a 404, never a
   * revoke.
   */
  revokeSession: (sessionId: string) =>
    http.delete<{ message: string }>(`/auth/sessions/${encodeURIComponent(sessionId)}`),

  submitVerification: (input: {
    targetLevel: number;
    documentType: 'PASSPORT' | 'ID_CARD' | 'CADASTRE' | 'SELFIE_LIVENESS';
    documentUrl?: string;
    selfieUrl?: string;
  }) => http.post<{ data: { id: string; status: string }; message: string }>(
    '/auth/verifications',
    input,
  ),

  myVerifications: () =>
    http.get<{ data: Array<{ id: string; targetLevel: number; documentType: string; status: string; rejectionReason?: string; createdAt: string }> }>(
      '/auth/verifications',
    ),
};
