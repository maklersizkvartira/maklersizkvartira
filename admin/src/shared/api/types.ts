/**
 * Wire shapes for the "Uyiz" FastAPI backend.
 *
 * Every field here was read off `backend_python/app/schemas/admin.py`,
 * `schemas/auth.py`, `schemas/common.py` and `services/admin.py`. The backend
 * serialises with a camelCase alias generator, so what Python calls
 * `trust_score` arrives as `trustScore` — the names below are the wire names,
 * not the Python ones. Nothing in this file is inferred: if a field is not
 * here, the backend does not send it.
 *
 * Dates arrive as ISO-8601 strings, uuids as plain strings.
 */

// ─── Envelope ─────────────────────────────────────────────────────────────────

/**
 * Pagination footer on every list response.
 *
 * `totalPages` is 0 — not 1 — when `total` is 0, so a "page 1 of {totalPages}"
 * label needs a guard. `page` is validated 1..10000 and `pageSize` 1..100;
 * out-of-range values come back as a 422, they are never clamped for you.
 */
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** Success envelope. `meta` is present only on paginated list routes. */
export interface ApiEnvelope<T> {
  status: 'success';
  data: T;
  meta?: PageMeta;
}

/** Error envelope. Branch on `code` — `message` is localised prose for humans. */
export interface ApiErrorEnvelope {
  status: 'error';
  code: string;
  message: string;
  field?: string;
  params?: Record<string, unknown>;
}

/** A list page after `requestPage()` has split the envelope apart. */
export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

/** What the mutation routes that return no row answer with. */
export interface MessageResponse {
  status: 'success';
  code?: string | null;
  message?: string | null;
}

// ─── Enumerations (values are the literal strings the backend stores) ─────────

/**
 * Staff rank. Authorisation on the backend is a single `>=` comparison against
 * this ladder — there are no scopes and no per-object ACLs. See
 * `@/shared/lib/permissions` for the ranking helpers.
 */
export type AdminRole = 'MODERATOR' | 'ADMIN' | 'SUPERADMIN';

/**
 * Role of an end user of the platform (not staff).
 *
 * AGENT is a realtor or an agency publishing on behalf of the people who own
 * the property; before it existed they signed up as OWNER and explained
 * themselves in the listing text. Anything that renders one of these goes
 * through `enumLabeller` rather than `t()` — the backend has twice grown a role
 * before the message catalogues did.
 */
export type UserRole =
  | 'STUDENT'
  | 'TENANT'
  | 'OWNER'
  | 'AGENT'
  | 'MODERATOR'
  | 'ADMIN'
  | 'DEVELOPER';

/**
 * Who a single listing claims to be published by, which is deliberately not the
 * publisher's `role`: an agent letting out a flat they own themselves posts as
 * OWNER, and an owner who handed one property to an agency is still an owner.
 * The backend lets only an AGENT account claim AGENT.
 */
export type SellerType = 'OWNER' | 'AGENT';

export type UserStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'BANNED'
  /** Carried over from the old backend: no password, so it cannot sign in. */
  | 'REGISTRATION_REQUIRED';

export type ListingStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'WARNING'
  | 'REJECTED'
  | 'UNDER_REVIEW'
  | 'ARCHIVED';

export type ReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export type ReportPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ReportReason =
  | 'SCAM'
  /** Retired: the public report form no longer offers it and no new report can
   *  carry it, but the enum value stays in the database for existing rows. */
  | 'BROKER'
  | 'FAKE_LISTING'
  | 'FAKE_PHOTOS'
  | 'WRONG_PRICE'
  | 'SPAM'
  | 'HARASSMENT'
  | 'OTHER';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Lifecycle of an owner's request for the promoted ("Top") rail. */
export type TopRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type VerificationDocumentType =
  | 'PASSPORT'
  | 'ID_CARD'
  | 'CADASTRE'
  | 'SELFIE_LIVENESS';

export type AuditSeverity = 'INFO' | 'NOTICE' | 'WARNING' | 'CRITICAL';

export type ActorType = 'USER' | 'ADMIN' | 'SYSTEM' | 'ANONYMOUS';

/**
 * Quick-filter buckets on the audit feed. These are lowercase on the wire
 * because the backend keys its `ACTION_GROUPS` map that way, and matches by
 * action-name prefix rather than by an enum column.
 */
export type AuditActionGroup =
  | 'auth'
  | 'user'
  | 'listing'
  | 'admin'
  | 'ai'
  | 'sms'
  | 'security';

export type UserSort = 'NEWEST' | 'OLDEST' | 'NAME' | 'TRUST' | 'LAST_LOGIN';

export type ListingSort =
  | 'NEWEST'
  | 'OLDEST'
  | 'RISK'
  | 'VIEWS'
  | 'PRICE_HIGH'
  | 'PRICE_LOW';

