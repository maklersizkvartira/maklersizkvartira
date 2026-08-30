import type {
  ReportPriority,
  ReportReason,
  ReportStatus,
  ResolveReportPayload,
} from '@/shared/api/types';

/**
 * Wire values for the report queue.
 *
 * `status` is the ONLY filter `GET /admin/reports` understands, and it is a
 * bare route parameter rather than part of a `Depends()` model. An unrecognised
 * value is upper-cased and compared against the column, so it comes back as an
 * empty page rather than a 422 — which is why the dropdown is built from this
 * list instead of accepting free text.
 */
export const REPORT_STATUSES: ReportStatus[] = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'];

/** Highest first, which is also the order a queue should be worked in. */
export const REPORT_PRIORITY_ORDER: ReportPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export type ReportListingAction = NonNullable<ResolveReportPayload['listingAction']>;

export const REPORT_LISTING_ACTIONS: ReportListingAction[] = [
  'NONE',
  'APPROVE',
  'REJECT',
  'DELETE',
];

/**
 * The whole `ReportReason` enum. Only used to declare what the catalogues
 * cover — the facet dropdown is built from the rows in hand, not from this
 * list.
 *
 * `BROKER` is no longer offered by the public report form and no new report can
 * carry it: the platform works with agents as well as owners, so "this is a
 * broker" is not a violation of anything. It stays in this list, and keeps a
 * catalogue entry, because the enum value stays in the database for the rows
 * filed before that changed — drop it here and every one of those historical
 * reports prints the raw wire string `BROKER` to a moderator instead of a
 * sentence. Its label was rewritten to describe the genuine abuse behind those
 * old reports (someone posing as the owner) rather than the broker framing.
 */
export const REPORT_REASONS: ReportReason[] = [
  'SCAM',
  'BROKER',
  'FAKE_LISTING',
  'FAKE_PHOTOS',
  'WRONG_PRICE',
  'SPAM',
  'HARASSMENT',
  'OTHER',
];

/** What the `reports.*` catalogues actually cover. A value outside these sets
 *  prints its wire form: next-intl throws on a missing key rather than
 *  rendering a blank, so every lookup on this screen is guarded by one. */
export const TRANSLATED_REPORT_STATUSES = new Set<string>(REPORT_STATUSES);
export const TRANSLATED_LISTING_ACTIONS = new Set<string>(REPORT_LISTING_ACTIONS);
export const TRANSLATED_REPORT_REASONS = new Set<string>(REPORT_REASONS);
export const TRANSLATED_REPORT_PRIORITIES = new Set<string>(REPORT_PRIORITY_ORDER);

/**
 * 50 rows a page.
 *
 * Larger than the other queues on purpose: priority, reason and listing have no
 * server-side filter at all, so they are faceted over whatever page is in hand.
 * A page big enough to be worth faceting is the honest way to offer them —
 * reports carry no images, so the payload stays small. The backend caps
 * `pageSize` at 100.
 */
export const REPORTS_PAGE_SIZE = 50;

/** `note` is `str | None`, max 1000 on `PATCH /admin/reports/{id}`. */
export const REPORT_NOTE_MAX = 1000;
