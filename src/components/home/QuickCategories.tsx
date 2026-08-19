import React, { useState } from 'react';
import { 
  Handshake, GraduationCap, Users, TrainFront, TrendingDown, Sparkles, ArrowRight, Home, ChevronRight, MapPin
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const QuickCategories: React.FC = () => {
  const { setFilters, setCurrentView } = useAppStore();
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
        setFilters({ minTrustScore: 90 });
        setCurrentView('SEARCH');
      }
    },
  ];

  return (
    <section id="kategoriyalar" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1">
            Sara Toifalar
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Kategoriyalar va Izlash</h2>
          <p className="text-xs text-slate-500 font-medium hidden sm:block">O'zingizga mos ijara turini bosing yoki ustiga keltiring</p>
        </div>
        <button
          onClick={() => setCurrentView('SEARCH')}
          className="text-xs font-extrabold text-emerald-700 hover:text-emerald-600 flex items-center gap-1 transition-colors bg-emerald-50 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-xl"
        >
          <span>Barchasi</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {categories.map((cat) => {
          const Icon = cat?.icon || Home;
          const isHovered = hoveredId === cat.id;

          return (
            <div
              key={cat.id}
              onClick={cat.action}
              onMouseEnter={() => setHoveredId(cat.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`group relative cursor-pointer rounded-2xl border border-slate-200/90 bg-gradient-to-br ${cat.gradientBg} p-3.5 sm:p-5 text-left transition-all duration-300 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 active:scale-[0.97] flex flex-col justify-between space-y-3 shadow-xs overflow-hidden`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center border ${cat.badgeColor} transition-transform group-hover:scale-110 shadow-xs shrink-0`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all ${isHovered ? 'opacity-100' : 'opacity-40'}`} />
              </div>

              <div className="space-y-1 min-w-0">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                  {cat.name}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold line-clamp-1">
                  {cat.desc}
                </p>

                {/* Sub-tags indicator on hover/desktop */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {cat.subTags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="text-[9px] font-bold bg-white/80 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md group-hover:border-emerald-300 group-hover:text-emerald-800 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};