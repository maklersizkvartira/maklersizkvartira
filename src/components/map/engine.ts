/**
 * The map surface, behind one interface.
 *
 * The page was wired directly to Leaflet — its script loader, its marker API,
 * its `fitBounds` — so the map provider was not a choice, it was the shape of
 * the component. This puts a small imperative handle in front of it so the
 * provider becomes a decision made in one place.
 *
 * Two implementations:
 *
 *  * **Yandex.** What people here actually use, and the only one whose Uzbek
 *    map has the mahalla-level detail a renter is looking for. Requires
 *    `VITE_YANDEX_MAPS_API_KEY`.
 *  * **Leaflet + Carto.** No key, so it always works. Used when the Yandex key
 *    is missing, which keeps the map on screen rather than showing an error
 *    to every visitor until someone remembers to set an environment variable.
 *
 * Coordinates are `[latitude, longitude]` throughout this module, because
 * that is what the rest of the app uses. Yandex wants them the other way
 * round; that flip happens once, at the boundary, and nowhere else — getting
 * it wrong puts every listing in the wrong hemisphere and the API reports no
 * error at all.
 */

export type LatLng = [number, number];

export interface EngineMarker {
  id: string;
  position: LatLng;
  /** Pre-rendered bubble markup. Both engines mount it as a DOM element. */
  html: string;
  /** Accessible name for the pin. */
  label: string;
}

export interface MapEngine {
  readonly provider: 'yandex' | 'leaflet';
  setTheme(dark: boolean): void;
  setMarkers(markers: EngineMarker[], onSelect: (id: string) => void): void;
  /** Frame a set of points. Does nothing when the set is empty. */
  fitTo(positions: LatLng[]): void;
  flyTo(position: LatLng, zoom: number): void;
  panTo(position: LatLng): void;
  destroy(): void;
}

export interface EngineOptions {
  center: LatLng;
  zoom: number;
  dark: boolean;
  language: string;
  zoomInTitle: string;
  zoomOutTitle: string;
}

const YANDEX_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY || '57fdc2ff-4eab-4070-bea6-771b83cf3433';

/** Which provider a fresh map will use. Exported so the UI can credit it. */
export const mapProvider: 'yandex' | 'leaflet' = YANDEX_KEY ? 'yandex' : 'leaflet';

// ---------------------------------------------------------------------------
// Script loading
// ---------------------------------------------------------------------------
function loadScript(id: string, src: string, integrity?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error(id)));
      }
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    if (integrity) {
      script.integrity = integrity;
      script.crossOrigin = 'anonymous';
    }
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(id));
    };
    document.head.appendChild(script);
  });
}

function loadStyle(id: string, href: string, integrity?: string): void {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  if (integrity) {
    link.integrity = integrity;
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

function bubble(html: string, label: string, onClick: () => void): HTMLElement {
  const element = document.createElement('div');
  element.className = 'listing-marker';
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', label);
  element.innerHTML = html;
  element.addEventListener('click', onClick);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  });
  return element;
}

// ---------------------------------------------------------------------------
// Yandex Maps JS API v3
// ---------------------------------------------------------------------------
interface YandexGlobal {
  ready: Promise<void>;
  YMap: new (element: HTMLElement, config: unknown) => YandexMapInstance;
  YMapDefaultSchemeLayer: new (config: unknown) => unknown;
  YMapDefaultFeaturesLayer: new (config: unknown) => unknown;
  YMapMarker: new (config: unknown, element: HTMLElement) => unknown;
  YMapControls: new (config: unknown) => { addChild(child: unknown): unknown };
  YMapZoomControl: new (config: unknown) => unknown;
}

interface YandexMapInstance {
  addChild(child: unknown): unknown;
  removeChild(child: unknown): unknown;
  update(config: unknown): void;
  setLocation(config: unknown): void;
  destroy(): void;
}

declare global {
  interface Window {
    ymaps3?: YandexGlobal;
  }
}

