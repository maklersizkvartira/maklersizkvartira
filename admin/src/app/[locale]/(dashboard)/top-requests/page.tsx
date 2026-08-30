'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldAlert, Star } from 'lucide-react';

import type { AdminTopRequestRow, TopRequestStatus } from '@/shared/api/types';
import type { TopRequestListParams } from '@/shared/api/endpoints';
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
import { Thumb, TOUCH_SELECT } from '@/features/listings/components/moderation-kit';
import { LISTINGS_QUERY_KEY } from '@/features/listings/api';
import {
  approveTopRequest,
  fetchTopRequests,
  isTopLive,
  patchTopRequestCache,
  rejectTopRequest,
  TOP_REQUESTS_QUERY_KEY,
} from '@/features/top-requests/api';
import {
  TOP_REQUESTS_PAGE_SIZE,
  TOP_REQUEST_STATUSES,
  TRANSLATED_TOP_REQUEST_STATUSES,
} from '@/features/top-requests/constants';
import { ReviewTopRequestSheet } from '@/features/top-requests/components/ReviewTopRequestSheet';

/**
 * Owners asking for the promoted ("Top") rail.
 *
 * The request is the CAUSE and the listing's `is_featured` / `featured_until` /
 * `promotion_weight` are the EFFECT: nothing is promoted when the owner taps
 * "Top" on the site, and the approval in the sheet on this page is the only
 * thing that ever writes those three columns from a request. That is why the
 * queue is its own screen next to reports and verifications rather than a tab
 * inside /listings — a pending decision nobody can see is a pending decision
 * nobody makes.
 *
 * `status` is the only filter `GET /admin/top-requests` understands; it is a
 * bare route parameter compared upper-cased against the column, so an unknown
 * value answers with an empty page rather than an error. It defaults to PENDING
 * here, unlike the reports queue: the waiting requests are the whole point of
 * the screen, and the settled ones are history.
 */

interface TopRequestFilters extends AdminFilters {
  status: string;
}

const INITIAL: TopRequestFilters = { status: 'PENDING' };

