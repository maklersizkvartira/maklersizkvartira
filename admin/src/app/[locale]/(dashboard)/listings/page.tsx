'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, ShieldAlert, Star } from 'lucide-react';

import type {
  AdminListingRow,
  ListingFeaturePayload,
  ListingSort,
  ListingStatus,
} from '@/shared/api/types';
import type { ListingListParams } from '@/shared/api/endpoints';
import { useAdminList, countActiveFilters, type AdminFilters } from '@/shared/hooks/useAdminList';
import { useRole } from '@/providers/role-provider';
import { PageHeader } from '@/shared/ui/PageHeader';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ListErrorBanner, ListState } from '@/shared/ui/ListState';
import { Pagination } from '@/shared/ui/Pagination';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Badge } from '@/shared/ui/Badge';
import { toast } from '@/shared/ui/Toast';
import {
  deleteListing,
  featureListing,
  fetchListings,
  isFeaturedNow,
  mergeListingRow,
  moderateListing,
  patchListingCache,
  LISTINGS_QUERY_KEY,
  type ListingModerationBody,
} from '@/features/listings/api';
import {
  LISTINGS_PAGE_SIZE,
  LISTING_SORTS,
  LISTING_STATUSES,
  TRANSLATED_LISTING_STATUSES,
} from '@/features/listings/constants';
import { ListingSheet } from '@/features/listings/components/ListingSheet';
import { RiskPill, Thumb, TOUCH_SELECT } from '@/features/listings/components/moderation-kit';

/**
 * The moderation queue: every listing on the platform, and the sheet where one
 * is approved, rejected, promoted or deleted.
 *
 * Filters are camelCase because `GET /admin/listings` reads them through a
 * `Depends()` model with a camelCase alias generator. A snake_case spelling
 * would not error — FastAPI drops an unknown query key and answers 200 with an
 * unfiltered list — so every request is built through `api.listings.list()`.
 */

/** Risk floors offered in the filter. The backend accepts any 0..100. */
const RISK_STEPS = [40, 60, 80];

interface ListingFilters extends AdminFilters {
  search: string;
  status: string;
  district: string;
  isFeatured: string;
  minRiskScore: string;
  sortBy: string;
}

const INITIAL: ListingFilters = {
  search: '',
  status: '',
  district: '',
  isFeatured: '',
  minRiskScore: '',
  sortBy: 'NEWEST',
};

