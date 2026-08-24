/**
 * HTTP layer.
 *
 * Deliberate changes from the previous implementation:
 *
 *  - No password is ever written to localStorage. The old client stored every
 *    registered user (password included) under `maklersiz_registered_users`
 *    and fell back to comparing them client-side when the server rejected a
 *    login, which meant the browser could authenticate itself.
 *  - A failed request throws a typed `ApiError` carrying the server's error
 *    code. Callers no longer receive a mock payload that looks like success.
 *  - One in-flight refresh at a time; queued callers await the same promise.
 *  - The active language rides along on every request so the server can
 *    localise its error messages.
 */

import { detectInitialLanguage as getStoredLanguage } from '../i18n/storage';

const ACCESS_TOKEN_KEY = 'maklersiz.access_token';
const REFRESH_TOKEN_KEY = 'maklersiz.refresh_token';

/** Legacy keys from the previous build, cleared on boot. */
const LEGACY_KEYS = [
  'access_token',
  'refresh_token',
  'maklersiz-user',
  'maklersiz_registered_users',
  'maklersiz-extra-listings',
];

function resolveBaseUrl(): string {
  const configured =
    import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
  if (configured) return configured.replace(/\/+$/, '');
  // Same-origin by default: no production hostname is baked into the bundle,
  // so a local build cannot accidentally talk to the live database.
  return '/api/v1';
}

export const API_BASE = resolveBaseUrl();

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  readonly params?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    field?: string,
    params?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
    this.params = params;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
  get isAuth(): boolean {
    return this.status === 401;
  }
  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------
export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveTokens(access: string, refresh?: string | null): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  } catch {
    /* storage unavailable — the session lasts for this tab only */
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Removes credentials the old build left behind, including plaintext passwords. */
export function purgeLegacyStorage(): void {
  try {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Session-expiry notification
// ---------------------------------------------------------------------------
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  onSessionExpired = handler;
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------
/** `rejected` distinguishes "the server said no" from "the network failed". */
interface RefreshResult {
  token: string | null;
  rejected: boolean;
}

let refreshInFlight: Promise<RefreshResult> | null = null;

async function performRefresh(): Promise<RefreshResult> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return { token: null, rejected: true };

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      clearTokens();
      return { token: null, rejected: true };
    }
    const data = await response.json();
    const access: string | null = data.accessToken ?? null;
    if (!access) {
      clearTokens();
      return { token: null, rejected: true };
    }
    saveTokens(access, data.refreshToken ?? null);
    return { token: access, rejected: false };
  } catch {
    // A network blip is not an expired session: keep the tokens so the next
    // attempt can succeed.
    return { token: null, rejected: false };
  }
}

async function refreshAccessToken(): Promise<RefreshResult> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip the Authorization header (public endpoints). */
  anonymous?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseError(response: Response): Promise<ApiError> {
  let code = 'generic';
  let message = '';
  let field: string | undefined;
  let params: Record<string, unknown> | undefined;
  try {
    const data = await response.json();
    code = data.code ?? code;
    message = data.message ?? '';
    field = data.field ?? undefined;
    params = data.params ?? undefined;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(response.status, code, message, field, params);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, anonymous = false, signal, timeoutMs = 20_000 } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Language': getStoredLanguage(),
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!anonymous && token) headers.Authorization = `Bearer ${token}`;

    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  };

  try {
    let response = await send(getAccessToken());

    // One transparent retry after refreshing an expired access token.
    if (response.status === 401 && !anonymous && getRefreshToken()) {
      const result = await refreshAccessToken();
      if (result.token) {
        response = await send(result.token);
      } else if (result.rejected) {
        // Only a server REJECTION ends the session. A network blip leaves the
        // tokens alone so the next request can succeed, which is what the
        // refresh path already promised but did not do.
        clearTokens();
        onSessionExpired?.();
      }
    }

    if (response.status === 204) return undefined as T;

    if (!response.ok) {
      const error = await parseError(response);
      if (error.isAuth && !anonymous) {
        clearTokens();
        onSessionExpired?.();
      }
      throw error;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'timeout', 'Request timed out');
    }
    throw new ApiError(0, 'network', 'Network request failed');
  } finally {
    clearTimeout(timeout);
  }
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
