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
    <section id="kategoriyalar" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200/60 pb-5">
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

      {/* Grid of Large Premium Interactive Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
        {categories.map((cat) => {
          const Icon = cat?.icon || Home;
          const isMetro = cat.id === 'metro';
          const isStudent = cat.id === 'students';
          const isSherik = cat.id === 'sherikchilik';

          return (
            <button
              key={cat.id}
              onClick={cat.action}
              className="flex flex-col items-center justify-between p-5 rounded-3xl bg-white border border-slate-200/80 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 group shrink-0 text-center relative overflow-hidden"
            >
              {/* Animated Top Ambient Gradient */}
              <div className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${cat.gradientBg} opacity-0 group-hover:opacity-100 transition-opacity`} />

              {/* Icon Container with Micro-Animations */}
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 shadow-sm border border-slate-100 group-hover:scale-110 group-hover:-translate-y-1 ${cat.badgeColor}`}>
                <Icon className={`w-7 h-7 sm:w-8 sm:h-8 transition-all duration-300 ${
                  isMetro ? 'group-hover:translate-x-1.5' : isStudent ? 'group-hover:-rotate-12' : isSherik ? 'group-hover:scale-125' : 'group-hover:rotate-6'
                }`} />
              </div>

              {/* Content */}
              <div className="space-y-1 w-full">
                <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-emerald-600 transition-colors leading-tight">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-snug">
                  {cat.desc}
                </p>
              </div>

              {/* Sub-tags */}
              <div className="mt-3 pt-2 border-t border-slate-100 w-full flex flex-wrap justify-center gap-1">
                {cat.subTags.slice(0, 2).map((tag, i) => (
                  <span key={i} className="text-[10px] font-bold text-slate-600 bg-slate-50 group-hover:bg-emerald-50 group-hover:text-emerald-700 px-2 py-0.5 rounded-md transition-colors">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};