import React, { useMemo, useState } from 'react';
import { 
  Filter, SlidersHorizontal, RefreshCw, Search, ShieldCheck, MapPin, 
  Train, GraduationCap, DollarSign, Home, CheckCircle2, ChevronDown, ChevronUp 
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ListingCard } from '../common/ListingCard';
import { MOCK_UNIVERSITIES } from '../../data/mockUniversities';
import { UZBEKISTAN_REGIONS } from '../../data/mockLocations';

export const SearchPage: React.FC = () => {
  const { 
    listings, searchQuery, setSearchQuery,
    selectedRegion, selectedDistrict, selectedUniversity, selectedMetro,
    maxPrice, roomsCount, onlyVerified, minTrustScore, sortBy,
    setFilters, resetFilters, setCurrentView
  } = useAppStore();

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const activeRegionObj = UZBEKISTAN_REGIONS.find((r) => r.name === selectedRegion) || UZBEKISTAN_REGIONS[0];
  const districts = ['Barchasi', ...activeRegionObj.districts];
  const metros = ['Barchasi', 'Oybek', 'Yunusobod', 'Beruniy', 'Mirzo Ulug\'bek', 'Buyuk Ipak Yo\'li'];

  // Filter listings
  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      // Keyword search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = listing.title.toLowerCase().includes(q);
        const matchesDesc = listing.description.toLowerCase().includes(q);
        const matchesDistrict = listing.district.toLowerCase().includes(q);
        const matchesRegion = listing.region.toLowerCase().includes(q);
        const matchesMetro = listing.metroStation?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesDesc && !matchesDistrict && !matchesRegion && !matchesMetro) return false;
      }

      // Region filter
      if (selectedRegion !== 'Barchasi' && listing.region !== selectedRegion) {
        return false;
      }

      // District filter
      if (selectedDistrict !== 'Barchasi' && listing.district !== selectedDistrict) {
        return false;
      }

      // Metro filter
      if (selectedMetro !== 'Barchasi' && listing.metroStation !== selectedMetro) {
        return false;
      }

      // University filter
      if (selectedUniversity !== 'Barchasi') {
        const uniObj = MOCK_UNIVERSITIES.find((u) => u.shortName === selectedUniversity || u.name.includes(selectedUniversity));
        if (uniObj && listing.district !== uniObj.district && !listing.universityName?.includes(selectedUniversity)) {
          return false;
        }
      }

      // Price filter
      if (listing.price > maxPrice) {
        return false;
      }

      // Rooms filter
      if (roomsCount !== null && listing.rooms !== roomsCount) {
        return false;
      }

      // Only Verified filter
      if (onlyVerified && !listing.owner.isVerified) {
        return false;
      }

      // Min Trust Score filter
      if (listing.trustScore < minTrustScore) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'TRUST') return b.trustScore - a.trustScore;
      if (sortBy === 'PRICE_LOW') return a.price - b.price;
      if (sortBy === 'PRICE_HIGH') return b.price - a.price;
      if (sortBy === 'NEWEST') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });
  }, [listings, searchQuery, selectedRegion, selectedDistrict, selectedMetro, selectedUniversity, maxPrice, roomsCount, onlyVerified, minTrustScore, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 min-h-[80vh] w-full max-w-full overflow-x-hidden">
      {/* Search Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 flex-wrap">
            Kvartiralar Qidiruvi <span className="text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">{filteredListings.length} ta e'lon</span>
          </h1>
          <p className="text-xs text-slate-500">O'zbekistonning 12 viloyati va tumanlari bo'yicha AI bilan saralangan</p>
        </div>

        {/* Mobile Filter Toggle & Sort Selector */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden flex items-center gap-1.5 bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-md"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filtrlar</span>
            {showMobileFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="hidden xs:inline">Saralash:</span>
            <select
              value={sortBy}
              onChange={(e) => setFilters({ sortBy: e.target.value as any })}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            >
              <option value="TRUST">Eng Ishonchli (Trust Score)</option>
              <option value="PRICE_LOW">Eng Arzon Narx</option>
              <option value="PRICE_HIGH">Eng Qimmat Narx</option>
              <option value="NEWEST">Eng Yangi E'lonlar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Layout: Sidebar Filters + Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 w-full">
        {/* Left Sidebar Filter Panel */}
        <div className={`lg:block ${showMobileFilters ? 'block' : 'hidden'} lg:col-span-1 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-card h-fit space-y-5 w-full`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" /> Viloyat va Tuman Filtrlar
            </h3>
            <button
              onClick={resetFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 hover:underline"
            >
              <RefreshCw className="w-3 h-3" /> Tozalash
            </button>
          </div>

          {/* Region Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Viloyat / Shahar
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => setFilters({ selectedRegion: e.target.value, selectedDistrict: 'Barchasi' })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Barchasi">Barcha Hududlar</option>
              {UZBEKISTAN_REGIONS.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Tuman / Shahar
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => setFilters({ selectedDistrict: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Metro Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Train className="w-3.5 h-3.5 text-blue-600" /> Metro Bekati
            </label>
            <select
              value={selectedMetro}
              onChange={(e) => setFilters({ selectedMetro: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {metros.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* University Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-amber-600" /> Universitet Yaqinligi
            </label>
            <select
              value={selectedUniversity}
              onChange={(e) => setFilters({ selectedUniversity: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Barchasi">Barchasi</option>
              {MOCK_UNIVERSITIES.map((u) => (
                <option key={u.id} value={u.shortName}>{u.shortName}</option>
              ))}
            </select>
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700">Maksimal Narx</label>
              <span className="font-extrabold text-emerald-700">{(maxPrice / 1000000).toFixed(1)} mln so'm</span>
            </div>
            <input
              type="range"
              min={2000000}
              max={15000000}
              step={500000}
              value={maxPrice}
              onChange={(e) => setFilters({ maxPrice: Number(e.target.value) })}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
            />
          </div>

          {/* Rooms Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Xonalar Soni</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setFilters({ roomsCount: roomsCount === num ? null : num })}
                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    roomsCount === num
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {num} xona
                </button>
              ))}
            </div>
          </div>

          {/* Trust Score & Verification Toggles */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={onlyVerified}
                onChange={(e) => setFilters({ onlyVerified: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Faqat Verified Egalari
              </span>
            </label>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Min Trust Score</span>
                <span className="font-bold text-emerald-700">{minTrustScore}+</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={10}
                value={minTrustScore}
                onChange={(e) => setFilters({ minTrustScore: Number(e.target.value) })}
                className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Right Listings Grid */}
        <div className="lg:col-span-3 w-full">
          {filteredListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
              {filteredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 w-full">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Ushbu viloyat yoki tuman bo'yicha e'lon topilmadi</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Shield AI viloyat va tuman filtrini o'zgartirishni tavsiya qiladi.
              </p>
              <button
                onClick={resetFilters}
                className="bg-emerald-600 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md hover:bg-emerald-700 transition-colors"
              >
                Filtrlarni Tozalash
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
