import React, { useState } from 'react';
import { Search, MapPin, Home, Users, GraduationCap, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { UZBEKISTAN_REGIONS, TASHKENT_METRO_LINES } from '../../data/mockLocations';

export const HeroSection: React.FC = () => {
  const { 
    searchQuery, setSearchQuery, 
    selectedRegion, selectedDistrict, selectedMetro,
    roomsCount, audience, rentalType,
    setFilters, setCurrentView 
  } = useAppStore();

  const [localRegion, setLocalRegion] = useState(selectedRegion);
  const [localDistrict, setLocalDistrict] = useState(selectedDistrict);
  const [localMetro, setLocalMetro] = useState(selectedMetro);
  const [localRooms, setLocalRooms] = useState<number | null>(roomsCount);

  const activeRegionObj = UZBEKISTAN_REGIONS.find((r) => r.name === localRegion) || UZBEKISTAN_REGIONS[0];
  const availableDistricts = ['Barchasi', ...activeRegionObj.districts];
  const showMetroFilter = localRegion === 'Toshkent shahri' || localRegion === 'Toshkent viloyati' || localRegion === 'Barchasi';

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({
      selectedRegion: localRegion,
      selectedDistrict: localDistrict,
      selectedMetro: localMetro,
      roomsCount: localRooms,
      sortBy: 'AI',
    });
    setCurrentView('SEARCH');
  };

  return (
    <div className="w-full">
      {/* Dark Luxury Hero Background */}
      <section className="relative overflow-hidden bg-slate-950 px-4 sm:px-6 pt-12 sm:pt-20 pb-28 sm:pb-36 text-white text-center">
        <div className="relative z-10 max-w-5xl mx-auto space-y-4 sm:space-y-6">
          {/* Animated 0% Commission Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-black tracking-wider text-emerald-400 uppercase backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>0% Komissiya • To'g'ridan-to'g'ri ijara</span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="text-3xl xs:text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.1] text-white">
            Maklersiz Kvartira Toping
          </h1>

          {/* Hero Subtitle */}
          <p className="max-w-2xl mx-auto text-slate-300 text-xs sm:text-lg md:text-xl font-medium leading-relaxed">
            O'zbekiston bo'ylab 12 viloyat va 120+ tumanlarda ishonchli va tekshirilgan uylar.
          </p>
        </div>

        {/* Ambient Emerald Glow Effect */}
        <div className="absolute top-0 right-0 h-[450px] w-[450px] translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-[450px] w-[450px] -translate-x-1/3 translate-y-1/3 rounded-full bg-teal-500/10 blur-[120px] pointer-events-none" />
      </section>

      {/* Overlapping Floating Search Container */}
      <div className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-24">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-7 shadow-2xl space-y-4 text-slate-900">
          <form onSubmit={handleHeroSearch} className="space-y-4">
            {/* Main Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tuman, kvartira mo'ljali yoki metro bekatini yozing..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3.5 text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-inner"
              />
              <Search className="w-4 h-4 text-emerald-600 absolute left-3.5 top-4" />
            </div>

            {/* Quick Audience Pills */}
            <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
              <button
                type="button"
                onClick={() => setFilters({ audience: 'ALL', rentalType: 'ALL' })}
                className={`py-2 px-3.5 rounded-xl font-bold border transition-all ${
                  audience === 'ALL' && rentalType === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Barchasi
              </button>
              <button
                type="button"
                onClick={() => setFilters({ rentalType: 'FULL' })}
                className={`py-2 px-3.5 rounded-xl font-bold border flex items-center gap-1.5 transition-all ${
                  rentalType === 'FULL'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Butun Kvartira</span>
              </button>
              <button
                type="button"
                onClick={() => setFilters({ rentalType: 'ROOMMATE' })}
                className={`py-2 px-3.5 rounded-xl font-bold border flex items-center gap-1.5 transition-all ${
                  rentalType === 'ROOMMATE'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Sherikchilikka</span>
              </button>
              <button
                type="button"
                onClick={() => setFilters({ audience: 'STUDENT' })}
                className={`py-2 px-3.5 rounded-xl font-bold border flex items-center gap-1.5 transition-all ${
                  audience === 'STUDENT'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Talabalarga</span>
              </button>
            </div>

            {/* Grid Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Region Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">Hudud</label>
                <div className="relative">
                  <select
                    value={localRegion}
                    onChange={(e) => {
                      setLocalRegion(e.target.value);
                      setLocalDistrict('Barchasi');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                  >
                    {UZBEKISTAN_REGIONS.map((r) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* District Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">Tuman</label>
                <div className="relative">
                  <select
                    value={localDistrict}
                    onChange={(e) => setLocalDistrict(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                  >
                    {availableDistricts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Metro Station Selector for Tashkent */}
              {showMetroFilter && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-blue-600 ml-1 flex items-center gap-1">
                    🚇 Metro Bekati
                  </label>
                  <div className="relative">
                    <select
                      value={localMetro}
                      onChange={(e) => setLocalMetro(e.target.value)}
                      className="w-full rounded-xl border border-blue-200 bg-blue-50/50 px-3.5 py-3 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                    >
                      <option value="Barchasi">Barcha Metro Bekatlari (~50 bekat)</option>
                      {TASHKENT_METRO_LINES.map((line) => (
                        <optgroup key={line.id} label={line.name}>
                          {line.stations.map((st) => (
                            <option key={st} value={st}>{st} bekati</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-blue-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Room Pill Buttons */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">Xonalar</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLocalRooms(localRooms === 1 ? null : 1)}
                    className={`flex-1 rounded-xl py-3 text-xs font-extrabold transition-all ${
                      localRooms === 1 ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    1
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalRooms(localRooms === 2 ? null : 2)}
                    className={`flex-1 rounded-xl py-3 text-xs font-extrabold transition-all ${
                      localRooms === 2 ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    2
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalRooms(localRooms === 3 ? null : 3)}
                    className={`flex-1 rounded-xl py-3 text-xs font-extrabold transition-all ${
                      localRooms === 3 ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    3+
                  </button>
                </div>
              </div>

              {/* Submit CTA Button */}
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full h-11 sm:h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-black text-xs sm:text-sm text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Search className="w-4 h-4 text-slate-950" />
                  <span>Qidirish</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
