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
import { copyFor } from '../../seo/content';
import { hubLinks } from '../../seo/links';
import { Button, SelectInput } from '../ui/Field';
import { LinkGroups } from '../seo/blocks';
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
  const language = useAppStore((state) => state.language);
  const copy = copyFor(language);

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

  const isMonetizationEnabled = useAppStore((state) => state.isMonetizationEnabled);

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
      {/* Controls (Joymee style)                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="sticky top-0 z-[60] bg-surface border-b border-line pb-4 pt-4 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-4">
          
          {/* Row 1: View Toggle & Map */}
          <div className="flex items-center gap-3">
            <div className="flex w-32 shrink-0 justify-between rounded-2xl bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`flex flex-1 items-center justify-center rounded-xl py-2.5 transition-colors ${
                  view === 'list' ? 'bg-brand text-on-brand shadow-sm' : 'text-muted'
                }`}
              >
                <ListIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`flex flex-1 items-center justify-center rounded-xl py-2.5 transition-colors ${
                  view === 'grid' ? 'bg-brand text-on-brand shadow-sm' : 'text-muted'
                }`}
              >
                <LayoutGrid className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCurrentView('MAP')}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3.5 text-sm font-bold text-muted transition-colors active:scale-95 hover:text-content"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {t('layout.nav.map')}
            </button>
          </div>

          {/* Row 2: Search & Filter Button */}
          <div className="flex gap-2.5">
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
                className="w-full rounded-2xl border border-transparent bg-surface-2 py-3.5 pl-12 pr-10 text-sm font-medium text-content transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
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
            <button
              type="button"
              onClick={() => setShowFilters((open) => !open)}
              aria-expanded={showFilters}
              className={`relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl transition-colors ${
                showFilters || filterCount > 0 ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted hover:text-content'
              }`}
            >
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              {filterCount > 0 && (
                <span className="absolute right-2 top-2 flex h-2 w-2 rounded-full bg-danger" />
              )}
            </button>
          </div>

          {/* Row 3: Rent Type Segmented Control */}
          <div className="flex rounded-2xl bg-surface-2 p-1">
            {(['ALL', 'FULL', 'ROOMMATE'] as const).map((type) => {
              const active = filters.rentalType === type;
              const label = type === 'ALL' ? t('common.rentalType.all') : type === 'FULL' ? t('common.rentalType.full') : t('common.rentalType.roommate');
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilters({ rentalType: type })}
                  className={`flex-1 rounded-xl py-2.5 text-[13px] font-bold transition-colors ${
                    active ? 'bg-brand text-on-brand shadow-sm' : 'text-muted hover:text-content'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Row 4: Horizontal Quick Filters */}
          <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {QUICK_FILTERS.map((quick) => {
              const active = isQuickActive(quick);
              return (
                <button
                  key={quick.id}
                  type="button"
                  onClick={() => toggleQuick(quick)}
                  aria-pressed={active}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-all ${
                    active
                      ? 'border-brand bg-brand-soft text-brand-text'
                      : 'border-transparent bg-surface-2 text-muted hover:text-content'
                  }`}
                >
                  <quick.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t(quick.labelKey as never)}
                </button>
              );
            })}
          </div>

          {/* Filter Panel (Expandable) */}
          {showFilters && (
            <div className="rise-in grid gap-4 rounded-2xl border border-line bg-surface-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="filter-district" className="mb-1.5 block text-xs font-bold text-muted">
                  {t('common.filters.district')}
                </label>
                <SelectInput
                  id="filter-district"
                  value={filters.district}
                  onChange={(event) => setFilters({ district: event.target.value })}
                  className="w-full bg-surface"
                >
                  <option value="ALL">{t('common.filters.all')}</option>
                  {TASHKENT_DISTRICTS.map((district) => (
                    <option key={district} value={district}>{district}</option>
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
                  onChange={(event) => setFilters({ rooms: event.target.value ? Number(event.target.value) : null })}
                  className="w-full bg-surface"
                >
                  <option value="">{t('common.filters.all')}</option>
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>{t('common.filters.roomsValue', { count })}</option>
                  ))}
                </SelectInput>
              </div>

              <div>
                <label htmlFor="filter-max-price" className="mb-1.5 block text-xs font-bold text-muted">
                  {t('common.filters.priceTo')}
                </label>
                <input
                  id="filter-max-price"
                  type="number"
                  min={0}
                  step={500_000}
                  value={filters.maxPrice ?? ''}
                  onChange={(event) => setFilters({ maxPrice: event.target.value ? Number(event.target.value) : null })}
                  placeholder="10 000 000"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-medium text-content focus:border-brand focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <button
                  type="button"
                  onClick={() => { setSearchDraft(''); resetFilters(); }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-text hover:underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('common.filters.reset')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Promoted / VIP Rail                                               */}
      {/* ---------------------------------------------------------------- */}
      {isMonetizationEnabled && promoted.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-6 pb-2 sm:px-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-warning" aria-hidden="true" />
            <h2 className="text-lg font-black text-content sm:text-xl">
              {t('listings.featured.vipTitle')}
            </h2>
            <span className="rounded-md bg-warning-soft px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-warning border border-warning/20">
              {t('listings.featured.topBadge')}
            </span>
          </div>
          <div className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {promoted.map((listing) => (
              <div key={listing.id} className="w-[85vw] shrink-0 snap-start sm:w-auto">
                <ListingCard listing={listing} promoted priority />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Results                                                           */}
      {/* ---------------------------------------------------------------- */}
      {/* The catalogue is the site's main money page and had no <h1> at all:
          its first heading was a conditional "VIP" <h2>, so on most renders
          the document's outline started inside the footer. */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
        <h1 className="text-xl font-black leading-tight tracking-tight text-content sm:text-2xl">
          {copy.catalog.h1}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">{copy.catalog.intro[0]}</p>
      </section>

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
      {/* Where else to look                                                */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <LinkGroups heading={copy.common.exploreHeading} groups={hubLinks(language)} />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Safety note                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6">
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