export default function TopRequestsPage() {
  const t = useTranslations('topRequests');
  const c = useTranslations('common');
  const e = useTranslations('errors');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { canAccess, can } = useRole();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  const list = useAdminList<AdminTopRequestRow, TopRequestFilters>({
    queryKey: TOP_REQUESTS_QUERY_KEY,
    initialFilters: INITIAL,
    fetcher: async ({ page, filters, signal }) => {
      const params: TopRequestListParams = {
        page,
        pageSize: TOP_REQUESTS_PAGE_SIZE,
        status: (filters.status || undefined) as TopRequestStatus | undefined,
      };
      const { data, meta } = await fetchTopRequests(params, signal);
      return { rows: data, meta };
    },
  });

  const selected = list.rows.find((row) => row.id === selectedId) ?? null;

  /* ── Mutations ────────────────────────────────────────────────────────────
     Merged into the cached rows rather than replacing them: the PATCH path
     joins only the listing, so it answers with a null owner name and phone
     every time.

     Both also invalidate the listings queue, because an approval wrote
     `is_featured`, `featured_until` and `promotion_weight` on a listing that
     screen is caching — without it the listings table shows as unpromoted a
     listing that was promoted a second ago. A rejection changes nothing on the
     listing, so only the approval needs it. */

  const approve = useMutation({
    mutationFn: ({ id, days, weight }: { id: string; days: number; weight: number }) =>
      approveTopRequest(id, days, weight),
    onSuccess: (row) => {
      patchTopRequestCache(queryClient, row);
      toast.success(c('success'));
      setSelectedId(null);
      void queryClient.invalidateQueries({ queryKey: LISTINGS_QUERY_KEY });
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTopRequest(id, reason),
    onSuccess: (row) => {
      patchTopRequestCache(queryClient, row);
      toast.success(c('success'));
      setSelectedId(null);
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  const statusLabel = (status: string) =>
    TRANSLATED_TOP_REQUEST_STATUSES.has(status)
      ? t(`status.${status}` as Parameters<typeof t>[0])
      : status;

  const columns: Column<AdminTopRequestRow>[] = [
    {
      key: 'listing',
      header: t('columns.listing'),
      render: (row) => (
        <div className="flex items-start gap-2.5 min-w-0">
          {/* Lazy and fixed-size: `listingImage` is one image rather than the
              whole array, but on a legacy listing it is still a multi-megabyte
              base64 data URI. */}
          <Thumb src={row.listingImage} alt={row.listingTitle ?? ''} size={40} />
          <div className="min-w-0">
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)', overflowWrap: 'anywhere' }}
            >
              {row.listingTitle ?? c('unknown')}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {[
                row.listingDistrict,
                row.listingPrice === null ? null : numberFormat.format(row.listingPrice),
              ]
                .filter(Boolean)
                .join(' · ') || c('unknown')}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'owner',
      header: t('columns.owner'),
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {row.ownerName ?? c('unknown')}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {row.ownerPhone ?? c('unknown')}
          </p>
        </div>
      ),
    },
    {
      key: 'requestedDays',
      header: t('columns.days'),
      align: 'right',
      render: (row) => `${row.requestedDays} ${c('days')}`,
    },
    {
      key: 'note',
      header: t('columns.note'),
      hideOnCard: true,
      render: (row) =>
        row.note ? (
          <span
            className="text-xs line-clamp-2"
            style={{ color: 'var(--color-text-secondary)', overflowWrap: 'anywhere' }}
          >
            {row.note}
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: (row) => (
        <div className="inline-flex flex-col items-start gap-1">
          <StatusPill
            status={row.status}
            label={statusLabel(row.status)}
            pulse={row.status === 'PENDING'}
          />
          {/* Read from the date, never from `listingIsFeatured` — nothing on the
              backend clears that boolean when the promotion expires. */}
          {isTopLive(row) && <Badge variant="info" label={t('review.alreadyLive')} />}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('columns.created'),
      hideOnCard: true,
      render: (row) => dateFormat.format(new Date(row.createdAt)),
    },
  ];

  // The page's own gate, alongside the sidebar's.
  if (!canAccess('/top-requests')) {
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
        activeCount={countActiveFilters(list.filters, INITIAL)}
        onReset={list.resetFilters}
      >
        <Select
          className={TOUCH_SELECT}
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value, { immediate: true })}
          placeholder={t('filters.status')}
          options={[
            { value: '', label: c('all') },
            ...TOP_REQUEST_STATUSES.map((value) => ({ value, label: statusLabel(value) })),
          ]}
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
          rows={list.rows}
          keyOf={(row) => row.id}
          loading={list.isLoading}
          loadingRows={10}
          onRowClick={(row) => setSelectedId(row.id)}
          empty={
            <ListState
              icon={<Star size={26} />}
              emptyTitle={t('empty')}
              errorTitle={c('error')}
              retryLabel={c('retry')}
              error={list.error}
              onRetry={list.refetch}
            />
          }
        />
      </div>

      <Pagination
        meta={list.meta}
        onPage={list.setPage}
        summary={(page, total) => c('pagination.pageOf', { page, total })}
        navLabel={c('pagination.label')}
        previousLabel={c('pagination.previousPage')}
        nextLabel={c('pagination.nextPage')}
      />

      {selected && (
        <ReviewTopRequestSheet
          key={selected.id}
          row={selected}
          onClose={() => setSelectedId(null)}
          onApprove={(days, weight) => approve.mutate({ id: selected.id, days, weight })}
          onReject={(reason) => reject.mutate({ id: selected.id, reason })}
          approving={approve.isPending}
          rejecting={reject.isPending}
          canReview={can('topRequestReview')}
          statusLabel={statusLabel}
        />
      )}
    </div>
  );
}
