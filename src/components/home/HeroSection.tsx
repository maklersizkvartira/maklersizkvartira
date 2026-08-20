import React, { useState } from 'react';
import { Search, MapPin, Home, Users, GraduationCap, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { UZBEKISTAN_REGIONS, TASHKENT_METRO_LINES } from '../../data/mockLocations';
import { SearchModal } from './SearchModal';

export const HeroSection: React.FC = () => {
  const { 
    searchQuery, setSearchQuery, 
    selectedRegion, selectedDistrict, selectedMetro,
    roomsCount, audience, rentalType,
    setFilters, setCurrentView 
  } = useAppStore();

  const [showSearchModal, setShowSearchModal] = useState(false);


  return (
    <div className="w-full">
      {/* Ultra Premium Dark Luxury Hero Background */}
      <section className="relative overflow-hidden bg-zinc-950 px-4 sm:px-6 pt-12 sm:pt-20 pb-28 sm:pb-36 text-white text-center">
        {/* Massive Radial Glows */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-zinc-950 to-zinc-950" />
        <div className="absolute top-0 right-0 h-[500px] w-[500px] translate-x-1/3 -translate-y-1/3 rounded-full bg-violet-600/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] -translate-x-1/3 translate-y-1/3 rounded-full bg-emerald-600/10 blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto space-y-5 sm:space-y-8 mt-4">
          {/* Serious 0% Commission Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 backdrop-blur-md px-5 py-2 text-xs font-black tracking-widest text-indigo-300 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="uppercase">0% Komissiya • To'g'ridan-to'g'ri ijara</span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="text-4xl xs:text-5xl sm:text-7xl font-black tracking-tighter leading-[1.05] text-white drop-shadow-2xl">
            Maklersiz Kvartira <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">Toping</span>
          </h1>

          {/* Hero Subtitle */}
          <p className="max-w-2xl mx-auto text-zinc-400 text-sm sm:text-lg md:text-xl font-medium leading-relaxed">
            O'zbekiston bo'ylab 12 viloyat va 120+ tumanlarda ishonchli va tekshirilgan uylar. Vositasiz. Ortiqcha to'lovsiz.
          </p>
        </div>
      </section>

      {/* Sleek Search Trigger */}
      <div className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 -mt-10 sm:-mt-12">
        <button
          onClick={() => setShowSearchModal(true)}
          className="w-full flex items-center gap-4 bg-zinc-900/90 hover:bg-zinc-800/95 border border-zinc-700/80 p-4 sm:p-5 rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all duration-500 group cursor-pointer hover:border-indigo-500/50 hover:shadow-[0_20px_50px_-12px_rgba(99,102,241,0.3)] hover:-translate-y-1"
        >
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-emerald-500 rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500 shrink-0 shadow-lg shadow-indigo-500/30">
            <Search className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="font-black text-base sm:text-xl text-white truncate group-hover:text-indigo-300 transition-colors">Qayerdan izlayapsiz?</div>
            <div className="text-xs sm:text-sm text-zinc-400 font-medium truncate mt-0.5">
              <span className="sm:hidden">Bu yerni bosing...</span>
              <span className="hidden sm:inline">Tuman, ko'cha, mo'ljal yoki metro kiriting...</span>
            </div>
          </div>
        </button>
      </div>

      {showSearchModal && <SearchModal onClose={() => setShowSearchModal(false)} />}
    </div>
  );
};
