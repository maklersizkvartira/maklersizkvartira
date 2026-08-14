import React from 'react';
import { ShieldCheck, UserCheck, ShieldAlert, CheckCircle } from 'lucide-react';

export const TrustStats: React.FC = () => {
  const stats = [
    {
      label: 'Verified Uy Egalari',
      value: '1,240+',
      sub: 'Pasport & kadastr bilan',
      icon: UserCheck,
      color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
    },
    {
      label: 'Bloklangan Maklerlar',
      value: '840+',
      sub: 'AI aniqlagan firibgarlar',
      icon: ShieldAlert,
      color: 'text-rose-400 bg-rose-950/60 border-rose-500/30',
    },
    {
      label: 'Faol E\'lonlar',
      value: '3,500+',
      sub: 'AI riski past deb baholangan',
      icon: ShieldCheck,
      color: 'text-blue-400 bg-blue-950/60 border-blue-500/30',
    },
    {
      label: 'Komissiyasiz Ijaralar',
      value: '2,100+',
      sub: 'Halol va bevosita ijara',
      icon: CheckCircle,
      color: 'text-amber-400 bg-amber-950/60 border-amber-500/30',
    },
  ];

  return (
    <section className="bg-slate-950 text-white py-8 sm:py-12 px-3 sm:px-6 w-full max-w-full overflow-x-hidden border-y border-slate-850">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1.5 px-2">
          <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">Platformadagi Ishonch Ko'rsatkichlari</h2>
          <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
            Maklersiz.uz foydalanuvchilarining xavfsizligini ta'minlash uchun har kuni 24/7 AI va Moderatorlar ishlaydi.
          </p>
        </div>

        {/* Compact 2x2 Grid for Mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 w-full">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="bg-slate-900/90 p-3.5 sm:p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-sm"
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center mb-2 sm:mb-3 ${stat.color}`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <div className="text-xl sm:text-3xl font-black text-white tracking-tight">{stat.value}</div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-200 mt-0.5 leading-snug">{stat.label}</div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">{stat.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
