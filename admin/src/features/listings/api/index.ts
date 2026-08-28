import type { QueryClient } from '@tanstack/react-query';

import { http } from '@/shared/lib/http';
import { api, type ListingListParams } from '@/shared/api/endpoints';
import type {
  AdminListingRow,
  ListingFeaturePayload,
  ListingStatus,
  MessageResponse,
} from '@/shared/api/types';
import { patchListCache } from '@/shared/lib/list-cache';
import type { AdminFilters } from '@/shared/hooks/useAdminList';

/** Base react-query key; `useAdminList` appends the page and the filters. */
export const LISTINGS_QUERY_KEY = ['listings'] as const;

/**
 * Body of `PATCH /admin/listings/{id}/status`.
 *
 * Widened from `ListingModerationPayload` because the backend assigns
 * `listing.moderation_note = payload.note` unconditionally: an explicit `null`
 * CLEARS the note, and omitting the key does exactly the same thing. There is
 * no "leave the note alone" call, so this screen always sends the field and
 * lets `null` mean cleared rather than pretending the choice does not exist.
 */
export interface ListingModerationBody {
  status: ListingStatus;
  note: string | null;
}

export function fetchListings(params: ListingListParams, signal?: AbortSignal) {
  return http.page<AdminListingRow>(api.listings.list(params), { signal });
}

export function moderateListing(id: string, body: ListingModerationBody) {
  return http.patch<AdminListingRow>(api.listings.status(id), body);
}

export function featureListing(id: string, body: ListingFeaturePayload) {
  return http.patch<AdminListingRow>(api.listings.feature(id), body);
}

/** ADMIN+. Soft-deletes on the backend, but there is no undelete route. */
export function deleteListing(id: string) {
  return http.delete<MessageResponse>(api.listings.remove(id));
}

/**
 * Is this listing promoted *right now*?
 *
 * Read the date, never `isFeatured`. Nothing on the backend expires a
 * promotion — `featured_until` simply passes and the boolean stays true — so a
 * table rendered from `isFeatured` shows listings as promoted months after
 * their week ran out.
 */
export function isFeaturedNow(row: AdminListingRow, now: number = Date.now()): boolean {
  if (!row.featuredUntil) return false;
  const until = new Date(row.featuredUntil).getTime();
  return Number.isFinite(until) && until > now;
}

/**
 * Fold a mutation response back into the row it came from.
 *
 * Both PATCH routes answer with `AdminListingRow.model_validate(listing)` and
 * no join, so `ownerName`, `ownerPhone`, `ownerRole` and `ownerTrustScore` come
 * back null and `reportCount` comes back 0 on every single call — not because
 * they changed, but because the update path never looked them up. Replacing the
 * cached row with the response therefore blanks the owner column of the table
 * the moment a listing is approved.
 *
 * `??` on the owner fields so a future backend that does join wins; a literal
 * carry-over for `reportCount`, where 0 is a legal value and so indistinguish-
 * able from "not computed". Report counts change on the reports screen, which
 * invalidates this list anyway.
 */
export function mergeListingRow(
  previous: AdminListingRow,
  next: AdminListingRow,
): AdminListingRow {
  return {
    ...previous,
    ...next,
    ownerName: next.ownerName ?? previous.ownerName,
    ownerPhone: next.ownerPhone ?? previous.ownerPhone,
    ownerRole: next.ownerRole ?? previous.ownerRole,
    ownerTrustScore: next.ownerTrustScore ?? previous.ownerTrustScore,
    reportCount: previous.reportCount,
  };
}

/**
 * Does this row still belong on a page fetched under these filters?
 *
 * Two of the six listing filters are things this screen's mutations change.
 * `status` moves with every moderation decision and `isFeatured` with every
 * promotion, and both are applied server-side — `?status=…` and
 * `Listing.is_featured.is_(…)`. The other four (search, district, minRiskScore,
 * sortBy) describe fields no mutation here touches, so they are not consulted.
 *
 * Note this reads the `isFeatured` COLUMN, the same thing the request asked the
 * server about — not `isFeaturedNow`, which answers the different question of
 * whether the promotion has run out.
 */
function listingMatchesFilters(filters: AdminFilters, row: AdminListingRow): boolean {
  const status = filters.status;
  if (typeof status === 'string' && status !== '' && status !== row.status) return false;

  const isFeatured = filters.isFeatured;
  if (typeof isFeatured === 'string' && isFeatured !== '') {
    if ((isFeatured === 'true') !== row.isFeatured) return false;
  }

  return true;
}

/**
 * Merge a mutation response into every cached listings page holding that row.
 *
 * A prefix match on `['listings']` reaches all of them, whichever page number
 * and filter set they were fetched under. Patching in place rather than
 * invalidating is what keeps the moderator's scroll position and the sheet they
 * are looking at from resetting after each decision — but a row the decision
 * has moved out of the active filter is dropped from that page rather than
 * rewritten inside it. See `patchListCache`.
 */
export function patchListingCache(queryClient: QueryClient, next: AdminListingRow): void {
  patchListCache(queryClient, LISTINGS_QUERY_KEY, next, {
    merge: mergeListingRow,
    belongs: listingMatchesFilters,
  });
}
