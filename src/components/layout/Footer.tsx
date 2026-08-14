import React from 'react';
import { 
  ShieldCheck, ArrowRight, CheckCircle2, Heart 
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const Footer: React.FC = () => {
  const { setCurrentView } = useAppStore();

  return (
    <footer className="bg-slate-950 text-white pt-10 pb-24 md:pb-12 border-t border-slate-800/80 w-full max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-8 w-full">
        
        {/* Anti-Scam Sleek Banner */}
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border border-emerald-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 w-full backdrop-blur-md">
          <div className="flex items-center gap-3 text-left w-full md:w-auto">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="font-black text-xs sm:text-base text-white flex items-center gap-1.5 flex-wrap">
                <span>Shield AI Anti-Scam Kafolati</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                  100% Halol
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                Plastik kartangizga oldindan pul o'tkazmang! Barcha e'lonlar AI skaneridan o'tadi.
              </p>
            </div>
          </div>

          <button
            onClick={() => setCurrentView('VERIFICATION')}
            className="w-full md:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs px-5 py-2.5 sm:py-3 rounded-xl shadow-lg shadow-emerald-600/30 shrink-0 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
          >
            <span>Verificationdan O'tish</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2x2 Grid for Mobile (clean and compact) */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 w-full text-xs">
          
          {/* Col 1: Platform Mission */}
          <div className="col-span-2 sm:col-span-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-base font-black tracking-tight">
                Maklersiz<span className="text-emerald-400">.uz</span>
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
              O'zbekistonda uyni egasidan ijaraga olish uchun birinchi AI platformasi. 0% komissiya.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>O'zbekistonning 12 viloyatida</span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Sahifalar</h4>
            <ul className="space-y-1.5 text-[11px] text-slate-300 font-medium">
              <li>
                <button onClick={() => setCurrentView('SEARCH')} className="hover:text-emerald-400 transition-colors">
                  Kvartiralar Qidiruvi
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('VERIFICATION')} className="hover:text-emerald-400 transition-colors">
                  5-Bosqich Verification
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('STUDENT_PROGRAM')} className="hover:text-emerald-400 transition-colors">
                  Talabalar Moduli
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('REFERRAL')} className="hover:text-emerald-400 transition-colors">
                  Referral & XP
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Future Ecosystem (Readme-7) */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Roadmap</h4>
            <ul className="space-y-1.5 text-[11px] text-slate-300 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Stage 1: Marketplace</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                <span>Stage 2: RentPay</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>Stage 3: Moving</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Stage 4: Mortgage</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact & Socials */}
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Bog'lanish</h4>
            <p className="text-[11px] text-slate-400">
              Shield AI qo'llab-quvvatlash markazi 24/7 xizmatda.
            </p>
            <div className="pt-1 flex flex-wrap gap-1.5">
              <span className="bg-slate-900 text-slate-300 text-[10px] font-mono px-2.5 py-1 rounded-md border border-slate-800">
                TG: @maklersiz_support
              </span>
              <span className="bg-slate-900 text-slate-300 text-[10px] font-mono px-2.5 py-1 rounded-md border border-slate-800">
                Email: info@maklersiz.uz
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Disclaimer */}
        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 text-center sm:text-left w-full">
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
