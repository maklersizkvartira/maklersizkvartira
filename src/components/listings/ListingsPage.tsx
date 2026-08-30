/**
 * The listings page — the platform's main showcase.
 *
 * Structure, front to back:
 *   1. A sticky control bar: the search box and the filter sheet's trigger,
 *      the rent-type switch, the category chips, and — only once something is
 *      filtered — a row naming every filter that is on, each one removable.
 *   2. A promoted rail — the advertising surface, clearly labelled as such.
 *   3. A results toolbar (how many listings there are, and how they are
 *      drawn), then the grid, with real skeletons, a real empty state and a
 *      real error state (the previous build silently rendered mock data).
 *
 * The bar used to be four stacked bands of identical weight — view toggle and
 * map, then search and filter, then the rent-type control, then a chip rail
 * that trailed off halfway across the row — with nothing on screen to say
 * which of them mattered or which of them were doing anything at that moment.
 * It now reads in one order: the search, then the two dimensions this
 * catalogue is actually browsed by, then the state those choices produced.
 * The view toggle moved down to the results it draws, which is both where it
 * belongs and what buys a phone back the row the rest of the bar needed.
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
import { HEADER_STICKY_TOP } from '../layout/headerMetrics';
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

  /**
   * Every filter that is on right now, one removable chip each.
   *
   * The badge on the sheet's trigger said "3" and nothing more, so a visitor
   * looking at an unexpectedly short catalogue could see that something was
   * narrowing it and then had to open the sheet — and scroll it — to find out
   * what. This list is that answer, on screen, and each entry undoes exactly
   * its own field, so backing out of one decision no longer means clearing
   * every decision.
   *
   * It walks the same fields in the same order as `activeFilterCount`, so the
   * number in the badge is always the number of chips standing here. Rolling
   * a whole quick filter up into one chip would read more tidily and would
   * lie: "Oilalarga" is three filters at once, and the visitor who wants a
   * family flat with one room rather than two has to be able to reach the one
   * that is in the way.
   */
  const applied: Array<{ id: string; label: string; clear: () => void }> = [];

  if (filters.search) {
    // Cleared through the debounced handler rather than `setFilters`, so the
    // box on screen empties with the store instead of waiting for the resync.
    applied.push({ id: 'search', label: filters.search, clear: () => onSearchChange('') });
  }
  if (filters.region !== 'ALL') {
    applied.push({
      id: 'region',
      label: filters.region,
      clear: () => setFilters({ region: 'ALL' }),
    });
  }
  if (filters.district !== 'ALL') {
    applied.push({
      id: 'district',
      label: filters.district,
      clear: () => setFilters({ district: 'ALL' }),
    });
  }
  if (filters.metroStation !== 'ALL') {
    applied.push({
      id: 'metroStation',
      label: filters.metroStation,
      clear: () => setFilters({ metroStation: 'ALL' }),
    });
  }
  if (filters.universityName !== 'ALL') {
    applied.push({
      id: 'universityName',
      label: filters.universityName,
      clear: () => setFilters({ universityName: 'ALL' }),
    });
  }
  if (filters.rooms !== null) {
    applied.push({
      id: 'rooms',
      label: t('common.filters.roomsValue', { count: filters.rooms }),
      clear: () => setFilters({ rooms: null }),
    });
  }
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    // One chip for the pair. `activeFilterCount` counts a price range once,
    // and two chips here would put the badge and this row permanently out of
    // step over the single filter people set most often.
    //
    // The unit is carried, not assumed: this chip and the area one below it
    // are otherwise both a bare number behind a comparison sign. It is always
    // som, whatever `currency` says — the sheet's boxes write UZS and the
    // backend's bounds are UZS, so `formatPrice` and its exchange rate would
    // be converting a number that was never dollars.
    const from = filters.minPrice === null ? '' : formatNumber(filters.minPrice);
    const to = filters.maxPrice === null ? '' : formatNumber(filters.maxPrice);
    const som = t('common.units.som');
    applied.push({
      id: 'price',
      label: from && to ? `${from} – ${to} ${som}` : to ? `≤ ${to} ${som}` : `≥ ${from} ${som}`,
      clear: () => setFilters({ minPrice: null, maxPrice: null }),
    });
  }
  if (filters.minArea !== null) {
    applied.push({
      id: 'minArea',
      label: `≥ ${formatNumber(filters.minArea)} ${t('common.units.sqm')}`,
      clear: () => setFilters({ minArea: null }),
    });
  }
  if (filters.propertyType !== 'ALL') {
    // Named by its field rather than by its value: nothing on this page sets
    // it except the Hovli chip, so there is no member list to translate and a
    // raw "HOUSE" on screen would be worse than the field's own name.
    applied.push({
      id: 'propertyType',
      label: t('common.filters.propertyType'),
      clear: () => setFilters({ propertyType: 'ALL' }),
    });
  }
  if (filters.rentalType !== 'ALL') {
    applied.push({
      id: 'rentalType',
      label:
        filters.rentalType === 'FULL'
          ? t('common.rentalType.full')
          : t('common.rentalType.roommate'),
      // Its own field and nothing else. The segmented control drops
      // `audience` when it moves because FAMILY implies FULL and the other
      // pairing is unsatisfiable; widening back to ALL cannot produce that
      // pairing, so a chip that quietly took a second filter with it would
      // only be surprising.
      clear: () => setFilters({ rentalType: 'ALL' }),
    });
  }
  if (filters.roommateGender !== 'ALL') {
    applied.push({
      id: 'roommateGender',
      label:
        filters.roommateGender === 'GIRLS'
          ? t('owner.create.details.roommateGenderGirls')
          : t('owner.create.details.roommateGenderBoys'),
      clear: () => setFilters({ roommateGender: 'ALL' }),
    });
  }
  if (filters.audience !== 'ALL') {
    applied.push({
      id: 'audience',
      label:
        filters.audience === 'STUDENT'
          ? t('common.audience.student')
          : t('common.audience.family'),
      clear: () => setFilters({ audience: 'ALL' }),
    });
  }
  if (filters.onlyVerified) {
    applied.push({
      id: 'onlyVerified',
      label: t('listings.filters.quick.verified'),
      // The sheet's checkbox clears `minTrustScore` as it unticks because
      // nothing else in the sheet could reach it afterwards. Here the
      // threshold has a chip of its own in this same row, so this one leaves
      // it standing rather than taking a second filter with it.
      clear: () => setFilters({ onlyVerified: false }),
    });
  }
  if (filters.minTrustScore > 0) {
    applied.push({
      id: 'minTrustScore',
      label: t('common.filters.trustScore'),
      clear: () => setFilters({ minTrustScore: 0 }),
    });
  }
  filters.amenities.forEach((key) => {
    // A quick filter can set an amenity the sheet does not list; the raw key
    // is a poor label but an invisible filter is a worse one.
    const known = AMENITIES.find((amenity) => amenity.key === key);
    applied.push({
      id: `amenity:${key}`,
      label: known ? t(known.labelKey) : key,
      clear: () => toggleAmenity(key),
    });
  });

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
          `bg-surface/95` at z-90 against this z-60 — taking the search box and
          the filter badge with it for the rest of the scroll.

          The offset is `HEADER_STICKY_TOP`, imported, and never a literal.
          "Change one and change both" is precisely what did not happen: the
          two offsets that stood here were the pre-redesign bar — 86px, and 94
          above the sm breakpoint. Once the bar became 65px at every width
          this parked 21px too low (29 above sm), leaving a strip of the
          results list scrolling visibly through the gap. Those values are
          written as prose rather than as class names deliberately: Tailwind
          v4 scans this file as raw text, so a dead utility quoted in a
          comment is a dead utility shipped in the stylesheet.

          Height is the other budget this bar lives inside. It is sticky under
          a 65px header on a 360px phone, so every row it holds open is a row
          of listings the visitor cannot see. Two rows at rest and three once
          something is filtered — 176px and 232px at `py-2` — is 38% and 46%
          of a 640px screen once the header is counted. That budget is why the
          view toggle went down to the results and why the rent-type control
          is the `sm` size here rather than the default one. */}
      <section
        className={`sticky ${HEADER_STICKY_TOP} z-[60] border-b border-line bg-surface py-2 shadow-sm sm:py-3`}
      >
        <div className="gutter-safe mx-auto max-w-7xl space-y-2">

          {/* Primary: the words the visitor is searching by, the sheet that
              holds everything this bar has no room for, the map, and the one
              cut that splits the whole catalogue in half.

              They are one group and they wrap as one. On a phone the search
              and its two buttons take the first line and the rent-type switch
              takes the second; from `lg`, where there is finally width for
              it, the four sit on a single line. `flex-wrap` does that with one
              instance of each control — a phone copy and a desktop copy
              behind `hidden`/`lg:flex` would put two radio groups in the
              accessibility tree for one setting. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex w-full min-w-0 items-center gap-2 lg:w-auto lg:flex-1">
              {/* The shared control, not a hand-rolled copy of it. This was a
                  raw <input> at `text-sm`, and Field.tsx explains at length why
                  14px is not an option: iOS Safari zooms the page whenever a
                  field under 16px takes focus and never zooms back — so the
                  catalogue's main search box zoomed and the price boxes one
                  sheet away did not. `className` overrides ride last through
                  `cn`, which is what keeps the pill shape and the icon gutter. */}
              <div className="relative min-w-0 flex-1">
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
                  // The right gutter is only held open while there is a clear
                  // button to hold it open for. On a 360px phone this field is
                  // about 216px wide, so a permanent 48px reservation was a
                  // fifth of the placeholder cut off for a control that is not
                  // on screen. Both class names are written out in full:
                  // Tailwind v4 scans this file as text and would generate
                  // nothing at all for an assembled `'pr-' + n`.
                  className={`h-12 rounded-2xl border-transparent pl-12 ${
                    searchDraft ? 'pr-12' : 'pr-4'
                  }`}
                />
                {searchDraft && (
                  // 44px rather than the 36 it was. It sits inside a 48px
                  // field, so the whole tap target fits without the field
                  // having to grow to hold it.
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    aria-label={t('common.action.clear')}
                    className="press absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-subtle hover:bg-surface-3 hover:text-content"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowFilters(true)}
                aria-label={t('listings.filters.openAria')}
                className={`press relative flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-colors sm:w-auto sm:px-4 ${
                  filterCount > 0
                    ? 'bg-brand text-on-brand'
                    : 'bg-surface-2 text-muted hover:text-content'
                }`}
              >
                <SlidersHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
                {/* The word appears as soon as there is width for it. Below
                    that the glyph carries the button, and the chips underneath
                    say what the sheet is currently doing to the list. */}
                <span className="hidden sm:inline">{t('listings.filters.title')}</span>
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

              <button
                type="button"
                onClick={() => setCurrentView('MAP')}
                aria-label={t('common.action.seeOnMap')}
                className="press flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-surface-2 text-sm font-bold text-muted transition-colors hover:text-content sm:w-auto sm:px-4"
              >
                <MapPin className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{t('common.action.seeOnMap')}</span>
              </button>
            </div>

            <Segmented
              label={t('home.search.rentalTypeLabel')}
              value={filters.rentalType}
              // `size="sm"` with a `p-0.5` track. At the default size three
              // segments and their padding want about 380px and a 360px phone
              // has 328, so "Butun kvartira" and "Квартира целиком" were being
              // truncated on the one control in the bar whose labels have to be
              // read to be used at all. The `lg` minimum keeps that headroom
              // once the control stops being full-width.
              size="sm"
              className="w-full p-0.5 lg:w-auto lg:min-w-[19rem] lg:shrink-0"
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
          </div>

          {/* The categories, and the row they have to fill.

              Nine chips sized to their own labels are about 1060px of content
              laid out in one line, so on every screen between a phone and a
              large laptop the row simply stopped somewhere in the middle and
              left the rest of the width blank. Two layouts fix that between
              them and neither can leave dead space by construction.

              On a phone the row scrolls, and the content is three times the
              viewport, so there is no free space left over to be empty — the
              chip cut off at the right edge is the affordance that says so.

              From `sm` the row wraps, and every chip carries `grow`, so each
              line — the last one included — is distributed across the whole
              width instead of ending early. `grow` is unconditional rather
              than `sm:grow` because it does nothing in the scrolling case: a
              flex line whose content overflows has no free space to hand out.
              `justify-center` is what keeps a stretched chip looking like a
              button rather than like a label stranded at the left edge of an
              over-wide box. */}
          <ChipRow
            label={t('listings.filters.quickLabel')}
            className="snap-x snap-mandatory sm:flex-wrap sm:overflow-x-visible"
          >
            {QUICK_FILTER_RAIL.map((id) => {
              const meta = QUICK_META[id];
              return (
                <Chip
                  key={id}
                  className="grow snap-start justify-center"
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

          {/* What is on, and the one tap that turns all of it off.

              The row exists only while something is filtered, which is the
              only time it is worth a phone's screen, and it is deliberately
              the last thing in the bar: it is the consequence of the controls
              above it rather than a fourth control competing with them. */}
          {applied.length > 0 && (
            <div className="flex items-center gap-2">
              <div
                role="group"
                aria-label={t('listings.filters.activeCount', { count: filterCount })}
                className="hide-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible"
              >
                {applied.map((item) => (
                  // The body and the ✕ do the same thing on purpose. The cross
                  // is what says which way tapping goes, and it is a 24px
                  // target inside a 44px chip — so the chip itself carries the
                  // handler too and the whole pill is tappable. The cost is
                  // that a keyboard reaches each chip twice, once for the pill
                  // and once for Chip's own remove affordance; two labelled
                  // stops for one filter is the cheaper of the two prices.
                  //
                  // `max-w` is for the search chip, whose label is whatever
                  // the visitor happened to type.
                  <Chip
                    key={item.id}
                    label={item.label}
                    selected
                    onClick={item.clear}
                    onRemove={item.clear}
                    removeLabel={t('listings.filters.clearOne', { label: item.label })}
                    className="max-w-[60vw] sm:max-w-xs"
                  />
                ))}
              </div>
              {/* Dashed and unfilled, so it does not read as one more filter
                  that happens to be switched off. Pinned outside the scrolling
                  group rather than sitting at the end of it: clearing is not
                  one action if the visitor has to scroll a row sideways to
                  reach the control that does it. */}
              <button
                type="button"
                onClick={clearEverything}
                aria-label={t('listings.filters.clearAll')}
                className="press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line-2 px-3 text-xs font-bold text-muted transition-colors hover:border-danger/50 hover:text-danger"
              >
                <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden xs:inline">{t('listings.filters.clearAll')}</span>
              </button>
            </div>
          )}
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
        {/* How the results are drawn belongs with the results.

            The grid/list toggle used to be the first control in the sticky
            bar, above the search box: the most prominent thing on the page,
            for a preference that is set once and then never touched again,
            holding 44px of a phone's screen open on every scroll of every
            visit. Down here it sits beside the count whose shape it changes,
            and the row it gave up is the one the applied-filter chips now
            stand in.

            The count is new on this page. `totalCount` was reachable only
            from the sheet's footer button and a line underneath the last card,
            so a visitor who had filtered the catalogue down to four listings
            had to work that out from the length of the grid.

            Nothing to draw, nothing to say: the empty and error cards below
            both already explain themselves, and a toolbar reading "0 listings
            found" over the top of one of them is a second voice saying the
            same thing less well. */}
        {(showSkeletons || listings.length > 0) && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-bold text-muted">
              {showSkeletons
                ? t('common.sheet.loading')
                : filterCount > 0
                  ? t('listings.page.resultCountFiltered', { count: formatNumber(totalCount) })
                  : t('listings.page.resultCount', { count: formatNumber(totalCount) })}
            </p>
            <div className="flex shrink-0 gap-1 rounded-2xl bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
                aria-label={t('listings.page.view.list')}
                className={`press flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                  view === 'list'
                    ? 'bg-brand text-on-brand shadow-sm'
                    : 'text-muted hover:text-content'
                }`}
              >
                <ListIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-pressed={view === 'grid'}
                aria-label={t('listings.page.view.grid')}
                className={`press flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                  view === 'grid'
                    ? 'bg-brand text-on-brand shadow-sm'
                    : 'text-muted hover:text-content'
                }`}
              >
                <LayoutGrid className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
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
