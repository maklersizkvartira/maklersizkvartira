import React from 'react';
import { GraduationCap, Users, Train, Banknote, Sparkles } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const QuickCategories: React.FC = () => {
  const { setFilters, setCurrentView } = useAppStore();

  const categories = [
    {
      id: 'students',
      name: 'Talabalar uchun',
      desc: 'TATU, INHA, WIUT yaqinida',
      icon: GraduationCap,
      color: 'bg-blue-500 text-white',
      badge: 'Ommabop',
      action: () => {
        setCurrentView('STUDENT_PROGRAM');
      }
    },
    {
      id: 'families',
      name: 'Oilalar uchun',
      desc: '2-3 xonali tinch uylar',
      icon: Users,
      color: 'bg-emerald-600 text-white',
      action: () => {
        setFilters({ roomsCount: 2, maxPrice: 8000000 });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'metro',
      name: 'Metro yaqinida',
      desc: 'Piyoda 1-5 daqiqa masofa',
      icon: Train,
      color: 'bg-indigo-600 text-white',
      action: () => {
        setFilters({ selectedMetro: 'Oybek' });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'affordable',
      name: 'Arzon uylar',
      desc: '4.5 mln so\'mgacha uylar',
      icon: Banknote,
      color: 'bg-teal-600 text-white',
      action: () => {
        setFilters({ maxPrice: 4500000 });
        setCurrentView('SEARCH');
      }
    },
    {
      id: 'premium',
      name: 'Premium uylar',
      desc: 'Top 90+ Trust Score uylar',
      icon: Sparkles,
      color: 'bg-amber-500 text-white',
      action: () => {
        setFilters({ minTrustScore: 85, onlyVerified: true });
        setCurrentView('SEARCH');
      }
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Tezkor Toifalar</h2>
          <p className="text-xs text-slate-500">Kerakli turdagi kvartiralarni bir bosing va toping</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={cat.action}
              className="group p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left flex flex-col justify-between relative overflow-hidden"
            >
              {cat.badge && (
                <span className="absolute top-2 right-2 bg-amber-400 text-slate-900 font-extrabold text-[9px] px-1.5 py-0.5 rounded uppercase">
                  {cat.badge}
                </span>
              )}
              <div className={`w-10 h-10 rounded-xl ${cat.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{cat.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
