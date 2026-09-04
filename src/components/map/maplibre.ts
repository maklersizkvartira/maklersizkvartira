import * as maplibregl from 'maplibre-gl';
// Bundled with this chunk rather than pulled from unpkg at runtime: the CDN
// copy was pinned to 4.7.1 while the package here is 6.x, and it carried no
// integrity hash on a page Google crawls.
import 'maplibre-gl/dist/maplibre-gl.css';
import type { EngineOptions, LatLng, MapEngine } from './engine';

const STYLE_URL_LIGHT = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const STYLE_URL_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export async function createMapLibre(
  element: HTMLElement,
  options: EngineOptions,
): Promise<MapEngine> {
  const map = new maplibregl.Map({
    container: element,
    style: options.dark ? STYLE_URL_DARK : STYLE_URL_LIGHT,
    center: [options.center[1], options.center[0]],
    zoom: options.zoom,
    pitch: 60, // 3D tilt
    bearing: -17, // slight rotation for 3D effect
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  let markers: maplibregl.Marker[] = [];

  map.on('load', () => {
    try {
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find(
          (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
      )?.id;

      map.addLayer(
          {
              'id': '3d-buildings',
              'source': 'carto',
              'source-layer': 'building',
              'filter': ['==', 'extrude', 'true'],
              'type': 'fill-extrusion',
              'minzoom': 15,
              'paint': {
                  'fill-extrusion-color': '#aaa',
                  'fill-extrusion-height': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      15,
                      0,
                      15.05,
                      ['get', 'height']
                  ],
                  'fill-extrusion-base': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      15,
                      0,
                      15.05,
                      ['get', 'min_height']
                  ],
                  'fill-extrusion-opacity': 0.6
              }
          },
          labelLayerId
      );
    } catch (e) {
      console.error('Failed to add 3D buildings:', e);
    }
  });

  let clickHandler: ((position: [number, number]) => void) | null = null;
  // One listener for the life of the map; `onClick` swaps the callback, so a
  // re-rendering component cannot leave a second one behind.
  map.on('click', (event: { lngLat: { lat: number; lng: number } }) => {
    if (clickHandler) clickHandler([event.lngLat.lat, event.lngLat.lng]);
  });

  return {
    provider: 'leaflet', // Return 'leaflet' so we don't break types if it only accepts yandex|leaflet
    onClick(handler) {
      clickHandler = handler;
    },
    setTheme(dark) {
      map.setStyle(dark ? STYLE_URL_DARK : STYLE_URL_LIGHT);
    },
    setMarkers(next, onSelect) {
      markers.forEach((m) => m.remove());
      markers = next.map((entry) => {
        const el = document.createElement('div');
        el.innerHTML = entry.html;
        el.className = 'listing-marker';
        el.style.cursor = 'pointer';
        el.onclick = () => onSelect(entry.id);
        return new maplibregl.Marker({ element: el })
          .setLngLat([entry.position[1], entry.position[0]])
          .addTo(map);
      });
    },
    fitTo(positions) {
      if (positions.length === 0) return;
      const bounds = new maplibregl.LngLatBounds();
      positions.forEach(p => bounds.extend([p[1], p[0]]));
      map.fitBounds(bounds, { padding: 56, maxZoom: 15 });
    },
    flyTo(position, zoom) {
      map.flyTo({ center: [position[1], position[0]], zoom, pitch: 60, duration: 1200 });
    },
    panTo(position) {
      map.panTo([position[1], position[0]], { duration: 400 });
    },
    destroy() {
      markers.forEach(m => m.remove());
      map.remove();
    },
  };
}
