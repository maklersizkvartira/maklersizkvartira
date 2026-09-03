import { env } from '@/env';
import type { ApiEnvelope, ApiErrorEnvelope, PageMeta, Paged } from '../api/types';

/**
 * The panel's only HTTP client.
 *
 * Three things about the backend shape everything below:
 *
 * 1. Every authenticated response is wrapped in `{status, data, meta?}`. The
 *    envelope is torn apart in exactly one place — here — so no caller ever has
 *    to remember whether a given hook returns the payload or the wrapper.
 * 2. Errors are `{status:'error', code, message, field?, params?}`. Branch on
 *    `code`; `message` is prose, already translated into the language we asked
 *    for, and it changes freely.
 * 3. CORS on the API allows exactly five request headers: Authorization,
 *    Content-Type, Accept, X-Request-ID and X-Language. Any other custom header
 *    fails the preflight, and it fails *silently* from the page's point of view
 *    — the request simply never happens. Do not add headers here without
 *    adding them to `allow_headers` in the backend's `main.py` first.
 */

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  /**
   * HTTP status, or 0 when the request never reached the server (offline,
   * DNS failure, blocked preflight, or our own timeout).
   */
  public readonly status: number;
  /** The backend's stable error code, e.g. 'refresh_reused', 'rate_limited'. */
  public readonly code: string;
  /** Extra context the backend attached to the code. */
  public readonly params?: Record<string, unknown>;
  /** Which request field the error is about, on validation failures. */
  public readonly field?: string;
  /** Seconds to wait before retrying — set on 429 only. */
  public readonly retryAfter?: number;

  constructor(
    status: number,
    code: string,
    message?: string,
    params?: Record<string, unknown>,
    field?: string,
    retryAfter?: number,
  ) {
    super(message || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.params = params;
    this.field = field;
    this.retryAfter = retryAfter;
  }
}

// ─── Options ──────────────────────────────────────────────────────────────────

export type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
  /** Skip the Authorization header — for login, refresh and `GET /settings`. */
  skipAuth?: boolean;
  /**
   * Abandon the request after this many milliseconds. The default is generous
   * because verification documents and legacy listing images travel as
   * multi-megabyte base64 strings inside the JSON body.
   */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;

// ─── Access token (in memory only, never localStorage) ────────────────────────

/**
 * The access token lives in a module variable and nowhere else. It survives a
 * client-side navigation and dies with the tab, which is the point: a token in
 * localStorage is readable by any script that ever gets injected into the page.
 * The refresh token is in an httpOnly cookie that JS cannot see at all, so a
 * reload re-mints the pair through `/api/auth/refresh` rather than restoring it
 * from storage.
 */
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) localStorage.setItem('uyiz_admin_access_token', token);
      else localStorage.removeItem('uyiz_admin_access_token');
    } catch {}
  }
}

export function getAccessToken(): string | null {
  if (!_accessToken && typeof window !== 'undefined') {
    try {
      _accessToken = localStorage.getItem('uyiz_admin_access_token');
    } catch {}
  }
  return _accessToken;
}

// ─── Language ─────────────────────────────────────────────────────────────────

/**
 * Sent as `X-Language` so the backend's error `message` comes back in the
 * admin's language instead of the default Uzbek. `Providers` keeps this in step
 * with the active locale.
 */
let _language = 'uz';

export function setApiLanguage(locale: string) {
  _language = locale;
}

export function getApiLanguage(): string {
  return _language;
}

// ─── Session teardown ─────────────────────────────────────────────────────────

/** Mirrors `routing.locales`; see the note in `@/shared/lib/permissions`. */
const LOCALE_SEGMENTS = new Set(['uz', 'ru', 'en']);

/**
 * The locale prefix is always present on in-app URLs (`localePrefix: 'always'`),
 * so a bare `/login` would bounce through the middleware. Read it back off the
 * current path and fall back to the language we are already sending. Matched
 * against the real locale list, not "is it two letters" — `/ai` is a route.
 */
