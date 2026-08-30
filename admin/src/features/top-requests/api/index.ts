import type { QueryClient } from '@tanstack/react-query';

import { http } from '@/shared/lib/http';
import { api, type TopRequestListParams } from '@/shared/api/endpoints';
import type { AdminTopRequestRow, ReviewTopRequestPayload } from '@/shared/api/types';
import { patchListCache } from '@/shared/lib/list-cache';
import type { AdminFilters } from '@/shared/hooks/useAdminList';

/** Base react-query key; `useAdminList` appends the page and the filters. */
export const TOP_REQUESTS_QUERY_KEY = ['top-requests'] as const;

export function fetchTopRequests(params: TopRequestListParams, signal?: AbortSignal) {
  return http.page<AdminTopRequestRow>(api.topRequests.list(params), { signal });
}

/**
 * Approve a Top request, which is what actually promotes the listing.
 *
 * The single PATCH does both halves in one transaction: it settles the request
 * AND writes `is_featured`, `featured_until` and `promotion_weight` on the
 * listing behind it. There is no second call, and there is no way to settle the
 * request without promoting.
 *
 * `days` omitted means "grant exactly what the owner asked for". Approving
 * EXTENDS rather than replaces: the backend keeps the later of the two end
 * dates and the higher of the two weights, so granting a second request can
 * never shorten a promotion the owner already has running.
 */
export function approveTopRequest(id: string, days: number, promotionWeight: number) {
  const body: ReviewTopRequestPayload = { status: 'APPROVED', days, promotionWeight };
  return http.patch<AdminTopRequestRow>(api.topRequests.patch(id), body);
}

/**
 * Reject a request. The reason is the only place it is legal to send one — the
 * backend clears `rejection_reason` on an approval, so pairing the two would
 * record a rejection reason against a promoted listing.
 */
export function rejectTopRequest(id: string, rejectionReason: string) {
  const body: ReviewTopRequestPayload = { status: 'REJECTED', rejectionReason };
  return http.patch<AdminTopRequestRow>(api.topRequests.patch(id), body);
}

/**
 * Fold the response back into the cached row.
 *
 * The PATCH route joins nothing but the listing it just promoted, so the owner
 * columns and the listing photo come back null on every single call — not
 * because they changed, but because the update path never looked them up.
 * Replacing the cached row with the response would empty the owner column of
 * the row that was just decided.
 */
export function mergeTopRequestRow(
  previous: AdminTopRequestRow,
  next: AdminTopRequestRow,
): AdminTopRequestRow {
  return {
    ...previous,
    ...next,
    ownerId: next.ownerId ?? previous.ownerId,
    ownerName: next.ownerName ?? previous.ownerName,
    ownerPhone: next.ownerPhone ?? previous.ownerPhone,
    listingImage: next.listingImage ?? previous.listingImage,
    listingDistrict: next.listingDistrict ?? previous.listingDistrict,
    listingPrice: next.listingPrice ?? previous.listingPrice,
  };
}

/**
 * Patch a decided request into every cached page that holds it.
 *
 * `status` is the one filter this route understands, and deciding a request is
 * precisely what changes it — so a request approved out of a PENDING-filtered
 * queue leaves that page rather than sitting in it reading "Approved", which is
 * how a decision gets made twice. Patching rather than invalidating is what
 * keeps the moderator's scroll position between decisions.
 */
export function patchTopRequestCache(
  queryClient: QueryClient,
  next: AdminTopRequestRow,
): void {
  patchListCache(queryClient, TOP_REQUESTS_QUERY_KEY, next, {
    merge: mergeTopRequestRow,
    belongs: (filters: AdminFilters, row) =>
      typeof filters.status !== 'string' || filters.status === '' || filters.status === row.status,
  });
}

/**
 * Is this listing promoted *right now*?
 *
 * Read the date, never `listingIsFeatured`. Nothing on the backend expires a
 * promotion — `featured_until` simply passes and the boolean stays true — so a
 * sheet rendered from the boolean tells the moderator a listing is already in
 * the Top months after its week ran out, and they reject a request they should
 * have granted. Same reasoning as `isFeaturedNow` on the listings queue.
 */
export function isTopLive(row: AdminTopRequestRow, now: number = Date.now()): boolean {
  if (!row.listingFeaturedUntil) return false;
  const until = new Date(row.listingFeaturedUntil).getTime();
  return Number.isFinite(until) && until > now;
}
