/**
 * The listings page — the platform's main showcase.
 *
 * Structure, front to back:
 *   1. A compact hero that states the promise (broker-free, 0% commission)
 *      and carries the primary search.
 *   2. A promoted rail — the advertising surface, clearly labelled as such.
 *   3. Quick filter chips for the searches people actually run.
 *   4. The result grid, with real skeletons, a real empty state and a real
 *      error state (the previous build silently rendered mock data instead).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore, DEFAULT_FILTERS, type Filters } from '../../stores/useAppStore';
import { Button, SelectInput } from '../ui/Field';
import { ListingCard, ListingCardSkeleton } from './ListingCard';

const TASHKENT_DISTRICTS = [
  'Chilonzor', 'Yunusobod', 'Mirobod', 'Yakkasaroy', 'Sergeli', 'Uchtepa',
  'Olmazor', 'Yashnobod', 'Shayxontohur', "Mirzo Ulug'bek", 'Bektemir', 'Yangihayot',
];

type QuickFilter = {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  patch: Partial<Filters>;
};

const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'roommate',
    labelKey: 'layout.categories.roommate.title',
    icon: Users,
    patch: { rentalType: 'ROOMMATE' },
  },
  {
    id: 'student',
    labelKey: 'layout.categories.student.title',
    icon: Building2,
    patch: { audience: 'STUDENT' },
  },
  {
    id: 'family',
    labelKey: 'layout.categories.family.title',
    icon: Users,
    patch: { audience: 'FAMILY', rentalType: 'FULL' },
  },
  {
    id: 'budget',
    labelKey: 'layout.categories.budget.title',
    icon: Sparkles,
    patch: { maxPrice: 3_000_000 },
  },
  {
    id: 'trusted',
    labelKey: 'layout.categories.premium.title',
    icon: ShieldCheck,
    patch: { onlyVerified: true, minTrustScore: 80 },
  },
];

export const ListingsPage: React.FC = () => {
  const { t, formatNumber } = useTranslation();

  const listings = useAppStore((state) => state.listings);
  const featured = useAppStore((state) => state.featured);
  const totalCount = useAppStore((state) => state.totalCount);
  const loading = useAppStore((state) => state.listingsLoading);
  const error = useAppStore((state) => state.listingsError);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const resetFilters = useAppStore((state) => state.resetFilters);
  const activeFilterCount = useAppStore((state) => state.activeFilterCount);
  const fetchListings = useAppStore((state) => state.fetchListings);
  const fetchFeatured = useAppStore((state) => state.fetchFeatured);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const currentUser = useAppStore((state) => state.currentUser);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const page = useAppStore((state) => state.page);
  const pageSize = useAppStore((state) => state.pageSize);

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetchListings({ page: 1 });
    void fetchFeatured();
    // Intentionally on mount only; filter changes refetch through setFilters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search so typing does not fire a request per keystroke.
  const onSearchChange = useCallback(
    (value: string) => {
      setSearchDraft(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => setFilters({ search: value }), 400);
    },
    [setFilters],
  );

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const filterCount = activeFilterCount();
  const hasMore = listings.length < totalCount;

  const isQuickActive = useCallback(
    (quick: QuickFilter) =>
      Object.entries(quick.patch).every(
        ([key, value]) => filters[key as keyof Filters] === value,
      ),
    [filters],
  );

  const toggleQuick = (quick: QuickFilter) => {
    if (isQuickActive(quick)) {
      const cleared = Object.fromEntries(
        Object.keys(quick.patch).map((key) => [key, DEFAULT_FILTERS[key as keyof Filters]]),
      );
      setFilters(cleared as Partial<Filters>);
    } else {
      setFilters(quick.patch);
    }
  };

  const promoted = useMemo(
    () => featured.filter((item) => !listings.some((listed) => listed.id === item.id)).slice(0, 4),
    [featured, listings],
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, var(--color-brand) 0, transparent 45%), radial-gradient(circle at 80% 0%, var(--color-info) 0, transparent 40%)',
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-black uppercase tracking-wide text-brand-text">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('listings.hero.eyebrow')}
          </span>

          <h1 className="hero-title mt-3 max-w-2xl text-3xl font-black leading-tight tracking-tight text-content sm:text-4xl lg:text-5xl">
            {t('listings.hero.title')}{' '}
            <span className="text-brand">{t('listings.hero.titleAccent')}</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {t('listings.hero.subtitle')}
          </p>

          {/* Search */}
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchDraft}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t('listings.page.searchPlaceholder')}
                aria-label={t('common.action.search')}
                className="w-full rounded-2xl border border-line bg-surface-2 py-4 pl-12 pr-11 text-sm font-medium text-content shadow-card transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label={t('common.action.clear')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-subtle hover:bg-surface-3 hover:text-content"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <Button
              onClick={() =>
                currentUser
                  ? setCurrentView('CREATE_LISTING')
                  : setShowAuth(true, 'REGISTER')
              }
              className="shrink-0 py-4"
            >
              {t('listings.hero.postCta')}
            </Button>
          </div>

          {/* Trust strip */}
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { value: formatNumber(totalCount), labelKey: 'listings.hero.stats.listings' },
              { value: '0%', labelKey: 'listings.hero.stats.commission' },
              { value: '100%', labelKey: 'listings.hero.stats.checked' },
              // Labelled for what it actually counts: promoted listings, not
              // verified owners (no honest platform-wide owner count exists).
              { value: formatNumber(featured.length), labelKey: 'listings.featured.title' },
            ].map((stat) => (
              <div
                key={stat.labelKey}
                className="rounded-xl border border-line bg-surface-2 px-3 py-2.5"
              >
                <dt className="text-[11px] font-semibold text-subtle">{t(stat.labelKey as never)}</dt>
                <dd className="text-lg font-black text-content">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Promoted rail                                                     */}
      {/* ---------------------------------------------------------------- */}
      {promoted.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
          <div className="mb-3.5 flex items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-content sm:text-xl">
                <Sparkles className="h-5 w-5 text-warning" aria-hidden="true" />
                {t('listings.featured.title')}
              </h2>
              <p className="text-xs text-muted">{t('listings.featured.subtitle')}</p>
            </div>
          </div>

          <div className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {promoted.map((listing) => (
              <div key={listing.id} className="w-[78vw] shrink-0 snap-start sm:w-auto">
                <ListingCard listing={listing} promoted priority />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Toolbar                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <div className="hide-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {QUICK_FILTERS.map((quick) => {
            const active = isQuickActive(quick);
            return (
              <button
                key={quick.id}
                type="button"
                onClick={() => toggleQuick(quick)}
                aria-pressed={active}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all ${
                  active
                    ? 'border-brand bg-brand text-on-brand shadow-brand'
                    : 'border-line bg-surface text-muted hover:border-brand hover:text-brand-text'
                }`}
              >
                <quick.icon className="h-3.5 w-3.5" />
                {t(quick.labelKey as never)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-black text-content">{t('listings.page.title')}</h2>
            <p className="text-xs font-semibold text-muted" aria-live="polite">
              {filterCount > 0
                ? t('listings.page.resultCountFiltered', { count: formatNumber(totalCount) })
                : t('listings.page.resultCount', { count: formatNumber(totalCount) })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="listings-sort">
              {t('common.sort.label')}
            </label>
            <div className="relative">
              <SelectInput
                id="listings-sort"
                value={filters.sortBy}
                onChange={(event) =>
                  setFilters({ sortBy: event.target.value as Filters['sortBy'] })
                } compact className="w-full min-w-[9.5rem]"
              >
                <option value="RECOMMENDED">{t('common.sort.recommended')}</option>
                <option value="NEWEST">{t('common.sort.newest')}</option>
                <option value="PRICE_LOW">{t('common.sort.priceLow')}</option>
                <option value="PRICE_HIGH">{t('common.sort.priceHigh')}</option>
                <option value="TRUST">{t('common.sort.trust')}</option>
                <option value="POPULAR">{t('common.sort.popular')}</option>
              </SelectInput>
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((open) => !open)}
              aria-expanded={showFilters}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                filterCount > 0
                  ? 'border-brand bg-brand-soft text-brand-text'
                  : 'border-line bg-surface text-muted hover:text-content'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              {t('common.action.filter')}
              {filterCount > 0 && (
                <span className="rounded-full bg-brand px-1.5 text-[10px] text-on-brand">
                  {filterCount}
                </span>
              )}
            </button>

            <div
              className="hidden overflow-hidden rounded-xl border border-line sm:flex"
              role="group"
              aria-label={t('listings.page.view.grid')}
            >
              {(
                [
                  ['grid', LayoutGrid, 'listings.page.view.grid'],
                  ['list', ListIcon, 'listings.page.view.list'],
                ] as const
              ).map(([mode, Icon, labelKey]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  aria-pressed={view === mode}
                  aria-label={t(labelKey)}
                  className={`p-2 transition-colors ${
                    view === mode
                      ? 'bg-brand text-on-brand'
                      : 'bg-surface text-muted hover:text-content'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="rise-in mt-4 grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="filter-district"
                className="mb-1.5 block text-xs font-bold text-muted"
              >
                {t('common.filters.district')}
              </label>
              <SelectInput
                id="filter-district"
                value={filters.district}
                onChange={(event) => setFilters({ district: event.target.value })} className="w-full"
              >
                <option value="ALL">{t('common.filters.all')}</option>
                {TASHKENT_DISTRICTS.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </SelectInput>
            </div>

            <div>
              <label htmlFor="filter-rooms" className="mb-1.5 block text-xs font-bold text-muted">
                {t('common.filters.rooms')}
              </label>
              <SelectInput
                id="filter-rooms"
                value={filters.rooms ?? ''}
                onChange={(event) =>
                  setFilters({ rooms: event.target.value ? Number(event.target.value) : null })
                } className="w-full"
              >
                <option value="">{t('common.filters.all')}</option>
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {t('common.filters.roomsValue', { count })}
                  </option>
                ))}
              </SelectInput>
            </div>

            <div>
              <label
                htmlFor="filter-max-price"
                className="mb-1.5 block text-xs font-bold text-muted"
              >
                {t('common.filters.priceTo')}
              </label>
              <input
                id="filter-max-price"
                type="number"
                min={0}
                step={500_000}
                value={filters.maxPrice ?? ''}
                onChange={(event) =>
                  setFilters({
                    maxPrice: event.target.value ? Number(event.target.value) : null,
                  })
                }
                placeholder="10 000 000"
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm font-medium text-content focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="filter-rental-type"
                className="mb-1.5 block text-xs font-bold text-muted"
              >
                {t('common.rentalType.all')}
              </label>
              <SelectInput
                id="filter-rental-type"
                value={filters.rentalType}
                onChange={(event) =>
                  setFilters({ rentalType: event.target.value as Filters['rentalType'] })
                } className="w-full"
              >
                <option value="ALL">{t('common.filters.all')}</option>
                <option value="FULL">{t('common.rentalType.full')}</option>
                <option value="ROOMMATE">{t('common.rentalType.roommate')}</option>
              </SelectInput>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="button"
                onClick={() => {
                  setSearchDraft('');
                  resetFilters();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-text hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {t('common.filters.reset')}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Results                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {error && !loading && listings.length === 0 ? (
          <div className="rounded-2xl border border-danger/30 bg-danger-soft p-8 text-center">
            <p className="text-sm font-bold text-danger">
              {error === 'network' ? t('common.error.network') : t('common.error.generic')}
            </p>
            <Button
              variant="secondary"
              onClick={() => void fetchListings({ page: 1 })}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t('common.error.tryAgain')}
            </Button>
          </div>
        ) : loading && listings.length === 0 ? (
          <div
            className={
              view === 'grid'
                ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'space-y-3'
            }
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <ListingCardSkeleton key={index} variant={view} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-10 text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-subtle">
              <MapPin className="h-7 w-7" aria-hidden="true" />
            </span>
            <h3 className="text-base font-black text-content">
              {filterCount > 0 ? t('listings.empty.title') : t('listings.empty.noListingsTitle')}
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
              {filterCount > 0 ? t('listings.empty.body') : t('listings.empty.noListingsBody')}
            </p>
            <Button
              variant={filterCount > 0 ? 'secondary' : 'primary'}
              onClick={() =>
                filterCount > 0
                  ? (setSearchDraft(''), resetFilters())
                  : currentUser
                    ? setCurrentView('CREATE_LISTING')
                    : setShowAuth(true, 'REGISTER')
              }
              className="mt-5"
            >
              {filterCount > 0 ? t('listings.empty.cta') : t('listings.empty.noListingsCta')}
            </Button>
          </div>
        ) : (
          <>
            <div
              className={
                view === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'space-y-3'
              }
            >
              {listings.map((listing, index) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  variant={view}
                  priority={index < 4}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="secondary"
                  loading={loading}
                  onClick={() => void fetchListings({ append: true })}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {t('common.action.loadMore')}
                </Button>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-subtle">
              {t('common.pagination.showing', {
                from: 1,
                to: listings.length,
                total: formatNumber(totalCount),
              })}
            </p>
          </>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Safety note                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-black text-content">
            <ShieldCheck className="h-5 w-5 text-brand" aria-hidden="true" />
            {t('listings.safety.title')}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {(['tip1', 'tip2', 'tip3', 'tip4'] as const).map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-xs text-muted">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                  aria-hidden="true"
                />
                {t(`listings.safety.${tip}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
};

export default ListingsPage;
