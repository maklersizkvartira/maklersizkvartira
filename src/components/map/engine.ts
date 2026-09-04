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
 *  * **Yandex.** Tried first, and what people here actually use: the only one
 *    whose Uzbek map has the mahalla-level detail a renter is looking for.
 *    Takes a key — see `YANDEX_KEYS` below, which carries a working default.
 *  * **Leaflet + OpenStreetMap.** No key, so it always works. It is the
 *    fallback for everything that can stop Yandex — a missing or rejected key,
 *    a referrer the key is not allowed on, a blocked request, a device with no
 *    WebGL — so a visitor always gets a map, and only the detail differs.
 *
 * The order matters and was wrong for a long time: with Leaflet tried first it
 * always succeeded, the Yandex branch never ran, and the site served OSM tiles
 * while this comment claimed otherwise. If the map ever looks less detailed
 * than it should, check `createMapEngine` at the foot of this file first.
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
  /**
   * Report where the map was tapped, or stop reporting when given `null`.
   *
   * Added for the listing form's location picker. Everything else this engine
   * does is read-only — it shows points somebody else chose — and picking a
   * point is the one case where the map is an input.
   */
  onClick(handler: ((position: LatLng) => void) | null): void;
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

/**
 * The Yandex JS API keys to try, in order.
 *
 * A list rather than one value: the environment wins when it holds a key that
 * works, and a stale one costs one failed request instead of silently
 * downgrading every visitor's map.
 *
 * A correction to what this comment used to say. It blamed `57fdc2ff-…` for
 * being "a key Yandex answers 403 Invalid api key", and that was wrong — the
 * request was. Both keys here return 200 and 35KB of JavaScript on the 2.1
 * endpoint this file now loads; both were refused by v3, which it used to
 * load, because a key issued for 2.1 is simply not a v3 key. Every hour spent
 * hunting a dead key was spent on the wrong half of the URL.
 *
 * The lesson worth keeping: when a provider says the credential is invalid,
 * check what was asked for before concluding anything about the credential.
 *
 * These are not secrets. A JS API key ships inside the bundle to every visitor
 * by definition; Yandex secures it by HTTP-Referer instead, so the allowed
 * hosts in the Yandex Cabinet are the only thing stopping another site from
 * spending this quota, so uyiz.uz has to be on the allowed list in the Yandex
 * Cabinet or the map drops to OpenStreetMap there.
 */
const YANDEX_KEYS: string[] = [
  import.meta.env.VITE_YANDEX_MAPS_API_KEY,
  '98af8724-f778-4831-a661-f197c1d1f656',
].filter((key): key is string => Boolean(key && key.trim()))
  .filter((key, index, all) => all.indexOf(key) === index);

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
/**
 * The slice of the 2.1 global this file touches.
 *
 * Deliberately narrow. `ymaps` is a very large namespace and typing it fully
 * would be typing somebody else's library; these are the eight things the
 * engine below calls, and anything else is a compile error rather than a
 * silent `any`.
 */
interface YandexMaps21 {
  ready(callback: () => void): void;
  Map: new (
    element: HTMLElement,
    state: { center: LatLng; zoom: number; controls: string[] },
    options?: Record<string, unknown>,
  ) => YandexMap21;
}

interface YandexProjection21 {
  toGlobalPixels(position: LatLng, zoom: number): [number, number];
}

interface YandexMap21 {
  controls: { add(name: string, options?: Record<string, unknown>): void };
  geoObjects: { add(object: unknown): void; removeAll(): void };
  events: {
    add(
      name: string | string[],
      handler: (event: { get(key: string): unknown }) => void,
    ): void;
  };
  /** Used to place our own markers — see the overlay in `createYandex`. */
  options: { get(name: 'projection'): YandexProjection21 };
  converter: { globalToPage(global: [number, number]): [number, number] };
  container: { getOffset(): [number, number] };
  getZoom(): number;
  setBounds(bounds: [LatLng, LatLng], options?: Record<string, unknown>): void;
  setCenter(center: LatLng, zoom?: number, options?: Record<string, unknown>): void;
  destroy(): void;
}

