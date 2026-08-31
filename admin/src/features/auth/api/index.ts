import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { AdminAccount, TokenResponse } from '@/shared/api/types';
import type { LoginFormValues } from '../schemas';
import type { LoginResult } from '../types';

export interface VerifyCredentialsResult {
  valid: boolean;
  username: string;
  fullName: string;
  hasFace: boolean;
}

export async function verifyCredentials(payload: LoginFormValues): Promise<VerifyCredentialsResult> {
  return http.raw.post<VerifyCredentialsResult>(api.auth.verifyCredentials, payload, {
    skipAuth: true,
  });
}

/**
 * `POST /admin/auth/login`
 *
 * Answers flat, not enveloped — the tokens sit at the top level beside
 * `status` — so this goes through `http.raw`. The backend sets no cookies at
 * all: parking the refresh token where JS cannot read it is entirely the
 * client's job, which `useLogin` does via `/api/auth/set-refresh`.
 */
export async function login(payload: LoginFormValues): Promise<LoginResult> {
  const res = await http.raw.post<TokenResponse>(api.auth.login, payload, {
    skipAuth: true,
  });

  if (!res.admin) {
    // A user token can never satisfy the admin dependencies, so this would be
    // a backend contract break rather than a wrong-credentials case; failing
    // loudly beats signing someone in with a null account.
    throw new Error('Login succeeded but returned no staff account.');
  }

  return {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    admin: res.admin,
  };
}

/**
 * `POST /admin/auth/face-login`
 *
 * The username is required by the backend and is not a formality: face matching
 * is a 1:1 check against the named account. Without it the server used to scan
 * every enrolled admin and sign the caller in as whichever scored highest.
 */
export async function faceLogin(username: string, image: string): Promise<LoginResult> {
  const res = await http.raw.post<TokenResponse>(
    api.auth.faceLogin,
    { username: username.trim().toLowerCase(), image },
    { skipAuth: true },
  );

  if (!res.admin) {
    throw new Error('Face login succeeded but returned no staff account.');
  }

  return {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    admin: res.admin,
  };
}

export interface FaceAdminItem {
  id: string;
  username: string;
  fullName: string;
  role: string;
  hasFace: boolean;
  faceImage?: string | null;
}

export interface FaceStatus {
  enrolled: boolean;
  count: number;
  username?: string | null;
  fullName?: string | null;
  faceImage?: string | null;
  admins?: FaceAdminItem[];
}

export async function getFaceStatus(): Promise<FaceStatus> {
  return http.raw.get(api.auth.faceStatus, { skipAuth: true });
}

export async function faceRegister(
  payload: {
    image: string;
    username?: string;
    password?: string;
  },
  options?: { skipAuth?: boolean },
): Promise<{ message: string }> {
  return http.raw.post(api.auth.faceRegister, payload, options);
}

export async function deleteFace(username?: string): Promise<{ message: string }> {
  return http.post(api.auth.faceDelete, { username });
}

/**
 * `GET /admin/auth/me`
 *
 * Read-only. There is no PATCH counterpart — a staff account is edited through
 * the staff routes by a SUPERADMIN, not by its owner.
 */
export async function getMe(): Promise<AdminAccount> {
  return http.get<AdminAccount>(api.auth.me);
}

/**
 * `POST /admin/auth/logout` is deliberately NOT called from here.
 *
 * It has to happen in the same round trip that clears the httpOnly refresh
 * cookie, and only the server can touch that cookie — so `useLogout` posts to
 * `/api/auth/logout`, which relays the bearer token upstream and expires the
 * cookie in one response. Calling the backend directly from the browser as well
 * would just spend the token twice.
 */
