import React from 'react';
import { 
  ShieldCheck, Layers, ArrowRight, CheckCircle2, Lock, 
  ExternalLink, Sparkles, Heart 
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const Footer: React.FC = () => {
  const { setCurrentView } = useAppStore();

  return (
    <footer className="bg-slate-900 text-white pt-12 pb-24 md:pb-12 border-t border-slate-800 w-full max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10 w-full">
        {/* Anti-Scam Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border border-emerald-500/30 rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3 text-left w-full md:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2 flex-wrap">
                <span>Shield AI Anti-Scam Kafolati</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                  100% Halol
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Plastik kartangizga oldindan pul o'tkazmang! Barcha e'lonlar AI va pHash skaneridan o'tadi.
              </p>
            </div>
          </div>

          <button
            onClick={() => setCurrentView('VERIFICATION')}
            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg shadow-emerald-600/30 shrink-0 transition-transform hover:scale-105 flex items-center justify-center gap-1.5"
          >
            <span>Verificationdan O'tish</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Stacked Columns on Mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
          {/* Col 1: Platform Mission */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-lg font-black tracking-tight">
                Maklersiz<span className="text-emerald-400">.uz</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              O'zbekistonda uyni to'g'ridan-to'g'ri egasidan ijaraga olish uchun birinchi AI va Trust Score platformasi. 0% makler komissiyasi.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>O'zbekistonning 12 viloyatida faol</span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Platforma Sahifalari</h4>
            <ul className="space-y-2 text-xs text-slate-300 font-medium">
              <li>
                <button onClick={() => setCurrentView('SEARCH')} className="hover:text-emerald-400 transition-colors">
                  Kvartiralar Qidiruvi
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('VERIFICATION')} className="hover:text-emerald-400 transition-colors">
                  5-Bosqichli Verification
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('STUDENT_PROGRAM')} className="hover:text-emerald-400 transition-colors">
                  Talabalar Uy Qidiruv Moduli
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('REFERRAL')} className="hover:text-emerald-400 transition-colors">
                  Referral va Trust XP Tizimi
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('CREATE_LISTING')} className="hover:text-emerald-400 transition-colors">
                  E'lon Berish (Uy Egalari uchun)
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Future Ecosystem (Readme-7) */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Ekotizim (Roadmap)</h4>
            <ul className="space-y-2 text-xs text-slate-300 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Stage 1: Rental Marketplace (Faol)</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>Stage 2: Digital Agreement & RentPay</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Stage 3: Moving & Furniture Services</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Stage 4: Mortgage & Property Sale</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact & Socials */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Bog'lanish va Qo'llab-quvvatlash</h4>
            <p className="text-xs text-slate-300">
              Savollaringiz bormi? Shield AI qo'llab-quvvatlash markazi 24/7 xizmatda.
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              <span className="bg-slate-800 text-slate-300 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-slate-700">
                Telegram: @maklersiz_support
              </span>
              <span className="bg-slate-800 text-slate-300 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-slate-700">
                Email: info@maklersiz.uz
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Disclaimer */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-left w-full">
          <div>
            © 2026 Maklersiz.uz. Barcha huquqlar himoyalangan.
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>for Uzbekistan</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
