import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, X, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { Listing } from '../../types';

const USD_RATE = 12800;

export const MapView: React.FC = () => {
  const { listings, setCurrentView, currency, setCurrency } = useAppStore();
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [filterRegion, setFilterRegion] = useState<string>('ALL');
  const [filterRooms, setFilterRooms] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const formatPrice = (priceVal: number, curr: 'USD' | 'UZS') => {
    let priceInUsd = priceVal > 10000 ? Math.round(priceVal / USD_RATE) : priceVal;
    let priceInUzs = priceVal > 10000 ? priceVal : priceVal * USD_RATE;

    if (curr === 'USD') {
      return `$${priceInUsd} / oy`;
    } else {
      const mln = (priceInUzs / 1000000).toFixed(1);
      return `${mln} mln so'm / oy`;
    }
  };

  const formatBadgePrice = (priceVal: number, curr: 'USD' | 'UZS') => {
    let priceInUsd = priceVal > 10000 ? Math.round(priceVal / USD_RATE) : priceVal;
    let priceInUzs = priceVal > 10000 ? priceVal : priceVal * USD_RATE;

    if (curr === 'USD') {
      return `$${priceInUsd}`;
    } else {
      return `${(priceInUzs / 1000000).toFixed(1)} mln`;
    }
  };

  const filteredListings = listings.filter((l) => {
    if (filterRegion !== 'ALL' && l.region !== filterRegion && l.district !== filterRegion) return false;
    if (filterRooms !== 'ALL' && l.rooms !== filterRooms) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchAddress = (l.address || '').toLowerCase().includes(q);
      const matchDistrict = l.district.toLowerCase().includes(q);
      if (!matchTitle && !matchAddress && !matchDistrict) return false;
    }
    return true;
  });

  const DISTRICT_COORDS: Record<string, [number, number]> = {
    'chilonzor': [41.2780, 69.2080],
    'yunusobod': [41.3650, 69.2920],
    'mirobod': [41.3005, 69.2740],
    'yakkasaroy': [41.2890, 69.2550],
    'sergeli': [41.2250, 69.2200],
    'uchtepa': [41.2950, 69.1750],
    'olmazor': [41.3490, 69.2080],
    'yashnobod': [41.2900, 69.3400],
    'shayxontohur': [41.3200, 69.2400],
    'mirzo': [41.3350, 69.3300],
    'bektemir': [41.2100, 69.3300],
  };

  useEffect(() => {
    let isMounted = true;

    const loadLeaflet = async () => {
      if (!(window as any).L) {
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        if (!document.getElementById('leaflet-js')) {
          const script = document.createElement('script');
          script.id = 'leaflet-js';
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          document.head.appendChild(script);
          await new Promise((resolve) => (script.onload = resolve));
        }
      }

      if (!isMounted || !mapContainerRef.current) return;

      const L = (window as any).L;
      if (!L) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
        }).setView([41.311, 69.279], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      filteredListings.forEach((item, idx) => {
        const lat = item.latitude || 41.311 + (Math.sin(idx * 1.5) * 0.04);
        const lng = item.longitude || 69.279 + (Math.cos(idx * 1.5) * 0.04);

        const priceText = formatBadgePrice(item.price, currency);

        const customIcon = L.divIcon({
          className: 'custom-map-marker',
          html: `
            <div class="cursor-pointer group flex items-center gap-1 bg-slate-900 text-white hover:bg-emerald-600 font-extrabold text-[11px] px-2.5 py-1 rounded-full shadow-lg border border-white/30 transition-transform transform hover:scale-110 active:scale-95 whitespace-nowrap">
              <span>📍 ${priceText}</span>
            </div>
          `,
          iconSize: [65, 26],
          iconAnchor: [32, 13],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        marker.on('click', () => {
          setSelectedListing(item);
          map.panTo([lat, lng], { animate: true });
        });

        markersRef.current.push(marker);
      });

      // Fly map to search query or filtered district location if matched
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        let targetCoords: [number, number] | null = null;

        for (const [key, coords] of Object.entries(DISTRICT_COORDS)) {
          if (q.includes(key)) {
            targetCoords = coords;
            break;
          }
        }

        if (!targetCoords && filteredListings.length > 0) {
          const first = filteredListings[0];
          targetCoords = [first.latitude || 41.311, first.longitude || 69.279];
        }

        if (targetCoords) {
          map.flyTo(targetCoords, 13, { animate: true, duration: 1.2 });
        }
      } else if (filterRegion !== 'ALL') {
        const key = filterRegion.toLowerCase();
        for (const [k, coords] of Object.entries(DISTRICT_COORDS)) {
          if (key.includes(k)) {
            map.flyTo(coords, 13, { animate: true, duration: 1.2 });
            break;
          }
        }
      }
    };

    loadLeaflet();

    return () => {
      isMounted = false;
    };
  }, [filteredListings, currency, searchQuery, filterRegion]);

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-5.5rem)] flex flex-col overflow-hidden bg-slate-950">
      {/* MAP TOP CONTROLS & FILTER BAR */}
      <div className="z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-3 sm:p-4 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1 relative min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Manzil, ko'cha yoki tuman izlash..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {/* CURRENCY TOGGLE FILTER (USD vs UZS) */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  currency === 'USD'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>💵 USD ($)</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrency('UZS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  currency === 'UZS'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>🇺🇿 UZS (So'm)</span>
              </button>
            </div>

            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500 shrink-0"
            >
              <option value="ALL">Barcha Tumanlar</option>
              <option value="Mirobod">Mirobod t.</option>
              <option value="Chilonzor">Chilonzor t.</option>
              <option value="Yunusobod">Yunusobod t.</option>
              <option value="Mirzo Ulug'bek">Mirzo Ulug'bek t.</option>
              <option value="Shayxontohur">Shayxontohur t.</option>
              <option value="Olmazor">Olmazor t.</option>
              <option value="Yakkasaroy">Yakkasaroy t.</option>
              <option value="Sergeli">Sergeli t.</option>
            </select>

            <select
              value={filterRooms}
              onChange={(e) => setFilterRooms(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500 shrink-0"
            >
              <option value="ALL">Xonalar: Barchasi</option>
              <option value="1">1 xonali</option>
              <option value="2">2 xonali</option>
              <option value="3">3 xonali</option>
              <option value="4">4+ xonali</option>
            </select>
          </div>

        </div>
      </div>

      <div className="relative flex-1 w-full h-full flex items-stretch">
        <div ref={mapContainerRef} className="w-full h-full z-10 bg-slate-900" />

        {selectedListing && (
          <div className="absolute bottom-6 left-4 right-4 sm:left-6 sm:max-w-md z-30 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-white">
            <button
              onClick={() => setSelectedListing(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-4 items-start">
              <img
                src={selectedListing.images?.[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'}
                alt={selectedListing.title}
                className="w-24 h-24 rounded-xl object-cover border border-slate-700 shrink-0"
              />

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{selectedListing.address || `${selectedListing.district}, ${selectedListing.region}`}</span>
                </div>

                <h4 className="font-extrabold text-sm text-white line-clamp-1">
                  {selectedListing.title}
                </h4>

                <div className="text-xs text-slate-400">
                  {selectedListing.rooms} xonali • {selectedListing.area} m²
                  {selectedListing.metroStation && ` • 🚇 ${selectedListing.metroStation}`}
                </div>

                <div className="text-base font-black text-emerald-400 pt-1">
                  {formatPrice(selectedListing.price, currency)}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <img
                  src={selectedListing.owner?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover border border-slate-700"
                />
                <span className="text-xs font-semibold text-slate-300 truncate max-w-[120px]">
                  {selectedListing.owner?.name || 'Uy Egasi'}
                </span>
              </div>

              <button
                onClick={() => setCurrentView('LISTING_DETAIL', selectedListing.id)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-1"
              >
                <span>Batafsil ko'rish</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
