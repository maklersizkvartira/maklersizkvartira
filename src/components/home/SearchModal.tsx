import React, { useState } from 'react';
import { Search, MapPin, Home, Users, GraduationCap, X, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { UZBEKISTAN_REGIONS, TASHKENT_METRO_LINES } from '../../data/mockLocations';

export const SearchModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { searchQuery, setSearchQuery, selectedRegion, selectedDistrict, selectedMetro, roomsCount, audience, rentalType, setFilters, setCurrentView } = useAppStore();
  
  const [localRegion, setLocalRegion] = useState(selectedRegion);
  const [localDistrict, setLocalDistrict] = useState(selectedDistrict);
  const [localMetro, setLocalMetro] = useState(selectedMetro);
  const [localRooms, setLocalRooms] = useState<number | null>(roomsCount);
  const [localRental, setLocalRental] = useState(rentalType);
  const [localAudience, setLocalAudience] = useState(audience);

  const activeRegionObj = UZBEKISTAN_REGIONS.find((r) => r.name === localRegion) || UZBEKISTAN_REGIONS[0];
  const availableDistricts = ['Barchasi', ...activeRegionObj.districts];
  const showMetroFilter = localRegion === 'Toshkent shahri' || localRegion === 'Toshkent viloyati' || localRegion === 'Barchasi';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ selectedRegion: localRegion, selectedDistrict: localDistrict, selectedMetro: localMetro, roomsCount: localRooms, rentalType: localRental, audience: localAudience, sortBy: 'AI' });
    setCurrentView('SEARCH');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100">
          <h3 className="font-black text-lg text-slate-900">Qidiruv parametrlari</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSearch} className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          <div className="relative">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tuman, ko'cha, mo'ljal..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <Search className="w-5 h-5 text-emerald-500 absolute left-4 top-4" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Viloyat</label>
              <div className="relative">
                <select value={localRegion} onChange={(e) => { setLocalRegion(e.target.value); setLocalDistrict('Barchasi'); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-900 appearance-none">
                  {UZBEKISTAN_REGIONS.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Tuman</label>
              <div className="relative">
                <select value={localDistrict} onChange={(e) => setLocalDistrict(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-900 appearance-none">
                  {availableDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {showMetroFilter && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-blue-600 ml-1">🚇 Metro Bekati</label>
              <div className="relative">
                <select value={localMetro} onChange={(e) => setLocalMetro(e.target.value)} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-bold text-slate-900 appearance-none">
                  <option value="Barchasi">Barcha Metro Bekatlari</option>
                  {TASHKENT_METRO_LINES.map((line) => (
                    <optgroup key={line.id} label={line.name}>
                      {line.stations.map((st) => <option key={st} value={st}>{st} bekati</option>)}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-blue-500 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Xonalar</label>
            <div className="flex gap-2">
              {[1,2,3,4].map(n => (
                <button key={n} type="button" onClick={() => setLocalRooms(localRooms === n ? null : n)} className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition-all ${localRooms === n ? 'bg-slate-900 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>
                  {n}{n===4?'+':''}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Ijara Turi</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button type="button" onClick={() => { setLocalRental('ALL'); setLocalAudience('ALL'); }} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${localRental === 'ALL' && localAudience === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>Barchasi</button>
              <button type="button" onClick={() => setLocalRental('FULL')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${localRental === 'FULL' ? 'bg-emerald-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>Butun Kvartira</button>
              <button type="button" onClick={() => setLocalRental('ROOMMATE')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${localRental === 'ROOMMATE' ? 'bg-amber-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>Sherikchilikka</button>
              <button type="button" onClick={() => setLocalAudience('STUDENT')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${localAudience === 'STUDENT' ? 'bg-blue-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>Talabalarga</button>
            </div>
          </div>
          
          <div className="pt-2">
            <button type="submit" className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-black text-sm text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <Search className="w-4 h-4" /> Natijalarni ko'rish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
