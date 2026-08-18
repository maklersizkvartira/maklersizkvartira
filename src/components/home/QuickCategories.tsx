import React from 'react';
import { GraduationCap, Users, Train, Banknote, Sparkles } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const QuickCategories: React.FC = () => {
  const { setFilters, setCurrentView } = useAppStore();

  const categories = [
    {
      id: 'sherikchilik',
      name: '🤝 Sherikchilikka',
      desc: 'Kvartiraga sherik topish',
      icon: Users,
      color: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/20',
      badge: 'TOP',
      badgeColor: 'bg-emerald-600 text-white',
      action: () => {
        setFilters({ rentalType: 'ROOMMATE' });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'students',
      name: 'Talabalar uchun',
      desc: 'TATU, INHA, WIUT',
      icon: GraduationCap,
      color: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/20',
      badge: 'Ommabop',
      badgeColor: 'bg-amber-400 text-slate-900',
      action: () => {
        setCurrentView('STUDENT_PROGRAM');
      }
    },
    {
      id: 'families',
      name: 'Oilalar uchun',
      desc: '2-3 xonali tinch uylar',
      icon: Users,
      color: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/20',
      action: () => {
        setFilters({ roomsCount: 2, maxPrice: 8000000 });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'metro',
      name: 'Metro yaqinida',
      desc: '1-5 daqiqa masofa',
      icon: Train,
      color: 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/20',
      action: () => {
        setFilters({ selectedMetro: 'Oybek' });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'affordable',
      name: 'Arzon uylar',
      desc: '4.5 mln so\'mgacha',
      icon: Banknote,
      color: 'bg-gradient-to-br from-teal-500 to-emerald-700 text-white shadow-teal-500/20',
      action: () => {
        setFilters({ maxPrice: 4500000 });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'premium',
      name: 'Premium uylar',
      desc: 'Top 90+ Trust Score',
      icon: Sparkles,
      color: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/20',
      badge: 'VIP',
      badgeColor: 'bg-slate-900 text-amber-300 border border-amber-400/30',
      action: () => {
        setFilters({ minTrustScore: 85, onlyVerified: true });
        setCurrentView('SEARCH');
      }
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 w-full overflow-x-hidden">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Tezkor Toifalar</h2>
          <p className="text-[11px] sm:text-xs text-slate-500">Kerakli turdagi kvartiralarni bir bosing va toping</p>
        </div>
      </div>

      <div className="flex md:grid md:grid-cols-5 gap-2.5 sm:gap-3 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-1 -mx-3 px-3 md:mx-0 md:px-0 md:overflow-visible">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={cat.action}
              className="group p-3 sm:p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left flex flex-col justify-between relative overflow-hidden active:scale-95 min-w-[148px] w-[148px] sm:min-w-[160px] sm:w-[160px] md:w-auto md:min-w-0 snap-start shrink-0"
            >
              {cat.badge && (
                <span className={`absolute top-2 right-2 font-extrabold text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded ${cat.badgeColor}`}>
                  {cat.badge}
                </span>
              )}

              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${cat.color} flex items-center justify-center mb-2 sm:mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>

              <div>
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight">
                  {cat.name}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 font-medium truncate">{cat.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
