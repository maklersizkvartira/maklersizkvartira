'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { PageMeta } from '@/shared/api/types';

/**
 * The list-page engine. Every paginated admin screen — listings, reports,
 * verifications, users, staff, audit, sms — is this hook plus a DataTable.
 *
 * It owns the three things each of those pages otherwise reinvents, usually
 * subtly differently:
 *
 *  · Debounce. Typing in a search box must not fire a request per keystroke,
 *    but choosing from a dropdown should feel instant. So text filters wait
 *    350ms and a control that passes `{ immediate: true }` commits at once.
 *    That flag is how a caller says so, because the runtime type cannot: every
 *    list page models its whole filter set as strings, tri-state dropdowns
 *    ('' | 'true' | 'false') included, so "is it a string" would debounce the
 *    dropdowns too — 350ms in which nothing is dimmed and the table looks
 *    settled while showing rows the filter has already excluded.
 *  · Page reset. Narrowing a filter while on page 7 of 7 would otherwise ask
 *    the server for page 7 of a 2-page result and render an empty table.
 *    Any committed filter change puts you back on page 1.
 *  · keepPreviousData. Without it the table unmounts to skeletons on every
 *    page step and the scroll position jumps. With it the old rows stay put,
 *    dimmed by `isFetching`, until the new ones land.
 */

export type FilterValue = string | number | boolean | null | undefined;
export type AdminFilters = Record<string, FilterValue>;

/** What a fetcher must return: the rows plus the server's page metadata. */
export interface AdminListResult<Row> {
  rows: Row[];
  meta: PageMeta;
}

export interface UseAdminListOptions<Row, F extends AdminFilters> {
  /** Base react-query key. The page number and committed filters are appended. */
  queryKey: readonly unknown[];
  fetcher: (params: { page: number; filters: F; signal: AbortSignal }) => Promise<AdminListResult<Row>>;
  initialFilters?: F;
  /** Text-filter debounce. 350ms is roughly one comfortable keystroke gap. */
  debounceMs?: number;
  /** Hold the request — e.g. until a parent id is known. */
  enabled?: boolean;
}

/** Per-call overrides for `setFilter`. */
export interface SetFilterOptions {
  /** Commit now instead of after the debounce — for dropdowns and toggles. */
  immediate?: boolean;
}

export interface UseAdminListReturn<Row, F extends AdminFilters> {
  rows: Row[];
  meta: PageMeta | undefined;
  /** Live values — bind these to the inputs, they update on every keystroke. */
  filters: F;
  setFilter: <K extends keyof F>(key: K, value: F[K], options?: SetFilterOptions) => void;
  resetFilters: () => void;
  page: number;
  setPage: (page: number) => void;
  /** True only on the very first load; a page step keeps the old rows. */
  isLoading: boolean;
  /** True whenever a request is in flight — use it to dim, not to unmount. */
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAdminList<Row, F extends AdminFilters = AdminFilters>({
  queryKey,
  fetcher,
  initialFilters,
  debounceMs = 350,
  enabled = true,
}: UseAdminListOptions<Row, F>): UseAdminListReturn<Row, F> {
  // Frozen on mount by the lazy initialiser: pages pass an object literal,
  // which would otherwise be a new identity every render and reset the form on
  // each keystroke.
  const [initial] = useState<F>(() => initialFilters ?? ({} as F));

  const [filters, setFiltersState] = useState<F>(initial);
  /** What the query actually asks for — `filters` after the debounce settles. */
  const [committed, setCommitted] = useState<F>(initial);
  const [page, setPageState] = useState(1);

  // Mirrors `filters` for the event handlers, which need the latest value
  // without closing over a stale render. Only ever read inside a handler.
  const filtersRef = useRef<F>(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const commit = useCallback((next: F) => {
    setCommitted(next);
    setPageState(1);
  }, []);

  const setFilter = useCallback(
    <K extends keyof F>(key: K, value: F[K], options?: SetFilterOptions) => {
      const next = { ...filtersRef.current, [key]: value } as F;
      filtersRef.current = next;
      setFiltersState(next);

      // A pending keystroke must not land after a later dropdown choice. This
      // is also what makes an immediate commit safe to interleave with typing.
      clearTimer();

      if (options?.immediate || typeof value !== 'string') {
        commit(next);
        return;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        commit(next);
      }, debounceMs);
    },
    [commit, debounceMs],
  );

  const resetFilters = useCallback(() => {
    clearTimer();
    filtersRef.current = initial;
    setFiltersState(initial);
    commit(initial);
  }, [commit, initial]);

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, Math.floor(next)));
  }, []);

  const query = useQuery({
    queryKey: [...queryKey, page, committed],
    queryFn: ({ signal }) => fetcher({ page, filters: committed, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  /**
   * Walk back onto the last real page when the one we are on has ceased to
   * exist — the moderator deleted the only row on page 2, or a mutation shrank
   * the result. The backend answers a page past the end with a perfectly valid
   * 200 and an empty `data`, so nothing errors and nothing corrects it: the
   * table shows its "no data" state over a queue that is not empty.
   *
   * Guarded on `isPlaceholderData` because `keepPreviousData` means `meta` is
   * the PREVIOUS page's while a step is in flight — clamping against that would
   * fight the navigation the admin just asked for. `>= 1` because
   * `build_page_meta` reports `total_pages: 0` for a genuinely empty result,
   * and page 0 does not exist.
   */
  const settledMeta = query.isPlaceholderData ? undefined : query.data?.meta;
  if (settledMeta && settledMeta.totalPages >= 1 && page > settledMeta.totalPages) {
    // Adjusted during render, not in an effect: React re-runs this component
    // with the corrected page before anything paints, so the empty table is
    // never shown at all. An effect would render it first and then fix it.
    setPageState(settledMeta.totalPages);
  }

  return {
    rows,
    meta: query.data?.meta,
    filters,
    setFilter,
    resetFilters,
    page,
    setPage,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}

/**
 * Counts the filters that are actually narrowing the list, for FilterBar's
 * mobile badge. Empty strings and nullish values are "not set"; `false` is,
 * because an explicit "inactive only" toggle is a real filter.
 */
export function countActiveFilters(filters: AdminFilters, initial: AdminFilters = {}): number {
  return Object.entries(filters).filter(([key, value]) => {
    if (value === null || value === undefined || value === '') return false;
    return value !== initial[key];
  }).length;
}
