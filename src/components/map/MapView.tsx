/**
 * The map surface.
 *
 * Leaflet is still loaded from the CDN at runtime rather than bundled: it is
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
import { Image as ImageIcon, List, MapPin, Search, ShieldCheck, X } from 'lucide-react';

import { UZBEKISTAN_REGIONS } from '../../data/mockLocations';
import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { Listing } from '../../types';
import { Button, SelectInput } from '../ui/Field';

// ---------------------------------------------------------------------------
// Minimal Leaflet surface
// ---------------------------------------------------------------------------
// Only the handful of members this component touches are typed. Leaflet ships
// no types of its own and `@types/leaflet` would be a dependency added purely
// for a global that is loaded at runtime.
type LatLngTuple = [number, number];

interface LeafletDivIcon {
  readonly options: unknown;
}

interface LeafletControl {
  addTo(map: LeafletMap): LeafletControl;
  remove(): LeafletControl;
}

interface LeafletTileLayer {
  addTo(map: LeafletMap): LeafletTileLayer;
  remove(): LeafletTileLayer;
}

interface LeafletMarker {
  addTo(map: LeafletMap): LeafletMarker;
  remove(): LeafletMarker;
  on(type: string, handler: () => void): LeafletMarker;
}

interface LeafletMap {
  setView(center: LatLngTuple, zoom: number): LeafletMap;
  panTo(center: LatLngTuple, options?: { animate?: boolean }): LeafletMap;
  flyTo(center: LatLngTuple, zoom: number, options?: { animate?: boolean; duration?: number }): LeafletMap;
  fitBounds(bounds: LatLngTuple[], options?: { padding?: [number, number]; maxZoom?: number }): LeafletMap;
  invalidateSize(): LeafletMap;
  remove(): LeafletMap;
}

interface LeafletStatic {
  map(element: HTMLElement, options?: { zoomControl?: boolean }): LeafletMap;
  tileLayer(url: string, options?: { attribution?: string; maxZoom?: number }): LeafletTileLayer;
  marker(
    position: LatLngTuple,
    options?: { icon?: LeafletDivIcon; title?: string; alt?: string; riseOnHover?: boolean },
  ): LeafletMarker;
  divIcon(options: {
    className?: string;
    html?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
  }): LeafletDivIcon;
  control: {
    zoom(options?: {
      position?: string;
      zoomInTitle?: string;
      zoomOutTitle?: string;
    }): LeafletControl;
  };
}

declare global {
  interface Window {
    L?: LeafletStatic;
  }
}

// ---------------------------------------------------------------------------
// CDN assets
// ---------------------------------------------------------------------------
const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const LEAFLET_JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
const LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

/** Attribution is a legal requirement and consists of proper nouns only. */
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

const TILE_URL_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_URL_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const TASHKENT_CENTER: LatLngTuple = [41.311, 69.279];

/**
 * Leaflet's own stylesheet paints the controls, the attribution strip and the
 * div-icon shell in fixed light colours. Restating them against the theme
 * tokens here keeps the map chrome readable in dark mode without touching the
 * global stylesheet, which this component does not own.
 */
const LEAFLET_THEME_CSS = `
.leaflet-container { background: var(--color-surface-2); font: inherit; }
.leaflet-div-icon.listing-marker { background: transparent; border: 0; }
.leaflet-bar a,
.leaflet-bar a:hover {
  background: var(--color-surface);
  color: var(--color-content);
  border-bottom-color: var(--color-line);
}
.leaflet-bar a:hover { background: var(--color-surface-2); }
.leaflet-control-attribution {
  background: color-mix(in srgb, var(--color-surface) 85%, transparent);
  color: var(--color-muted);
}
.leaflet-control-attribution a { color: var(--color-brand-text); }
`;

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

const DISTRICT_META: { match: string; key: DistrictKey; center: LatLngTuple }[] = [
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
function markerHtml(priceText: string, selected: boolean): string {
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
let leafletPromise: Promise<LeafletStatic> | null = null;

function loadLeaflet(): Promise<LeafletStatic> {
  if (window.L) return Promise.resolve(window.L);

  if (!leafletPromise) {
    leafletPromise = new Promise<LeafletStatic>((resolve, reject) => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS_URL;
        link.integrity = LEAFLET_CSS_SRI;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }

      if (!document.getElementById('leaflet-theme-css')) {
        const style = document.createElement('style');
        style.id = 'leaflet-theme-css';
        style.textContent = LEAFLET_THEME_CSS;
        document.head.appendChild(style);
      }

      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = LEAFLET_JS_URL;
      script.integrity = LEAFLET_JS_SRI;
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => {
        if (window.L) resolve(window.L);
        else reject(new Error('leaflet-missing'));
      };
      script.onerror = () => reject(new Error('leaflet-unreachable'));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      // Drop the cached rejection so the retry button can genuinely retry.
      leafletPromise = null;
      document.getElementById('leaflet-js')?.remove();
      throw error;
    });
  }

  return leafletPromise;
}