function loginUrl(): string {
  const first = window.location.pathname.split('/').filter(Boolean)[0];
  const locale = first && LOCALE_SEGMENTS.has(first) ? first : _language;
  return `/${locale}/login`;
}

/**
 * Drop the session and send the browser to the sign-in page.
 *
 * This is a full document navigation rather than a router push on purpose:
 * everything in memory — the react-query cache included — has to go, and a
 * client-side transition would keep the previous admin's cached rows alive in
 * the same tab.
 */
async function endSession(): Promise<void> {
  try {
    const { useAuthStore } = await import('@/store/auth.store');
    useAuthStore.getState().clearAuth();
  } catch {
    // The store may not be reachable during SSR; clearing the token cell is
    // the part that actually matters.
    setAccessToken(null);
  }
  if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/login')) {
    window.location.href = loginUrl();
  }
}

// ─── Token refresh, single-flight across every tab ────────────────────────────

/**
 * What a refresh attempt came back with.
 *
 * `unreachable` is not a rejected session: the cookie may be perfectly good and
 * the API simply down. Callers that clear the session on any failure turn a
 * backend blip into a forced sign-out, so the two are told apart here rather
 * than collapsed into a boolean.
 */
export type RefreshOutcome = { ok: true } | { ok: false; reason: 'rejected' | 'unreachable' };

/** Serialises callers inside THIS tab. The lock below covers the other tabs. */
let refreshPromise: Promise<RefreshOutcome> | null = null;

/* ── Cross-tab names, renamed with the Uyiz rebrand ───────────────────────────
   All three carry the brand, so all three moved. None of them may move ALONE,
   and none of them may move BARELY, because they are not stored values — they
   are the names two tabs have to agree on in order to serialise a refresh.

   During the deploy window an old tab is still running the previous bundle and
   still using the `maklersiz-*` names. If this bundle used only the new ones,
   the two would no longer share a mutex or a token channel: both would post a
   refresh with the same one-shot cookie, the backend would answer 401
   `refresh_reused`, call `revoke_family`, and sign the admin out on EVERY
   device — not just the losing tab.

   So for one release each name is used ALONGSIDE its predecessor: both locks
   are acquired (always in the same order, so nothing can deadlock), and a
   freshly minted token is announced on both channels. Nobody is signed out.
   Delete the LEGACY_* constants, the nested acquire and the second channel once
   no browser can still be holding the old bundle. */
const REFRESH_LOCK = 'uyiz-admin-refresh';
const LEGACY_REFRESH_LOCK = 'maklersiz-admin-refresh';
const REFRESH_CHANNEL = 'uyiz-admin-auth';
const LEGACY_REFRESH_CHANNEL = 'maklersiz-admin-auth';

/** How long a storage-mutex holder may keep the lock before it is stolen. */
const LOCK_TTL_MS = 15_000;
const LOCK_KEY = 'uyiz-admin-refresh-lock';
const LEGACY_LOCK_KEY = 'maklersiz-admin-refresh-lock';

let _channels: BroadcastChannel[] | undefined;

/**
 * The channels the tabs announce a freshly minted access token on.
 *
 * Only the token travels, never the refresh token — that one is httpOnly and
 * has to stay unreachable from script. `undefined` means "not asked yet", an
 * empty array means "this browser has no BroadcastChannel", which is
 * survivable: without it the other tabs simply refresh again in turn, which is
 * safe because the lock has already made those attempts sequential.
 *
 * Two channels rather than one for the length of the rename window, per the
 * note above. A tab listening on both hears a token twice; the second delivery
 * is a no-op because the value has already been adopted.
 */