/**
 * Yandex's own cartography, left alone.
 *
 * There was a CSS filter here — invert, hue-rotate, the same stack the
 * Leaflet path uses to force OpenStreetMap into a dark palette. On Yandex it
 * was the wrong tool: OSM tiles are generic and a filter is the only way to
 * theme them, while Yandex ships a designed map, and running it through
 * `invert()` produced something that looked like a broken screenshot of one.
 * Recoloured roads, inverted water, labels in colours no cartographer chose.
 *
 * So the tiles render as Yandex draws them, in both themes. The map is lighter
 * than the page around it in dark mode, and that is the honest trade: this is
 * the map people recognise from every other Uzbek site, which is most of its
 * value here.
 *
 * The background token stays, purely so the container is not a white rectangle
 * in the moment before the first tile arrives.
 */
const YANDEX_THEME_CSS = `
.uyiz-ymap { background: var(--color-surface-2); font: inherit; }
`;

function injectYandexTheme(): void {
  if (document.getElementById('yandex-theme-css')) return;
  const style = document.createElement('style');
  style.id = 'yandex-theme-css';
  style.textContent = YANDEX_THEME_CSS;
  document.head.appendChild(style);
}

/**
 * Yandex Maps, JS API 2.1.
 *
 * Written against 2.1 and not v3, which is what this used to load, because a
 * key issued for one is not a key for the other: v3 answered every request
 * with `403 Invalid api key` for a key that returns 200 and 35KB of
 * JavaScript on 2.1. The map fell through to OpenStreetMap the whole time and
 * said so only in the console, so from the outside it looked like a dead key
 * rather than a version mismatch.
 */
