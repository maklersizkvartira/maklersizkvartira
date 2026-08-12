import React, { useState } from 'react';
import { Search, ShieldCheck, Sparkles, MapPin, Train, Home, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { UZBEKISTAN_REGIONS } from '../../data/mockLocations';

export const HeroSection: React.FC = () => {
  const { 
    searchQuery, setSearchQuery, 
    selectedRegion, selectedDistrict,
    roomsCount, maxPrice,
    setFilters, setCurrentView 
  } = useAppStore();

  const [localRegion, setLocalRegion] = useState(selectedRegion !== 'Barchasi' ? selectedRegion : 'Toshkent shahri');
  const [localDistrict, setLocalDistrict] = useState(selectedDistrict);
  const [localRooms, setLocalRooms] = useState<number | null>(roomsCount);
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice);

  const activeRegionObj = UZBEKISTAN_REGIONS.find((r) => r.name === localRegion) || UZBEKISTAN_REGIONS[0];
  const availableDistricts = ['Barchasi', ...activeRegionObj.districts];

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({
      selectedRegion: localRegion,
      selectedDistrict: localDistrict,
      roomsCount: localRooms,
      maxPrice: localMaxPrice,
    });
    setCurrentView('SEARCH');
  };

  return (
    <section className="relative bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 text-white pt-12 pb-20 px-4 sm:px-6 overflow-hidden">
      {/* Background Glow & Pattern */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-indigo-600 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
        {/* Shield AI Pill Badge */}
        <div className="inline-flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs px-4 py-1.5 rounded-full shadow-emerald backdrop-blur-md">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold">AI Anti-Scam & Trust Score Bilan Himoyalangan</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
        </div>

        {/* Hero Title & Subtitle */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight text-white">
          Maklersiz <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">Kvartira Toping</span>
        </h1>

        <p className="text-slate-300 text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed">
          O'zbekistonning barcha 12 viloyati hamda Toshkent bo'yicha to'g'ridan-to'g'ri egasidan ijaraga oling. 0% komissiya, 100% AI tekshiruvi.
        </p>

        {/* Hero Interactive Search Card */}
        <div className="bg-white/95 backdrop-blur-xl text-slate-900 rounded-3xl p-4 sm:p-6 shadow-2xl border border-white/20 max-w-5xl mx-auto text-left mt-8">
          <form onSubmit={handleHeroSearch} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Keyword */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-emerald-600" /> Qidiruv
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Kvartira yoki metro..."
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Region Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Viloyat / Shahar
                </label>
                <select
                  value={localRegion}
                  onChange={(e) => {
                    setLocalRegion(e.target.value);
                    setLocalDistrict('Barchasi');
                  }}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Barchasi">Barcha Hududlar</option>
                  {UZBEKISTAN_REGIONS.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* District Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Tuman / Shahar
                </label>
                <select
                  value={localDistrict}
                  onChange={(e) => setLocalDistrict(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Rooms Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Home className="w-3.5 h-3.5 text-emerald-600" /> Xonalar Soni
                </label>
                <select
                  value={localRooms ?? ''}
                  onChange={(e) => setLocalRooms(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Barchasi</option>
                  <option value="1">1 xonali</option>
                  <option value="2">2 xonali</option>
                  <option value="3">3 xonali</option>
                  <option value="4">4+ xonali</option>
                </select>
              </div>

              {/* Max Price Range */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                  <span>Maks Narx</span>
                  <span className="text-emerald-700 font-bold">{(localMaxPrice / 1000000).toFixed(1)} mln so'm</span>
                </label>
                <input
                  type="range"
                  min={2000000}
                  max={15000000}
                  step={500000}
                  value={localMaxPrice}
                  onChange={(e) => setLocalMaxPrice(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* CTA Search Button & Trust Indicator */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>O'zbekistonning 12 ta viloyati va 120+ tumanida halol va maklersiz e'lonlar!</span>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm transition-all hover:scale-105"
              >
                <Search className="w-4 h-4" />
                <span>Kvartira Izlash</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
