import React from 'react';
import { 
  Layers, FileText, CreditCard, Truck, Sofa, Wrench, 
  Building2, Sparkles, CheckCircle2, ShieldCheck, ArrowRight 
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const EcosystemPreviewPage: React.FC = () => {
  const { setCurrentView } = useAppStore();

  const stages = [
    {
      stage: 'STAGE 1',
      status: 'Hozir Faol ✅',
      title: 'Rental Marketplace & AI Trust',
      desc: 'Maklersiz kvartira qidirish, 100% AI verification, Trust Score, 5-bosqichli owner tasdiqlash.',
      icon: ShieldCheck,
      color: 'bg-emerald-600 text-white',
      badge: 'Active MVP',
    },
    {
      stage: 'STAGE 2',
      status: 'Jarayonda 🚀',
      title: 'Digital Rental Profile & Tenant Reputation',
      desc: 'Ijarachi va Uy egasi uchun ikki tomonlama obro\' (reputation) va ishonch profili.',
      icon: FileText,
      color: 'bg-blue-600 text-white',
      badge: 'Coming Soon',
    },
    {
      stage: 'STAGE 3',
      status: 'Rejalashtirilgan ⚖️',
      title: 'Digital Agreement & RentPay',
      desc: 'Platforma ichida huquqiy elektron ijara shartnomasi va kafolatlangan depozit to\'lovlari.',
      icon: CreditCard,
      color: 'bg-indigo-600 text-white',
      badge: 'Qashqadaryo/Toshkent test',
    },
    {
      stage: 'STAGE 4',
      status: 'Kelajakdagi Ekotizim 🚚',
      title: 'Moving, Furniture & Home Services',
      desc: 'Ko\'chirish brigadalari, mebel marketplace, tozalash va internet ulash hamkorlik xizmatlari.',
      icon: Truck,
      color: 'bg-teal-600 text-white',
      badge: 'Ecosystem',
    },
    {
      stage: 'STAGE 5',
      status: 'Vision 🏦',
      title: 'Mortgage & Property Super App',
      desc: 'Banklar bilan ipoteka taqqoslash va ko\'chmas mulk sotib olish platformasi.',
      icon: Building2,
      color: 'bg-amber-500 text-white',
      badge: 'Super App',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 min-h-[85vh] space-y-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-3.5 py-1 rounded-full border border-indigo-200">
          <Layers className="w-3.5 h-3.5 text-indigo-600" /> Company Roadmap & Ecosystem Vision
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Maklersiz.uz — Property Super App Viziyasi
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Oddiy e'lonlar saytidan O'zbekistondagi eng yirik ko'chmas mulk va yashash xizmatlari ekotizimiga aylanish yo'l xaritasi.
        </p>
      </div>

      {/* Stage Roadmap Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          return (
            <div
              key={idx}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card flex flex-col justify-between space-y-4 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-400">{st.stage}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {st.badge}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl ${st.color} flex items-center justify-center shrink-0 shadow-md`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">{st.title}</h3>
                  <span className="text-[11px] font-semibold text-emerald-700">{st.status}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{st.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Interactive Try Button */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl text-center space-y-4 max-w-2xl mx-auto shadow-2xl">
        <Sparkles className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
        <h3 className="text-xl font-bold">Hozirgi MVP Versiyani Sınab Ko'ring</h3>
        <p className="text-xs text-slate-300">
          Kvartira izlang, verification'dan o'ting yoki e'lon bering!
        </p>
        <button
          onClick={() => setCurrentView('SEARCH')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-8 py-3 rounded-xl shadow-lg transition-transform hover:scale-105"
        >
          Kvartiralar Qidiruviga O'tish ➔
        </button>
      </div>
    </div>
  );
};
