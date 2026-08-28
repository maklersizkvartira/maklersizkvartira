'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Flag, ShieldAlert } from 'lucide-react';

import type { AdminReportRow, ReportStatus, ResolveReportPayload } from '@/shared/api/types';
import type { ReportListParams } from '@/shared/api/endpoints';
import { useAdminList, countActiveFilters, type AdminFilters } from '@/shared/hooks/useAdminList';
import { useRole } from '@/providers/role-provider';
import { PageHeader } from '@/shared/ui/PageHeader';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Select } from '@/shared/ui/Select';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ListErrorBanner, ListState } from '@/shared/ui/ListState';
import { Pagination } from '@/shared/ui/Pagination';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Badge } from '@/shared/ui/Badge';
import { toast } from '@/shared/ui/Toast';
import { TOUCH_SELECT } from '@/features/listings/components/moderation-kit';
import { LISTINGS_QUERY_KEY } from '@/features/listings/api';
import { fetchReports, patchReportCache, resolveReport, REPORTS_QUERY_KEY } from '@/features/reports/api';
import {
  REPORTS_PAGE_SIZE,
  REPORT_PRIORITY_ORDER,
  REPORT_STATUSES,
  TRANSLATED_LISTING_ACTIONS,
  TRANSLATED_REPORT_PRIORITIES,
  TRANSLATED_REPORT_REASONS,
  TRANSLATED_REPORT_STATUSES,
} from '@/features/reports/constants';
import { ResolveReportSheet } from '@/features/reports/components/ResolveReportSheet';

/**
 * User reports on listings.
 *
 * `status` is the only thing `GET /admin/reports` can filter on — it is a bare
 * route parameter, not part of a `Depends()` model, and it is compared
 * upper-cased against the column, so an unknown value returns an empty page
 * rather than an error.
 *
 * Priority, reason and listing therefore have no server-side filter at all.
 * They are faceted here over the page that has been fetched, which is a
 * genuinely different thing from filtering the queue — so their options are
 * built from the rows in hand with a count each, the page size is large enough
 * to make that worth doing, and the table prints how much of the page survived
 * the facets. Presenting them as ordinary filters would quietly lie about how
 * much of the queue had been searched.
 */

/** Sent to the server. Everything else on this screen is client-side. */
interface ReportFilters extends AdminFilters {
  status: string;
}

const INITIAL: ReportFilters = { status: '' };

/**
 * Faceted client-side; '' means "every value on this page". It extends
 * `AdminFilters` only so `countActiveFilters` can count these alongside the
 * server-side one — they never reach a request.
 */
interface PageFacets extends AdminFilters {
  priority: string;
  reason: string;
  listingId: string;
}

const NO_FACETS: PageFacets = { priority: '', reason: '', listingId: '' };

