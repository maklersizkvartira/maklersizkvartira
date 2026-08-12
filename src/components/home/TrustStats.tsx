import React from 'react';
import { ShieldCheck, UserCheck, ShieldAlert, CheckCircle } from 'lucide-react';

export const TrustStats: React.FC = () => {
  const stats = [
    {
      label: 'Verified Uy Egalari',
      value: '1,240+',
      sub: 'Pasport va kadastr bilan tasdiqlangan',
      icon: UserCheck,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      label: 'Bloklangan Makler va Firibgarlar',
      value: '840+',
      sub: 'AI anti-scam tizimi tomonidan aniqlangan',
      icon: ShieldAlert,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
    },
    {
      label: 'Faol E\'lonlar',
      value: '3,500+',
      sub: 'Barchasi AI riski past deb baholangan',
      icon: ShieldCheck,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      label: 'Muvaffaqiyatli Ijaralar',
      value: '2,100+',
      sub: 'Komissiyasiz va halol amalga oshirilgan',
      icon: CheckCircle,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
  ];

  return (
    <section className="bg-slate-900 text-white py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <h2 className="text-2xl font-black text-white">Platformadagi Ishonch Ko'rsatkichlari</h2>
          <p className="text-xs text-slate-400">
            Maklersiz.uz foydalanuvchilarining xavfsizligini ta'minlash uchun har kuni 24/7 rejimida AI va Moderatorlar ishlaydi.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="bg-slate-850 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-white tracking-tight">{stat.value}</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{stat.label}</div>
                  <div className="text-[11px] text-slate-400 mt-1">{stat.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