async function createYandex(
  element: HTMLElement,
  options: EngineOptions,
): Promise<MapEngine> {
  await loadScript(
    'yandex-maps-js',
    `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(YANDEX_KEY)}` +
      `&lang=${options.language === 'ru' ? 'ru_RU' : options.language === 'en' ? 'en_US' : 'uz_UZ'}`,
  );

  const ymaps = window.ymaps3;
  if (!ymaps) throw new Error('yandex-missing');
  await ymaps.ready;

  const {
    YMap,
    YMapDefaultSchemeLayer,
    YMapDefaultFeaturesLayer,
    YMapMarker,
    YMapControls,
    YMapZoomControl,
  } = ymaps;

  const map = new YMap(element, {
    location: { center: [options.center[1], options.center[0]], zoom: options.zoom },
    camera: { tilt: 45 * (Math.PI / 180), azimuth: 0, duration: 0 }
  });

  let scheme = new YMapDefaultSchemeLayer({ theme: options.dark ? 'dark' : 'light' });
  map.addChild(scheme);
  map.addChild(new YMapDefaultFeaturesLayer({}));

  const controls = new YMapControls({ position: 'bottom right' });
  controls.addChild(new YMapZoomControl({}));
  map.addChild(controls);

  let markers: unknown[] = [];

  return {
    provider: 'yandex',

    setTheme(dark) {
      map.removeChild(scheme);
      scheme = new YMapDefaultSchemeLayer({ theme: dark ? 'dark' : 'light' });
      map.addChild(scheme);
    },

    setMarkers(next, onSelect) {
      markers.forEach((marker) => map.removeChild(marker));
      markers = next.map((entry) => {
        const marker = new YMapMarker(
          { coordinates: [entry.position[1], entry.position[0]] },
          bubble(entry.html, entry.label, () => onSelect(entry.id)),
        );
        map.addChild(marker);
        return marker;
      });
    },

    fitTo(positions) {
      if (positions.length === 0) return;
      const lats = positions.map((p) => p[0]);
      const lngs = positions.map((p) => p[1]);
      map.setLocation({
        bounds: [
          [Math.min(...lngs), Math.max(...lats)],
          [Math.max(...lngs), Math.min(...lats)],
        ],
        duration: 400,
      });
    },

    flyTo(position, zoom) {
      map.setLocation({ center: [position[1], position[0]], zoom, duration: 800 });
    },

    panTo(position) {
      map.setLocation({ center: [position[1], position[0]], duration: 400 });
    },

    destroy() {
      markers = [];
      map.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// Leaflet + Carto
// ---------------------------------------------------------------------------
const LEAFLET_VERSION = '1.9.4';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; ' +
  '<a href="https://carto.com/attributions">CARTO</a>';
const TILE_URL_LIGHT =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_URL_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';


/**
 * Leaflet's own stylesheet paints the controls, the attribution strip and the
 * marker frames in its default grey. Left alone they sit on the page as a
 * lighter rectangle that ignores the theme entirely.
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

function injectLeafletTheme(): void {
  if (document.getElementById('leaflet-theme-css')) return;
  const style = document.createElement('style');
  style.id = 'leaflet-theme-css';
  style.textContent = LEAFLET_THEME_CSS;
  document.head.appendChild(style);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function createLeaflet(
  element: HTMLElement,
  options: EngineOptions,
): Promise<MapEngine> {
  loadStyle(
    'leaflet-css',
    `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`,
    'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
  );
  injectLeafletTheme();
  await loadScript(
    'leaflet-js',
    `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`,
    'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
  );

  const leaflet = (window as any).L;
  if (!leaflet) throw new Error('leaflet-missing');

  const map = leaflet.map(element, { zoomControl: false }).setView(options.center, options.zoom);
  map.invalidateSize();

  let tiles: any = null;
  const applyTiles = (dark: boolean) => {
    tiles?.remove();
    tiles = leaflet
      .tileLayer(dark ? TILE_URL_DARK : TILE_URL_LIGHT, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
      })
      .addTo(map);
  };
  applyTiles(options.dark);

  leaflet.control
    .zoom({
      position: 'bottomright',
      zoomInTitle: options.zoomInTitle,
      zoomOutTitle: options.zoomOutTitle,
    })
    .addTo(map);

  let markers: any[] = [];

  return {
    provider: 'leaflet',
    setTheme: applyTiles,

    setMarkers(next, onSelect) {
      markers.forEach((marker) => marker.remove());
      markers = next.map((entry) => {
        const marker = leaflet
          .marker(entry.position, {
            icon: leaflet.divIcon({
              className: 'listing-marker',
              html: entry.html,
              iconSize: [72, 30],
              iconAnchor: [36, 30],
            }),
            title: entry.label,
            alt: entry.label,
            riseOnHover: true,
          })
          .addTo(map);
        marker.on('click', () => onSelect(entry.id));
        return marker;
      });
    },

    fitTo(positions) {
      if (positions.length === 0) return;
      map.fitBounds(positions, { padding: [56, 56], maxZoom: 15 });
    },

    flyTo(position, zoom) {
      map.flyTo(position, zoom, { animate: true, duration: 1.2 });
    },

    panTo(position) {
      map.panTo(position, { animate: true });
    },

    destroy() {
      markers.forEach((marker) => marker.remove());
      markers = [];
      map.remove();
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
export async function createMapEngine(
  element: HTMLElement,
  options: EngineOptions,
): Promise<MapEngine> {
  if (YANDEX_KEY) {
    try {
      return await createYandex(element, options);
    } catch {
      // A bad or over-quota key must not cost the visitor their map.
      const { createMapLibre } = await import('./maplibre');
      return createMapLibre(element, options);
    }
  }
  const { createMapLibre } = await import('./maplibre');
  return createMapLibre(element, options);
}
