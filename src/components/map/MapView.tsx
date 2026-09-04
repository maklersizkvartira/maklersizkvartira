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
import { List, LocateFixed, MapPin, Search, X } from 'lucide-react';

import { UZBEKISTAN_REGIONS } from '../../data/mockLocations';
import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { Listing } from '../../types';
import { Button, SelectInput } from '../ui/Field';

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

function markerHtml(priceText: string): string {
  // No selected state any more: a pin is tapped and the page changes, so
  // there is never a moment where one pin is "the open one".
  const selected = false;
  const bubble = selected
    ? 'background: var(--color-brand); color: var(--color-on-brand); border-color: var(--color-brand);'
    : 'background: var(--color-surface); color: var(--color-brand-text); border-color: var(--color-brand);';
  const tip = selected ? 'var(--color-brand)' : 'var(--color-surface)';

  return `
    <div class="flex flex-col items-center" style="filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.25));">
      <div class="whitespace-nowrap rounded-2xl border px-2.5 py-1 text-[11px] font-black" style="${bubble}">
        ${escapeHtml(priceText)}
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
  const resetFilters = useAppStore((state) => state.resetFilters);
  const activeFilterCount = useAppStore((state) => state.activeFilterCount);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const currency = useAppStore((state) => state.currency);
  const setCurrency = useAppStore((state) => state.setCurrency);
  const fxRate = useAppStore((state) => state.fxRate);

  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Bumped by the retry button. The map effect keys off it, so retrying tears
  // the old attempt down and builds a fresh one rather than layering a second
  // map onto the same element.
  const [retryToken, setRetryToken] = useState(0);
  const [searchDraft, setSearchDraft] = useState(filters.search);

  const containerRef = useRef<HTMLDivElement>(null);
  /** Where the visitor is, once they ask. Never requested on load. */
  const [me, setMe] = useState<[number, number] | null>(null);
  const [meBusy, setMeBusy] = useState(false);
  const engineRef = useRef<MapEngine | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requested = useRef(false);

  // -- Data ----------------------------------------------------------------
  // Mount only; filter changes refetch through setFilters. The ref is what
  // makes that true under StrictMode, which mounts every effect twice — two
  // page-1 requests where one was wanted, the second cancelling the first.
  //
  // "See on map" arrives here straight from the catalogue, which has just
  // fetched these exact filters and may have paged well past the first
  // twenty-four. Refetching page 1 threw those extra pages away for a request
  // whose answer the store already held.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    if (!listingsAreCurrent()) void fetchListings({ page: 1 });
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

  // Listing prices are stored in so'm; the USD view is a presentation choice.
  /**
   * A listing's price in whichever currency the viewer picked.
   *
   * Takes the listing, not a number, and that is the fix: `listings.price` is
   * stored in the currency the owner quoted, so a bare number cannot be
   * converted without knowing which. Treating every price as so'm — which is
   * what this did — printed a $500 flat as "0.0 mln" on its marker, or as
   * "$0.04" for a viewer reading in dollars. Both from the same missing
   * question.
   *
   * Normalised to so'm first, then out to the display currency, so the two
   * kinds of listing rank and read alike on one map.
   */
  const inSelectedCurrency = useCallback(
    (listing: Listing) => {
      const uzs = listing.currency === 'USD' ? listing.price * fxRate : listing.price;
      return currency === 'USD' ? uzs / fxRate : uzs;
    },
    [currency, fxRate],
  );

  const fullPrice = useCallback(
    (listing: Listing) => formatPrice(inSelectedCurrency(listing), currency),
    [currency, formatPrice, inSelectedCurrency],
  );

  /** Markers only have room for a short price, so so'm is shown in millions. */
  const badgePrice = useCallback(
    (listing: Listing) =>
      currency === 'USD'
        ? formatPrice(inSelectedCurrency(listing), 'USD')
        : t('map.marker.priceMillion', {
            value: formatNumber(inSelectedCurrency(listing) / 1_000_000, {
              maximumFractionDigits: 1,
            }),
          }),
    [currency, formatNumber, formatPrice, inSelectedCurrency, t],
  );

  // -- Map -----------------------------------------------------------------
  // Created once and kept. Re-running this would drop every marker and throw
  // the viewport back to the city centre while someone is reading a pin.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let cancelled = false;
    setMapStatus('loading');

    void createMapEngine(element, {
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
    );

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // Rebuilding the map for a theme or language change would be far more
    // disruptive than the small mismatch it fixes; both are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  useEffect(() => {
    if (mapStatus === 'ready') engineRef.current?.setTheme(isDark);
  }, [mapStatus, isDark]);

  // Markers.
  useEffect(() => {
    if (mapStatus !== 'ready') return;
    const engine = engineRef.current;
    if (!engine) return;

    // The visitor's own pin goes in the same call as the listings. `setMarkers`
    // replaces everything it is given, so a separate call for one of them
    // would simply erase the other.
    const pins = mapped.map(({ listing, position }) => {
      const price = badgePrice(listing);
      return {
        id: listing.id,
        position,
        html: markerHtml(price),
        label: t('map.marker.label', { title: listing.title, price }),
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
      // A pin is a link. Tapping the price opens that listing, with nothing
      // in between — which is the whole job of a price on a map.
      //
      // There used to be a preview card here first: tap a pin, read a summary,
      // then press a button to actually go. Two taps and a small target for
      // something a visitor had already decided on by the time they aimed at
      // the pin. The summary is the listing page, one tap earlier.
      (id) => {
        // The visitor's own pin is not a listing and opens nothing.
        if (id === ME_MARKER_ID) return;
        setCurrentView('LISTING_DETAIL', id);
      },
    );
  }, [mapStatus, mapped, badgePrice, me, t]);

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

  const filterCount = activeFilterCount();
  const showEmpty = !listingsLoading && !listingsError && listings.length === 0;
  const showNoMapped = !listingsLoading && listings.length > 0 && mapped.length === 0;

  // -- Render --------------------------------------------------------------
  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col overflow-hidden bg-canvas sm:h-[calc(100vh-5.5rem)]">
      {/* ------------------------------------------------------------------ */}
      {/* Controls                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="z-20 border-b border-line bg-surface p-3 shadow-card sm:p-4">
        <div className="mx-auto flex max-w-7xl flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text"
              aria-hidden="true"
            >
              <MapPin className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-black text-content">{t('map.page.title')}</h1>
              {/* The counter says how many pins are drawn, and that used to be
                  the whole sentence: a filter matching 213 flats produced 24
                  markers and a line reading "24 listings on the map", so a
                  visitor who panned the district concluded those were all of
                  them. The denominator is the missing half — the store has had
                  the real total all along — and the button below is how the
                  rest of them get onto the map. */}
              <p className="text-[11px] text-muted" aria-live="polite">
                {t('map.page.counter', { count: formatNumber(mapped.length) })}
                {totalCount > listings.length && (
                  <span className="ml-1.5 text-subtle">
                    {t('common.pagination.showing', {
                      from: 1,
                      to: listings.length,
                      total: formatNumber(totalCount),
                    })}
                  </span>
                )}
              </p>
            </div>

            {hasMoreListings && (
              <Button
                variant="secondary"
                className="shrink-0 px-3 py-2 text-xs"
                loading={listingsAppending}
                disabled={listingsLoading}
                onClick={() => void fetchListings({ append: true })}
              >
                {t('common.action.loadMore')}
              </Button>
            )}
          </div>

          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('map.search.placeholder')}
              aria-label={t('common.action.search')}
              // 16px, not 14: iOS Safari zooms the page whenever a field
              // smaller than that takes focus and never zooms back out, which
              // on the map means every search leaves the visitor pinching the
              // controls back into view. Field.tsx makes the same point about
              // the shared control this box predates.
              className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-10 pr-10 text-base font-medium text-content transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none"
            />
            {searchDraft && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label={t('common.action.clear')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-subtle transition-colors hover:bg-surface-3 hover:text-content"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <div
              className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-surface-2 p-1"
              role="group"
              aria-label={t('map.filters.currency')}
            >
              {(
                [
                  ['UZS', 'map.filters.currencyUzs'],
                  ['USD', 'map.filters.currencyUsd'],
                ] as const
              ).map(([code, labelKey]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  aria-pressed={currency === code}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    currency === code
                      ? 'bg-brand text-on-brand shadow-brand'
                      : 'text-muted hover:bg-surface-3 hover:text-content'
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>

            <label className="sr-only" htmlFor="map-district">
              {t('map.filters.district')}
            </label>
            <SelectInput
              id="map-district"
              value={filters.district}
              onChange={(event) => setFilters({ district: event.target.value })} compact className="shrink-0"
              >
              <option value="ALL">{t('common.filters.all')}</option>
              {TASHKENT_DISTRICTS.map((district) => (
                <option key={district} value={district}>
                  {districtLabel(district)}
                </option>
              ))}
            </SelectInput>

            <label className="sr-only" htmlFor="map-rooms">
              {t('map.filters.rooms')}
            </label>
            <SelectInput
              id="map-rooms"
              value={filters.rooms ?? ''}
              onChange={(event) =>
                setFilters({ rooms: event.target.value ? Number(event.target.value) : null })
              } compact className="shrink-0"
              >
              <option value="">{t('common.filters.all')}</option>
              {/* Exact counts only — the server filters on equality, so a "4+"
                  option would promise something the query cannot deliver. */}
              {[1, 2, 3, 4, 5].map((count) => (
                <option key={count} value={count}>
                  {t('common.filters.roomsValue', { count })}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        {missingCoordinates > 0 && mapped.length > 0 && (
          <p className="mx-auto mt-2 max-w-7xl text-[11px] text-subtle">
            {t('map.state.noCoordinates', { count: formatNumber(missingCoordinates) })}
          </p>
        )}
      </div>

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
                <Button variant="secondary" onClick={() => setRetryToken((token) => token + 1)}>
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

            {/* Bottom-left, clear of Yandex's zoom controls on the right and
                of the filter bar above. */}
            {'geolocation' in navigator && (
              <button
                type="button"
                onClick={locateMe}
                disabled={meBusy}
                aria-label={t('map.me.cta')}
                title={t('map.me.cta')}
                className="press absolute bottom-6 left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-brand shadow-raised transition-colors hover:bg-surface-2 disabled:opacity-60 sm:left-6"
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

            {mapStatus === 'ready' && listingsLoading && listings.length === 0 && (
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
                  {showEmpty && filterCount > 0 && (
                    <Button variant="secondary" onClick={() => resetFilters()}>
                      {t('common.filters.reset')}
                    </Button>
                  )}
                  {showNoMapped && (
                    <Button onClick={() => setCurrentView('LISTINGS')}>
                      <List className="h-4 w-4" aria-hidden="true" />
                      {t('map.page.listCta')}
                    </Button>
                  )}
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
