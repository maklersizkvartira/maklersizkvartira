'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, ShieldAlert, Crown, Flame, CheckCircle2, Flag } from 'lucide-react';

import type {
  AdminListingRow,
  ListingFeaturePayload,
  ListingSort,
  ListingStatus,
} from '@/shared/api/types';
import type { ListingListParams } from '@/shared/api/endpoints';
import { useAdminList, countActiveFilters, type AdminFilters } from '@/shared/hooks/useAdminList';
import { useRole } from '@/providers/role-provider';
import { SectionHeader } from '@/features/hubs/SectionHeader';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ListErrorBanner, ListState } from '@/shared/ui/ListState';
import { Pagination } from '@/shared/ui/Pagination';
import { StatusPill } from '@/shared/ui/StatusPill';
import { toast } from '@/shared/ui/Toast';
import {
  deleteListing,
  featureListing,
  fetchListings,
  isFeaturedNow,
  isVipNow,
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

const PROMO_FILTERS = ['REPORTS', 'TOP', 'VIP', 'VERIFIED_OWNER', 'ANY_PROMO'] as const;

export function ListingsScreen({ embedded = false }: { embedded?: boolean } = {}) {
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
        promotion: filters.isFeatured || undefined,
        isFeatured: filters.isFeatured === 'true' ? true : (filters.isFeatured === 'false' ? false : undefined),
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
      // A moderation moves the listing into or out of PENDING, so the
      // dashboard's triage counters are now wrong. `['stats']` is cached with
      // the global five-minute staleTime and does not refetch on focus, so
      // nothing else corrects it: the hero would go on advertising a queue
      // this moderator has just emptied.
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
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
      // `featuredListings` on the dashboard just moved, and that cache is stale
      // for five minutes otherwise.
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
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
      // Every listing counter on the dashboard counted that row.
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
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
      width: '54px',
      render: (row) => {
        // Older rows carry the cover under one of several legacy keys.
        const legacy = row as unknown as Record<string, unknown>;
        const first = Array.isArray(row.images) && row.images.length > 0 ? row.images[0] : null;
        const fallback = [legacy.images, legacy.image, legacy.coverImage, legacy.photo].find(
          (value): value is string => typeof value === 'string' && value.length > 0,
        );
        return <Thumb src={first ?? fallback ?? null} alt={row.title} size={42} />;
      },
    },
    {
      key: 'title',
      header: t('columns.title'),
      width: '230px',
      render: (row) => {
        const isVip = isVipNow(row);
        const isTop = isFeaturedNow(row);
        return (
          <div className="min-w-0 max-w-[250px]">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {isVip && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 shrink-0">
                  <Crown size={11} className="text-purple-600" />
                  VIP
                </span>
              )}
              {isTop && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shrink-0">
                  <Flame size={11} className="text-amber-600" />
                  TOP
                </span>
              )}
              {row.reportCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800 shrink-0">
                  <Flag size={10} className="text-rose-600" />
                  {row.reportCount} ta shikoyat!
                </span>
              )}
            </div>
            <p
              className="text-sm font-semibold leading-snug line-clamp-2 break-words"
              style={{ color: 'var(--color-text-primary)' }}
              title={row.title}
            >
              {row.title}
            </p>
            {row.aiRiskReasons && row.aiRiskReasons.length > 0 && (
              <p className="text-xs flex items-center gap-1 mt-1 text-[var(--color-text-muted)]">
                <ShieldAlert size={11} aria-hidden="true" />
                {row.aiRiskReasons.length} ta xavf
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'owner',
      header: t('columns.owner'),
      width: '150px',
      render: (row) => (
        <div className="min-w-0 max-w-[170px]">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-sm font-bold truncate max-w-[110px]" style={{ color: 'var(--color-text-primary)' }}>
              {row.ownerName ?? c('unknown')}
            </span>
            {row.ownerIsVerified && (
              <span
                className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 shrink-0"
                title="Tasdiqlangan profil egasi (Galochka)"
              >
                <CheckCircle2 size={10} className="text-blue-500" />
                Galochka
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 text-[var(--color-text-muted)]">
            {[row.ownerPhone, row.ownerTrustScore === null ? null : `★ ${row.ownerTrustScore}`]
              .filter(Boolean)
              .join(' · ') || c('unknown')}
          </p>
        </div>
      ),
    },
    {
      key: 'district',
      header: t('columns.district'),
      width: '95px',
      render: (row) => (
        <span className="text-xs font-medium whitespace-nowrap text-[var(--color-text-muted)]">
          {row.district || '—'}
        </span>
      ),
    },
    {
      key: 'price',
      header: t('columns.price'),
      width: '110px',
      align: 'right',
      render: (row) => (
        <span className="text-sm font-semibold whitespace-nowrap text-[var(--color-text-primary)]">
          {numberFormat.format(row.price)} {row.currency}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      width: '115px',
      render: (row) => (
        <div className="whitespace-nowrap">
          <StatusPill status={row.status} label={statusLabel(row.status)} />
        </div>
      ),
    },
    {
      key: 'riskScore',
      header: t('columns.risk'),
      width: '65px',
      align: 'right',
      render: (row) => <RiskPill score={row.riskScore} label={t('columns.risk')} />,
    },
    {
      key: 'viewsCount',
      header: t('columns.views'),
      width: '75px',
      align: 'right',
      render: (row) => (
        <span className="text-sm font-semibold">{numberFormat.format(row.viewsCount)}</span>
      ),
    },
    {
      key: 'reportCount',
      header: t('columns.reports'),
      width: '105px',
      align: 'center',
      render: (row) =>
        row.reportCount > 0 ? (
          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs">
            <Flag size={11} className="shrink-0" />
            {row.reportCount} ta
          </span>
        ) : (
          <span className=" text-xs text-[var(--color-text-muted)]">0</span>
        ),
    },
    {
      key: 'featured',
      header: t('columns.featured'),
      width: '125px',
      render: (row) => {
        const isVip = isVipNow(row);
        const isTop = isFeaturedNow(row);

        if (isVip) {
          return (
            <div className="space-y-0.5 whitespace-nowrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">
                <Crown size={11} className="text-purple-600" />
                VIP
              </span>
              {row.vipUntil && (
                <div className="text-[10px] text-[var(--color-text-muted)]">
                  {showDate(row.vipUntil)}
                </div>
              )}
            </div>
          );
        }

        if (isTop) {
          return (
            <div className="space-y-0.5 whitespace-nowrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                <Flame size={11} className="text-amber-600" />
                TOP
              </span>
              {row.featuredUntil && (
                <div className="text-[10px] text-[var(--color-text-muted)]">
                  {showDate(row.featuredUntil)}
                </div>
              )}
            </div>
          );
        }

        return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
      },
    },
    {
      key: 'createdAt',
      header: t('columns.created'),
      width: '95px',
      hideOnCard: true,
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">
          {showDate(row.createdAt)}
        </span>
      ),
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
      <SectionHeader embedded={embedded} title={t('title')} subtitle={t('subtitle')} />

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
          placeholder={t('filters.promo.placeholder')}
          options={[
            { value: '', label: t('filters.promo.all') },
            ...PROMO_FILTERS.map((key) => ({ value: key, label: t(`filters.promo.${key}`) })),
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
          minWidth="1120px"
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
