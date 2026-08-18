/**
 * authService.ts
 * 
 * Centralized authentication service:
 * - Access token + Refresh token storage
 * - Auto-refresh on 401 responses
 * - /auth/me initialization
 * - Logout cleanup
 */

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://maklersizkvartira-production.up.railway.app/api/v1'
);

// ─── Token Helpers ────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveTokens(access: string, refresh?: string | null): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

async function doRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const data = await res.json();
    const newAccess: string | null = data.access_token ?? null;
    const newRefresh: string | null = data.refresh_token ?? null;

    if (newAccess) {
      saveTokens(newAccess, newRefresh);
      return newAccess;
    }
    clearTokens();
    return null;
  } catch {
    clearTokens();
    return null;
  }
}

/**
 * Refreshes the access token. De-duplicates concurrent refresh calls.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ─── Authenticated Fetch ──────────────────────────────────────────────────────

export interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Fetch wrapper that:
 * 1. Attaches Authorization header with the current access token
 * 2. On 401 → tries to refresh token → retries the request once
 * 3. On second 401 → clears tokens and returns null (caller handles logout)
 */
export async function fetchWithAuth(
  url: string,
  options: FetchOptions = {}
): Promise<Response | null> {
  const { skipAuth, ...fetchOpts } = options;

  const buildHeaders = (token?: string | null): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string> || {}),
    ...((!skipAuth && token) ? { Authorization: `Bearer ${token}` } : {}),
  });

  const accessToken = getAccessToken();
  let response = await fetch(url, {
    ...fetchOpts,
    headers: buildHeaders(accessToken),
  });

  // If 401 and we have a refresh token, try to refresh once
  if (response.status === 401 && !skipAuth && getRefreshToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await fetch(url, {
        ...fetchOpts,
        headers: buildHeaders(newToken),
      });
    } else {
      // Refresh failed — signal caller to log out
      return null;
    }
  }

  return response;
}

// ─── /auth/me Bootstrap ───────────────────────────────────────────────────────

export interface MeResponse {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  role?: string;
  avatar?: string;
  avatar_url?: string;
}

/**
 * Called on app start. If an access token exists in localStorage,
 * calls GET /auth/me to hydrate the current user from backend.
 * Returns the user object or null.
 */
export async function initAuthFromStorage(): Promise<MeResponse | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const res = await fetchWithAuth(`${API_BASE}/auth/me`);
    if (!res) {
      // Token expired and refresh failed
      clearTokens();
      return null;
    }
    if (!res.ok) {
      if (res.status === 401) clearTokens();
      return null;
    }
    const data = await res.json();
    // Backend may return nested .user or flat object
    return (data.user ?? data) as MeResponse;
  } catch {
    return null;
  }
}

// ─── Convenience POST JSON ────────────────────────────────────────────────────

export async function postJsonAuth<T>(
  path: string,
  body: unknown,
  requiresAuth = true
): Promise<T | null> {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(body),
      skipAuth: !requiresAuth,
    });
    if (!res) return null;
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return err ?? null;
    }
    return await res.json() as T;
  } catch {
    return null;
  }
}

export async function getJsonAuth<T>(path: string): Promise<T | null> {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetchWithAuth(url);
    if (!res || !res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}