async function createYandex(
  element: HTMLElement,
  options: EngineOptions,
  apiKey: string,
): Promise<MapEngine> {
  injectYandexTheme();
  await loadScript(
    'yandex-maps-js',
    `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}` +
      `&lang=${options.language === 'ru' ? 'ru_RU' : options.language === 'en' ? 'en_US' : 'uz_UZ'}`,
  );

  const ymaps = (window as unknown as { ymaps?: YandexMaps21 }).ymaps;
  if (!ymaps) throw new Error('yandex-missing');
  // `ready` resolves once the modules the constructors live in are loaded.
  // Touching `ymaps.Map` before it does throws, and that throw is what the
  // caller reads as "this key did not work" — so a slow network would have
  // looked like a bad key.
  await new Promise<void>((resolve) => ymaps.ready(resolve));

  element.classList.add('uyiz-ymap');

  const map = new ymaps.Map(
    element,
    { center: options.center, zoom: options.zoom, controls: [] },
    // The whole point of this map is the tiles; Yandex's own search box,
    // traffic panel and ruler are chrome we neither asked for nor style.
    { suppressMapOpenBlock: true },
  );

  map.controls.add('zoomControl', { position: { right: 12, bottom: 44 } });

  // Nothing to switch: Yandex's tiles carry their own design and this engine
  // no longer repaints them. Kept because `MapEngine` requires it and the
  // Leaflet path, which does theme its tiles, still needs the call.
  const applyTheme = (_dark: boolean) => undefined;

  let clickHandler: ((position: LatLng) => void) | null = null;

  // One listener for the life of the map; `onClick` swaps the callback, so a
  // component that re-renders cannot leave a second listener behind and fire
  // the handler twice.
  map.events.add('click', (event: { get(name: string): unknown }) => {
    const coords = event.get('coords') as LatLng | undefined;
    if (clickHandler && Array.isArray(coords)) clickHandler([coords[0], coords[1]]);
  });

  /**
   * Markers are drawn by us, on top of Yandex's tiles.
   *
   * `ymaps.Placemark` renders nothing on this account. The map builds its
   * ground, events, copyright and control panes and no places pane at all, so
   * geo objects join a collection that never paints. Verified against Yandex's
   * own documented example in a clean frame — plain map, one preset placemark,
   * `load=package.full` — which drew tiles and no marker either. It is what
   * the key is entitled to, not the code above it.
   *
   * The projection is there regardless, and it is all a marker needs: a
   * coordinate becomes a pixel, an absolutely positioned element goes there,
   * and the browser handles the click. The tiles stay Yandex's, which is the
   * half of the map this account does serve.
   */
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden';
  element.appendChild(overlay);

  let pins: { element: HTMLElement; position: LatLng }[] = [];

  const placePins = () => {
    if (pins.length === 0) return;
    const projection = map.options.get('projection');
    const offset = map.container.getOffset();
    const zoom = map.getZoom();
    pins.forEach((pin) => {
      const page = map.converter.globalToPage(
        projection.toGlobalPixels(pin.position, zoom),
      );
      pin.element.style.left = `${page[0] - offset[0]}px`;
      pin.element.style.top = `${page[1] - offset[1]}px`;
    });
  };

  // Every way the viewport can move. `actiontick` is what keeps the pins with
  // the tiles *during* a drag rather than snapping to place when it ends.
  map.events.add(['boundschange', 'actionend', 'actiontick', 'sizechange'], placePins);

  return {
    provider: 'yandex',

    onClick(handler) {
      clickHandler = handler;
    },

    setTheme: applyTheme,

    setMarkers(next, onSelect) {
      pins.forEach((pin) => pin.element.remove());
      pins = next.map((entry) => {
        // The same `bubble` the Leaflet path mounts, so a marker looks and
        // behaves identically whichever engine is underneath.
        const element = bubble(entry.html, entry.label, () => onSelect(entry.id));
        element.style.position = 'absolute';
        // The overlay ignores the pointer so the map can still be dragged
        // through it; each marker takes it back for itself.
        element.style.pointerEvents = 'auto';
        element.style.transform = 'translate(-50%, -100%)';
        overlay.appendChild(element);
        return { element, position: entry.position };
      });
      placePins();
    },

    fitTo(positions) {
      if (positions.length === 0) return;
      const lats = positions.map((p) => p[0]);
      const lngs = positions.map((p) => p[1]);
      map.setBounds(
        [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ],
        { checkZoomRange: true, duration: 400 },
      );
    },

    flyTo(position, zoom) {
      map.setCenter(position, zoom, { duration: 800 });
    },

    panTo(position) {
      map.setCenter(position, undefined, { duration: 400 });
    },

    destroy() {
      pins = [];
      overlay.remove();
      element.classList.remove('uyiz-ymap');
      map.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Leaflet + OpenStreetMap
// ---------------------------------------------------------------------------
const LEAFLET_VERSION = '1.9.4';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

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

/* Premium Dark Mode Map tiles: deep slate/navy asphalt with zero watermarks */
.leaflet-container.dark-theme .leaflet-tile-pane,
[data-theme="dark"] .leaflet-container .leaflet-tile-pane {
  filter: brightness(0.58) invert(1) contrast(2.4) hue-rotate(200deg) saturate(0.3) brightness(0.8);
}
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
    if (dark) {
      element.classList.add('dark-theme');
    } else {
      element.classList.remove('dark-theme');
    }
    if (!tiles) {
      tiles = leaflet
        .tileLayer(TILE_URL, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: 19,
        })
        .addTo(map);
    }
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
  let clickHandler: ((position: LatLng) => void) | null = null;

  // One listener, swapped callback — same reasoning as the Yandex path.
  map.on('click', (event: { latlng: { lat: number; lng: number } }) => {
    if (clickHandler) clickHandler([event.latlng.lat, event.latlng.lng]);
  });

  return {
    provider: 'leaflet',
    setTheme: applyTiles,

    onClick(handler) {
      clickHandler = handler;
    },

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
/**
 * Yandex first, Leaflet if it will not load.
 *
 * The order used to be the other way round, with a comment about emulators and
 * domain-locked keys. The effect was that the Yandex path never ran at all:
 * Leaflet has no key to reject and no GL to miss, so it succeeded every time
 * and the fallback was the map every visitor got. All of the Yandex code above
 * was dead, and the site showed OpenStreetMap tiles — which do not carry the
 * mahalla-level detail of Uzbek addresses that a renter is actually looking
 * for, and which is the whole reason Yandex is wired up here.
 *
 * The concern behind that order was real, though, so it is handled rather than
 * avoided: anything that stops Yandex — no key, a referrer the key is not
 * allowed on, a blocked request, a WebGL-less device — throws, and Leaflet
 * takes over. A visitor sees a working map either way; only the detail differs.
 */
export async function createMapEngine(
  element: HTMLElement,
  options: EngineOptions,
): Promise<MapEngine> {
  for (const apiKey of YANDEX_KEYS) {
    try {
      return await createYandex(element, options, apiKey);
    } catch (error) {
      // Yandex may have written into the container before it failed, and
      // Leaflet refuses a container it thinks is already a map ("Map container
      // is already initialized") — including one Leaflet itself never touched.
      // Both are cleared here so whatever runs next starts on bare ground.
      console.warn(`[map] Yandex key ${apiKey.slice(0, 8)}… did not load`, error);
      element.innerHTML = '';
      delete (element as unknown as Record<string, unknown>)._leaflet_id;
    }
  }
  if (YANDEX_KEYS.length > 0) {
    console.warn('[map] no Yandex key loaded — falling back to OpenStreetMap');
  }
  return createLeaflet(element, options);
}
