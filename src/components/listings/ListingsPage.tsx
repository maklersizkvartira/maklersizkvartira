/**
 * The listings page — the platform's main showcase.
 *
 * Structure, front to back:
 *   1. A sticky control bar: view toggle, search, the rent-type switch and a
 *      snap-scrolling rail of quick filters.
 *   2. A promoted rail — the advertising surface, clearly labelled as such.
 *   3. The result grid, with real skeletons, a real empty state and a real
 *      error state (the previous build silently rendered mock data instead).
 *
 * The detailed filters live in the shared bottom sheet rather than in a panel
 * that expanded inside the sticky header. That panel was a single column on a
 * phone, so opening it ate half the viewport and pushed the results the
 * visitor was filtering off the bottom of the screen — while still exposing
 * only three of the fields the backend supports.
 *
 * The quick filters are a single-select group over `QUICK_FILTER_RAIL`, which
 * is defined in the store next to the filter shape it writes; the home page's
 * category tiles open the same searches from the same table.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Flower2,
  GraduationCap,
  Handshake,
  Home,
  Landmark,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  MapPin,
  Ruler,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  TrainFront,
  TrendingDown,
  Users,
  X,
} from 'lucide-react';

import { useTranslation, type TranslationKey } from '../../i18n';
import {
  activeQuickFilter,
  quickFilterState,
  useAppStore,
  QUICK_FILTER_RAIL,
  type Filters,
  type QuickFilterId,
} from '../../stores/useAppStore';
import { useSeoCopy } from '../../seo/useSeoCopy';
import { hubLinks } from '../../seo/links';
import { Button, SelectInput, TextInput } from '../ui/Field';
import { Chip, ChipRow } from '../ui/Chip';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { LinkGroups } from '../seo/blocks';
import { ListingCard, ListingCardSkeleton } from './ListingCard';

const TASHKENT_DISTRICTS = [
  'Chilonzor', 'Yunusobod', 'Mirobod', 'Yakkasaroy', 'Sergeli', 'Uchtepa',
  'Olmazor', 'Yashnobod', 'Shayxontohur', "Mirzo Ulug'bek", 'Bektemir', 'Yangihayot',
];

/**
 * The chip rail's presentation. What each id *means* is the store's business.
 *
 * The glyphs are the ones `home/QuickCategories.tsx` and `layout/Header.tsx`
 * give the same categories, because the icon is the only thing that survives
 * a horizontally scrolled rail where the labels are clipped: a visitor who
 * taps the flower-marked "Qizlarga" tile on the home page must land on a chip
 * wearing that same flower. This table had picked its own, so three
 * neighbouring chips shared one `Users` and five categories changed shape on
 * the way here. (The three tables are still three tables; only Header's
 * `Venus` for `qizlarga` remains out of step, and it lives in another file.)
 */
const QUICK_META: Record<
  QuickFilterId,
  { labelKey: TranslationKey; icon: React.ComponentType<{ className?: string }> }
> = {
  // 'all' is the rail's own entry and has no tile or menu item to match.
  all: { labelKey: 'listings.filters.quick.all', icon: LayoutGrid },
  roommate: { labelKey: 'listings.filters.quick.roommate', icon: Handshake },
  student: { labelKey: 'listings.filters.quick.student', icon: GraduationCap },
  family: { labelKey: 'listings.filters.quick.family', icon: Users },
  metro: { labelKey: 'listings.filters.quick.metro', icon: TrainFront },
  qizlarga: { labelKey: 'listings.filters.quick.qizlarga', icon: Flower2 },
  komfort: { labelKey: 'listings.filters.quick.komfort', icon: Sofa },
  center: { labelKey: 'listings.filters.quick.center', icon: Landmark },
  // The chip rail keeps a line glyph: the home cards' painted
  // illustrations are unreadable at the 16px a chip gives them.
  hovli: { labelKey: 'listings.filters.quick.hovli', icon: Home },
  budget: { labelKey: 'listings.filters.quick.budget', icon: TrendingDown },
  premium: { labelKey: 'listings.filters.quick.premium', icon: ShieldCheck },
};

