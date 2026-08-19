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

      {/* Sleek Search Trigger */}
      <div className="relative z-20 max-w-3xl mx-auto px-4 sm:px-6 -mt-8 sm:-mt-10">
        <button
          onClick={() => setShowSearchModal(true)}
          className="w-full flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200/80 p-3 sm:p-4 rounded-full shadow-xl transition-all group"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 rounded-full flex items-center justify-center text-slate-900 group-hover:scale-105 transition-transform shrink-0">
            <Search className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="font-black text-sm sm:text-base text-slate-900 truncate">Qayerdan izlayapsiz?</div>
            <div className="text-xs text-slate-500 font-medium truncate">Tuman, ko'cha, mo'ljal yoki metro...</div>
          </div>
        </button>
      </div>

      {showSearchModal && <SearchModal onClose={() => setShowSearchModal(false)} />}
    </div>
  );
};