function refreshChannels(): BroadcastChannel[] {
  if (_channels !== undefined) return _channels;
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    _channels = [];
    return _channels;
  }
  const adopt = (event: MessageEvent) => {
    const access = (event.data as { access?: string } | null)?.access;
    if (!access || access === _accessToken) return;
    // A sibling tab rotated the cookie and this is what it got back. Adopt it:
    // the token this tab is holding was minted from a refresh token that no
    // longer exists, and posting our own refresh would be the replay that
    // revokes the family.
    setAccessToken(access);
    void import('@/store/auth.store').then(({ useAuthStore }) => {
      useAuthStore.getState().updateAccessToken(access);
    });
  };
  _channels = [REFRESH_CHANNEL, LEGACY_REFRESH_CHANNEL].map((name) => {
    const channel = new BroadcastChannel(name);
    channel.addEventListener('message', adopt);
    return channel;
  });
  return _channels;
}

function publishAccessToken(access: string): void {
  for (const channel of refreshChannels()) channel.postMessage({ access });
}

/**
 * Best-effort cross-tab mutex for browsers without the Web Locks API.
 *
 * localStorage writes are atomic and visible to every tab immediately, so
 * "write my id, read it back, proceed only if it is still mine" is a real —
 * if racy at the microsecond scale — mutex. The TTL is what keeps a tab the
 * user closed mid-refresh from wedging every other one.
 *
 * The key is a parameter so the caller can hold the current name and the
 * pre-rebrand one at the same time; see the note beside the constants. Every
 * access is wrapped because `localStorage` throws rather than returning null in
 * a browser with site data blocked, and a refresh that cannot take the mutex is
 * far better than a refresh that throws.
 */
async function withStorageMutex<T>(key: string, run: () => Promise<T>): Promise<T> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const giveUpAt = Date.now() + LOCK_TTL_MS;

  const read = (): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (value: string): void => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable — proceed unserialised rather than fail the refresh */
    }
  };

  for (;;) {
    const held = read();
    const heldUntil = held ? Number(held.split('|')[1]) : 0;
    if (!held || !Number.isFinite(heldUntil) || heldUntil <= Date.now()) {
      write(`${id}|${Date.now() + LOCK_TTL_MS}`);
      if (read()?.startsWith(`${id}|`)) break;
    }
    // Waiting forever would be worse than a replay: the panel would never
    // finish booting. Past the deadline, go ahead unserialised.
    if (Date.now() >= giveUpAt) break;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  try {
    return await run();
  } finally {
    if (read()?.startsWith(`${id}|`)) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* nothing to clean up if storage is gone; the TTL covers it anyway */
      }
    }
  }
}

/**
 * Both lock names, nested and always in the same order — new outside, legacy
 * inside. A tab on the old bundle only ever takes the legacy one, so there is
 * no pair of tabs that can take them in opposite orders and deadlock.
 */
function withRefreshLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK, () =>
      navigator.locks.request(LEGACY_REFRESH_LOCK, run),
    ) as Promise<T>;
  }
  if (typeof window === 'undefined' || !window.localStorage) return run();
  return withStorageMutex(LOCK_KEY, () => withStorageMutex(LEGACY_LOCK_KEY, run));
}

/**
 * Exchange the httpOnly refresh cookie for a fresh access token.
 *
 * Serialisation here is load-bearing, not an optimisation, and it has to reach
 * across tabs. Refresh rotation on the backend is mandatory and one-shot:
 * replaying a spent refresh token answers 401 `refresh_reused` and — before it
 * answers — calls `revoke_family`, which marks every token in the family
 * revoked, INCLUDING the one the winning request minted a moment earlier. So
 * two tabs that post their own refresh with the same cookie do not merely lose
 * one of the two; they kill the session on every device the family covers. That
 * is the shape of a window restored with /dashboard and /listings both pinned.
 *
 * Three things stop it, in order of how much they carry:
 *
 *  1. A cross-tab lock, so the second exchange starts only after the first has
 *     replaced the cookie — a *sequential* rotation R→R2→R3 is legal and safe.
 *  2. A broadcast of the minted token, so the waiters adopt it and never post
 *     at all. Without it the loser wakes with an empty token cell and refreshes
 *     anyway: harmless, but a wasted round trip on every cold load.
 *  3. The module-level promise, which covers the parallel 401s inside one tab
 *     without paying for a lock acquisition.
 */
