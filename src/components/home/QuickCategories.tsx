import React, { useState } from 'react';
import { 
  Handshake, GraduationCap, Users, TrainFront, TrendingDown, Sparkles, ArrowRight, Home, ChevronRight, MapPin
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const QuickCategories: React.FC = () => {
  const { setFilters, resetFilters, setCurrentView } = useAppStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const categories = [
    {
      id: 'sherikchilik',
      name: 'Sheriklikka',
      desc: 'Talaba va ijarachiga sherik',
      icon: Handshake,
      badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-200/80',
      gradientBg: 'from-amber-500/10 via-orange-500/5 to-transparent',
      subTags: ['Yigitlarga', 'Qizlarga', 'Xonadosh'],
      action: () => {
        resetFilters();
        setFilters({ rentalType: 'ROOMMATE' });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'students',
      name: 'Talabalar uchun',
      desc: 'OTMlar va OOTV yaqinida',
      icon: GraduationCap,
      badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-200/80',
      gradientBg: 'from-blue-500/10 via-indigo-500/5 to-transparent',
      subTags: ["O'zMU", 'TTA', 'INHA'],
      action: () => {
        resetFilters();
        setFilters({ audience: 'STUDENT' });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'families',
      name: 'Oilalar uchun',
      desc: '2-3 xonali shinam uylar',
      icon: Users,
      badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-200/80',
      gradientBg: 'from-emerald-500/10 via-teal-500/5 to-transparent',
      subTags: ['2 xona', '3 xona', 'Boshlang\'ich ijara'],
      action: () => {
        resetFilters();
        setFilters({ roomsCount: 2 });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'metro',
      name: 'Metro yaqinida',
      desc: "1-5 daqiqa piyoda yo'l",
      icon: TrainFront,
      badgeColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-200/80',
      gradientBg: 'from-indigo-500/10 via-purple-500/5 to-transparent',
      subTags: ['Chilonzor', 'Yunusobod', 'Buyuk Ipak Yoli'],
      action: () => {
        resetFilters();
        setFilters({ selectedMetro: 'Yunusobod' });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'budget',
      name: 'Arzon uylar',
      desc: 'Hamyonbop ijara narxlari',
      icon: TrendingDown,
      badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-200/80',
      gradientBg: 'from-rose-500/10 via-pink-500/5 to-transparent',
      subTags: ['< 3 mln', '< 4 mln', 'Depozitsiz'],
      action: () => {
        resetFilters();
        setFilters({ maxPrice: 4000000 });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'premium',
      name: 'Premium uylar',
      desc: 'Evroremont, 100% jihozlangan',
      icon: Sparkles,
      badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-200/80',
      gradientBg: 'from-purple-500/10 via-violet-500/5 to-transparent',
      subTags: ['Rakatboshi', 'Yevroremont', 'Studio'],
      action: () => {
        resetFilters();
        setFilters({ minTrustScore: 90 });
        setCurrentView('SEARCH');
      }
    },
  ];

  return (
    <section id="kategoriyalar" className="max-w-7xl mx-auto px-0 sm:px-6 py-8 sm:py-14 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-4 sm:px-0 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full uppercase tracking-wider mb-2 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sara Kategoriya Bo'limlari</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Kategoriyalar Bo'yicha Tezkor Qidiruv
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            O'zingizga ma'qul ijara turini tanlang va uylarni ko'ring
          </p>
        </div>
        <button
          onClick={() => setCurrentView('SEARCH')}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all group"
        >
          <span>Barcha e'lonlarni ko'rish</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Horizontal Scroll on Mobile, Grid on Desktop Large Premium Interactive Category Cards */}
      <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {categories.map((cat) => {
          const Icon = cat?.icon || Home;
          const isMetro = cat.id === 'metro';
          const isStudent = cat.id === 'students';
          const isSherik = cat.id === 'sherikchilik';

          return (
            <button
              key={cat.id}
              onClick={cat.action}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 w-[160px] sm:w-auto shrink-0 snap-start rounded-[16px] bg-white border border-slate-200/80 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 group text-left relative overflow-hidden"
            >
              {/* Animated Left Ambient Gradient */}
              <div className={`absolute left-0 inset-y-0 w-1 bg-gradient-to-b ${cat.gradientBg} opacity-0 group-hover:opacity-100 transition-opacity`} />

              {/* Icon Container with Micro-Animations */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 border border-slate-100 group-hover:scale-105 ${cat.badgeColor}`}>
                <Icon className={`w-6 h-6 transition-all duration-300 ${
                  isMetro ? 'group-hover:translate-x-1' : isStudent ? 'group-hover:-rotate-12' : isSherik ? 'group-hover:scale-110' : 'group-hover:rotate-6'
                }`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors truncate">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  {cat.desc}
                </p>
                <div className="mt-1.5 flex gap-1 overflow-hidden">
                  {cat.subTags.slice(0, 2).map((tag, i) => (
                    <span key={i} className="text-[9px] font-bold text-slate-600 bg-slate-50 group-hover:bg-emerald-50 group-hover:text-emerald-700 px-1.5 py-0.5 rounded transition-colors whitespace-nowrap">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};