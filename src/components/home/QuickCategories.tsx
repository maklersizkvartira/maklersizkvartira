import React from 'react';
import { Handshake, GraduationCap, Users, TrainFront, TrendingDown, Sparkles, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const QuickCategories: React.FC = () => {
  const { setFilters, setCurrentView } = useAppStore();

  const categories = [
    {
      id: 'sherikchilik',
      name: 'Sheriklikka',
      desc: 'Talaba va ijarachiga sherik',
      icon: Handshake,
      iconBg: 'bg-amber-500/10 text-amber-600 border-amber-200',
      action: () => {
        setFilters({ rentalType: 'ROOMMATE' });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'students',
      name: 'Talabalar uchun',
      desc: 'OOTV va OTMlar yaqinida',
      icon: GraduationCap,
      iconBg: 'bg-blue-500/10 text-blue-600 border-blue-200',
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
      iconBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      action: () => {
        setFilters({ roomsCount: 2 });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'metro',
      name: 'Metro yaqinida',
      desc: '1-5 daqiqa piyoda yo\'l',
      icon: TrainFront,
      iconBg: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
      action: () => {
        setFilters({ selectedMetro: 'Yunusobod' });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'budget',
      name: 'Arzon uylar',
      desc: '3.5 mln so\'mgacha uylar',
      icon: TrendingDown,
      iconBg: 'bg-rose-500/10 text-rose-600 border-rose-200',
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
      iconBg: 'bg-purple-500/10 text-purple-600 border-purple-200',
      action: () => {
        setFilters({ minTrustScore: 90 });
        setCurrentView('SEARCH');
      }
    },
  ];

  return (
    <section id="kategoriyalar" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Kategoriyalar</h2>
          <p className="text-xs text-slate-500 font-medium hidden sm:block">O'zingizga mos ijara turini tanlang</p>
        </div>
        <button
          onClick={() => setCurrentView('SEARCH')}
          className="text-xs font-extrabold text-emerald-700 hover:text-emerald-600 flex items-center gap-1 transition-colors"
        >
          <span>Barchasini ko'rish</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.id}
              onClick={cat.action}
              className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 text-center transition-all hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center space-y-2.5 shadow-card"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${cat.iconBg} transition-transform group-hover:scale-110 shadow-xs`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                  {cat.name}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium line-clamp-1">
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
