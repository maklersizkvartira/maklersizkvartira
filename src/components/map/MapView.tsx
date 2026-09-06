/**
 * The map surface.
 *
 * The map surface itself lives in ./engine, which picks Yandex when a key is
 * configured and Leaflet otherwise. This file owns the page around it.
 *
 * The renderer is loaded from a CDN at runtime rather than bundled: it is
 * the only screen that needs it, and pulling ~150 KB into the main chunk for
 * a view most visitors never open is a worse trade than one lazy request.
 * What changed is the safety around it — the version is pinned, the files
 * carry SRI hashes, and a failed load now renders an explanation plus a way
 * into the list view instead of a blank rectangle.
 *
 * Markers come from `store.listings`, so the map shows exactly what the
 * server returned for the current filters. Listings without coordinates are
 * counted and reported rather than scattered around Tashkent with made-up
 * positions, which is what the previous build did.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createMapEngine } from './engine';
import type { LatLng, MapEngine } from './engine';
import {
  ChevronRight,
  Image as ImageIcon,
  List,
  LocateFixed,
  MapPin,
  RefreshCw,
  Ruler,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Train,
  X,
} from 'lucide-react';

import { AMENITIES } from '../../data/amenities';
import { TASHKENT_METRO_LINES, UZBEKISTAN_REGIONS } from '../../data/mockLocations';
import { useTranslation } from '../../i18n';
import {
  DEFAULT_FILTERS,
  MAP_PAGE_SIZE,
  activeQuickFilter,
  quickFilterState,
  railFor,
  useAppStore,
  type Filters,
  type QuickFilterId,
} from '../../stores/useAppStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { Listing } from '../../types';
import { isForSale } from '../../types/deal';
import { BOTTOM_NAV_CLEARANCE, VIEWPORT_UNDER_HEADER_H } from '../layout/headerMetrics';
import { Button, SelectInput, TextInput } from '../ui/Field';
import { Chip, ChipRow } from '../ui/Chip';
import { NumberFilter } from '../ui/NumberFilter';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
// The catalogue's rail, drawn here from the same table. `railFor` already
// knows what to do with this screen's 'ALL' deal type — it was taught that
// when the union grew its third member, for exactly this.
import { QUICK_META } from '../listings/quickFilterMeta';

// ---------------------------------------------------------------------------
const TASHKENT_CENTER: LatLng = [41.311, 69.279];


// ---------------------------------------------------------------------------
// Districts — the taxonomy lives in data/mockLocations, the coordinates here
// ---------------------------------------------------------------------------
type DistrictKey =
  | 'chilonzor'
  | 'yunusobod'
  | 'mirobod'
  | 'mirzoUlugbek'
  | 'olmazor'
  | 'yakkasaroy'
  | 'sergeli'
  | 'shayxontohur'
  | 'yashnobod'
  | 'uchtepa'
  | 'bektemir'
  | 'yangihayot';

/** Apostrophes drift between data sources (ʻ, ’, '), so names are compared loosely. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ʻʼ‘’'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const DISTRICT_META: { match: string; key: DistrictKey; center: LatLng }[] = [
  { match: 'chilonzor', key: 'chilonzor', center: [41.278, 69.208] },
  { match: 'yunusobod', key: 'yunusobod', center: [41.365, 69.292] },
  { match: 'mirobod', key: 'mirobod', center: [41.3005, 69.274] },
  { match: 'mirzo ulugbek', key: 'mirzoUlugbek', center: [41.335, 69.33] },
  { match: 'olmazor', key: 'olmazor', center: [41.349, 69.208] },
  { match: 'yakkasaroy', key: 'yakkasaroy', center: [41.289, 69.255] },
  { match: 'sergeli', key: 'sergeli', center: [41.225, 69.22] },
  { match: 'shayxontohur', key: 'shayxontohur', center: [41.32, 69.24] },
  { match: 'yashnobod', key: 'yashnobod', center: [41.29, 69.34] },
  { match: 'uchtepa', key: 'uchtepa', center: [41.295, 69.175] },
  { match: 'bektemir', key: 'bektemir', center: [41.21, 69.33] },
  { match: 'yangihayot', key: 'yangihayot', center: [41.2, 69.253] },
];

const DISTRICT_BY_NAME = new Map(DISTRICT_META.map((entry) => [entry.match, entry]));

/** Districts as data/mockLocations spells them — the single source of truth. */
const TASHKENT_DISTRICTS: string[] =
  UZBEKISTAN_REGIONS.find((region) => region.id === 'tashkent_city')?.districts ?? [];

/**
 * The districts to offer for the region that is selected.
 *
 * The dropdown used to be hardcoded to Tashkent's twelve. That was fine while
 * the map only had a district filter, and wrong the moment it gained a region
 * one: picking Samarqand and then a district would have matched a Tashkent
 * name against Samarqand listings and returned nothing, with both controls
 * showing a perfectly sensible pair of choices.
 */
function districtsFor(region: string): string[] {
  if (region === 'ALL') return TASHKENT_DISTRICTS;
  return UZBEKISTAN_REGIONS.find((entry) => entry.name === region)?.districts ?? [];
}

/** The catalogue's list, in the catalogue's order, so the two screens agree. */
const PROPERTY_TYPES: { value: string; labelKey: string }[] = [
  { value: 'APARTMENT', labelKey: 'listings.propertyType.apartment' },
  { value: 'HOUSE', labelKey: 'listings.propertyType.house' },
  { value: 'ROOM', labelKey: 'listings.propertyType.room' },
  { value: 'STUDIO', labelKey: 'listings.propertyType.studio' },
  { value: 'DORMITORY', labelKey: 'listings.propertyType.dormitory' },
  { value: 'LAND', labelKey: 'listings.propertyType.land' },
  { value: 'COMMERCIAL', labelKey: 'listings.propertyType.commercial' },
];

const SORT_OPTIONS: { value: NonNullable<Filters['sortBy']>; labelKey: string }[] = [
  { value: 'RECOMMENDED', labelKey: 'listings.filters.sort.recommended' },
  { value: 'NEWEST', labelKey: 'listings.filters.sort.newest' },
  { value: 'PRICE_LOW', labelKey: 'listings.filters.sort.priceLow' },
  { value: 'PRICE_HIGH', labelKey: 'listings.filters.sort.priceHigh' },
  { value: 'TRUST', labelKey: 'listings.filters.sort.trust' },
  { value: 'POPULAR', labelKey: 'listings.filters.sort.popular' },
];

/**
 * The ceiling the API enforces, in so'm — `min_price`/`max_price` are declared
 * `le=1_000_000_000`, and anything above it is a 422 that empties the map for
 * a red card that says nothing about why.
 */
const MAX_PRICE = 1_000_000_000;
const MAX_AREA = 10_000;

/** The server has no `maxSearch`; it rejects a longer query outright. */
const MAX_SEARCH_LENGTH = 120;

/**
 * How close two listings must be to share a pin, in degrees of latitude.
 *
 * 0.00018° is about twenty metres. The bubble is roughly sixty pixels wide,
 * and twenty metres is under one pixel at city zoom and about eight at street
 * zoom — so anything inside this radius overlaps its neighbour at every zoom a
 * visitor browses at. It is also, in practice, the same building.
 */
const PIN_MERGE_DEGREES = 0.00018;

// ---------------------------------------------------------------------------
// Marker rendering
// ---------------------------------------------------------------------------
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Marker content is handed to Leaflet as raw HTML, so listing text is escaped. */
/**
 * The currency a listing was actually quoted in.
 *
 * The type says `'UZS' | 'USD'`, but the column behind it is a bare
 * `String(3)` with a default and no constraint — only the create and update
 * schemas narrow it, and the read schema hands back plain `str`. So a row
 * carrying 'usd', ' USD' or '' typechecks all the way to here and then fails a
 * strict `=== 'USD'`, which on this screen means a dollar listing drawn as a
 * so'm one: `$700` rendered as "700 mln so'm". Anything that is not
 * recognisably USD is treated as so'm, which is the column's own default.
 */
