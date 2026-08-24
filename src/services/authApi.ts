/**
 * Authentication API.
 *
 * Mirrors the backend's three-step registration:
 *   register()  -> nothing is created yet, an SMS code is sent
 *   verifyCode() -> the account is created and tokens are issued
 *   login()      -> phone + password
 */

import { clearTokens, http, saveTokens } from './http';
import type { Language } from '../i18n';

export type UserRole = 'STUDENT' | 'OWNER' | 'TENANT' | 'MODERATOR' | 'ADMIN';

export interface ApiUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  avatar?: string | null;
  role: UserRole;
  status: string;
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

export interface RegisterInput {
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: 'STUDENT' | 'OWNER';
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
    role: 'STUDENT' | 'OWNER',
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
    role?: 'STUDENT' | 'OWNER';
    language?: Language;
    theme?: 'light' | 'dark' | 'system';
  }): Promise<ApiUser> => {
    const response = await http.patch<{ user: ApiUser }>('/auth/profile', changes);
    return response.user;
  },

  logout: async (allDevices = false): Promise<void> => {
    try {
      await http.post('/auth/logout', {
        refreshToken: localStorage.getItem('maklersiz.refresh_token'),
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

  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    http.post<{ message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    }),

  /** Live feedback for the registration form's strength meter. */
  checkPasswordStrength: (password: string) =>
    http.post<{ score: number; acceptable: boolean; code?: string; message?: string }>(
      '/auth/password-strength',
      { password },
      { anonymous: true },
    ),

  sessions: () =>
    http.get<Array<{ id: string; createdAt: string; expiresAt: string; ip?: string; userAgent?: string }>>(
      '/auth/sessions',
    ),

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
