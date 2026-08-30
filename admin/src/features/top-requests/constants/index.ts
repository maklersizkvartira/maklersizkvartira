import type { TopRequestStatus } from '@/shared/api/types';

/**
 * Wire values and limits for the Top (promotion) queue.
 *
 * `status` is the only filter `GET /admin/top-requests` understands, and it is
 * a bare route parameter compared upper-cased against the column — so an
 * unrecognised value answers with an empty page, not a 422.
 *
 * The promotion bounds themselves are NOT redeclared here. They live in
 * `@/features/listings/constants` (FEATURE_DAYS_* / FEATURE_WEIGHT_*) because
 * approving a request writes the very same three columns as the manual promote
 * on the listings screen, and two copies of 1..365 / 0..1000 would eventually
 * disagree — at which point one of the two surfaces starts 422-ing.
 */
export const TOP_REQUEST_STATUSES: TopRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

/** What the `topRequests.status.*` catalogue covers. Guarded because next-intl
 *  throws on a missing key rather than rendering a blank, so a value the backend
 *  adds before the messages catch up has to fall back to its wire form. */
export const TRANSLATED_TOP_REQUEST_STATUSES = new Set<string>(TOP_REQUEST_STATUSES);

/**
 * 25 rows a page.
 *
 * One more than the listings queue because a row here carries a single image
 * rather than the whole `images` array. That single image can still be a
 * multi-megabyte base64 data URI on a legacy listing, so it is rendered through
 * the lazy `Thumb` and nothing on this screen decodes one up front. If the
 * payload ever turns out to be dominated by them, drop this to 10 — the same
 * reasoning that put the verifications queue there.
 */
export const TOP_REQUESTS_PAGE_SIZE = 25;

/** `rejection_reason` is `str | None`, max 500 on the PATCH route. */
export const TOP_REJECTION_REASON_MAX = 500;
