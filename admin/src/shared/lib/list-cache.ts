import type { QueryClient } from '@tanstack/react-query';

import type { AdminFilters, AdminListResult } from '@/shared/hooks/useAdminList';

/**
 * Fold a mutation response back into every cached list page holding that row.
 *
 * Patching in place rather than invalidating is deliberate: it keeps the
 * moderator's scroll position and the sheet they are reading, and on the
 * verifications queue it is the difference between a repaint and refetching ten
 * multi-megabyte base64 documents after every decision.
 *
 * But an in-place patch is only honest while the mutated field is not part of
 * the query. `status` is: it is sent as `?status=…` and applied server-side, so
 * a row whose status has just changed can stop belonging to the page it is
 * sitting in. Rewriting it there leaves an approved listing inside a queue
 * filtered to PENDING, still counted in the total and still tappable — which is
 * how a decision gets made twice.
 *
 * So the caller says which filters the row has to keep satisfying, and a row
 * that no longer does is removed from that page instead of rewritten. `meta` is
 * corrected in the same pass; leaving it as fetched would keep the removed row
 * in "page X of Y".
 */
export interface PatchListCacheOptions<Row> {
  /** Fold the response into the cached row — mutation responses skip joins. */
  merge: (previous: Row, next: Row) => Row;
  /**
   * Does `next` still belong on a page fetched under these committed filters?
   * Omit when nothing the mutation touches is part of the query.
   */
  belongs?: (filters: AdminFilters, row: Row) => boolean;
}

export function patchListCache<Row extends { id: string }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  next: Row,
  { merge, belongs }: PatchListCacheOptions<Row>,
): void {
  // Walked one query at a time rather than through `setQueriesData`, because
  // the committed filters are only readable from the key — `useAdminList`
  // appends them as its last element — and the updater is not handed one.
  for (const query of queryClient.getQueryCache().findAll({ queryKey })) {
    const tail = query.queryKey[query.queryKey.length - 1];
    const filters =
      tail !== null && typeof tail === 'object' ? (tail as AdminFilters) : undefined;
    const keep = !belongs || !filters || belongs(filters, next);

    queryClient.setQueryData<AdminListResult<Row>>(query.queryKey, (page) => {
      if (!page) return page;
      const index = page.rows.findIndex((row) => row.id === next.id);
      if (index < 0) return page;

      if (keep) {
        const rows = [...page.rows];
        rows[index] = merge(rows[index], next);
        return { ...page, rows };
      }

      const rows = page.rows.filter((_, i) => i !== index);
      const total = Math.max(0, page.meta.total - 1);
      // `pageSize` is 0 on the synthetic meta the client builds for routes that
      // answer with a bare list; fall back rather than divide by it.
      const pageSize = page.meta.pageSize > 0 ? page.meta.pageSize : rows.length || 1;
      const totalPages = Math.ceil(total / pageSize);
      return {
        rows,
        meta: {
          ...page.meta,
          total,
          totalPages,
          hasNext: page.meta.page < totalPages,
        },
      };
    });
  }
}
