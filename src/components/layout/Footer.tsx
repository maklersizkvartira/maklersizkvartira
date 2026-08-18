import React from 'react';
import { ShieldCheck, ArrowRight, CheckCircle2, Heart, Ban, Send, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const Footer: React.FC = () => {
  const { setCurrentView } = useAppStore();

  return (
    <footer className="bg-slate-950 text-white pt-8 sm:pt-10 pb-28 md:pb-12 border-t border-slate-800 w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-6 sm:space-y-8 w-full">

        <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 border border-emerald-500/25 rounded-2xl p-4 sm:p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Ban className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-sm sm:text-base text-white leading-snug">
                Makler yo'q. Komissiya yo'q.
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed">
                Kvartirani egasidan o'zingiz toping. Pulni oldindan kartaga o'tkazmang, barcha e'lonlar AI tekshiruvidan o'tadi.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentView('VERIFICATION')}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all"
          >
            Ishonchni tekshirish
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:gap-8 text-xs">
          <div className="col-span-2 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-base font-black tracking-tight">
                Maklersiz<span className="text-emerald-400">.uz</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              O'zbekistonda uy-joy ijarasini maklersiz, to'g'ridan-to'g'ri egasidan topish platformasi.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              12 viloyat • 0% komissiya
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Sahifalar</h4>
            <ul className="space-y-1.5 text-[11px] text-slate-300 font-medium">
              <li><button onClick={() => setCurrentView('SEARCH')} className="hover:text-emerald-400">Kvartiralar</button></li>
              <li><button onClick={() => setCurrentView('VERIFICATION')} className="hover:text-emerald-400">Verification</button></li>
              <li><button onClick={() => setCurrentView('STUDENT_PROGRAM')} className="hover:text-emerald-400">Talabalar</button></li>
              <li><button onClick={() => setCurrentView('CREATE_LISTING')} className="hover:text-emerald-400">E'lon berish</button></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Nega biz?</h4>
            <ul className="space-y-1.5 text-[11px] text-slate-300 font-medium">
              <li>Egasidan to'g'ridan-to'g'ri</li>
              <li>Makler va firibgar filtri</li>
              <li>AI Trust Score</li>
              <li>0% vositachilik</li>
            </ul>
          </div>
        </div>

        {/* Telegram Support Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">Qo'llab-quvvatlash Xizmati (Support 24/7)</div>
              <div className="text-xs text-slate-400 mt-0.5">Savollar, takliflar yoki e'loningiz AI tomonidan to'silsa murojaat qiling</div>
            </div>
          </div>
          <a
            href="https://t.me/MaklersizUy_Support"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all shrink-0 active:scale-[0.98]"
          >
            <span>@MaklersizUy_Support</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="pt-4 border-t border-slate-800 flex flex-col items-center gap-2 text-[11px] text-slate-500 text-center">
          <div>© 2026 Maklersiz.uz</div>
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
