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
  /** The refresh call itself never answered, as opposed to failing outright. */
  timedOut?: boolean;
}

/**
 * The refresh gets its own deadline.
 *
 * Every other fetch in this file is wired to `request`'s controller, which
 * aborts after `timeoutMs`. This one was not, and `fetch` has no default
 * timeout — so a refresh endpoint that accepted the connection and then went
 * quiet held the promise open until the operating system gave up on the
 * socket, minutes later. Because `refreshInFlight` is shared, every other 401
 * queued behind it, and `initAuth` never reached its `catch`: the whole app
 * sat on `<Loading />` with no error and nothing to retry.
 */
const REFRESH_TIMEOUT_MS = 10_000;

let refreshInFlight: Promise<RefreshResult> | null = null;

async function performRefresh(): Promise<RefreshResult> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return { token: null, rejected: true };

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
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
  } catch (error) {
    // A network blip is not an expired session: keep the tokens so the next
    // attempt can succeed. The deadline above surfaces as an AbortError, and
    // it is reported separately because a refresh that never answered must
    // not be mistaken for a 401 further down.
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return { token: null, rejected: false, timedOut };
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

/**
 * Resolves when `signal` aborts, and never rejects.
 *
 * Raced against the shared refresh so a caller the visitor has already
 * cancelled — a filter tap superseding the previous query — stops waiting for
 * it. The refresh promise itself is deliberately left running: other callers
 * are queued on the same one and still want its answer.
 */
function abortedWhen(signal: AbortSignal): Promise<'aborted'> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve('aborted');
    else signal.addEventListener('abort', () => resolve('aborted'), { once: true });
  });
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

  // A signal that is *already* aborted fires no event, so listening alone let
  // a request the caller had cancelled before it started go out anyway. The
  // listener is removed in the `finally` so a caller that reuses one signal
  // across many requests does not accumulate handlers on it.
  const relayAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', relayAbort, { once: true });

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
      const result = await Promise.race([refreshAccessToken(), abortedWhen(controller.signal)]);
      if (result === 'aborted') {
        throw signal?.aborted
          ? new ApiError(0, 'aborted', 'Request aborted')
          : new ApiError(0, 'timeout', 'Request timed out');
      }
      if (result.token) {
        response = await send(result.token);
      } else if (result.rejected) {
        // Only a server REJECTION ends the session. A network blip leaves the
        // tokens alone so the next request can succeed, which is what the
        // refresh path already promised but did not do.
        clearTokens();
        onSessionExpired?.();
      } else {
        // The refresh neither succeeded nor was refused, so the session is
        // still whatever it was. Falling through to the 401 already in hand
        // would run the expiry branch below and sign the visitor out over a
        // stalled socket — the exact opposite of what the line above says.
        throw new ApiError(
          0,
          result.timedOut ? 'timeout' : 'network',
          'Token refresh did not complete',
        );
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
      // A caller-supplied abort is a cancellation, not a timeout: the caller
      // asked for this and its own sequencing decides what to do next, so it
      // is reported as such rather than as a failed request.
      throw signal?.aborted
        ? new ApiError(0, 'aborted', 'Request aborted')
        : new ApiError(0, 'timeout', 'Request timed out');
    }
    throw new ApiError(0, 'network', 'Network request failed');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', relayAbort);
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