/**
 * What the backend's `ListingFilters` will accept.
 *
 * `min={0}` on a number input constrains the spinner and nothing else — a
 * typed or pasted "-1" reached the query unchanged, the schema answered 422,
 * and `fetchListings` cleared the grid for a red card whose "try again"
 * re-sent the same rejected value. Clamping here is what keeps a typo from
 * looking like an outage. An inverted min/max pair needs no handling: the
 * schema swaps that itself.
 */
const MAX_PRICE = 1_000_000_000;
const MAX_AREA = 10_000;
/** `search` is `max_length=120` server-side. */
const MAX_SEARCH_LENGTH = 120;

/** Every sort the backend can actually order by. `AREA_LARGE` is not one. */
const SORT_OPTIONS: Array<{ value: NonNullable<Filters['sortBy']>; labelKey: TranslationKey }> = [
  { value: 'RECOMMENDED', labelKey: 'listings.filters.sort.recommended' },
  { value: 'NEWEST', labelKey: 'listings.filters.sort.newest' },
  { value: 'PRICE_LOW', labelKey: 'listings.filters.sort.priceLow' },
  { value: 'PRICE_HIGH', labelKey: 'listings.filters.sort.priceHigh' },
  { value: 'TRUST', labelKey: 'listings.filters.sort.trust' },
  { value: 'POPULAR', labelKey: 'listings.filters.sort.popular' },
];

const AMENITIES: Array<{ key: string; labelKey: TranslationKey }> = [
  { key: 'furnished', labelKey: 'listings.amenities.furnished' },
  { key: 'airConditioning', labelKey: 'listings.amenities.airConditioning' },
  { key: 'washingMachine', labelKey: 'listings.amenities.washingMachine' },
  { key: 'internet', labelKey: 'listings.amenities.internet' },
  { key: 'parking', labelKey: 'listings.amenities.parking' },
  { key: 'petsAllowed', labelKey: 'listings.amenities.petsAllowed' },
];

/** Empty box, empty filter — `Number('')` is 0, which is a real minimum. */
function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Price and area have different ceilings, so the bound travels with the field. */
function clampToRange(value: number | null, max: number): number | null {
  if (value === null) return null;
  return Math.min(Math.max(value, 0), max);
}

/**
 * A number box that commits on a pause rather than on every keystroke.
 *
 * `setFilters` fires a list request, so binding one of these straight to the
 * store would put a query on the wire for every digit of "3000000". The
 * store's sequencing makes that harmless, not free.
 */
const NumberFilter: React.FC<{
  label: string;
  placeholder: string;
  value: number | null;
  max: number;
  onCommit: (value: number | null) => void;
  step?: number;
}> = ({ label, placeholder, value, max, onCommit, step }) => {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follows the store when it moves on its own — "clear all", a quick filter,
  // a search arriving from the home page — but never while a keystroke of the
  // visitor's is still waiting to be committed.
  useEffect(() => {
    if (timer.current) return;
    setDraft(value === null ? '' : String(value));
  }, [value]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /**
   * Blur is what saves the last digits.
   *
   * These boxes live inside the filter sheet, and `<Sheet>` renders null when
   * it closes — so tapping "Show N results" 200ms after the last keystroke
   * unmounted the field and the cleanup above cancelled the pending commit
   * instead of running it. Pointer-down on the footer button, Escape and a
   * drag dismissal all blur the focused field first, so committing here
   * catches every one of them. The unmount cleanup stays a pure cancel: this
   * component also goes away when the whole page is torn down by a
   * navigation, and firing a filter write plus a list request on the way out
   * of a page the visitor has already left is not a save, it is a leak.
   */
  const flush = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    onCommit(clampToRange(toNumberOrNull(draft), max));
  };

  return (
    <TextInput
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      step={step}
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      onBlur={flush}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          onCommit(clampToRange(toNumberOrNull(next), max));
        }, 400);
      }}
    />
  );
};

