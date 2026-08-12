import React, { useState } from 'react';
import { GraduationCap, MapPin, Train, Sparkles, BookOpen, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { MOCK_UNIVERSITIES } from '../../data/mockUniversities';
import { ListingCard } from '../common/ListingCard';

export const StudentProgramPage: React.FC = () => {
  const { listings, setFilters, setCurrentView } = useAppStore();
  const [selectedUni, setSelectedUni] = useState(MOCK_UNIVERSITIES[0]);

  // Filter listings near selected university
  const studentListings = listings.filter((l) => {
    return l.district === selectedUni.district || l.universityName?.includes(selectedUni.shortName);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 min-h-[85vh] space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-10 rounded-3xl shadow-xl border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-3 relative z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-300 bg-blue-950 px-3.5 py-1 rounded-full border border-blue-500/40">
            <GraduationCap className="w-4 h-4 text-amber-400" /> Talabalar Maxsus Dasturi
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Universitetingizga Yaqin Xavfsiz Uylar
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
            TATU, INHA, WIUT, Turin, TDIU va NUUz talabalari uchun hamyonbop va maklersiz ijara uylari bazasi.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center shrink-0 space-y-1">
          <span className="text-xs text-slate-300">Talaba Bonusi</span>
          <div className="text-2xl font-black text-amber-400 flex items-center justify-center gap-1">
            +50 XP & Free Boost
          </div>
          <span className="text-[10px] text-blue-300 font-semibold block">Talaba ID karta bilan</span>
        </div>
      </div>

      {/* University Selector Cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-black text-slate-900">Universitetingizni Tanlang</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {MOCK_UNIVERSITIES.map((uni) => (
            <button
              key={uni.id}
              onClick={() => setSelectedUni(uni)}
              className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-2 ${
                selectedUni.id === uni.id
                  ? 'bg-slate-900 text-white font-bold border-slate-900 shadow-md scale-105'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
              }`}
            >
              <span className="text-2xl">{uni.icon}</span>
              <div>
                <span className="text-xs font-bold block">{uni.shortName}</span>
                <span className="text-[10px] opacity-75">{uni.district}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected University Details & Listings */}
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Tanlangan Universitet</div>
            <h3 className="text-xl font-extrabold text-slate-900">{selectedUni.name}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> {selectedUni.district} tumani, Toshkent shahri
            </p>
          </div>

          <button
            onClick={() => {
              setFilters({ selectedUniversity: selectedUni.shortName });
              setCurrentView('SEARCH');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-colors flex items-center gap-1"
          >
            Barchasini Ko'rish <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {studentListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {studentListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            {selectedUni.shortName} yaqinida mos e'lonlar qidirilmoqda...
          </div>
        )}
      </div>
    </div>
  );
};
