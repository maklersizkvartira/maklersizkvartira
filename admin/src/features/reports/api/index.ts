import type { QueryClient } from '@tanstack/react-query';

import { http } from '@/shared/lib/http';
import { api, type ReportListParams } from '@/shared/api/endpoints';
import type { AdminReportRow, ResolveReportPayload } from '@/shared/api/types';
import { patchListCache } from '@/shared/lib/list-cache';
import type { AdminFilters } from '@/shared/hooks/useAdminList';

/** Base react-query key; `useAdminList` appends the page and the filters. */
export const REPORTS_QUERY_KEY = ['reports'] as const;

export function fetchReports(params: ReportListParams, signal?: AbortSignal) {
  return http.page<AdminReportRow>(api.reports.list(params), { signal });
}

/**
 * Resolve a report, and optionally act on the listing behind it in the same
 * transaction.
 *
 * Two things about `listingAction` that the copy on this screen has to carry,
 * because neither is guessable from the name:
 *
 *  · 'DELETE' soft-deletes the listing from inside this MODERATOR route, even
 *    though `DELETE /admin/listings/{id}` itself is ADMIN+. It is the one place
 *    a moderator can destroy a listing.
 *  · 'APPROVE' sets `status = APPROVED` but does NOT touch `published_at`,
 *    unlike the approve on the listings screen. A listing approved this way is
 *    approved without being published.
 */
export function resolveReport(id: string, body: ResolveReportPayload) {
  return http.patch<AdminReportRow>(api.reports.patch(id), body);
}

/**
 * Fold the response back into the cached row.
 *
 * `listingTitle` is the one field on this row that comes from a join, and the
 * PATCH path does not do it — so the response always carries `null` there and a
 * straight replacement empties the "listing" column of the row that was just
 * resolved. Everything else on `AdminReportRow` is a real column and can be
 * taken from the response.
 */
export function mergeReportRow(previous: AdminReportRow, next: AdminReportRow): AdminReportRow {
  return { ...previous, ...next, listingTitle: next.listingTitle ?? previous.listingTitle };
}

/**
 * Patch a resolved report into every cached page that holds it.
 *
 * `status` is the one filter this route understands, and resolving a report is
 * precisely what changes it — so a report resolved out of an OPEN-filtered
 * queue leaves that page rather than sitting in it reading "Resolved". Nothing
 * else on the row participates in the query: priority, reason and listing are
 * faceted client-side over the page in hand.
 */
export function patchReportCache(queryClient: QueryClient, next: AdminReportRow): void {
  patchListCache(queryClient, REPORTS_QUERY_KEY, next, {
    merge: mergeReportRow,
    belongs: (filters: AdminFilters, row) =>
      typeof filters.status !== 'string' || filters.status === '' || filters.status === row.status,
  });
}
