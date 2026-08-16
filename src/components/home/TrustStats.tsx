import React from 'react';
import { ShieldCheck, UserCheck, ShieldAlert, Ban } from 'lucide-react';

export const TrustStats: React.FC = () => {
  const stats = [
    {
      label: 'Tasdiqlangan egalar',
      value: '1,240+',
      sub: 'Pasport va kadastr',
      icon: UserCheck,
      color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
    },
    {
      label: "Maklerlar to'sildi",
      value: '840+',
      sub: 'AI aniqlagan vositachilar',
      icon: ShieldAlert,
      color: 'text-rose-400 bg-rose-950/60 border-rose-500/30',
    },
    {
      label: 'Faol e\'lonlar',
      value: '3,500+',
      sub: 'Komissiyasiz kvartiralar',
      icon: ShieldCheck,
      color: 'text-blue-400 bg-blue-950/60 border-blue-500/30',
    },
    {
      label: '0% vositachilik',
      value: '2,100+',
      sub: 'Egasidan to\'g\'ridan-to\'g\'ri',
      icon: Ban,
      color: 'text-amber-400 bg-amber-950/60 border-amber-500/30',
    },
  ];

  return (
    <section className="bg-slate-950 text-white py-8 sm:py-12 px-3 sm:px-6 w-full">
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1.5 px-1">
          <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-snug">
            Maklersiz ijara, ishonch bilan
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
            Odamlarga kvartirani o'zi mustaqil topish uchun makler va firibgarlarni tizimdan chiqaramiz.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 w-full">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="bg-slate-900/90 p-3 sm:p-5 rounded-2xl border border-slate-800 flex flex-col justify-between"
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center mb-2 sm:mb-3 ${stat.color}`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <div className="text-xl sm:text-3xl font-black text-white tracking-tight">{stat.value}</div>
                  <div className="text-[11px] sm:text-sm font-extrabold text-slate-200 mt-0.5 leading-snug">{stat.label}</div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 leading-snug">{stat.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