async function attemptTokenRefresh(): Promise<RefreshOutcome> {
  if (refreshPromise) {
    return refreshPromise;
  }

  // Subscribe before queueing, not on the way out: a tab that only ever waits
  // never reaches `publishAccessToken`, and an unsubscribed waiter cannot hear
  // the token it is waiting for.
  refreshChannels();

  // Read before queueing for the lock: if the cell has changed by the time we
  // hold it, a sibling minted a token while we waited.
  const tokenBefore = _accessToken;

  refreshPromise = withRefreshLock(async (): Promise<RefreshOutcome> => {
    if (_accessToken && _accessToken !== tokenBefore) return { ok: true };

    let res: Response;
    try {
      res = await fetch('/api/auth/refresh', { method: 'POST' });
    } catch {
      // The route itself never answered — the network, not the session.
      return { ok: false, reason: 'unreachable' };
    }

    const data = (await res.json().catch(() => null)) as
      | { access?: string; code?: string }
      | null;

    if (!res.ok || !data?.access) {
      // 502 `network_error` is the route telling us the backend is down and
      // that it has deliberately kept the cookie. Everything else — a 401, or
      // a 502 carrying a backend code — is a session that cannot be revived.
      const unreachable = res.status === 502 && data?.code === 'network_error';
      return { ok: false, reason: unreachable ? 'unreachable' : 'rejected' };
    }

    setAccessToken(data.access);
    publishAccessToken(data.access);
    const { useAuthStore } = await import('@/store/auth.store');
    useAuthStore.getState().updateAccessToken(data.access);
    return { ok: true };
  }).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Restore the session from the refresh cookie.
 *
 * The same call the 401 path uses, exported so the bootstrap in `useSession`
 * goes through it too. A second refresh code path is exactly the race this
 * whole section exists to prevent.
 */
export function refreshSession(): Promise<RefreshOutcome> {
  return attemptTokenRefresh();
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

function requestId(): string {
  // Echoed back on the response and stored on the audit row, so a support
  // request can be traced from a screenshot to a log line.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Seconds the backend wants us to wait, from the error body first and the
 * `Retry-After` header second. The API exposes that header through CORS
 * specifically so we can read it.
 */
function retryAfterSeconds(res: Response, params?: Record<string, unknown>): number | undefined {
  const fromBody = Number(params?.retry_after);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
  const fromHeader = Number(res.headers.get('Retry-After'));
  if (Number.isFinite(fromHeader) && fromHeader > 0) return fromHeader;
  return undefined;
}

/**
 * Perform one request and hand back the parsed body, or `undefined` for 204.
 *
 * `isRetry` marks the single replay we allow after a successful token refresh,
 * so a 401 that survives the new token ends the session instead of looping.
 */
async function send(
  endpoint: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<unknown> {
  const {
    skipAuth = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers: customHeaders,
    signal: callerSignal,
    ...restOptions
  } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Language': _language,
    'X-Request-ID': requestId(),
    ...customHeaders,
  };

  // Only set Content-Type when there is something to describe. A GET carrying
  // `Content-Type: application/json` triggers a preflight for no reason.
  if (restOptions.body !== undefined && restOptions.body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  if (!skipAuth && _accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${env.API_URL}${endpoint}`;

  // A fresh controller per attempt — an aborted signal cannot be reused, and
  // the 401 path replays the request.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', forwardAbort);

  let res: Response;
  try {
    res = await fetch(url, { ...restOptions, headers, signal: controller.signal });
  } catch (error) {
    // A caller-initiated abort (react-query cancelling a stale query) must stay
    // an AbortError so react-query recognises it rather than surfacing a toast.
    if (callerSignal?.aborted) throw error;
    if (controller.signal.aborted) {
      throw new ApiError(0, 'timeout', `Request timed out after ${timeoutMs}ms.`);
    }
    throw new ApiError(0, 'network_error', (error as Error)?.message);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', forwardAbort);
  }

  if (res.status === 204) return undefined;

  // Typed only for the fields the error path below reads. On success the
  // same value leaves this function as `unknown` and the envelope helpers
  // narrow it, so nothing downstream loses a check by it being shaped here.
  let body: Partial<ApiErrorEnvelope> | undefined;
  try {
    body = (await res.json()) as Partial<ApiErrorEnvelope>;
  } catch {
    // An empty body, or HTML from a proxy that never reached the app.
    body = undefined;
  }

  if (res.ok) return body;

  if (res.status === 401 && !skipAuth && !isRetry) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed.ok) {
      return send(endpoint, options, true);
    }
    // The refresh token is gone, expired, or was already spent by someone
    // else. There is nothing left to retry with.
    //
    // `unreachable` is exempt: the cookie is still good and the API is simply
    // down, so tearing the session down would turn an outage into a re-login.
    // The 401 falls through as an ordinary error and the screen can retry.
    if (refreshed.reason === 'rejected') {
      await endSession();
    }
  }

  throw new ApiError(
    res.status,
    body?.code ?? res.statusText,
    body?.message,
    body?.params,
    body?.field,
    res.status === 429 ? retryAfterSeconds(res, body?.params) : undefined,
  );
}

// ─── Envelope handling ────────────────────────────────────────────────────────

/**
 * Meta for a route that answers with a bare list and no pagination footer —
 * `/admin/staff` and the AI message log. Reporting the real length keeps the
 * shared list components honest instead of showing "0 of 0".
 */
function syntheticMeta(count: number): PageMeta {
  return {
    page: 1,
    pageSize: count,
    total: count,
    totalPages: count > 0 ? 1 : 0,
    hasNext: false,
    hasPrevious: false,
  };
}

/**
 * Send a request and return the envelope's `data`.
 *
 * A body without a `data` key is passed through untouched, which is what the
 * routes that answer flat want: login and refresh (`TokenResponse`), the
 * reveal-password response, and the plain `{status, message}` acknowledgements
 * behind every delete and toggle.
 */
export async function request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  const body = await send(endpoint, options);
  if (body !== null && typeof body === 'object' && 'data' in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

/** Send a request and return the envelope untouched — `data`, `meta` and any
 * siblings. Needed by `GET /admin/users/{id}`, which hangs `activity` and
 * `sessions` off the top level, by `GET /admin/audit/actions`, which does the
 * same with `groups`, and by `GET /settings`, which has no envelope at all. */
export async function requestRaw<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  return (await send(endpoint, options)) as T;
}

/** Send a request and split a paginated envelope into rows and page meta. */
export async function requestPage<T>(
  endpoint: string,
  options?: RequestOptions,
): Promise<Paged<T>> {
  const body = (await send(endpoint, options)) as ApiEnvelope<T[]> | undefined;
  const rows = Array.isArray(body?.data) ? body!.data : [];
  return { data: rows, meta: body?.meta ?? syntheticMeta(rows.length) };
}

// ─── Convenience methods ──────────────────────────────────────────────────────

const encode = (body?: unknown) =>
  body !== undefined ? JSON.stringify(body) : undefined;

export const http = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body: encode(body) }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body: encode(body) }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body: encode(body) }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  /** Paginated GET: `{ data, meta }`. */
  page: <T>(endpoint: string, options?: RequestOptions) =>
    requestPage<T>(endpoint, { ...options, method: 'GET' }),

  /** The same verbs with the envelope left intact. */
  raw: {
    get: <T>(endpoint: string, options?: RequestOptions) =>
      requestRaw<T>(endpoint, { ...options, method: 'GET' }),

    post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
      requestRaw<T>(endpoint, { ...options, method: 'POST', body: encode(body) }),

    patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
      requestRaw<T>(endpoint, { ...options, method: 'PATCH', body: encode(body) }),

    delete: <T>(endpoint: string, options?: RequestOptions) =>
      requestRaw<T>(endpoint, { ...options, method: 'DELETE' }),
  },
};
