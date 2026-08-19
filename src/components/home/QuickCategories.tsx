import React from 'react';
import { Handshake, GraduationCap, Users, TrainFront, TrendingDown, Sparkles, ArrowRight, Home } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const QuickCategories: React.FC = () => {
  const { setFilters, setCurrentView } = useAppStore();

  const categories = [
    {
      id: 'sherikchilik',
      name: 'Sheriklikka',
      desc: 'Talaba va ijarachiga sherik',
      icon: Handshake,
      badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-200/80',
      gradientBg: 'from-amber-500/10 via-orange-500/5 to-transparent',
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
      action: () => {
        setFilters({ maxPrice: 4000000 });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'premium',
      name: 'Premium Uylar',
      desc: 'Evroremont, 100% jihozlangan',
      icon: Sparkles,
      badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-200/80',
      gradientBg: 'from-purple-500/10 via-violet-500/5 to-transparent',
      action: () => {
        setFilters({ minTrustScore: 90 });
        setCurrentView('SEARCH');
      }
    },
  ];

  return (
    <section id="kategoriyalar" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1">
            Sara Toifalar
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Kategoriyalar</h2>
          <p className="text-xs text-slate-500 font-medium hidden sm:block">O'zingizga mos ijara turini tanlang</p>
        </div>
        <button
          onClick={() => setCurrentView('SEARCH')}
          className="text-xs font-extrabold text-emerald-700 hover:text-emerald-600 flex items-center gap-1 transition-colors bg-emerald-50 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-xl"
        >
          <span>Barchasi</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
        {categories.map((cat) => {
          const Icon = cat?.icon || Home;
          return (
            <div
              key={cat.id}
              onClick={cat.action}
              className={`group cursor-pointer rounded-2xl border border-slate-200/80 bg-gradient-to-br ${cat.gradientBg} p-3.5 sm:p-5 text-left transition-all hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 active:scale-[0.97] flex flex-col justify-between space-y-3 shadow-xs`}
            >
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center border ${cat.badgeColor} transition-transform group-hover:scale-110 shadow-xs shrink-0`}>
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                  {cat.name}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold line-clamp-1">
                  {cat.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};