function quotedIn(listing: Listing): 'UZS' | 'USD' {
  return String(listing.currency ?? '').trim().toUpperCase() === 'USD' ? 'USD' : 'UZS';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/**
 * The marker lives outside React's tree, so it cannot use utility classes that
 * Tailwind might not emit for a string literal. Colours are read straight from
 * the theme variables instead, which also means markers re-theme with the page.
 */
/** The id the visitor's own pin carries, so a click on it can be ignored. */
const ME_MARKER_ID = '__me__';

/**
 * The visitor's own position: a dot, not a price bubble.
 *
 * Deliberately a different shape from every listing pin. It answers a
 * different question — "where am I" rather than "what is here" — and a second
 * bubble among the prices would read as another flat.
 */
function meMarkerHtml(): string {
  return `
    <span style="display:block;width:16px;height:16px;border-radius:9999px;
                 background:var(--color-brand);border:3px solid var(--color-surface);
                 box-shadow:0 0 0 4px rgb(20 71 230 / 0.25);"></span>
  `;
}

/**
 * One price bubble. `extra` is how many further listings stand on this spot.
 *
 * The count is the correction. Markers are absolutely positioned elements, so
 * two listings at the same address land on the same pixel and the second one
 * is simply behind the first: the counter said "10 e'lon on the map", the
 * visitor could see nine, and nothing anywhere said the tenth existed. Two
 * flats in one building is the ordinary case here, not an edge case.
 */
function markerHtml(priceText: string, extra = 0, selected = false): string {
  const bubble = selected
    ? 'background: var(--color-brand); color: #ffffff; border-color: var(--color-brand); transform: scale(1.12); box-shadow: 0 4px 14px rgba(20, 71, 230, 0.45); font-weight: 900;'
    : 'background: var(--color-surface); color: var(--color-brand-text); border-color: var(--color-brand);';
  const tip = selected ? 'var(--color-brand)' : 'var(--color-surface)';
  const badge =
    extra > 0
      ? `<span style="margin-left:6px;display:inline-block;border-radius:9999px;
                      background:var(--color-brand);color:var(--color-on-brand);
                      padding:0 5px;font-size:10px;line-height:16px;">+${extra}</span>`
      : '';

  return `
    <div class="flex flex-col items-center transition-transform" style="filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.25)); z-index: ${selected ? 99 : 1};">
      <div class="whitespace-nowrap rounded-2xl border px-2.5 py-1 text-[11px] font-black transition-all" style="${bubble}">
        ${escapeHtml(priceText)}${badge}
      </div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${tip};margin-top:-1px;"></div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Script loading
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
export const MapView: React.FC = () => {
  const { t, language, formatPrice, formatNumber } = useTranslation();
  const { isDark } = useTheme();

  const listings = useAppStore((state) => state.listings);
  const totalCount = useAppStore((state) => state.totalCount);
  const listingsLoading = useAppStore((state) => state.listingsLoading);
  const listingsAppending = useAppStore((state) => state.listingsAppending);
  const listingsError = useAppStore((state) => state.listingsError);
  const hasMoreListings = useAppStore((state) => state.hasMoreListings);
  const fetchListings = useAppStore((state) => state.fetchListings);
  const listingsAreCurrent = useAppStore((state) => state.listingsAreCurrent);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const activeFilterCount = useAppStore((state) => state.activeFilterCount);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const currency = useAppStore((state) => state.currency);
  const setCurrency = useAppStore((state) => state.setCurrency);
  const fxRate = useAppStore((state) => state.fxRate);
  const setPageSize = useAppStore((state) => state.setPageSize);
  const setMapCarryFilters = useAppStore((state) => state.setMapCarryFilters);

  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Bumped by the retry button. The map effect keys off it, so retrying tears
  // the old attempt down and builds a fresh one rather than layering a second
  // map onto the same element.
  const [retryToken, setRetryToken] = useState(0);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [showFilters, setShowFilters] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  /** Where the visitor is, once they ask. Never requested on load. */
  const [me, setMe] = useState<[number, number] | null>(null);
  const [meBusy, setMeBusy] = useState(false);
  const engineRef = useRef<MapEngine | null>(null);
  /** Resolves once the previous engine has been torn down. See the map effect. */
  const teardownRef = useRef<Promise<void>>(Promise.resolve());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requested = useRef(false);

  // -- Data ----------------------------------------------------------------
  // Mount only; filter changes refetch through setFilters. The ref is what
  // makes that true under StrictMode, which mounts every effect twice — two
  // page-1 requests where one was wanted, the second cancelling the first.
  //
  // Three things happen here, in order, and the order is the point.
  //
  // The page size goes up first. A map holding twenty-four of a hundred pins
  // behind a "load more" button is not a smaller map, it is a wrong one: the
  // visitor has no way to know the ones they cannot see exist, and panning to
  // an empty district tells them there is nothing there.
  //
  // Then the filters, and this is the half that was wrong.
  //
  // The map's neutral state is everything: no filter on, and 'ALL' for the
  // deal type, which is the one screen where "both" is coherent. Arriving at a
  // map that has already hidden every property for sale, or every rental, or
  // everything outside one district, with nothing on screen saying so, is a
  // filtered map presented as the whole picture.
  //
  // Whether to keep what is standing used to be INFERRED — "is any filter on?"
  // — and that question cannot tell the two arrivals apart. Pressing "Xaritada
  // ko'rish" on a catalogue search and pressing the Xarita tab in the bottom
  // bar both arrive with filters on; only the first one means "carry them".
  // So a category tile tapped on the home page (which commits audience and a
  // deal type), an SEO landing page, an answer from the assistant, or simply
  // having looked at Sotuv earlier in the session all left the map opening
  // pre-filtered. And the deal-type half was inverted as well: a bare 'SALE'
  // counts as no active filter, so it read as "cold", took the `setFilters`
  // branch — which only writes `dealType` — and the map opened on sales alone.
  //
  // The caller states it now. `mapCarryFilters` is set by exactly two buttons
  // (the catalogue's "see on map" and the listing page's "view on map") and by
  // the pin taps below, which are the arrivals a Back press returns from.
  //
  // Only then the fetch, and only if the store is not already holding the
  // answer — after a neutral commit it will not be, because the filters are
  // part of the signature `listingsAreCurrent` compares.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    setPageSize(MAP_PAGE_SIZE);

    const carry = useAppStore.getState().mapCarryFilters;
    setMapCarryFilters(false); // one-shot, consumed here

    if (carry) {
      if (!listingsAreCurrent()) void fetchListings({ page: 1 });
      return;
    }

    const neutral: Filters = { ...DEFAULT_FILTERS, dealType: 'ALL' };
    const alreadyNeutral = (Object.keys(neutral) as (keyof Filters)[]).every((key) =>
      key === 'amenities' ? filters.amenities.length === 0 : filters[key] === neutral[key],
    );
    if (alreadyNeutral) {
      if (!listingsAreCurrent()) void fetchListings({ page: 1 });
      return;
    }

    // One commit, one request. The pending search debounce is killed rather
    // than left to re-apply the query being cleared, and the draft is set
    // directly instead of through `commitSearch`, which would fire a second
    // `setFilters` — and so a second round trip — of its own.
    //
    // Deliberately NOT `clearEverything`: that also resets the currency, which
    // is not a filter, defaults to "as the owner quoted it" on every page load
    // anyway, and on a Back-from-a-listing arrival would undo a choice the
    // visitor made on this very screen.
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    setSearchDraft('');
    setFilters(neutral);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapped = useMemo(
    () =>
      listings
        .filter(
          (listing) =>
            Number.isFinite(listing.latitude) &&
            Number.isFinite(listing.longitude) &&
            (listing.latitude !== 0 || listing.longitude !== 0),
        )
        .map((listing) => ({
          listing,
          position: [listing.latitude, listing.longitude] as LatLng,
        })),
    [listings],
  );

  const missingCoordinates = listings.length - mapped.length;

  /**
   * Listings standing close enough together to share one pin.
   *
   * By distance, not by a rounded grid. Rounding to four decimals was the
   * first attempt and it fails on the case that motivated this: two real
   * listings nine metres apart at 41.29356/69.22172 and 41.29360/69.22163
   * round to different cells because they straddle a boundary, so they were
   * still drawn on top of each other and one of them was still invisible. A
   * grid groups points that share a cell, which is not the same question as
   * whether two points collide on screen.
   *
   * Greedy, and against the first member rather than a moving centroid, so
   * the grouping does not depend on iteration order beyond the ranking the
   * server already chose. Quadratic in the number of pins, which is capped at
   * a hundred by `MAP_PAGE_SIZE`.
   *
   * The group keeps the server's order, so the price on the bubble is the
   * ranked-first listing rather than an arbitrary member, and the group's id
   * is that listing's id — stable across re-renders and refetches.
   */
  const grouped = useMemo(() => {
    const cells: { id: string; position: LatLng; listings: Listing[] }[] = [];
    for (const { listing, position } of mapped) {
      // Longitude degrees are shorter than latitude ones away from the
      // equator; without the cosine the threshold would be ~25% wider
      // east-west than north-south at Tashkent's latitude.
      const scale = Math.cos((position[0] * Math.PI) / 180);
      const near = cells.find((cell) => {
        const dLat = cell.position[0] - position[0];
        const dLng = (cell.position[1] - position[1]) * scale;
        return Math.hypot(dLat, dLng) <= PIN_MERGE_DEGREES;
      });
      if (near) near.listings.push(listing);
      else cells.push({ id: listing.id, position, listings: [listing] });
    }
    return cells;
  }, [mapped]);

  /** The group a tap opened, when it holds more than one listing. */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const groupListings = openGroup
    ? (grouped.find((cell) => cell.id === openGroup)?.listings ?? [])
    : [];

  /**
   * The pin showing a preview card, and the listing that card is about.
   *
   * A pin is a small target on a phone and the page it opens is a big
   * commitment, so the first tap shows what is there and the second one goes.
   * Only a pin holding ONE listing gets a card: several is a choice rather
   * than a preview, and that opens the group sheet instead.
   *
   * The ref exists because the marker click handler is registered with the
   * engine, which is outside React's tree: it closes over whatever `selectedId`
   * was when `setMarkers` last ran, and "is this the pin already open?" has to
   * be asked of the current value, not that one.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const selectedCell = selectedId
    ? (grouped.find((cell) => cell.id === selectedId) ?? null)
    : null;
  const selected =
    selectedCell && selectedCell.listings.length === 1 ? selectedCell.listings[0] : null;

  // A refetch can dissolve the group that is open — a filter change, a listing
  // withdrawn mid-browse. Left alone, the sheet and the card would sit there
  // describing something that is no longer on the map.
  useEffect(() => {
    if (openGroup && !grouped.some((cell) => cell.id === openGroup)) setOpenGroup(null);
  }, [grouped, openGroup]);

  useEffect(() => {
    if (selectedId && !grouped.some((cell) => cell.id === selectedId)) setSelectedId(null);
  }, [grouped, selectedId]);

  // Escape closes the card. It is the only thing this screen opens that is not
  // a Sheet, and Sheet handles its own.
  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId]);

  /**
   * A listing's price converted into the currency the viewer asked for.
   *
   * Only reached when they actually asked. Takes the listing rather than a
   * number because `listing.price` is stored in whichever currency the owner
   * quoted, so a bare number cannot be converted without knowing which:
   * normalised to so'm first, then out again, so the two kinds of listing
   * rank and read alike.
   */
  const inSelectedCurrency = useCallback(
    (listing: Listing, code: 'UZS' | 'USD') => {
      const uzs = quotedIn(listing) === 'USD' ? listing.price * fxRate : listing.price;
      return code === 'USD' ? uzs / fxRate : uzs;
    },
    [fxRate],
  );

  /**
   * What a pin says, and what a screen reader reads out for it.
   *
   * `currency === null` is the default and it means "the viewer has not asked"
   * — so the price is rendered exactly as its owner set it, which is what the
   * catalogue card and the detail page have always done. This screen used to
   * be the exception: the store defaulted to 'UZS', so a flat advertised at
   * $1,000 arrived on the map as "12.7 mln", a number the owner never quoted
   * and one that moves overnight with the exchange rate. Two screens, two
   * prices, one listing.
   *
   * Conversion is still here, and still one tap away — it is just something
   * the viewer opts into rather than something the map does to them.
   */
  const priceOf = useCallback(
    (listing: Listing) => {
      const quoted = quotedIn(listing);
      return {
        code: currency ?? quoted,
        value: currency === null ? listing.price : inSelectedCurrency(listing, currency),
        // Whether this number is the owner's or ours. Everything that renders
        // a price reads it, because a figure we computed from an exchange rate
        // that moves overnight must not be presented with the same authority
        // as the one the owner typed.
        converted: currency !== null && currency !== quoted,
      };
    },
    [currency, inSelectedCurrency],
  );

  const fullPrice = useCallback(
    (listing: Listing) => {
      const { code, value, converted } = priceOf(listing);
      const text = formatPrice(value, code);
      return converted ? `≈ ${text}` : text;
    },
    [formatPrice, priceOf],
  );

  /** Markers only have room for a short price, so so'm is shown in millions. */
  const badgePrice = useCallback(
    (listing: Listing) => {
      const { code, value, converted } = priceOf(listing);
      const text =
        code === 'USD'
          ? formatPrice(value, 'USD')
          : t('map.marker.priceMillion', {
              value: formatNumber(value / 1_000_000, { maximumFractionDigits: 1 }),
            });
      return converted ? `≈ ${text}` : text;
    },
    [formatNumber, formatPrice, priceOf, t],
  );

  // -- Map -----------------------------------------------------------------
  // Created once and kept. Re-running this would drop every marker and throw
  // the viewport back to the city centre while someone is reading a pin.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let cancelled = false;
    setMapStatus('loading');

    /**
     * Wait for the previous attempt to finish before starting this one.
     *
     * `cancelled` alone was not enough, and the gap it left is reachable in
     * production, not just under StrictMode's double mount. Building a map is
     * two awaits deep — load the script, wait for `ymaps.ready` — and the
     * cleanup runs long before either resolves. At that moment `engineRef` is
     * still null, so the cleanup tears down nothing, and the next attempt
     * calls `new ymaps.Map(element, …)` on a container the first attempt is
     * still on its way to claiming. Both eventually resolve; the loser's late
     * `destroy()` wipes the container the winner is now the live handle for,
     * and the visitor is left looking at a grey rectangle.
     *
     * Chaining the builds through one promise means a build never *starts* on
     * a container a pending build still owns.
     */
    const mine = teardownRef.current.then(() =>
      createMapEngine(element, {
        center: TASHKENT_CENTER,
        zoom: 12,
        dark: isDark,
        language,
        zoomInTitle: t('map.a11y.zoomIn'),
        zoomOutTitle: t('map.a11y.zoomOut'),
      }).then(
        (engine) => {
          if (cancelled) {
            engine.destroy();
            return;
          }
          engineRef.current = engine;
          setMapStatus('ready');
        },
        () => {
          if (!cancelled) setMapStatus('error');
        },
      ),
    );

    return () => {
      cancelled = true;
      // The next build waits on this, so a teardown that has not happened yet
      // — because the engine is still being built — still blocks it.
      teardownRef.current = mine.then(() => {
        engineRef.current?.destroy();
        engineRef.current = null;
      });
    };
    // Rebuilding the map for a theme or language change would be far more
    // disruptive than the small mismatch it fixes; both are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  useEffect(() => {
    if (mapStatus === 'ready') engineRef.current?.setTheme(isDark);
  }, [mapStatus, isDark]);

  // A tap on the map itself dismisses the preview card, which is what anyone
  // who has used a map expects and is a much larger target than the card's own
  // close button. Registered once the engine exists, and torn down with it —
  // `onClick(null)` is the engine's own way of saying "stop reporting".
  useEffect(() => {
    if (mapStatus !== 'ready') return;
    const engine = engineRef.current;
    if (!engine) return;
    engine.onClick(() => setSelectedId(null));
    return () => engine.onClick(null);
  }, [mapStatus]);

  // Markers.
  useEffect(() => {
    if (mapStatus !== 'ready') return;
    const engine = engineRef.current;
    if (!engine) return;

    // The visitor's own pin goes in the same call as the listings. `setMarkers`
    // replaces everything it is given, so a separate call for one of them
    // would simply erase the other.
    const pins = grouped.map((cell) => {
      const [first] = cell.listings;
      const extra = cell.listings.length - 1;
      const price = badgePrice(first);
      return {
        id: cell.id,
        position: cell.position,
        html: markerHtml(price, extra, cell.id === selectedId),
        label:
          extra > 0
            ? t('map.marker.groupLabel', { count: cell.listings.length })
            : t('map.marker.label', { title: first.title, price }),
      };
    });
    if (me) {
      pins.push({
        id: ME_MARKER_ID,
        position: me,
        html: meMarkerHtml(),
        label: t('map.me.label'),
      });
    }

    engine.setMarkers(
      pins,
      // Look, then go.
      //
      // The first tap on a pin raises a preview card and brings the pin to the
      // middle of the map; the second tap on the SAME pin opens the listing.
      // A pin is a small target with a big page behind it, and on a phone the
      // map is most of what the visitor can see — sending them straight to a
      // full page on a tap they may have made with the side of a thumb is a
      // navigation they then have to undo.
      //
      // A pin holding several listings is a different question and gets a
      // different answer: opening whichever happened to be ranked first would
      // be a coin toss the visitor never sees, so they get the list.
      (id) => {
        // The visitor's own pin is not a listing and opens nothing.
        if (id === ME_MARKER_ID) return;
        const cell = grouped.find((entry) => entry.id === id);
        if (!cell) return;
        if (cell.listings.length > 1) {
          setSelectedId(null);
          setOpenGroup(cell.id);
          return;
        }
        // Asked of the ref, not of the value this handler closed over: the
        // engine keeps whichever callback it was last given, and that one was
        // built when `selectedId` was something else.
        if (id === selectedIdRef.current) {
          // Leaving the map for a listing is an arrival this screen expects to
          // be returned from. Without the flag, Back would remount the map, see
          // no carry, and reset the filters the visitor had just set ON it.
          setMapCarryFilters(true);
          setCurrentView('LISTING_DETAIL', cell.listings[0].id);
          return;
        }
        setSelectedId(cell.id);
        engineRef.current?.panTo(cell.position);
      },
    );
  }, [mapStatus, grouped, badgePrice, me, t, selectedId, setCurrentView, setMapCarryFilters]);

  // Frame the results when the result set itself changes — not when the user
  // merely selects a pin, which would yank the viewport away from them.
  const boundsKey = useMemo(() => mapped.map((entry) => entry.listing.id).join(','), [mapped]);

  useEffect(() => {
    if (mapStatus !== 'ready') return;
    const engine = engineRef.current;
    if (!engine) return;

    if (mapped.length > 0) {
      engine.fitTo(mapped.map((entry) => entry.position));
      return;
    }

    const district = DISTRICT_BY_NAME.get(normalizeName(filters.district));
    if (district) engine.flyTo(district.center, 13);
    // `mapped` is represented by boundsKey; depending on it would refit on every fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStatus, boundsKey, filters.district]);

  // -- Filters -------------------------------------------------------------
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

  /**
   * Commit whatever is typed, right now.
   *
   * The box had no submit path at all: pressing the phone keyboard's search
   * key did nothing, because there was no form around the input and no key
   * handler on it, so the only way to run a search was to type and then wait
   * out a debounce with no sign that anything had been registered. Clearing
   * had the same problem in reverse — the ✕ went through the same 400ms
   * timer, so the pins stayed filtered for most of a second after the box
   * was visibly empty.
   */
  const commitSearch = useCallback(
    (value: string) => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
        searchTimer.current = null;
      }
      setSearchDraft(value);
      if (value !== filters.search) setFilters({ search: value });
    },
    [filters.search, setFilters],
  );

  // The store's search term can change from somewhere this box knows nothing
  // about — the home search sheet, a category tile, a filter reset. Seeding
  // the draft only at mount left an empty box over a filtered map. The
  // pending-timer guard is what stops the resync from yanking the caret back
  // while the visitor is still typing.
  useEffect(() => {
    if (searchTimer.current) return;
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  /**
   * Put the visitor on the map, and move the map to them.
   *
   * Asked for, never automatic. A permission prompt on arrival is the fastest
   * way to lose somebody who has not yet decided to trust the page, and the
   * map is perfectly useful without knowing where anyone is.
   *
   * A refusal is not an error worth a banner — the visitor said no on purpose
   * — so the button simply stops spinning.
   */
  const locateMe = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setMeBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setMe(here);
        setMeBusy(false);
        engineRef.current?.flyTo(here, 14);
      },
      () => setMeBusy(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const districtLabel = useCallback(
    (name: string) => {
      const meta = DISTRICT_BY_NAME.get(normalizeName(name));
      // An unmapped district still shows its own name rather than nothing.
      return meta ? t(`map.districts.${meta.key}` as `map.districts.${DistrictKey}`) : name;
    },
    [t],
  );

  /**
   * How many filters are on, counting the deal type.
   *
   * The store's `activeFilterCount` deliberately ignores `dealType`, because
   * on the catalogue it is not a filter — it is which of two catalogues you
   * are looking at, and one of them is always selected. On the map it *is* a
   * filter, because 'ALL' is a real state there. Leaving it out is what made
   * tapping "Sotuv" produce an empty map, a card telling the visitor to clear
   * their filters, and no clear button — because the count said nothing was
   * on.
   */
  const dealTypeFiltered = filters.dealType !== 'ALL';
  const filterCount = activeFilterCount() + (dealTypeFiltered ? 1 : 0);

  /**
   * Back to a completely unfiltered map, in one tap.
   *
   * `resetFilters()` alone will not do it: it preserves `dealType` on purpose,
   * because on the catalogue "clear filters" while browsing sales means show
   * me all of the sales. Here the neutral state is 'ALL', so the deal type has
   * to go with everything else — and the search draft has to be cleared
   * through `commitSearch`, or the pending debounce re-applies the query the
   * visitor just cleared.
   */
  const clearEverything = useCallback(() => {
    commitSearch('');
    setFilters({ ...DEFAULT_FILTERS, dealType: 'ALL' });
    // The currency goes too. It is not in `Filters` — it changes what the pins
    // say rather than which pins are drawn — so "clear everything" left it
    // behind, and `filterCount` does not count it either. A visitor who had
    // pressed So'm, then pressed clear, was looking at a map that had reset
    // every filter and was still rewriting every dollar price into so'm, with
    // nothing on screen saying why.
    setCurrency(null);
  }, [commitSearch, setCurrency, setFilters]);

  /**
   * One removable chip per filter that is on.
   *
   * The map had no such row. `filterCount` was computed and then used exactly
   * once, to decide whether to draw a reset button inside an empty-state card
   * — so a visitor looking at four pins where they expected forty had nothing
   * on screen telling them what had been narrowed, and no way to undo one
   * thing without undoing all of it. The catalogue has had this row for a
   * while; this is the same idea, same component, same wording.
   */
  const applied: { id: string; label: string; clear: () => void }[] = [];
  // First, because it is the one entry here that is not a filter: it does not
  // remove a pin, it rewrites what every pin says. It earns a chip for exactly
  // that reason — it was the only control on this screen whose effect was
  // visible everywhere and whose cause was three taps inside a sheet.
  if (currency !== null) {
    applied.push({
      id: 'currency',
      label: t(currency === 'USD' ? 'map.filters.currencyUsd' : 'map.filters.currencyUzs'),
      clear: () => setCurrency(null),
    });
  }
  if (dealTypeFiltered) {
    applied.push({
      id: 'dealType',
      label: t(filters.dealType === 'SALE' ? 'common.dealType.sale' : 'common.dealType.rent'),
      clear: () => setFilters({ dealType: 'ALL' }),
    });
  }
  if (filters.search) {
    applied.push({ id: 'search', label: filters.search, clear: () => commitSearch('') });
  }
  if (filters.region !== 'ALL') {
    applied.push({
      id: 'region',
      label: filters.region,
      // The district goes with the region: a Tashkent district under a
      // Samarqand region matches nothing, and nothing on screen would say why.
      clear: () => setFilters({ region: 'ALL', district: 'ALL' }),
    });
  }
  if (filters.district !== 'ALL') {
    applied.push({
      id: 'district',
      label: districtLabel(filters.district),
      clear: () => setFilters({ district: 'ALL' }),
    });
  }
  if (filters.metroStation !== 'ALL') {
    applied.push({
      id: 'metro',
      label: filters.metroStation,
      clear: () => setFilters({ metroStation: 'ALL' }),
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
    const from = filters.minPrice === null ? '' : formatNumber(filters.minPrice);
    const to = filters.maxPrice === null ? '' : formatNumber(filters.maxPrice);
    // With the unit. The chip was a bare number, so with "Dollar" pressed it
    // read as a dollar range while the filter behind it was, and stays, so'm.
    const som = t('common.units.som');
    applied.push({
      id: 'price',
      label:
        from && to ? `${from} – ${to} ${som}` : from ? `≥ ${from} ${som}` : `≤ ${to} ${som}`,
      clear: () => setFilters({ minPrice: null, maxPrice: null }),
    });
  }
  if (filters.minArea !== null) {
    applied.push({
      id: 'area',
      label: `≥ ${formatNumber(filters.minArea)} ${t('common.units.sqm')}`,
      clear: () => setFilters({ minArea: null }),
    });
  }
  if (filters.propertyType !== 'ALL') {
    const known = PROPERTY_TYPES.find((entry) => entry.value === filters.propertyType);
    applied.push({
      id: 'propertyType',
      label: known ? t(known.labelKey as never) : filters.propertyType,
      clear: () => setFilters({ propertyType: 'ALL' }),
    });
  }
  if (filters.rentalType !== 'ALL') {
    applied.push({
      id: 'rentalType',
      label: t(
        filters.rentalType === 'FULL' ? 'common.rentalType.full' : 'common.rentalType.roommate',
      ),
      clear: () => setFilters({ rentalType: 'ALL' }),
    });
  }
  if (filters.roommateGender !== 'ALL') {
    applied.push({
      id: 'roommateGender',
      label: t(
        filters.roommateGender === 'GIRLS'
          ? 'owner.create.details.roommateGenderGirls'
          : 'owner.create.details.roommateGenderBoys',
      ),
      clear: () => setFilters({ roommateGender: 'ALL' }),
    });
  }
  if (filters.audience !== 'ALL') {
    applied.push({
      id: 'audience',
      label: t(
        filters.audience === 'STUDENT' ? 'common.audience.student' : 'common.audience.family',
      ),
      clear: () => setFilters({ audience: 'ALL' }),
    });
  }
  if (filters.sellerType !== 'ALL') {
    applied.push({
      id: 'sellerType',
      label: t(
        filters.sellerType === 'OWNER'
          ? 'listings.seller.filterOwner'
          : 'listings.seller.filterAgent',
      ),
      clear: () => setFilters({ sellerType: 'ALL' }),
    });
  }
  if (filters.onlyVerified) {
    applied.push({
      id: 'verified',
      label: t('listings.filters.quick.verified'),
      // Unticking clears the trust floor too, exactly as the catalogue's own
      // checkbox does — a threshold with nothing on screen to show it is a
      // filter the visitor cannot undo.
      clear: () => setFilters({ onlyVerified: false, minTrustScore: 0 }),
    });
  }
  // Its own chip, not folded into the verified one. "Yuqori ishonchli" sets
  // both at once, and a visitor who wants to keep the verified-owner cut while
  // dropping an 80-point floor had no way to say so.
  if (filters.minTrustScore > 0) {
    applied.push({
      id: 'trust',
      label: `${t('listings.filters.sort.trust')} ${filters.minTrustScore}+`,
      clear: () => setFilters({ minTrustScore: 0 }),
    });
  }
  filters.amenities.forEach((key) => {
    const known = AMENITIES.find((amenity) => amenity.key === key);
    applied.push({
      id: `amenity:${key}`,
      label: known ? t(known.labelKey as never) : key,
      clear: () =>
        setFilters({ amenities: filters.amenities.filter((entry) => entry !== key) }),
    });
  });

  const toggleAmenity = (key: string) =>
    setFilters({
      amenities: filters.amenities.includes(key)
        ? filters.amenities.filter((entry) => entry !== key)
        : [...filters.amenities, key],
    });

  /**
   * The catalogue's quick filters, on the map.
   *
   * A chip commits a whole filter set rather than a patch — the same rule the
   * catalogue follows, and for the same reason: 'family' and 'roommate' patched
   * together ask for listings that both are and are not shared, which returns
   * nothing and leaves no chip explaining why.
   *
   * The deal type is carried across, so a chip tapped on an everything-map
   * stays an everything-map. `railFor` drops the tenancy-only chips when it is
   * not purely rentals, so the combination that would empty the map cannot be
   * reached from here.
   */
  const activeQuick = activeQuickFilter(filters);
  const selectQuick = (id: QuickFilterId) => {
    const next = activeQuick === id ? 'all' : id;
    // Whatever is in the box wins, and the pending debounce is cancelled with
    // it. A chip tapped a keystroke after typing would otherwise commit the
    // previous query and then have the timer fire 400ms later and patch the
    // new one over a set the visitor had just replaced.
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    setFilters(quickFilterState(next, searchDraft, filters.dealType), {
      quickFilter: next,
    });
  };

  const showEmpty = !listingsLoading && !listingsError && listings.length === 0;
  const showNoMapped = !listingsLoading && listings.length > 0 && mapped.length === 0;

  // -- Render --------------------------------------------------------------
  return (
    <div
      // One height, `dvh`, and room for the bottom bar.
      //
      // This was `h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-5.5rem)]`, which was
      // three errors in one line: `vh` is the tallest the viewport ever gets on
      // a phone, so the surface hung sixty-odd pixels below the screen; 3.5rem
      // was 9px short of the real header; and 5.5rem was 23px too tall. Worse,
      // nothing reserved room for the fixed BottomNav, so on every phone the
      // locate-me button and both engines' zoom controls were drawn underneath
      // it and every tap on them hit a navigation tab instead.
      // `px-safe` as well as the bottom clearance. The root reserved room for
      // the home indicator and nothing for the sensor housing, so on a notched
      // phone held sideways the filter bar, the pin counter and the locate
      // button all sat under the cut-out. It is a zero-width padding on every
      // device that has no inset.
      className={`flex w-full flex-col overflow-hidden bg-canvas px-safe ${VIEWPORT_UNDER_HEADER_H} ${BOTTOM_NAV_CLEARANCE}`}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Controls                                                            */}
      {/* ------------------------------------------------------------------ */}
      {/* Two rows on a phone instead of four, because every row here is a row
          the map does not get. The old bar spent one on a title and a counter,
          one on the search box and one on a horizontally scrolling rail of
          pills and dropdowns — about 172px of an 844px screen, before the
          BottomNav took its share. The title is redundant (the page is
          obviously a map), the counter has moved onto the map itself where
          there is unused space, and everything that was in the rail is now in
          a sheet. */}
      <div className="z-20 shrink-0 border-b border-line bg-surface px-3 py-2.5 shadow-card sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-7xl flex-col gap-2">
          <div className="flex items-center gap-2">
            {/* A real form, so the phone keyboard's search key does something.
                There was none: the only way to run a search was to type and
                wait out a 400ms debounce with nothing on screen acknowledging
                the keystroke, which is most of what "the search does not work"
                described. */}
            <form
              className="relative min-w-0 flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                commitSearch(searchDraft);
                // Dismiss the keyboard: on a phone it covers the map the
                // search was run to look at.
                const box = event.currentTarget.querySelector('input');
                if (box instanceof HTMLInputElement) box.blur();
              }}
            >
              <TextInput
                type="search"
                enterKeyHint="search"
                icon={<Search className="h-5 w-5" aria-hidden="true" />}
                value={searchDraft}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t('map.search.placeholder')}
                aria-label={t('common.action.search')}
                // The server rejects a longer query outright, and a 422 here
                // empties the map for a card that says nothing about why.
                maxLength={MAX_SEARCH_LENGTH}
                // Both class names written out in full: Tailwind v4 scans this
                // file as text and would emit nothing for an assembled string.
                className={`h-11 rounded-2xl border-transparent pl-11 ${
                  searchDraft ? 'pr-11' : 'pr-3'
                }`}
              />
              {searchDraft && (
                <button
                  type="button"
                  // Clears immediately rather than through the debounce. The
                  // cross used to go through the same 400ms timer, so the pins
                  // stayed filtered for most of a second after the box was
                  // visibly empty.
                  onClick={() => commitSearch('')}
                  aria-label={t('common.action.clear')}
                  className="press absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-subtle transition-colors hover:bg-surface-3 hover:text-content"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </form>

            {/* The sheet, and the count of what it is currently doing.

                This replaces two dropdowns that used to sit inside the pill
                rail — and could not work there. `overflow-x: auto` forces the
                computed `overflow-y` to `auto` as well, so the rail was a
                44px-tall scroll container and the 320px list opened into it and
                was clipped to nothing: tapping "Tuman" scrolled the rail
                sideways and showed no list at all. */}
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              aria-label={t('listings.filters.openAria')}
              className={`press relative flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-colors sm:w-auto sm:px-4 ${
                filterCount > 0
                  ? 'bg-brand text-on-brand shadow-brand'
                  : 'bg-surface-2 text-muted hover:text-content'
              }`}
            >
              <SlidersHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t('map.page.filtersCta')}</span>
              {filterCount > 0 && (
                // The number, not a dot. It is how a visitor staring at an
                // unexpectedly empty map works out how much is filtered away.
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
              onClick={() => setCurrentView('LISTINGS')}
              aria-label={t('map.page.listCta')}
              className="press flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-surface-2 text-sm font-bold text-muted transition-colors hover:text-content lg:w-auto lg:px-4"
            >
              <List className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">{t('map.page.listCta')}</span>
            </button>
          </div>

          {/* Three segments, not two, and "Barchasi" is where the map starts.

              The old pair had no neutral member: one of Ijara/Sotuv was always
              pressed, so the map arrived having already hidden everything on
              the other side of that cut, with nothing saying so. Two pills also
              made it a one-way door — once you tapped Ijara, no control
              anywhere took you back to seeing everything.

              This is the one screen where "both" is coherent. A pin is a
              location, not a row in a price-sorted list, so the three orders of
              magnitude between a monthly rent and a purchase price — the whole
              reason the catalogue refuses to mix them — has nothing here to
              break. */}
          <Segmented
            label={t('listings.filters.dealType')}
            value={filters.dealType}
            size="sm"
            className="w-full p-0.5 sm:w-auto sm:self-start"
            // The same companion reset the catalogue does. A price ceiling set
            // against rents matches no sale, so carrying it across would empty
            // the map on the first tap; the rental-only questions cannot be
            // asked of a sale at all.
            onChange={(dealType) =>
              setFilters({
                dealType,
                rentalType: 'ALL',
                roommateGender: 'ALL',
                audience: 'ALL',
                minPrice: null,
                maxPrice: null,
              })
            }
            options={[
              { value: 'ALL', label: t('common.filters.all') },
              { value: 'RENT', label: t('common.dealType.rent') },
              { value: 'SALE', label: t('common.dealType.sale') },
            ]}
          />

          {/* What is currently narrowing the map, and one tap to undo any of
              it. Drawn only while something is on, because otherwise it is a
              row of a phone's screen spent saying nothing. */}
          {applied.length > 0 && (
            <ChipRow label={t('common.filters.applied', { count: applied.length })}>
              {applied.map((entry) => (
                <Chip
                  key={entry.id}
                  size="sm"
                  tone="neutral"
                  selected
                  label={entry.label}
                  onClick={entry.clear}
                  onRemove={entry.clear}
                  removeLabel={`${t('common.action.clear')}: ${entry.label}`}
                />
              ))}
              <Chip
                size="sm"
                label={t('map.page.resetAll')}
                icon={RefreshCw}
                onClick={clearEverything}
              />
            </ChipRow>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Filter sheet                                                        */}
      {/* ------------------------------------------------------------------ */}
      {/* Everything the bar has no room for, in the same component and with the
          same vocabulary the catalogue's sheet uses — one filter language
          across the two screens rather than a second, smaller one here. */}
      <Sheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title={t('listings.filters.title')}
        size="lg"
        footer={
          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={clearEverything}
              // The currency counts here even though it is not a filter and
              // not in the badge: this button now resets it, so gating on the
              // filter count alone left it greyed out for a viewer whose only
              // change was pressing So'm — the one thing they might want undone.
              disabled={filterCount === 0 && currency === null}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t('listings.filters.clearAll')}
            </Button>
            <Button className="flex-1" onClick={() => setShowFilters(false)}>
              {listingsLoading
                ? t('common.sheet.loading')
                : totalCount > 0
                  ? t('listings.filters.showResults', { count: formatNumber(totalCount) })
                  : t('listings.filters.showResultsNone')}
            </Button>
          </div>
        }
      >
        <div className="space-y-6 pb-2">
          {/* The rail, first, because one tap here answers most of the sheet.

              It lives inside the sheet rather than in the bar above the map.
              The catalogue can afford a chip row on screen — it is a scrolling
              list either way — but every row this screen spends is a row of
              map, and the bar already holds the search box, the sheet trigger,
              the list link and the deal type. */}
          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.filters.quickLabel')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {railFor(filters.dealType).map((id) => {
                const meta = QUICK_META[id];
                return (
                  <Chip
                    key={id}
                    label={t(meta.labelKey as never)}
                    icon={meta.icon}
                    selected={activeQuick === id}
                    onClick={() => selectQuick(id)}
                  />
                );
              })}
            </div>
          </fieldset>

          {/* Then currency — set apart from everything below it, because it is
              the one control here that changes what every pin SAYS rather than
              which pins are drawn. */}
          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('map.filters.currency')}
            </legend>
            <Segmented
              label={t('map.filters.currency')}
              value={currency ?? 'AUTO'}
              size="sm"
              onChange={(next) => setCurrency(next === 'AUTO' ? null : next)}
              options={[
                { value: 'AUTO', label: t('map.filters.currencyAuto') },
                { value: 'UZS', label: t('map.filters.currencyUzs') },
                { value: 'USD', label: t('map.filters.currencyUsd') },
              ]}
            />
            <p className="mt-1.5 text-[11px] text-subtle">{t('map.filters.currencyHint')}</p>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.filters.locationTitle')}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput
                aria-label={t('home.search.regionLabel')}
                value={filters.region}
                // The district goes with the region. They are not independent:
                // a Tashkent district under a Samarqand region is a query that
                // matches nothing, and neither control would say why.
                onChange={(event) =>
                  setFilters({ region: event.target.value, district: 'ALL' })
                }
                className="w-full"
              >
                <option value="ALL">{t('common.filters.all')}</option>
                {UZBEKISTAN_REGIONS.map((region) => (
                  <option key={region.id} value={region.name}>
                    {region.name}
                  </option>
                ))}
              </SelectInput>

              <SelectInput
                aria-label={t('common.filters.district')}
                value={filters.district}
                onChange={(event) => setFilters({ district: event.target.value })}
                className="w-full"
              >
                <option value="ALL">{t('common.filters.all')}</option>
                {districtsFor(filters.region).map((district) => (
                  <option key={district} value={district}>
                    {districtLabel(district)}
                  </option>
                ))}
              </SelectInput>
            </div>

            {/* Grouped by line, as the create form does: "Buyuk Ipak Yo'li"
                means nothing to somebody who is thinking in colours. */}
            <SelectInput
              aria-label={t('common.filters.metro')}
              value={filters.metroStation}
              onChange={(event) => setFilters({ metroStation: event.target.value })}
              className="mt-3 w-full"
            >
              <option value="ALL">{t('home.search.metroAll')}</option>
              {TASHKENT_METRO_LINES.map((line) => (
                <optgroup key={line.id} label={line.name}>
                  {line.stations.map((station) => (
                    <option key={station} value={station}>
                      {station}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectInput>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('common.filters.propertyType')}
            </legend>
            <SelectInput
              aria-label={t('common.filters.propertyType')}
              value={filters.propertyType}
              onChange={(event) => setFilters({ propertyType: event.target.value })}
              className="w-full"
            >
              <option value="ALL">{t('common.filters.all')}</option>
              {PROPERTY_TYPES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {t(entry.labelKey as never)}
                </option>
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
              {/* Exact counts only — the server filters on equality, so a "4+"
                  option would promise something the query cannot deliver. */}
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

          {/* A tenancy question, so it is asked only while tenancies are in the
              results. Nobody sells a room to share. */}
          {filters.dealType !== 'SALE' && (
            <fieldset>
              <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
                {t('home.search.rentalTypeLabel')}
              </legend>
              <Segmented
                label={t('home.search.rentalTypeLabel')}
                value={filters.rentalType}
                size="sm"
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
            </fieldset>
          )}

          {/* Who a shared room is shared with.

              Drawn while the search is about shared rooms, and drawn anyway
              whenever it is set: `activeFilterCount` counts it, so a badge
              reading 2 with only one control behind it is a filter the visitor
              can see the effect of and not the cause. The "Qizlarga" chip in
              the rail above can set this on its own. */}
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

          {/* Who the place is for.

              A tenancy question — a sale has no audience in this sense — so it
              goes with the rental type rather than standing on its own. The
              server reads STUDENT as "near a university, or a shared room, or
              in a student district" and FAMILY as "two rooms or more, not
              shared", which is why it is a filter of its own and not a
              shorthand for the room count. */}
          {filters.dealType !== 'SALE' && (
            <fieldset>
              <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
                {t('home.search.audienceLabel')}
              </legend>
              <Segmented
                label={t('home.search.audienceLabel')}
                value={filters.audience}
                size="sm"
                onChange={(audience) => setFilters({ audience })}
                options={[
                  { value: 'ALL', label: t('common.audience.all') },
                  { value: 'STUDENT', label: t('common.audience.student') },
                  { value: 'FAMILY', label: t('common.audience.family') },
                ]}
              />
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.filters.priceTitle')}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* The catalogue's labels, which carry "(so'm)". The map used
                  `common.filters.priceFrom`/`priceTo` — "Narx (dan)" — which
                  says no unit at all, in a sheet whose control directly above
                  offers to switch the whole map into dollars. The range is
                  always in so'm: the server normalises every price into so'm
                  before comparing it against these bounds. */}
              <NumberFilter
                label={t('listings.filters.minPrice')}
                placeholder={t(
                  filters.dealType === 'SALE'
                    ? 'listings.filters.minPricePlaceholderSale'
                    : 'listings.filters.minPricePlaceholder',
                )}
                value={filters.minPrice}
                max={MAX_PRICE}
                step={filters.dealType === 'SALE' ? 10_000_000 : 500_000}
                onCommit={(minPrice) => setFilters({ minPrice })}
              />
              <NumberFilter
                label={t('listings.filters.maxPrice')}
                placeholder={t(
                  filters.dealType === 'SALE'
                    ? 'listings.filters.maxPricePlaceholderSale'
                    : 'listings.filters.maxPricePlaceholder',
                )}
                value={filters.maxPrice}
                max={MAX_PRICE}
                step={filters.dealType === 'SALE' ? 10_000_000 : 500_000}
                onCommit={(maxPrice) => setFilters({ maxPrice })}
              />
            </div>
            {/* The range is in so'm whatever the pins are showing: the server
                compares against a so'm-normalised price, so a dollar figure
                typed here would filter out almost everything. */}
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

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.seller.filterLabel')}
            </legend>
            <ChipRow label={t('listings.seller.filterLabel')}>
              {(
                [
                  ['ALL', 'listings.seller.filterAll'],
                  ['OWNER', 'listings.seller.filterOwner'],
                  ['AGENT', 'listings.seller.filterAgent'],
                ] as const
              ).map(([value, labelKey]) => (
                <Chip
                  key={value}
                  label={t(labelKey)}
                  selected={filters.sellerType === value}
                  onClick={() => setFilters({ sellerType: value })}
                />
              ))}
            </ChipRow>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.filters.amenitiesTitle')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((amenity) => (
                <Chip
                  key={amenity.key}
                  label={t(amenity.labelKey as never)}
                  icon={amenity.Icon}
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
            {/* Sorting is not cosmetic on a map: it decides which listings
                survive the page cut, so once there are more than a hundred it
                decides which pins exist at all. */}
            <SelectInput
              aria-label={t('listings.filters.sortBy')}
              value={filters.sortBy ?? 'RECOMMENDED'}
              onChange={(event) =>
                setFilters({ sortBy: event.target.value as Filters['sortBy'] })
              }
              className="w-full"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey as never)}
                </option>
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
              // Ticking narrows, so it must not widen: it leaves any trust
              // floor alone. Unticking clears it, because a threshold with
              // nothing on screen to show it cannot be undone.
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

          {/* The trust floor, with a control of its own.

              `minTrustScore` was reachable on this screen only as a side
              effect of the "Yuqori ishonchli" chip, and only clearable by
              unticking the verified box beside it — two settings behind one
              switch. Three named steps rather than a slider: 0–100 is the
              server's scale, not a thing a searcher has an opinion about. */}
          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-wide text-subtle">
              {t('listings.filters.trustTitle')}
            </legend>
            <ChipRow label={t('listings.filters.trustTitle')}>
              {(
                [
                  [0, 'listings.filters.trustAny'],
                  [60, 'listings.filters.trustMid'],
                  [80, 'listings.filters.trustHigh'],
                ] as const
              ).map(([score, labelKey]) => (
                <Chip
                  key={score}
                  label={t(labelKey)}
                  selected={filters.minTrustScore === score}
                  onClick={() => setFilters({ minTrustScore: score })}
                />
              ))}
            </ChipRow>
          </fieldset>
        </div>
      </Sheet>

      {/* ------------------------------------------------------------------ */}
      {/* One address, several listings                                       */}
      {/* ------------------------------------------------------------------ */}
      {/* Opened by a pin carrying a "+N" badge. A single-listing pin still goes
          straight to its page — this exists only for the case where going
          straight somewhere would mean picking for the visitor. */}
      <Sheet
        open={openGroup !== null && groupListings.length > 1}
        onClose={() => setOpenGroup(null)}
        title={t('map.group.title')}
        description={t('map.group.subtitle', { count: formatNumber(groupListings.length) })}
        size="sm"
      >
        <ul className="space-y-2">
          {groupListings.map((listing) => (
            <li key={listing.id}>
              <button
                type="button"
                onClick={() => {
                  setOpenGroup(null);
                  // Same round trip as a single pin: Back must come home to
                  // the map the visitor left, not a freshly reset one.
                  setMapCarryFilters(true);
                  setCurrentView('LISTING_DETAIL', listing.id);
                }}
                className="press flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left transition-colors hover:bg-surface-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-content">
                    {listing.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-subtle">
                    {[listing.district, listing.address].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-black text-brand-text">
                  {fullPrice(listing)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {/* ------------------------------------------------------------------ */}
      {/* Map                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative flex flex-1 items-stretch">
        {mapStatus === 'error' ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-sm rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
              <span
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-warning"
                aria-hidden="true"
              >
                <MapPin className="h-7 w-7" />
              </span>
              <h2 className="text-base font-black text-content">
                {t('map.state.scriptError.title')}
              </h2>
              <p className="mt-1.5 text-sm text-muted">{t('map.state.scriptError.body')}</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  variant="secondary"
                  // Both, and in this order. The container div lives only in
                  // the non-error branch of this ternary, so while the status
                  // is 'error' `containerRef.current` is null — and the map
                  // effect's first line is `if (!element) return`. Bumping the
                  // token alone therefore re-ran an effect that bailed out
                  // immediately, left the status on 'error', and never
                  // rendered the container again: the button could be pressed
                  // for ever and only a page reload recovered. Clearing the
                  // status first is what puts the container back, in the same
                  // batched render, so the effect finds a live ref.
                  onClick={() => {
                    setMapStatus('loading');
                    setRetryToken((token) => token + 1);
                  }}
                >
                  {t('common.error.tryAgain')}
                </Button>
                <Button onClick={() => setCurrentView('LISTINGS')}>
                  <List className="h-4 w-4" aria-hidden="true" />
                  {t('map.page.listCta')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              role="application"
              aria-label={t('map.a11y.map')}
              className="z-10 h-full w-full bg-surface-2"
            />

            {/* How many pins are drawn, and how many there are.

                It used to be a line in the control bar, which cost a whole row
                of a phone's screen for one short sentence. Floated over the map
                it costs nothing: the top-left corner of a city map is water,
                parkland or the edge of the frame, never the thing being read.

                The denominator is the half that matters. "24 listings on the
                map" over a filter matching 213 of them let a visitor who panned
                the district conclude those were all of them. */}
            <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2 sm:left-4 sm:top-4">
              <p
                className="pointer-events-auto rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[11px] font-bold text-muted shadow-card backdrop-blur"
                aria-live="polite"
              >
                {t('map.page.counter', { count: formatNumber(mapped.length) })}
                {totalCount > listings.length && (
                  <span className="ml-1.5 font-medium text-subtle">
                    {t('common.pagination.showing', {
                      from: 1,
                      to: listings.length,
                      total: formatNumber(totalCount),
                    })}
                  </span>
                )}
              </p>

              {/* Only ever drawn once there are more than a hundred matches,
                  because the map now asks for a hundred at a time. */}
              {hasMoreListings && (
                <Button
                  variant="secondary"
                  className="pointer-events-auto px-3 py-2 text-xs shadow-card"
                  loading={listingsAppending}
                  disabled={listingsLoading}
                  onClick={() => void fetchListings({ append: true })}
                >
                  {t('common.action.loadMore')}
                </Button>
              )}

              {/* Listings the owner never placed on the map. Said here rather
                  than in the control bar, for the same reason as the counter. */}
              {missingCoordinates > 0 && mapped.length > 0 && (
                <p className="pointer-events-auto rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[11px] text-subtle shadow-card backdrop-blur">
                  {t('map.state.noCoordinates', { count: formatNumber(missingCoordinates) })}
                </p>
              )}
            </div>

            {/* Bottom-left, clear of Yandex's zoom controls on the right and
                of the filter bar above. The root's own bottom padding is what
                keeps it clear of the BottomNav below `lg`.

                `bottom-4`, not `bottom-6`: this is measured from the map's own
                content box, which the root already lifts 64px plus the home
                indicator off the bottom of the screen, so six more units left
                the button floating in a band of map nobody was going to
                press. */}
            {'geolocation' in navigator && mapStatus === 'ready' && (
              <button
                type="button"
                onClick={locateMe}
                disabled={meBusy}
                aria-label={t('map.me.cta')}
                title={t('map.me.cta')}
                className="press absolute bottom-4 left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-brand shadow-raised transition-colors hover:bg-surface-2 disabled:opacity-60 sm:left-6"
              >
                {meBusy ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden="true"
                  />
                ) : (
                  <LocateFixed className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            )}

            {/* Keyboard and screen-reader equivalent of clicking a pin. */}
            <h2 className="sr-only">{t('map.a11y.resultList')}</h2>
            <ul className="sr-only">
              {mapped.map(({ listing, position }) => (
                <li key={listing.id}>
                  <button
                    type="button"
                    // The same thing the pin does, for a keyboard or a screen
                    // reader. It has to stay in step: this list exists to be
                    // the equivalent of clicking a pin, not a second behaviour.
                    onClick={() => setCurrentView('LISTING_DETAIL', listing.id)}
                  >
                    {t('map.marker.label', {
                      title: listing.title,
                      price: fullPrice(listing),
                    })}
                  </button>
                </li>
              ))}
            </ul>

            {mapStatus === 'loading' && (
              <div
                className="absolute inset-0 z-20 flex items-center justify-center bg-canvas/80"
                role="status"
              >
                <div className="flex flex-col items-center gap-3">
                  <span
                    className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-bold text-muted">{t('map.state.loadingMap')}</p>
                </div>
              </div>
            )}

            {/* `listings.length === 0` used to be part of this test, which
                meant the pill appeared on the very first load and never again.
                Every filter change after that showed the previous, now-wrong
                pins for the whole round trip with nothing saying anything was
                happening — the control highlighted instantly, the map
                disagreed with it for a couple of seconds, and then everything
                jumped. `!listingsAppending` keeps it off during "load more",
                which has its own spinner on its own button. */}
            {mapStatus === 'ready' && listingsLoading && !listingsAppending && (
              <div
                className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-line bg-surface px-4 py-2 shadow-card"
                role="status"
              >
                <span className="flex items-center gap-2 text-xs font-bold text-muted">
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent"
                    aria-hidden="true"
                  />
                  {t('map.state.loadingListings')}
                </span>
              </div>
            )}

            {mapStatus === 'ready' && listingsError && listings.length === 0 && (
              <div className="absolute left-1/2 top-4 z-20 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-danger/30 bg-surface p-4 text-center shadow-raised">
                <p className="text-sm font-bold text-danger">
                  {t('map.state.listingsError.title')}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {listingsError === 'network'
                    ? t('common.error.network')
                    : t('common.error.generic')}
                </p>
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => void fetchListings({ page: 1 })}
                >
                  {t('common.error.tryAgain')}
                </Button>
              </div>
            )}

            {mapStatus === 'ready' && (showEmpty || showNoMapped) && (
              <div className="absolute left-1/2 top-4 z-20 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-line bg-surface p-4 text-center shadow-raised">
                <p className="text-sm font-black text-content">
                  {showEmpty ? t('map.state.empty.title') : t('map.state.noMapped.title')}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {showEmpty ? t('map.state.empty.body') : t('map.state.noMapped.body')}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {/* `filterCount` counts the deal type here, and
                      `clearEverything` clears it — which is the whole fix.
                      Tapping "Sotuv" on a catalogue with no properties for
                      sale emptied the map and drew this card telling the
                      visitor to clear their filters; the store's count said
                      nothing was on, so no button was drawn, and `resetFilters`
                      would have preserved the deal type anyway. The card gave
                      an instruction and withheld the only control that could
                      follow it. */}
                  {showEmpty && filterCount > 0 && (
                    <Button variant="secondary" onClick={clearEverything}>
                      {t('map.page.resetAll')}
                    </Button>
                  )}
                  {/* Always a way onwards.

                      The list link used to be drawn only for `showNoMapped`,
                      so an empty map with no filter on — the state a visitor
                      reaches when the catalogue genuinely has nothing, or when
                      the request failed and left nothing behind — showed two
                      lines of text and not one control. A card that says "there
                      is nothing here" and offers no next step is a dead end. */}
                  {(showNoMapped || filterCount === 0) && (
                    <Button onClick={() => setCurrentView('LISTINGS')}>
                      <List className="h-4 w-4" aria-hidden="true" />
                      {t('map.page.listCta')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* The tapped pin, before you commit to its page                 */}
            {/* ------------------------------------------------------------ */}
            {selected && (
              <div
                role="dialog"
                aria-label={selected.title}
                onClick={(event) => event.stopPropagation()}
                className="rise-in absolute bottom-20 left-3 right-3 z-40 rounded-2xl border border-line bg-surface p-4 shadow-raised sm:bottom-6 sm:left-20 sm:right-auto sm:w-[390px] sm:max-w-md"
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label={t('map.panel.close')}
                  className="absolute right-2.5 top-2.5 z-10 rounded-full p-1.5 text-subtle transition-colors hover:bg-surface-3 hover:text-content"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMapCarryFilters(true);
                    setCurrentView('LISTING_DETAIL', selected.id);
                  }}
                  className="press w-full text-left"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2">
                      {selected.images?.[0] ? (
                        <img
                          src={selected.images[0]}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-subtle">
                          <ImageIcon className="h-6 w-6" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex items-center gap-1 text-xs font-bold text-brand-text">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {selected.address ||
                            [districtLabel(selected.district), selected.region]
                              .filter(Boolean)
                              .join(', ')}
                        </span>
                      </p>

                      <h3 className="line-clamp-1 text-sm font-black text-content">
                        {selected.title}
                      </h3>

                      <p className="text-xs text-muted">
                        {t('listings.card.roomsAndArea', {
                          rooms: selected.rooms,
                          area: selected.area,
                        })}
                      </p>

                      {selected.metroStation && (
                        <p className="flex items-center gap-1 truncate text-xs font-semibold text-muted">
                          <Train className="h-3 w-3 shrink-0 text-brand" aria-hidden="true" />
                          <span className="truncate">
                            {t('map.panel.metro', { station: selected.metroStation })}
                          </span>
                        </p>
                      )}

                      {/* The same price the pin is showing, in the same
                          currency: the card must not be the one place that
                          quietly converts. `fullPrice` carries the "≈" when
                          the viewer has asked for a currency of their own. */}
                      <p className="pt-1 text-base font-black text-content">
                        {fullPrice(selected)}
                        {!isForSale(selected) && (
                          <span className="ml-1 text-xs font-semibold text-subtle">
                            {t('listings.card.perMonth')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </button>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                    <span className="truncate">
                      {selected.owner?.name || t('common.role.owner')}
                    </span>
                  </span>

                  <Button
                    className="shrink-0 px-3.5 py-1.5 text-xs font-bold"
                    onClick={() => {
                      setMapCarryFilters(true);
                      setCurrentView('LISTING_DETAIL', selected.id);
                    }}
                  >
                    {t('common.action.details')}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MapView;