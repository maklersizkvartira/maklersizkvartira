import React, { useState } from 'react';
import { ShieldCheck, UserCheck, ShieldAlert, Ban, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

export const TrustStats: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

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
    <section className="bg-slate-950 text-white py-4 sm:py-6 px-3 sm:px-6 w-full border-t border-slate-800">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Expandable Ko'rsatkichlar Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3 transition-colors shadow-md group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-sm sm:text-base font-black text-white truncate">Platforma Ko'rsatkichlari</div>
              <div className="text-xs text-slate-400 truncate">1,240+ tasdiqlangan egalar • 0% vositachilik</div>
            </div>
          </div>
          <div className="bg-slate-800 text-slate-300 group-hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0">
            <span>{isExpanded ? "Yopish" : "Ko'rish"}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="space-y-5 animate-in fade-in-50 duration-300 pt-2">
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
                const Icon = stat?.icon || ShieldCheck;
                return (
                  <div
                    key={idx}
                    className="bg-slate-900/90 p-3.5 sm:p-5 rounded-2xl border border-slate-800 flex flex-col justify-between"
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
        )}
      </div>
    </section>
  );
};