export default function ListingsPage() {
  const t = useTranslations('listings');
  const c = useTranslations('common');
  const e = useTranslations('errors');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { can, canAccess } = useRole();

  /**
   * The row the sheet is open on, held whole rather than by id.
   *
   * It used to be an id looked up in `list.rows` on every render, which meant
   * anything that replaced the fetched page closed the sheet under the
   * moderator mid-read: a filter commit, a page step, or a moderation that
   * moves the row out of the active status filter. The row is not on the new
   * page, the lookup returns nothing, and the sheet unmounts with no
   * explanation. Held here it survives all three.
   *
   * The cost is that it no longer follows a cache patch on its own, so the two
   * mutations that change the open row refresh it explicitly below.
   */
  const [selected, setSelected] = useState<AdminListingRow | null>(null);

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    [locale],
  );

  const list = useAdminList<AdminListingRow, ListingFilters>({
    queryKey: LISTINGS_QUERY_KEY,
    initialFilters: INITIAL,
    fetcher: async ({ page, filters, signal }) => {
      const params: ListingListParams = {
        page,
        pageSize: LISTINGS_PAGE_SIZE,
        search: filters.search || undefined,
        status: (filters.status || undefined) as ListingStatus | undefined,
        district: filters.district || undefined,
        // Tri-state: '' is "no filter", not "false". Note this asks the server
        // about the `is_featured` COLUMN, which never expires — the table's own
        // badge is computed from `featuredUntil` instead.
        isFeatured: filters.isFeatured === '' ? undefined : filters.isFeatured === 'true',
        minRiskScore: filters.minRiskScore ? Number(filters.minRiskScore) : undefined,
        sortBy: (filters.sortBy || undefined) as ListingSort | undefined,
      };
      const { data, meta } = await fetchListings(params, signal);
      return { rows: data, meta };
    },
  });

  /* ── Mutations ────────────────────────────────────────────────────────────
     Both PATCH responses are merged into the cached rows instead of replacing
     them: the update path does no join, so it answers with a null owner and a
     zero report count on every call. See `mergeListingRow`. */

  const moderate = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ListingModerationBody }) =>
      moderateListing(id, body),
    onSuccess: (row) => {
      patchListingCache(queryClient, row);
      toast.success(c('success'));
      // The decision is made; close so the moderator lands back on the queue.
      setSelected(null);
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  const feature = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ListingFeaturePayload }) =>
      featureListing(id, body),
    // Left open on purpose: the promotion panel shows the new expiry date, and
    // a toast raised behind an open sheet would not be seen anyway.
    onSuccess: (row) => {
      patchListingCache(queryClient, row);
      // Merged the same way the cache is, so the panel shows the new
      // `featuredUntil` without blanking the owner column the PATCH response
      // does not carry.
      setSelected((open) => (open && open.id === row.id ? mergeListingRow(open, row) : open));
      toast.success(c('success'));
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteListing(id),
    onSuccess: () => {
      toast.success(c('success'));
      setSelected(null);
      // The row is gone rather than changed, so the page has to be refetched.
      void queryClient.invalidateQueries({ queryKey: LISTINGS_QUERY_KEY });
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  /* ── Labels ───────────────────────────────────────────────────────────────
     WARNING and UNDER_REVIEW are in the backend's enum but not in the message
     catalogues, and next-intl throws on a missing key rather than rendering a
     blank — so a status the messages do not cover prints its wire value. */
  const statusLabel = (status: string) =>
    TRANSLATED_LISTING_STATUSES.has(status)
      ? t(`status.${status}` as Parameters<typeof t>[0])
      : status;

  const showDate = (iso: string) => dateFormat.format(new Date(iso));

  const columns: Column<AdminListingRow>[] = [
    {
      key: 'photo',
      header: t('columns.photo'),
      width: '64px',
      render: (row) => <Thumb src={row.images[0] ?? null} alt={row.title} size={44} />,
    },
    {
      key: 'title',
      header: t('columns.title'),
      render: (row) => (
        <div className="min-w-0">
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)', overflowWrap: 'anywhere' }}
          >
            {row.title}
          </p>
          {row.aiRiskReasons.length > 0 && (
            <p
              className="text-xs flex items-center gap-1 mt-0.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <ShieldAlert size={11} aria-hidden="true" />
              {row.aiRiskReasons.length}
            </p>
          )}
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
            {[row.ownerPhone, row.ownerTrustScore === null ? null : `★ ${row.ownerTrustScore}`]
              .filter(Boolean)
              .join(' · ') || c('unknown')}
          </p>
        </div>
      ),
    },
    { key: 'district', header: t('columns.district') },
    {
      key: 'price',
      header: t('columns.price'),
      align: 'right',
      render: (row) => `${numberFormat.format(row.price)} ${row.currency}`,
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: (row) => <StatusPill status={row.status} label={statusLabel(row.status)} />,
    },
    {
      key: 'riskScore',
      header: t('columns.risk'),
      align: 'right',
      render: (row) => <RiskPill score={row.riskScore} label={t('columns.risk')} />,
    },
    {
      key: 'viewsCount',
      header: t('columns.views'),
      align: 'right',
      render: (row) => numberFormat.format(row.viewsCount),
    },
    {
      key: 'reportCount',
      header: t('columns.reports'),
      align: 'right',
      render: (row) =>
        row.reportCount > 0 ? (
          <Badge variant="danger" label={String(row.reportCount)} />
        ) : (
          numberFormat.format(0)
        ),
    },
    {
      key: 'featured',
      header: t('columns.featured'),
      // Read from the date, never from `isFeatured`: nothing on the backend
      // expires a promotion, so the boolean stays true long after the week the
      // owner paid for has run out.
      render: (row) =>
        isFeaturedNow(row) ? (
          <Badge
            variant="info"
            label={
              <span className="inline-flex items-center gap-1">
                <Star size={10} aria-hidden="true" />
                {t('columns.featured')}
              </span>
            }
          />
        ) : (
          '—'
        ),
    },
    {
      key: 'createdAt',
      header: t('columns.created'),
      hideOnCard: true,
      render: (row) => showDate(row.createdAt),
    },
  ];

  // The page's own gate, alongside the sidebar's. A rank that cannot reach the
  // route must not be able to type the URL into a browser either.
  if (!canAccess('/listings')) {
    return (
      <div className="card">
        <EmptyState icon={<ShieldAlert size={26} />} title={e('forbidden')} />
      </div>
    );
  }

  const activeCount = countActiveFilters(list.filters, INITIAL);

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <FilterBar
        label={c('filters')}
        resetLabel={c('reset')}
        activeCount={activeCount}
        onReset={list.resetFilters}
        leading={
          <Input
            value={list.filters.search}
            onChange={(event) => list.setFilter('search', event.target.value)}
            placeholder={t('filters.search')}
            aria-label={t('filters.search')}
            fullWidth
          />
        }
      >
        <Select
          className={TOUCH_SELECT}
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value, { immediate: true })}
          placeholder={t('filters.status')}
          options={[
            { value: '', label: c('all') },
            ...LISTING_STATUSES.map((status) => ({ value: status, label: statusLabel(status) })),
          ]}
        />
        <Input
          value={list.filters.district}
          onChange={(event) => list.setFilter('district', event.target.value)}
          placeholder={t('filters.district')}
          aria-label={t('filters.district')}
        />
        <Select
          className={TOUCH_SELECT}
          value={list.filters.isFeatured}
          onChange={(value) => list.setFilter('isFeatured', value, { immediate: true })}
          placeholder={t('filters.featuredOnly')}
          options={[
            { value: '', label: c('all') },
            { value: 'true', label: c('yes') },
            { value: 'false', label: c('no') },
          ]}
        />
        <Select
          className={TOUCH_SELECT}
          value={list.filters.minRiskScore}
          onChange={(value) => list.setFilter('minRiskScore', value, { immediate: true })}
          placeholder={t('filters.minRisk')}
          options={[
            { value: '', label: c('all') },
            ...RISK_STEPS.map((step) => ({ value: String(step), label: `≥ ${step}` })),
          ]}
        />
        <Select
          className={TOUCH_SELECT}
          value={list.filters.sortBy}
          onChange={(value) => list.setFilter('sortBy', value, { immediate: true })}
          placeholder={c('sortBy')}
          options={LISTING_SORTS.map((sort) => ({
            value: sort,
            label: t(`sort.${sort}` as Parameters<typeof t>[0]),
          }))}
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
          loadingRows={LISTINGS_PAGE_SIZE}
          onRowClick={(row) => setSelected(row)}
          empty={
            <ListState
              icon={<Building2 size={26} />}
              emptyTitle={c('noData')}
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
        <ListingSheet
          key={selected.id}
          row={selected}
          onClose={() => setSelected(null)}
          onModerate={(body) => moderate.mutate({ id: selected.id, body })}
          onFeature={(body) => feature.mutate({ id: selected.id, body })}
          onDelete={() => remove.mutate(selected.id)}
          moderating={moderate.isPending}
          featuring={feature.isPending}
          removing={remove.isPending}
          canModerate={can('listingModerate')}
          canFeature={can('listingFeature')}
          canDelete={can('listingDelete')}
          statusLabel={statusLabel}
        />
      )}
    </div>
  );
}
