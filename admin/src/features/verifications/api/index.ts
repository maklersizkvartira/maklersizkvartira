import type { QueryClient } from '@tanstack/react-query';

import { http } from '@/shared/lib/http';
import { api, type VerificationListParams } from '@/shared/api/endpoints';
import type { AdminVerificationRow, ReviewVerificationPayload } from '@/shared/api/types';
import { patchListCache } from '@/shared/lib/list-cache';
import type { AdminFilters } from '@/shared/hooks/useAdminList';

/** Base react-query key; `useAdminList` appends the page and the filters. */
export const VERIFICATIONS_QUERY_KEY = ['verifications'] as const;

export function fetchVerifications(params: VerificationListParams, signal?: AbortSignal) {
  return http.page<AdminVerificationRow>(api.verifications.list(params), { signal });
}

/**
 * Approve a verification request.
 *
 * `rejectionReason` is deliberately absent from the body. The backend assigns
 * `request.rejection_reason = payload.rejection_reason` unconditionally, so
 * omitting it here is what clears a reason left over from an earlier rejection
 * — and sending one alongside APPROVED would record a rejection reason on an
 * approved request.
 *
 * The effect is not reversible by any route in this API: it sets `is_verified`,
 * raises `verification_level` to the requested level and adds 15 to the user's
 * trust score (capped at 100). Rejecting afterwards does not undo any of it.
 */
export function approveVerification(id: string) {
  const body: ReviewVerificationPayload = { status: 'APPROVED' };
  return http.patch<AdminVerificationRow>(api.verifications.patch(id), body);
}

/** Reject a request. The reason is the only place it is legal to send one. */
export function rejectVerification(id: string, rejectionReason: string) {
  const body: ReviewVerificationPayload = { status: 'REJECTED', rejectionReason };
  return http.patch<AdminVerificationRow>(api.verifications.patch(id), body);
}

/**
 * Fold the response back into the cached row.
 *
 * `userName` and `userPhone` come from a join the PATCH path does not do, so
 * the response carries null for both and a straight replacement would empty the
 * user column of the row that was just reviewed.
 *
 * The two media fields are carried over as well: they are real columns, so the
 * response does repeat them, but they are megabytes each and keeping the
 * existing strings avoids swapping identical multi-megabyte values into the
 * cache on every review.
 */
export function mergeVerificationRow(
  previous: AdminVerificationRow,
  next: AdminVerificationRow,
): AdminVerificationRow {
  return {
    ...previous,
    ...next,
    userName: next.userName ?? previous.userName,
    userPhone: next.userPhone ?? previous.userPhone,
    documentUrl: previous.documentUrl ?? next.documentUrl,
    selfieUrl: previous.selfieUrl ?? next.selfieUrl,
  };
}

/**
 * Patch a reviewed request into every cached page that holds it.
 *
 * A reviewed request no longer belongs in a PENDING-filtered queue, so it is
 * dropped from that page rather than left in it showing "Approved". Dropping,
 * not invalidating: a blanket refetch of this queue pulls ten documents that
 * are frequently ~8 MB of base64 each, which is the exact cost the whole screen
 * is built to avoid.
 */
export function patchVerificationCache(
  queryClient: QueryClient,
  next: AdminVerificationRow,
): void {
  patchListCache(queryClient, VERIFICATIONS_QUERY_KEY, next, {
    merge: mergeVerificationRow,
    belongs: (filters: AdminFilters, row) =>
      typeof filters.status !== 'string' || filters.status === '' || filters.status === row.status,
  });
}
