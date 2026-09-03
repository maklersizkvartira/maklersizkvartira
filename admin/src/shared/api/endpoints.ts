/**
 * Every path the admin panel is allowed to call, and the exact spelling of
 * every query parameter each one accepts.
 *
 * ── The casing rule, which is the whole reason this file builds query strings
 *    for you instead of exporting bare path constants ──
 *
 * The backend reads filters two different ways, and they disagree on casing:
 *
 *   • Filters that arrive through a `Depends()` pydantic model are camelCase
 *     ONLY, because those models carry a camelCase alias generator:
 *       pageSize, sortBy, hasListings, isFeatured, minRiskScore,
 *       actionGroup, actorType, entityType, entityId, actorId,
 *       dateFrom, dateTo
 *   • Filters that are bare function parameters on the route are snake_case:
 *       days, limit, status, only_failed, is_active
 *
 * An unknown key is SILENTLY IGNORED — FastAPI does not reject it, it just
 * drops it, and the endpoint answers 200 with an unfiltered list. The panel
 * this one replaces shipped a Security screen whose "only failed" checkbox
 * sent `onlyFailed` and therefore did precisely nothing for its entire life,
 * with no error anywhere to hint at it. Typing the parameter objects below is
 * the only thing standing between us and that bug happening again, so add new
 * filters to the interfaces rather than hand-appending them to a URL.
 *
 * All paths are relative to `env.API_URL`, which already ends in `/api/v1`.
 * Everything under `/admin` needs a staff bearer token; `/settings` does not.
 */

import type {
  AuditActionGroup,
  AuditSeverity,
  ActorType,
  ListingSort,
  ListingStatus,
  ReportStatus,
  TopRequestStatus,
  UserRole,
  UserSort,
  UserStatus,
  VerificationStatus,
} from './types';

// ─── Query-string builder ─────────────────────────────────────────────────────

/**
 * Serialise a parameter object, dropping keys the caller left empty.
 *
 * Empty string is dropped alongside null/undefined so a cleared search box
 * sends no `search` key at all rather than `search=`, which the backend would
 * happily match every row against.
 */