export default function ReportsPage() {
  const t = useTranslations('reports');
  const c = useTranslations('common');
  const e = useTranslations('errors');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { canAccess } = useRole();

  const [facets, setFacets] = useState<PageFacets>(NO_FACETS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  const list = useAdminList<AdminReportRow, ReportFilters>({
    queryKey: REPORTS_QUERY_KEY,
    initialFilters: INITIAL,
    fetcher: async ({ page, filters, signal }) => {
      const params: ReportListParams = {
        page,
        pageSize: REPORTS_PAGE_SIZE,
        status: (filters.status || undefined) as ReportStatus | undefined,
      };
      const { data, meta } = await fetchReports(params, signal);
      return { rows: data, meta };
    },
  });

  const resolve = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResolveReportPayload }) =>
      resolveReport(id, body),
    onSuccess: (row, variables) => {
      patchReportCache(queryClient, row);
      toast.success(c('success'));
      setSelectedId(null);
      // A listingAction other than NONE changed a listing in the same
      // transaction, so anything the listings queue is holding is now stale.
      if (variables.body.listingAction && variables.body.listingAction !== 'NONE') {
        void queryClient.invalidateQueries({ queryKey: LISTINGS_QUERY_KEY });
      }
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  /* ── Labels ─────────────────────────────────────────────────────────────
     All four are guarded the same way: a value the backend adds before the
     catalogues catch up prints its wire form with the underscores softened,
     because next-intl throws on a missing key rather than blanking. */
  const statusLabel = (status: string) =>
    TRANSLATED_REPORT_STATUSES.has(status)
      ? t(`status.${status}` as Parameters<typeof t>[0])
      : status;

  const listingActionLabel = (action: string) =>
    TRANSLATED_LISTING_ACTIONS.has(action)
      ? t(`listingAction.${action}` as Parameters<typeof t>[0])
      : action;

  // These two are memoised because the facet option lists depend on them; the
  // other two are only ever called from a render body.
  const reasonLabel = useCallback(
    (reason: string) =>
      TRANSLATED_REPORT_REASONS.has(reason)
        ? t(`reason.${reason}` as Parameters<typeof t>[0])
        : reason.replace(/_/g, ' '),
    [t],
  );

  const priorityLabel = useCallback(
    (priority: string) =>
      TRANSLATED_REPORT_PRIORITIES.has(priority)
        ? t(`priority.${priority}` as Parameters<typeof t>[0])
        : priority.replace(/_/g, ' '),
    [t],
  );

  /* ── Facets over the fetched page ───────────────────────────────────────── */

  const priorityOptions = useMemo(() => {
    const counts = countBy(list.rows, (row) => row.priority);
    return REPORT_PRIORITY_ORDER.filter((value) => counts.has(value)).map((value) => ({
      value,
      label: `${priorityLabel(value)} (${counts.get(value)})`,
    }));
  }, [list.rows, priorityLabel]);

  const reasonOptions = useMemo(() => {
    const counts = countBy(list.rows, (row) => row.reason);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, label: `${reasonLabel(value)} (${count})` }));
  }, [list.rows, reasonLabel]);

  const listingOptions = useMemo(() => {
    const counts = countBy(list.rows, (row) => row.listingId);
    const titles = new Map<string, string>();
    for (const row of list.rows) {
      if (!titles.has(row.listingId)) titles.set(row.listingId, row.listingTitle ?? row.listingId);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ value: id, label: `${titles.get(id) ?? id} (${count})` }));
  }, [list.rows]);

  const visible = useMemo(
    () =>
      list.rows.filter(
        (row) =>
          (!facets.priority || row.priority === facets.priority) &&
          (!facets.reason || row.reason === facets.reason) &&
          (!facets.listingId || row.listingId === facets.listingId),
      ),
    [list.rows, facets],
  );

  const facetCount = countActiveFilters(facets, NO_FACETS);
  const selected = visible.find((row) => row.id === selectedId) ?? null;

  const showDate = (iso: string) => dateFormat.format(new Date(iso));

  const columns: Column<AdminReportRow>[] = [
    {
      key: 'listingTitle',
      header: t('columns.listing'),
      render: (row) => (
        <span style={{ overflowWrap: 'anywhere' }}>{row.listingTitle ?? c('unknown')}</span>
      ),
    },
    {
      key: 'reason',
      header: t('columns.reason'),
      render: (row) => reasonLabel(row.reason),
    },
    {
      key: 'reporterLabel',
      header: t('columns.reporter'),
      render: (row) => row.reporterLabel ?? c('unknown'),
    },
    {
      key: 'priority',
      header: t('columns.priority'),
      render: (row) => (
        <Badge variant={priorityVariant(row.priority)} label={priorityLabel(row.priority)} />
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: (row) => (
        <StatusPill
          status={row.status}
          label={statusLabel(row.status)}
          pulse={row.status === 'OPEN' || row.status === 'UNDER_REVIEW'}
        />
      ),
    },
    {
      key: 'createdAt',
      header: t('columns.created'),
      hideOnCard: true,
      render: (row) => showDate(row.createdAt),
    },
  ];

  // The page's own gate, alongside the sidebar's.
  if (!canAccess('/reports')) {
    return (
      <div className="card">
        <EmptyState icon={<ShieldAlert size={26} />} title={e('forbidden')} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <FilterBar
        label={c('filters')}
        resetLabel={c('reset')}
        activeCount={countActiveFilters(list.filters, INITIAL) + facetCount}
        onReset={() => {
          list.resetFilters();
          setFacets(NO_FACETS);
        }}
      >
        <Select
          className={TOUCH_SELECT}
          value={list.filters.status}
          onChange={(value) => {
            // Third of the three paths that replace the fetched page, and the
            // one that used to forget: the facets describe the page in hand, so
            // they cannot survive a refetch under a different status. A facet
            // value absent from the new page is not even visible as a filter —
            // `Select` falls back to its placeholder once the value drops out
            // of the options — so the table would simply look empty.
            setFacets(NO_FACETS);
            list.setFilter('status', value, { immediate: true });
          }}
          placeholder={t('columns.status')}
          options={[
            { value: '', label: c('all') },
            ...REPORT_STATUSES.map((value) => ({ value, label: statusLabel(value) })),
          ]}
        />

        {/* Everything past this divider narrows the page in hand, not the
            queue — hence the marker, and hence the count line under the
            table. There is no server-side filter for any of them. */}
        <span
          className="text-[10px] font-bold uppercase tracking-[0.09em] self-center px-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {c('page')} {list.page}
        </span>

        <Select
          className={TOUCH_SELECT}
          value={facets.priority}
          onChange={(value) => setFacets((f) => ({ ...f, priority: value }))}
          placeholder={t('columns.priority')}
          options={[{ value: '', label: c('all') }, ...priorityOptions]}
        />
        <Select
          className={TOUCH_SELECT}
          value={facets.reason}
          onChange={(value) => setFacets((f) => ({ ...f, reason: value }))}
          placeholder={t('columns.reason')}
          options={[{ value: '', label: c('all') }, ...reasonOptions]}
        />
        <Select
          className={TOUCH_SELECT}
          value={facets.listingId}
          onChange={(value) => setFacets((f) => ({ ...f, listingId: value }))}
          placeholder={t('columns.listing')}
          options={[{ value: '', label: c('all') }, ...listingOptions]}
        />
      </FilterBar>

      {/* A refetch that fails leaves the previous page on screen and says
          nothing — `keepPreviousData` holds those rows. The empty-state
          branch below never runs in that case, so the warning goes here. */}
      <ListErrorBanner
        error={list.rows.length > 0 ? list.error : null}
        title={c('error')}
        retryLabel={c('retry')}
        onRetry={list.refetch}
      />

      <div
        style={{
          opacity: list.isFetching && !list.isLoading ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        <DataTable
          columns={columns}
          rows={visible}
          keyOf={(row) => row.id}
          loading={list.isLoading}
          loadingRows={10}
          onRowClick={(row) => setSelectedId(row.id)}
          empty={
            <ListState
              icon={<Flag size={26} />}
              emptyTitle={c('noData')}
              errorTitle={c('error')}
              retryLabel={c('retry')}
              error={list.error}
              onRetry={list.refetch}
            />
          }
        />
      </div>

      {/* How much of the fetched page the facets left standing. Only shown
          while a facet is set, because otherwise the pagination summary below
          already says it. */}
      {facetCount > 0 && !list.isLoading && (
        <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
          {c('showing', {
            from: visible.length === 0 ? 0 : 1,
            to: visible.length,
            total: list.rows.length,
          })}
        </p>
      )}

      <Pagination
        meta={list.meta}
        onPage={(page) => {
          // The facets describe the page that was fetched, so they cannot
          // survive a step to a different one.
          setFacets(NO_FACETS);
          list.setPage(page);
        }}
        summary={(page, total) => c('pagination.pageOf', { page, total })}
        navLabel={c('pagination.label')}
        previousLabel={c('pagination.previousPage')}
        nextLabel={c('pagination.nextPage')}
      />

      {selected && (
        <ResolveReportSheet
          key={selected.id}
          row={selected}
          onClose={() => setSelectedId(null)}
          onSubmit={(body) => resolve.mutate({ id: selected.id, body })}
          pending={resolve.isPending}
          statusLabel={statusLabel}
          listingActionLabel={listingActionLabel}
          reasonLabel={reasonLabel}
          priorityLabel={priorityLabel}
        />
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = key(row);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/** Priority is not a status, so `statusVariant` would map every value to
 *  neutral. These four are the whole enum; anything else falls through. */
function priorityVariant(priority: string) {
  switch (priority) {
    case 'CRITICAL':
      return 'danger' as const;
    case 'HIGH':
      return 'warning' as const;
    case 'MEDIUM':
      return 'info' as const;
    default:
      return 'neutral' as const;
  }
}
