import React, { useState } from 'react';
import { Search, ShieldCheck, Sparkles, MapPin, Home, CheckCircle2, SlidersHorizontal, ChevronDown, Users, GraduationCap } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { UZBEKISTAN_REGIONS } from '../../data/mockLocations';

export const HeroSection: React.FC = () => {
  const { 
    searchQuery, setSearchQuery, 
    selectedRegion, selectedDistrict,
    roomsCount, maxPrice, audience, rentalType,
    setFilters, setCurrentView 
  } = useAppStore();

  const [localRegion, setLocalRegion] = useState(selectedRegion);
  const [localDistrict, setLocalDistrict] = useState(selectedDistrict);
  const [localRooms, setLocalRooms] = useState<number | null>(roomsCount);
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice);
  const [showAdvancedMobile, setShowAdvancedMobile] = useState(false);

  const activeRegionObj = UZBEKISTAN_REGIONS.find((r) => r.name === localRegion) || UZBEKISTAN_REGIONS[0];
  const availableDistricts = ['Barchasi', ...activeRegionObj.districts];

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({
      selectedRegion: localRegion,
      selectedDistrict: localDistrict,
      roomsCount: localRooms,
      maxPrice: localMaxPrice,
      sortBy: 'AI',
    });
    setCurrentView('SEARCH');
  };

  return (
    <section className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white pt-6 sm:pt-12 pb-10 sm:pb-16 px-3 sm:px-6 overflow-hidden">
      <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden pointer-events-none opacity-25">
        <div className="absolute -top-24 left-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-emerald-500 rounded-full blur-3xl" />
        <div className="absolute top-10 right-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-teal-600 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10 space-y-3 sm:space-y-5">
        <div className="inline-flex max-w-full items-center justify-center gap-1.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] sm:text-xs px-3 sm:px-4 py-1 rounded-full shadow-emerald backdrop-blur-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-semibold truncate">
            <span className="sm:hidden">AI Trust Score bilan himoyalangan</span>
            <span className="hidden sm:inline">AI Anti-Scam & Trust Score Bilan Himoyalangan</span>
          </span>
          <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
        </div>

        <h1 className="hero-title text-[1.7rem] xs:text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.15] text-white px-1">
          Maklersiz <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200">Kvartira Toping</span>
        </h1>

        <p className="text-slate-300 text-xs sm:text-base max-w-xl mx-auto leading-relaxed px-1">
          O'zbekistonning 12 viloyati va Toshkent bo'yicha to'g'ridan-to'g'ri egasidan ijaraga oling. 0% komissiya, 100% AI tekshiruvi.
        </p>

        <div className="bg-white/95 backdrop-blur-xl text-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl border border-white/20 max-w-4xl mx-auto text-left mt-4 sm:mt-6 w-full">
          <form onSubmit={handleHeroSearch} className="space-y-3 sm:space-y-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tuman, kvartira yoki metro..."
                className="w-full bg-slate-100/90 border border-slate-200 rounded-xl pl-9 pr-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-inner"
              />
              <Search className="w-4 h-4 text-emerald-600 absolute left-3 top-3.5" />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setFilters({ audience: 'ALL', rentalType: 'ALL' })} className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 transition-all ${audience === 'ALL' && rentalType === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>Barchasi</button>
              <button type="button" onClick={() => setFilters({ rentalType: 'FULL' })} className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 transition-all ${rentalType === 'FULL' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                <Home className="w-3.5 h-3.5 shrink-0" />
                <span>Butun Kvartira</span>
              </button>
              <button type="button" onClick={() => setFilters({ rentalType: 'ROOMMATE' })} className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 transition-all ${rentalType === 'ROOMMATE' ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Sherikchilikka</span>
              </button>
              <button type="button" onClick={() => setFilters({ audience: 'STUDENT' })} className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 transition-all ${audience === 'STUDENT' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span>Talabaga</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
              <div className="space-y-1 min-w-0">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" /> Viloyat
                </label>
                <div className="relative">
                  <select
                    value={localRegion}
                    onChange={(e) => {
                      setLocalRegion(e.target.value);
                      setLocalDistrict('Barchasi');
                    }}
                    className="w-full min-w-0 appearance-none bg-slate-100/90 border border-slate-200 rounded-xl pl-2.5 pr-7 py-2.5 font-bold text-[11px] sm:text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
                  >
                    <option value="Barchasi">Barchasi</option>
                    {UZBEKISTAN_REGIONS.map((r) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1 min-w-0">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" /> Tuman
                </label>
                <div className="relative">
                  <select
                    value={localDistrict}
                    onChange={(e) => setLocalDistrict(e.target.value)}
                    className="w-full min-w-0 appearance-none bg-slate-100/90 border border-slate-200 rounded-xl pl-2.5 pr-7 py-2.5 font-bold text-[11px] sm:text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
                  >
                    {availableDistricts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className={`space-y-1 min-w-0 ${showAdvancedMobile ? 'block' : 'hidden'} sm:block`}>
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Home className="w-3 h-3 text-emerald-600 shrink-0" /> Xonalar
                </label>
                <div className="relative">
                  <select
                    value={localRooms ?? ''}
                    onChange={(e) => setLocalRooms(e.target.value ? Number(e.target.value) : null)}
                    className="w-full min-w-0 appearance-none bg-slate-100/90 border border-slate-200 rounded-xl pl-2.5 pr-7 py-2.5 font-bold text-[11px] sm:text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
                  >
                    <option value="">Barchasi</option>
                    <option value="1">1 xona</option>
                    <option value="2">2 xona</option>
                    <option value="3">3 xona</option>
                    <option value="4">4+ xona</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className={`space-y-1 min-w-0 ${showAdvancedMobile ? 'block' : 'hidden'} sm:block`}>
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-slate-600">
                  <span>Maks Narx</span>
                  <span className="text-emerald-700 font-extrabold">{(localMaxPrice / 1000000).toFixed(1)}m</span>
                </div>
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

            <button
              type="button"
              onClick={() => setShowAdvancedMobile((v) => !v)}
              className="sm:hidden w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl py-2"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showAdvancedMobile ? 'Filtrlarni yopish' : 'Xona va narx filtrlari'}
            </button>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>12 viloyat va 120+ tumanida halol e'lonlar!</span>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold px-6 py-3 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
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