export type Language = 'uz' | 'ru' | 'en';

export type ThemePreference = 'light' | 'dark' | 'system';

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** The signed-in staff account, as returned by login, refresh and `/auth/me`. */
export interface AdminAccount {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: AdminRole;
  language: string;
  theme: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface LoginPayload {
  username: string;
  password: string;
}

/**
 * Login and refresh both answer with this, and it is NOT enveloped — the
 * fields sit at the top level next to `status`. Read it with `http.raw.*`,
 * never with `http.post` (which would unwrap a `data` key that is not there).
 *
 * The backend sets no cookies at all; the refresh token arrives in this body
 * and it is the client's job to park it somewhere JS cannot read.
 */
export interface TokenResponse {
  status: 'success';
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds — 1800. The refresh token lives 1 day. */
  expiresIn: number;
  admin: AdminAccount | null;
  /** Mirror of `accessToken` kept for an older client path. Ignore it. */
  token?: string | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * `GET /admin/stats`. Every field is a plain integer count.
 *
 * `tenants` is NOT a separate cohort: the backend fills it with the very same
 * query as `students` (`role == STUDENT`), so rendering both side by side
 * shows one number twice under two labels. Pick one.
 */
export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  owners: number;
  students: number;
  /** Duplicate of `students` — see the note above. */
  tenants: number;
  pendingUsers: number;
  suspendedUsers: number;
  todayNewUsers: number;
  weekNewUsers: number;
  totalListings: number;
  approvedListings: number;
  rejectedListings: number;
  pendingListings: number;
  featuredListings: number;
  todayNewListings: number;
  totalViews: number;
  openReports: number;
  pendingVerifications: number;
  /** Top (promotion) requests still waiting for a moderator's decision. */
  pendingTopRequests: number;
  aiSessions: number;
  /** AI sessions with no signed-in user attached. */
  guests: number;
  aiQueries: number;
  todayAiQueries: number;
  smsToday: number;
  smsFailedToday: number;
  visitorsToday: number;
  failedLoginsToday: number;
}

/** `GET /admin/chart/registrations`. One entry per day, gaps filled with 0. */
export interface RegistrationPoint {
  date: string;
  count: number;
}

/** `GET /admin/chart/traffic`. `visitors` counts distinct sessions, bots excluded. */
export interface TrafficPoint {
  date: string;
  visitors: number;
  views: number;
}

/** `GET /admin/chart/districts`. Listings per district, busiest first. */
export interface DistrictPoint {
  district: string;
  count: number;
}

/** `GET /admin/chart/activity`. Audit events per day split by severity. */
export interface ActivityPoint {
  date: string;
  info: number;
  notice: number;
  warning: number;
  critical: number;
}

/** `GET /settings` — the public, unauthenticated, snake_case outlier. */
export interface PublicSettings {
  is_monetization_enabled: boolean;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar: string | null;
  role: UserRole;
  /**
   * The agency an AGENT account works for; null on every other role, and null
   * for a freelance realtor who has one and belongs to nobody. The detail page
   * shows the row only when there is a value, so nothing renders an empty
   * "Agency —" line for the accounts this never applies to.
   */
  agencyName: string | null;
  status: UserStatus;
  /** 'google' when the account came from Google sign-in, otherwise 'phone'. */
  authType: string;
  trustScore: number;
  verificationLevel: number;
  isVerified: boolean;
  language: string;
  theme: string;
  xpPoints: number;
  listingsCount: number;
  approvedListings: number;
  favoritesCount: number;
  /** Whether a password exists at all — never the password itself. */
  hasPassword: boolean;
  /** Whether reveal is possible; the reveal itself is a separate audited call. */
  passwordRevealable: boolean;
  passwordUpdatedAt: string | null;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  phoneVerifiedAt: string | null;
  suspendedReason: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A live refresh token, i.e. one device still signed in as this user. */
export interface AdminUserSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
}

/**
 * `GET /admin/users/{id}` — the one route whose extras are SIBLINGS of `data`
 * rather than nested inside it. The body is
 * `{ status, data: AdminUserRow, activity: [...], sessions: [...] }`, so it has
 * to be read with `http.raw.get<AdminUserDetail>(...)`; `http.get` would unwrap
 * `data` and throw the activity feed and the session list away.
 */
export interface AdminUserDetail {
  status: 'success';
  data: AdminUserRow;
  /** Last 50 audit rows where this user was the actor or the entity. */
  activity: AuditLogRow[];
  /** Up to 20 unrevoked, unused refresh tokens. */
  sessions: AdminUserSession[];
}

/** Body of `PATCH /admin/users/{id}`. Every field is optional. */
export interface AdminUserPatch {
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  /** 0..100. */
  trustScore?: number;
  /** 1..5. */
  verificationLevel?: number;
  isVerified?: boolean;
  language?: Language;
  adminNote?: string;
  suspendedReason?: string;
}

/** Body of `POST /admin/users/{id}/set-password`. */
export interface AdminSetPasswordPayload {
  /** 8..128 characters; the backend also runs its own strength policy. */
  newPassword: string;
  mustChange?: boolean;
  revokeSessions?: boolean;
}

/**
 * `POST /admin/users/{id}/reveal-password`. Flat, not enveloped. Every call
 * writes a CRITICAL audit row naming the admin who made it — `auditId` is that
 * row, and `warning` is prose already translated into the request's language.
 */
export interface RevealPasswordResponse {
  status: 'success';
  userId: string;
  password: string;
  auditId: string;
  warning: string;
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export interface AdminListingRow {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  rooms: number;
  area: number | null;
  region: string | null;
  district: string | null;
  address: string | null;
  /**
   * Usually CDN URLs, but legacy rows hold base64 `data:` URIs that run to
   * several megabytes EACH. Never render this array un-virtualised in a table
   * cell, and never put it through `JSON.stringify` for a debug view.
   */
  images: string[];
  status: ListingStatus;
  /**
   * The seller claim this listing makes, and the agency named on it.
   *
   * `sellerType` is never absent: the column is NOT NULL with a default of
   * OWNER and the migration backfilled every row that predates it, so "OWNER"
   * on an old listing means "nobody was ever asked", not "the owner said so".
   * That is why the moderation sheet gives a badge to AGENT only.
   *
   * `agencyName` is the agency as it was at the moment of publishing, not as
   * the account spells it today — an agent who changes agencies must not
   * silently rewrite who every flat they ever listed was represented by. The
   * backend clears it whenever `sellerType` is OWNER, so the two can never
   * contradict each other on a row.
   */
  sellerType: SellerType;
  agencyName: string | null;
  trustScore: number;
  riskScore: number;
  aiRiskReasons: string[];
  safetyBadges: string[];
  isFeatured: boolean;
  featuredUntil: string | null;
  promotionWeight: number;
  viewsCount: number;
  favoritesCount: number;
  contactCount: number;
  moderationNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerRole: string | null;
  ownerTrustScore: number | null;
  reportCount: number;
}

/** Body of `PATCH /admin/listings/{id}/status`. Returns the updated row. */
export interface ListingModerationPayload {
  status: ListingStatus;
  note?: string;
}

/**
 * Body of `PATCH /admin/listings/{id}/feature`. Returns the updated row.
 * `days` and `promotionWeight` are ignored when `isFeatured` is false — the
 * backend zeroes the weight and clears `featuredUntil` itself.
 */
export interface ListingFeaturePayload {
  isFeatured: boolean;
  /** 1..365, default 7. */
  days?: number;
  /** 0..1000, default 0. */
  promotionWeight?: number;
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export interface AuditLogRow {
  id: string;
  createdAt: string;
  actorType: ActorType;
  actorId: string | null;
  actorLabel: string | null;
  /** A stable `AuditAction` name, e.g. 'ADMIN_USER_PASSWORD_REVEALED'. */
  action: string;
  severity: AuditSeverity;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  summary: string | null;
  /** Free-form diff, shape varies per action. Null on most rows. */
  changes: Record<string, unknown> | null;
  /** Free-form context, shape varies per action. Null on most rows. */
  meta: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
}

/** One row of `GET /admin/audit/actions`, for the action dropdown. */
export interface AuditActionCount {
  action: string;
  count: number;
}

/**
 * `GET /admin/audit/actions` in full — `groups` is a sibling of `data`, so this
 * route also needs `http.raw.get`.
 */
export interface AuditActionsResponse {
  status: 'success';
  data: AuditActionCount[];
  groups: AuditActionGroup[];
}

// ─── Reports & verifications ──────────────────────────────────────────────────

export interface AdminReportRow {
  id: string;
  listingId: string;
  listingTitle: string | null;
  reporterLabel: string | null;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  priority: ReportPriority;
  aiRiskScore: number;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/**
 * Body of `PATCH /admin/reports/{id}`. `listingAction` lets one call resolve
 * the report and act on the listing behind it in the same transaction.
 */
export interface ResolveReportPayload {
  status: ReportStatus;
  note?: string;
  listingAction?: 'NONE' | 'REJECT' | 'DELETE' | 'APPROVE';
}

export interface AdminVerificationRow {
  id: string;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  targetLevel: number;
  documentType: VerificationDocumentType;
  /**
   * Frequently a base64 `data:` URI around 8 MB, not a URL — users upload
   * straight from a phone camera. Load it lazily, behind a click.
   */
  documentUrl: string | null;
  /** Same caveat as `documentUrl`. */
  selfieUrl: string | null;
  status: VerificationStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** Body of `PATCH /admin/verifications/{id}`. Returns the updated row. */
export interface ReviewVerificationPayload {
  status: VerificationStatus;
  rejectionReason?: string;
}

// ─── Top (promotion) requests ─────────────────────────────────────────────────

/**
 * One row of `GET /admin/top-requests`: an owner asking for the promoted rail.
 *
 * The request is the CAUSE and `Listing.isFeatured` / `featuredUntil` /
 * `promotionWeight` are the EFFECT an approval writes — nothing is promoted
 * until a moderator approves the row.
 */
export interface AdminTopRequestRow {
  id: string;
  listingId: string;
  /** Joined by the list route; the PATCH route fills these in by hand. */
  listingTitle: string | null;
  listingDistrict: string | null;
  listingPrice: number | null;
  /** ONE image, never the array — see the `images` caveat on AdminListingRow. */
  listingImage: string | null;
  listingIsFeatured: boolean;
  listingFeaturedUntil: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  requestedDays: number;
  note: string | null;
  status: TopRequestStatus;
  rejectionReason: string | null;
  /** Non-null only on an approved request: what the moderator actually granted. */
  grantedDays: number | null;
  grantedWeight: number | null;
  grantedUntil: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * Body of `PATCH /admin/top-requests/{id}`. Returns the updated row.
 *
 * `days` and `promotionWeight` are read only when approving; omitting `days`
 * means "grant what the owner asked for". Approving EXTENDS an existing
 * promotion — the backend keeps the later of the two end dates and the higher
 * of the two weights — so a second grant can never shorten a live run. A
 * request that has already been decided answers 409 `top_request_already_reviewed`.
 */
export interface ReviewTopRequestPayload {
  status: Exclude<TopRequestStatus, 'PENDING'>;
  /** 1..365. */
  days?: number;
  /** 0..1000, default 100. */
  promotionWeight?: number;
  rejectionReason?: string;
}

// ─── AI, SMS, security ────────────────────────────────────────────────────────

export interface AdminAiSessionRow {
  id: string;
  sessionKey: string;
  userId: string | null;
  userName: string | null;
  /** Set instead of `userName` when the session belongs to an anonymous guest. */
  guestLabel: string | null;
  language: string;
  messageCount: number;
  summary: string | null;
  /** Last classified intent; shape depends on the model that produced it. */
  lastIntent: Record<string, unknown> | null;
  closedAt: string | null;
  ip: string | null;
  createdAt: string;
}

/** `GET /admin/ai/sessions/{id}/messages`. Oldest first, capped at 200 rows. */
export interface AdminAiMessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** Listings the assistant cited in this turn; empty on user turns. */
  listingIds: string[];
}

export interface AdminSmsRow {
  id: string;
  phone: string;
  /** 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET' | 'PHONE_CHANGE'. */
  purpose: string;
  provider: string;
  /** 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED'. */
  status: string;
  template: string | null;
  error: string | null;
  /** Billable SMS segments. */
  parts: number;
  createdAt: string;
}

export interface AdminLoginAttemptRow {
  id: string;
  /** Set for user sign-ins, which are keyed by phone. */
  phone: string | null;
  /** Set for staff sign-ins, which are keyed by username. */
  username: string | null;
  successful: boolean;
  failureReason: string | null;
  isAdminPortal: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ─── Staff accounts ───────────────────────────────────────────────────────────

export interface AdminStaffRow {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  failedLoginCount: number;
  lockedUntil: string | null;
  /** Comma-separated CIDRs, or null for "any address". */
  ipAllowlist: string | null;
  createdAt: string;
}

/**
 * Body of `POST /admin/staff`. The new account is always created with
 * `mustChangePassword` set, so the password below is a one-time handover.
 */
export interface CreateStaffPayload {
  /** 3..64 chars, `^[a-z0-9._-]+$`. */
  username: string;
  fullName: string;
  /** 12..128 chars — longer than the 8 the user-facing policy allows. */
  password: string;
  email?: string;
  role?: AdminRole;
  ipAllowlist?: string;
}


/**
 * What the paid services have left.
 *
 * `sms` is null when the provider could not be reached or no token is set —
 * shown as unknown rather than as zero, because zero is a real and alarming
 * value and the two must not look alike.
 */
export interface AdminBalances {
  sms: {
    balance: number;
    smsPrice: number;
    /** How many more codes can be sent before signup stops working. */
    remainingSms: number | null;
  } | null;
  ai: {
    messagesToday: number;
    messagesThisMonth: number;
    sessionsToday: number;
    /**
     * Always false today. OpenAI publishes no credit endpoint for an ordinary
     * API key, so the spend has to be read in their own dashboard; this flag
     * is what lets the panel say that instead of showing a blank.
     */
    costAvailable: boolean;
  };
}