function qs(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

// ─── Parameter shapes ─────────────────────────────────────────────────────────

/**
 * Pagination, accepted by every list route. camelCase — it comes from the
 * `PaginationParams` dependency. `page` is 1..10000 and `pageSize` 1..100;
 * anything outside that is a 422, not a clamp.
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/** `GET /admin/users` — camelCase, from `AdminUserFilters`. */
export interface UserListParams extends PaginationParams {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  hasListings?: boolean;
  sortBy?: UserSort;
}

/** `GET /admin/listings` — camelCase, from `AdminListingFilters`. */
export interface ListingListParams extends PaginationParams {
  search?: string;
  status?: ListingStatus;
  district?: string;
  isFeatured?: boolean;
  /**
   * 0..100. Shows only listings whose risk score is at least this high.
   *
   * No model produces that number any more: since publish-time AI scoring was
   * removed the backend maintains `riskScore` as the inverse of the listing's
   * reliability score, which moves only when a moderator confirms a complaint.
   * So this filter now means "listings with upheld complaints against them",
   * which is a more useful queue than the one it used to be.
   */
  minRiskScore?: number;
  sortBy?: ListingSort;
}

/** `GET /admin/audit` — camelCase, from `AuditFilters`. */
export interface AuditListParams extends PaginationParams {
  search?: string;
  /** An exact action name, e.g. 'ADMIN_USER_PASSWORD_REVEALED'. */
  action?: string;
  /** A prefix bucket; mutually useful with, not exclusive of, `action`. */
  actionGroup?: AuditActionGroup;
  actorType?: ActorType;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  severity?: AuditSeverity;
  /** Substring match against the stored address, not an exact comparison. */
  ip?: string;
  /** ISO-8601 datetime. */
  dateFrom?: string;
  /** ISO-8601 datetime. */
  dateTo?: string;
}

/** `GET /admin/reports` — `status` is a bare route parameter, so lowercase. */
export interface ReportListParams extends PaginationParams {
  status?: ReportStatus;
}

/** `GET /admin/verifications` — `status` is a bare route parameter. */
export interface VerificationListParams extends PaginationParams {
  status?: VerificationStatus;
}

/** `GET /admin/top-requests` — `status` is a bare route parameter. */
export interface TopRequestListParams extends PaginationParams {
  status?: TopRequestStatus;
}

/**
 * `GET /admin/security/login-attempts`. `only_failed` is snake_case because it
 * is a bare route parameter, NOT part of a `Depends()` model. Spelling it
 * `onlyFailed` produces a silently unfiltered list.
 */
export interface LoginAttemptParams extends PaginationParams {
  only_failed?: boolean;
}

// ─── The surface ──────────────────────────────────────────────────────────────

export const api = {
  /**
   * Login and refresh answer with a flat `TokenResponse`, not an envelope, and
   * the backend sets no cookies — the tokens come back in the JSON body.
   */
  auth: {
    login: '/admin/auth/login',
    verifyCredentials: '/admin/auth/verify-credentials',
    faceLogin: '/admin/auth/face-login',
    faceRegister: '/admin/auth/face-register',
    faceStatus: '/admin/auth/face-status',
    faceDelete: '/admin/auth/face-delete',
    refresh: '/admin/auth/refresh',
    /** Bumps the account's token_version, killing every live access token. */
    logout: '/admin/auth/logout',
    me: '/admin/auth/me',
  },

  /** `GET` — the 26 dashboard counters. MODERATOR+. */
  stats: '/admin/stats',

  /**
   * `GET` — SMS credit and assistant usage. MODERATOR+.
   *
   * Separate from `stats` because it leaves the building: it calls the SMS
   * provider, so a slow one would hold up every counter on the page if the
   * two were fetched together.
   */
  balances: '/admin/balances',

  charts: {
    /** `days` 1..90, default 7. Bare parameter, so snake/lowercase. */
    registrations: (days?: number) => `/admin/chart/registrations${qs({ days })}`,
    /** `days` 1..90, default 7. */
    traffic: (days?: number) => `/admin/chart/traffic${qs({ days })}`,
    /** `limit` 1..30, default 10. */
    districts: (limit?: number) => `/admin/chart/districts${qs({ limit })}`,
    /** `days` 1..90, default 7. */
    activity: (days?: number) => `/admin/chart/activity${qs({ days })}`,
  },

  settings: {
    /**
     * Public and unauthenticated, and the single response in the whole API
     * with no envelope and snake_case keys: `{ is_monetization_enabled }`.
     * Call it with `skipAuth` and read it with `http.raw.get`.
     */
    publicRead: '/settings',
    /**
     * `POST`, SUPERADMIN only. Answers with a MessageResponse and no new
     * value, so refetch `settings.publicRead` afterwards to learn the result.
     */
    toggleMonetization: '/admin/settings/toggle-monetization',
  },

  users: {
    /** `GET`, MODERATOR+. */
    list: (params?: UserListParams) => `/admin/users${qs({ ...params })}`,
    /** `GET`, MODERATOR+. Puts `activity` and `sessions` beside `data`. */
    detail: (id: string) => `/admin/users/${id}`,
    /** `PATCH`, ADMIN+. Body: `AdminUserPatch`. Returns the updated row. */
    patch: (id: string) => `/admin/users/${id}`,
    /** `POST`, ADMIN+. Rate-limited and written to the audit log at CRITICAL. */
    revealPassword: (id: string) => `/admin/users/${id}/reveal-password`,
    /** `POST`, ADMIN+. Body: `AdminSetPasswordPayload`. */
    setPassword: (id: string) => `/admin/users/${id}/set-password`,
    /** `POST`, ADMIN+. Signs the user out of every device. */
    revokeSessions: (id: string) => `/admin/users/${id}/revoke-sessions`,
    /** `DELETE`, SUPERADMIN only. */
    remove: (id: string) => `/admin/users/${id}`,
  },

  listings: {
    /** `GET`, MODERATOR+. */
    list: (params?: ListingListParams) => `/admin/listings${qs({ ...params })}`,
    /** `PATCH`, MODERATOR+. Body: `ListingModerationPayload`. */
    status: (id: string) => `/admin/listings/${id}/status`,
    /** `PATCH`, MODERATOR+. Body: `ListingFeaturePayload`. */
    feature: (id: string) => `/admin/listings/${id}/feature`,
    /** `DELETE`, ADMIN+. */
    remove: (id: string) => `/admin/listings/${id}`,
  },

  audit: {
    /** `GET`, MODERATOR+. */
    list: (params?: AuditListParams) => `/admin/audit${qs({ ...params })}`,
    /** `GET`, MODERATOR+. Distinct action names plus the group list. */
    actions: '/admin/audit/actions',
  },

  reports: {
    /** `GET`, MODERATOR+. */
    list: (params?: ReportListParams) => `/admin/reports${qs({ ...params })}`,
    /** `PATCH`, MODERATOR+. Body: `ResolveReportPayload`. */
    patch: (id: string) => `/admin/reports/${id}`,
  },

  verifications: {
    /** `GET`, MODERATOR+. */
    list: (params?: VerificationListParams) => `/admin/verifications${qs({ ...params })}`,
    /** `PATCH`, MODERATOR+. Body: `ReviewVerificationPayload`. */
    patch: (id: string) => `/admin/verifications/${id}`,
  },

  /**
   * Owners asking for the promoted ("Top") rail. Same MODERATOR gate as
   * `listings.feature`, because approving one does the same three writes.
   */
  topRequests: {
    /** `GET`, MODERATOR+. */
    list: (params?: TopRequestListParams) => `/admin/top-requests${qs({ ...params })}`,
    /** `PATCH`, MODERATOR+. Body: `ReviewTopRequestPayload`. */
    patch: (id: string) => `/admin/top-requests/${id}`,
  },

  ai: {
    /** `GET`, MODERATOR+. Pagination only — no filters exist on this route. */
    sessions: (params?: PaginationParams) => `/admin/ai/sessions${qs({ ...params })}`,
    /** `GET`, MODERATOR+. Not paginated; returns up to 200 messages, oldest first. */
    sessionMessages: (sessionId: string) => `/admin/ai/sessions/${sessionId}/messages`,
  },

  /** `GET`, ADMIN+. Pagination only. */
  sms: (params?: PaginationParams) => `/admin/sms${qs({ ...params })}`,

  security: {
    /** `GET`, ADMIN+. Note the snake_case `only_failed`. */
    loginAttempts: (params?: LoginAttemptParams) =>
      `/admin/security/login-attempts${qs({ ...params })}`,
  },

  staff: {
    /** `GET`, SUPERADMIN only. Not paginated — every staff account, oldest first. */
    list: '/admin/staff',
    /** `POST`, SUPERADMIN only. Body: `CreateStaffPayload`. */
    create: '/admin/staff',
    /**
     * `PATCH`, SUPERADMIN only. `is_active` is a REQUIRED snake_case QUERY
     * parameter and the request carries no body at all. Deactivating also
     * revokes that account's sessions and bumps its token_version.
     */
    setActive: (id: string, isActive: boolean) =>
      `/admin/staff/${id}/active${qs({ is_active: isActive })}`,
  },
} as const;