// ---------------------------------------------------------------------------
export const MapView: React.FC = () => {
  const { t, formatPrice, formatNumber } = useTranslation();
  const { isDark } = useTheme();

  const listings = useAppStore((state) => state.listings);
  const listingsLoading = useAppStore((state) => state.listingsLoading);
  const listingsError = useAppStore((state) => state.listingsError);
  const fetchListings = useAppStore((state) => state.fetchListings);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const resetFilters = useAppStore((state) => state.resetFilters);
  const activeFilterCount = useAppStore((state) => state.activeFilterCount);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const currency = useAppStore((state) => state.currency);
  const setCurrency = useAppStore((state) => state.setCurrency);
  const fxRate = useAppStore((state) => state.fxRate);

  const [leafletStatus, setLeafletStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(filters.search);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileRef = useRef<LeafletTileLayer | null>(null);
  const zoomRef = useRef<LeafletControl | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Data ----------------------------------------------------------------
  useEffect(() => {
    void fetchListings({ page: 1 });
    // Mount only; filter changes refetch through setFilters.
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
          position: [listing.latitude, listing.longitude] as LatLngTuple,
        })),
    [listings],
  );

  const missingCoordinates = listings.length - mapped.length;
  const selected = useMemo(
    () => listings.find((listing) => listing.id === selectedId) ?? null,
    [listings, selectedId],
  );

  // Listing prices are stored in so'm; the USD view is a presentation choice.
  const inSelectedCurrency = useCallback(
    (price: number) => (currency === 'USD' ? price / fxRate : price),
    [currency, fxRate],
  );

  const fullPrice = useCallback(
    (price: number) => formatPrice(inSelectedCurrency(price), currency),
    [currency, formatPrice, inSelectedCurrency],
  );

  /** Markers only have room for a short price, so so'm is shown in millions. */
  const badgePrice = useCallback(
    (price: number) =>
      currency === 'USD'
        ? formatPrice(inSelectedCurrency(price), 'USD')
        : t('map.marker.priceMillion', {
            value: formatNumber(price / 1_000_000, { maximumFractionDigits: 1 }),
          }),
    [currency, formatNumber, formatPrice, inSelectedCurrency, t],
  );

  // -- Leaflet -------------------------------------------------------------
  const bootstrap = useCallback(() => {
    setLeafletStatus('loading');
    let cancelled = false;
    loadLeaflet().then(
      () => {
        if (!cancelled) setLeafletStatus('ready');
      },
      () => {
        if (!cancelled) setLeafletStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => bootstrap(), [bootstrap]);

  // Tear the map down only on unmount; re-running would drop every marker.
  useEffect(
    () => () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      tileRef.current = null;
      zoomRef.current = null;
    },
    [],
  );

  // Create the map, then keep the tiles and the zoom control in step with the
  // theme and the language.
  useEffect(() => {
    if (leafletStatus !== 'ready') return;
    const leaflet = window.L;
    const element = containerRef.current;
    if (!leaflet || !element) return;

    if (!mapRef.current) {
      mapRef.current = leaflet.map(element, { zoomControl: false }).setView(TASHKENT_CENTER, 12);
      mapRef.current.invalidateSize();
    }
    const instance = mapRef.current;

    tileRef.current?.remove();
    tileRef.current = leaflet
      .tileLayer(isDark ? TILE_URL_DARK : TILE_URL_LIGHT, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
      })
      .addTo(instance);

    zoomRef.current?.remove();
    zoomRef.current = leaflet.control
      .zoom({
        position: 'bottomright',
        zoomInTitle: t('map.a11y.zoomIn'),
        zoomOutTitle: t('map.a11y.zoomOut'),
      })
      .addTo(instance);
  }, [leafletStatus, isDark, t]);

  // Markers.
  useEffect(() => {
    if (leafletStatus !== 'ready') return;
    const leaflet = window.L;
    const instance = mapRef.current;
    if (!leaflet || !instance) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    mapped.forEach(({ listing, position }) => {
      const price = badgePrice(listing.price);
      const label = t('map.marker.label', { title: listing.title, price });

      const marker = leaflet
        .marker(position, {
          icon: leaflet.divIcon({
            className: 'listing-marker',
            html: markerHtml(price, listing.id === selectedId),
            iconSize: [72, 30],
            iconAnchor: [36, 30],
          }),
          title: label,
          alt: label,
          riseOnHover: true,
        })
        .addTo(instance);

      marker.on('click', () => {
        setSelectedId(listing.id);
        instance.panTo(position, { animate: true });
      });

      markersRef.current.push(marker);
    });
  }, [leafletStatus, mapped, badgePrice, selectedId, t]);

  // Frame the results when the result set itself changes — not when the user
  // merely selects a pin, which would yank the viewport away from them.
  const boundsKey = useMemo(() => mapped.map((entry) => entry.listing.id).join(','), [mapped]);

  useEffect(() => {
    if (leafletStatus !== 'ready') return;
    const instance = mapRef.current;
    if (!instance) return;

    if (mapped.length > 0) {
      instance.fitBounds(
        mapped.map((entry) => entry.position),
        { padding: [56, 56], maxZoom: 15 },
      );
      return;
    }

    const district = DISTRICT_BY_NAME.get(normalizeName(filters.district));
    if (district) instance.flyTo(district.center, 13, { animate: true, duration: 1.2 });
    // `mapped` is represented by boundsKey; depending on it would refit on every fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletStatus, boundsKey, filters.district]);

  // -- Filters -------------------------------------------------------------
  const onSearchChange = useCallback(
    (value: string) => {
      setSearchDraft(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => setFilters({ search: value }), 400);
    },
    [setFilters],
  );

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  // Escape closes the detail card, matching every other overlay in the app.
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

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
              <p className="truncate text-[11px] text-muted" aria-live="polite">
                {t('map.page.counter', { count: formatNumber(mapped.length) })}
              </p>
            </div>
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
              className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-10 pr-10 text-sm font-medium text-content transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none"
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
        {leafletStatus === 'error' ? (
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
                <Button variant="secondary" onClick={() => bootstrap()}>
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

            {/* Keyboard and screen-reader equivalent of clicking a pin. */}
            <h2 className="sr-only">{t('map.a11y.resultList')}</h2>
            <ul className="sr-only">
              {mapped.map(({ listing, position }) => (
                <li key={listing.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(listing.id);
                      mapRef.current?.panTo(position, { animate: true });
                    }}
                  >
                    {t('map.marker.label', {
                      title: listing.title,
                      price: fullPrice(listing.price),
                    })}
                  </button>
                </li>
              ))}
            </ul>

            {leafletStatus === 'loading' && (
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

            {leafletStatus === 'ready' && listingsLoading && listings.length === 0 && (
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

            {leafletStatus === 'ready' && listingsError && listings.length === 0 && (
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

            {leafletStatus === 'ready' && (showEmpty || showNoMapped) && (
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

            {/* ------------------------------------------------------------ */}
            {/* Selected listing                                              */}
            {/* ------------------------------------------------------------ */}
            {selected && (
              <div
                role="dialog"
                aria-label={selected.title}
                className="rise-in absolute bottom-6 left-4 right-4 z-30 rounded-2xl border border-line bg-surface p-4 shadow-raised sm:left-6 sm:right-auto sm:max-w-md"
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label={t('map.panel.close')}
                  className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-subtle transition-colors hover:bg-surface-3 hover:text-content"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>

                <div className="flex items-start gap-4">
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
                    <p className="flex items-center gap-1.5 text-xs font-bold text-brand-text">
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
                      <p className="truncate text-xs font-semibold text-muted">
                        {t('map.panel.metro', { station: selected.metroStation })}
                      </p>
                    )}

                    <p className="pt-1 text-base font-black text-content">
                      {fullPrice(selected.price)}
                      <span className="ml-1 text-xs font-semibold text-subtle">
                        {t('listings.card.perMonth')}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                    <span className="truncate">
                      {selected.owner?.name || t('common.role.owner')}
                    </span>
                  </span>

                  <Button
                    className="shrink-0 px-4 py-2 text-xs"
                    onClick={() => setCurrentView('LISTING_DETAIL', selected.id)}
                  >
                    {t('common.action.details')}
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
