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

      <div className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {categories.map((cat) => {
          const Icon = cat?.icon || Home;

          return (
            <button
              key={cat.id}
              onClick={cat.action}
              className="flex flex-col items-center justify-center min-w-[85px] sm:min-w-[100px] p-3 rounded-2xl bg-white border border-slate-200/60 hover:border-emerald-500/50 hover:bg-emerald-50/30 hover:shadow-md transition-all group shrink-0"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-transform group-hover:scale-110 ${cat.badgeColor}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-extrabold text-slate-700 group-hover:text-emerald-700 text-center leading-tight">
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};