export const ListingsPage: React.FC = () => {
  const { t, formatNumber } = useTranslation();
  const language = useAppStore((state) => state.language);
  const copy = useSeoCopy(language);

  const listings = useAppStore((state) => state.listings);
  const featured = useAppStore((state) => state.featured);
  const totalCount = useAppStore((state) => state.totalCount);
  const loading = useAppStore((state) => state.listingsLoading);
  const appending = useAppStore((state) => state.listingsAppending);
  const error = useAppStore((state) => state.listingsError);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const resetFilters = useAppStore((state) => state.resetFilters);
  const activeFilterCount = useAppStore((state) => state.activeFilterCount);
  const fetchListings = useAppStore((state) => state.fetchListings);
  const listingsAreCurrent = useAppStore((state) => state.listingsAreCurrent);
  const hasMore = useAppStore((state) => state.hasMoreListings);
  const fetchFeatured = useAppStore((state) => state.fetchFeatured);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const currentUser = useAppStore((state) => state.currentUser);
  const setShowAuth = useAppStore((state) => state.setShowAuth);

  const isMonetizationEnabled = useAppStore((state) => state.isMonetizationEnabled);

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requested = useRef(false);

  // Mount only; filter changes refetch through setFilters. The ref is what
  // makes that true under StrictMode, which mounts every effect twice.
  //
  // App.tsx swaps views by unmounting, so pressing Back from a listing detail
  // rebuilds this page from nothing and the ref resets with it. Refetching
  // page 1 there overwrote the seventy-two rows two "load more" taps had
  // accumulated with twenty-four, and dropped the visitor at the top of them.
  // The store knows whether the rows it holds answer the filters on screen;
  // when they do, there is nothing to ask for.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    if (!listingsAreCurrent()) void fetchListings({ page: 1 });
    void fetchFeatured();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search so typing does not fire a request per keystroke.
  const onSearchChange = useCallback(
    (value: string) => {
      setSearchDraft(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        searchTimer.current = null;
        setFilters({ search: value });
      }, 400);
    },
    [setFilters],
  );

  // The store's search term changes from places this box knows nothing about
  // — the home search sheet, a category tile, a filter reset. Seeding the
  // draft only at mount is why arriving from the home page showed an empty
  // search box over a filtered result set. The pending-timer guard stops the
  // resync from yanking the caret back while the visitor is still typing.
  useEffect(() => {
    if (searchTimer.current) return;
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const filterCount = activeFilterCount();
  const activeQuick = activeQuickFilter(filters);

  /**
   * Selecting a chip commits a whole filter set, not a patch.
   *
   * Patching only the keys a chip named is what let 'family' and 'roommate'
   * both stick: audience=FAMILY with rentalType=ROOMMATE asks the backend for
   * listings that are and are not shared at once, which returns nothing and
   * shows no chip to explain it.
   */
  const selectQuick = (id: QuickFilterId) => {
    const next = activeQuick === id ? 'all' : id;
    // Named, not inferred. A whole-set commit always carries a `search` key,
    // so the store used to file every chip tap under the search box.
    setFilters(quickFilterState(next, filters.search), { quickFilter: next });
  };

  const toggleAmenity = (key: string) => {
    const next = filters.amenities.includes(key)
      ? filters.amenities.filter((item) => item !== key)
      : [...filters.amenities, key];
    setFilters({ amenities: next });
  };

  const clearEverything = () => {
    setSearchDraft('');
    resetFilters();
  };

  const promoted = useMemo(
    () => featured.filter((item) => !listings.some((listed) => listed.id === item.id)).slice(0, 4),
    [featured, listings],
  );

  const showSkeletons = loading && !appending;

  const grid =
    view === 'grid'
      ? 'grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
      : 'space-y-3';

  return (
    <div className="min-h-screen bg-canvas">
      {/* ---------------------------------------------------------------- */}
      {/* Controls                                                          */}
      {/* ---------------------------------------------------------------- */}
      {/* `top-0` is measured from the viewport, not from the padded <main>, so
          the bar parked itself underneath the fixed header — an opaque
          `bg-surface/95` at z-90 against this z-60 — taking the view toggle,
          the search box and the filter badge with it for the rest of the
          scroll. 86/94px is the header's measured height; App.tsx:245 pads
          <main> by exactly the same numbers, so change one and change both. */}
      <section className="sticky top-[86px] z-[60] border-b border-line bg-surface pb-3 pt-3 shadow-sm sm:top-[94px]">
        <div className="gutter-safe mx-auto max-w-7xl space-y-3">

          {/* Row 1: view toggle & map */}
          <div className="flex items-center gap-3">
            <div className="flex w-32 shrink-0 justify-between rounded-2xl bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
                aria-label={t('listings.page.view.list')}
                className={`press flex min-h-11 flex-1 items-center justify-center rounded-xl transition-colors ${
                  view === 'list' ? 'bg-brand text-on-brand shadow-sm' : 'text-muted'
                }`}
              >
                <ListIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-pressed={view === 'grid'}
                aria-label={t('listings.page.view.grid')}
                className={`press flex min-h-11 flex-1 items-center justify-center rounded-xl transition-colors ${
                  view === 'grid' ? 'bg-brand text-on-brand shadow-sm' : 'text-muted'
                }`}
              >
                <LayoutGrid className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCurrentView('MAP')}
              className="press flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-surface-2 text-sm font-bold text-muted transition-colors hover:text-content"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {t('common.action.seeOnMap')}
            </button>
          </div>

          {/* Row 2: search & the filter sheet's trigger */}
          <div className="flex gap-2.5">
            {/* The shared control, not a hand-rolled copy of it. This was a
                raw <input> at `text-sm`, and Field.tsx explains at length why
                14px is not an option: iOS Safari zooms the page whenever a
                field under 16px takes focus and never zooms back — so the
                catalogue's main search box zoomed and the price boxes one
                sheet away did not. `className` overrides ride last through
                `cn`, which is what keeps the pill shape and the icon gutter. */}
            <div className="relative flex-1">
              <TextInput
                type="search"
                icon={<Search className="h-5 w-5" aria-hidden="true" />}
                value={searchDraft}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t('listings.page.searchPlaceholder')}
                aria-label={t('common.action.search')}
                // The server rejects a longer query outright, and a 422 here
                // empties the grid for a red card that says nothing about why.
                maxLength={MAX_SEARCH_LENGTH}
                className="h-12 rounded-2xl border-transparent pl-12 pr-10"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label={t('common.action.clear')}
                  className="press absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-subtle hover:bg-surface-3 hover:text-content"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              aria-label={t('listings.filters.openAria')}
              className={`press relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                filterCount > 0
                  ? 'bg-brand text-on-brand'
                  : 'bg-surface-2 text-muted hover:text-content'
              }`}
            >
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              {filterCount > 0 && (
                // A bare dot said "something is on" and nothing else. The
                // number is the whole point: it is how a visitor staring at an
                // unexpectedly short list works out how much is filtered away.
                <span
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black tabular-nums text-white"
                  aria-hidden="true"
                >
                  {filterCount}
                </span>
              )}
            </button>
          </div>

          {/* Row 3: rent type */}
          <Segmented
            label={t('home.search.rentalTypeLabel')}
            value={filters.rentalType}
            // `audience` goes with it: FAMILY means "2+ rooms and not shared",
            // so leaving it standing while switching to ROOMMATE asks for
            // listings that are shared and not shared at the same time.
            //
            // `roommateGender` goes too, unless the switch is *staying* on
            // shared rooms — it is meaningless on a whole apartment, and it
            // used to survive the move: tapping Qizlarga and then FULL left a
            // girls-only clause counted in the filter badge, matching no chip
            // in the rail, and with no control anywhere on screen able to
            // clear it short of "clear all".
            onChange={(rentalType) =>
              setFilters({
                rentalType,
                audience: 'ALL',
                ...(rentalType === 'ROOMMATE' ? {} : { roommateGender: 'ALL' as const }),
              })
            }
            options={[
              { value: 'ALL', label: t('common.rentalType.all') },
              { value: 'FULL', label: t('common.rentalType.full') },
              { value: 'ROOMMATE', label: t('common.rentalType.roommate') },
            ]}
          />

          {/* Row 4: quick filters */}
          <ChipRow label={t('listings.filters.quickLabel')} className="snap-x snap-mandatory">
            {QUICK_FILTER_RAIL.map((id) => {
              const meta = QUICK_META[id];
              return (
                <Chip
                  key={id}
                  className="snap-start"
                  label={t(meta.labelKey)}
                  icon={meta.icon}
                  // No special case for 'all'. `activeQuickFilter` iterates a
                  // rail whose first entry *is* 'all' with an empty delta, so
                  // the unfiltered state returns the string 'all' and only a
                  // combination matching no chip returns null. Testing 'all'
                  // against null was exactly inverted: nothing lit up on an
                  // unfiltered catalogue, and picking a district lit up
                  // "Hammasi" next to a badge reading 1.
                  selected={activeQuick === id}
                  onClick={() => selectQuick(id)}
                />
              );
            })}
          </ChipRow>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Filters                                                           */}
      {/* ---------------------------------------------------------------- */}
      <Sheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title={t('listings.filters.title')}
        description={
          filterCount > 0
            ? t('listings.filters.activeCount', { count: filterCount })
            : t('listings.filters.subtitle')
        }
        size="lg"
        footer={
          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={clearEverything}
              disabled={filterCount === 0}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t('listings.filters.clearAll')}
            </Button>
            <Button className="flex-1" onClick={() => setShowFilters(false)}>
              {loading
                ? t('common.sheet.loading')
                : totalCount > 0
                  ? t('listings.filters.showResults', { count: formatNumber(totalCount) })
                  : t('listings.filters.showResultsNone')}
            </Button>
          </div>
        }
      >
        <div className="space-y-6 pb-2">
          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.filters.locationTitle')}
            </legend>
            <SelectInput
              aria-label={t('common.filters.district')}
              value={filters.district}
              onChange={(event) => setFilters({ district: event.target.value })}
              className="w-full"
            >
              <option value="ALL">{t('common.filters.all')}</option>
              {TASHKENT_DISTRICTS.map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </SelectInput>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.filters.roomsTitle')}
            </legend>
            <ChipRow label={t('listings.filters.roomsTitle')}>
              <Chip
                label={t('common.filters.all')}
                selected={filters.rooms === null}
                onClick={() => setFilters({ rooms: null })}
              />
              {[1, 2, 3, 4, 5].map((count) => (
                <Chip
                  key={count}
                  label={String(count)}
                  selected={filters.rooms === count}
                  onClick={() => setFilters({ rooms: count })}
                />
              ))}
            </ChipRow>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.filters.priceTitle')}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberFilter
                label={t('listings.filters.minPrice')}
                placeholder={t('listings.filters.minPricePlaceholder')}
                value={filters.minPrice}
                max={MAX_PRICE}
                step={500_000}
                onCommit={(minPrice) => setFilters({ minPrice })}
              />
              <NumberFilter
                label={t('listings.filters.maxPrice')}
                placeholder={t('listings.filters.maxPricePlaceholder')}
                value={filters.maxPrice}
                max={MAX_PRICE}
                step={500_000}
                onCommit={(maxPrice) => setFilters({ maxPrice })}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-subtle">{t('listings.filters.priceHint')}</p>
          </fieldset>

          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-subtle">
              <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
              {t('listings.filters.areaTitle')}
            </legend>
            {/* Only the minimum: `maxArea` is in the copy but not in
                `ListingFilters`, so a maximum would be dropped in transit. */}
            <NumberFilter
              label={t('listings.filters.minArea')}
              placeholder={t('listings.filters.minAreaPlaceholder')}
              value={filters.minArea}
              max={MAX_AREA}
              step={5}
              onCommit={(minArea) => setFilters({ minArea })}
            />
          </fieldset>

          {/* Roommate gender.

              Shown while the search is about shared rooms, and shown anyway
              whenever it is set, because `activeFilterCount` counts it: a
              number in that badge with no control behind it is a filter the
              visitor can see the effect of and not the cause. The Qizlarga
              chip was the only thing that could set it and nothing here could
              undo it. Labels are the owner form's — one wording for "who can
              share", asked from the other side. */}
          {(filters.rentalType === 'ROOMMATE' || filters.roommateGender !== 'ALL') && (
            <fieldset>
              <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
                {t('owner.create.details.roommateGenderLabel')}
              </legend>
              <ChipRow label={t('owner.create.details.roommateGenderLabel')}>
                {(
                  [
                    ['ALL', 'common.filters.all'],
                    ['GIRLS', 'owner.create.details.roommateGenderGirls'],
                    ['BOYS', 'owner.create.details.roommateGenderBoys'],
                  ] as const
                ).map(([value, labelKey]) => (
                  <Chip
                    key={value}
                    label={t(labelKey)}
                    selected={filters.roommateGender === value}
                    onClick={() => setFilters({ roommateGender: value })}
                  />
                ))}
              </ChipRow>
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.filters.amenitiesTitle')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((amenity) => (
                <Chip
                  key={amenity.key}
                  label={t(amenity.labelKey)}
                  selected={filters.amenities.includes(amenity.key)}
                  onClick={() => toggleAmenity(amenity.key)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.filters.sortBy')}
            </legend>
            <SelectInput
              aria-label={t('listings.filters.sortBy')}
              value={filters.sortBy ?? 'RECOMMENDED'}
              onChange={(event) =>
                setFilters({ sortBy: event.target.value as Filters['sortBy'] })
              }
              className="w-full"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
              ))}
            </SelectInput>
          </fieldset>

          <label className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4">
            <span className="flex items-center gap-2 text-sm font-bold text-content">
              <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
              {t('listings.filters.quick.verified')}
            </span>
            <input
              type="checkbox"
              checked={filters.onlyVerified}
              // Ticking narrows, so it must not widen. Both arms of the old
              // ternary wrote `0` — `DEFAULT_FILTERS.minTrustScore` *is* zero —
              // so ticking a box labelled "verified only" wiped the 80-point
              // threshold the premium chip had set and returned *more* rows
              // than before it was ticked. Ticking now leaves the threshold
              // alone; unticking clears it, because a trust floor with nothing
              // on screen to show it is a filter the visitor cannot undo.
              onChange={(event) =>
                setFilters(
                  event.target.checked
                    ? { onlyVerified: true }
                    : { onlyVerified: false, minTrustScore: 0 },
                )
              }
              className="h-5 w-5 accent-[var(--color-brand)]"
            />
          </label>
        </div>
      </Sheet>

      {/* ---------------------------------------------------------------- */}
      {/* Promoted / VIP Rail                                               */}
      {/* ---------------------------------------------------------------- */}
      {isMonetizationEnabled && promoted.length > 0 && (
        <section className="gutter-safe mx-auto max-w-7xl pb-2 pt-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-warning" aria-hidden="true" />
            <h2 className="text-lg font-black text-content sm:text-xl">
              {t('listings.featured.vipTitle')}
            </h2>
            <span className="rounded-md border border-warning/20 bg-warning-soft px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-warning">
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
      <section className="gutter-safe mx-auto max-w-7xl pt-6 sm:pt-8">
        <h1 className="text-xl font-black leading-tight tracking-tight text-content sm:text-2xl">
          {copy.catalog.h1}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">{copy.catalog.intro[0]}</p>
      </section>

      <section className="gutter-safe mx-auto max-w-7xl py-6 sm:py-8">
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
        ) : showSkeletons ? (
          // Skeletons, not the previous query's rows. Leaving stale results up
          // while a new filter is in flight is the same lie the mock listings
          // told: cards that are about to be replaced by a different number of
          // cards, which is what "everything vanished" looked like.
          <div className={grid} aria-busy="true" aria-label={t('common.sheet.loading')}>
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
                  ? clearEverything()
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
            <div className={grid}>
              {listings.map((listing, index) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  variant={view}
                  priority={index < 4}
                />
              ))}
            </div>

            {/* An append that failed keeps its rows and says so here, rather
                than collapsing the list back to the first page. */}
            {error && !appending && listings.length > 0 && (
              <p className="mt-6 text-center text-xs font-bold text-danger">
                {error === 'network' ? t('common.error.network') : t('common.error.generic')}
              </p>
            )}

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="secondary"
                  loading={appending}
                  disabled={loading}
                  onClick={() => void fetchListings({ append: true })}
                >
                  {appending ? (
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
      <section className="gutter-safe mx-auto max-w-7xl">
        <LinkGroups heading={copy.common.exploreHeading} groups={hubLinks(language)} />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Safety note                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="gutter-safe mx-auto max-w-7xl pb-12 pt-10">
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
