import type { ListingSort, ListingStatus, SellerType } from '@/shared/api/types';

/**
 * Wire values and limits for the listings queue, kept beside the fetchers so a
 * dropdown and the request it produces can never drift apart.
 */

/**
 * 24 rows a page.
 *
 * Higher would be nicer to page through and is a trap: `images` may hold base64
 * data URIs of several megabytes EACH, so the response size scales with this
 * number far faster than the row count suggests. 24 keeps a bad page in the low
 * tens of megabytes instead of the hundreds.
 */
export const LISTINGS_PAGE_SIZE = 24;

/** Every status the backend's enum holds, in moderation-queue order. */
export const LISTING_STATUSES: ListingStatus[] = [
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'WARNING',
  'REJECTED',
  'DRAFT',
  'ARCHIVED',
];

export const LISTING_SORTS: ListingSort[] = [
  'NEWEST',
  'OLDEST',
  'RISK',
  'VIEWS',
  'PRICE_HIGH',
  'PRICE_LOW',
];

/**
 * The statuses `listings.status.*` actually has messages for.
 *
 * WARNING and UNDER_REVIEW exist in the backend enum but not in the catalogues,
 * and next-intl throws on a missing key rather than rendering a blank — so
 * every `t()` of a status goes through this set first and falls back to the
 * wire value.
 */
export const TRANSLATED_LISTING_STATUSES = new Set<string>([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'ARCHIVED',
]);

/**
 * Both claims a listing can make about who is publishing it.
 *
 * Passed to `enumLabeller` so a `listings.seller.*` message that goes missing
 * is a dev-time warning rather than an English word rendered quietly into the
 * Uzbek panel — see `shared/lib/enum-label`.
 */
export const SELLER_TYPES: SellerType[] = ['OWNER', 'AGENT'];

/** Statuses offered as a one-tap decision in the moderation sheet. */
export const APPROVE_STATUS: ListingStatus = 'APPROVED';
export const REJECT_STATUS: ListingStatus = 'REJECTED';

/* ─── Promotion ─────────────────────────────────────────────────────────────
   `days` is 1..365 and `promotionWeight` 0..1000 on the backend; anything
   outside is a 422, not a clamp. The defaults below are what the form starts
   at for a listing that has never been promoted — the panel this replaces
   hardcoded 7 and 10 with no way to change either. */

export const FEATURE_DAYS_MIN = 1;
export const FEATURE_DAYS_MAX = 365;
export const FEATURE_DAYS_DEFAULT = 7;

export const FEATURE_WEIGHT_MIN = 0;
export const FEATURE_WEIGHT_MAX = 1000;
/** Mid-scale, so a first promotion has room to be out-bid in both directions. */
export const FEATURE_WEIGHT_DEFAULT = 100;

/** `note` is `str | None`, max 1000 — the backend truncates nothing. */
export const MODERATION_NOTE_MAX = 1000;
