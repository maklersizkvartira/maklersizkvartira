import React from 'react';
import { ShieldCheck, ArrowRight, CheckCircle2, Heart, Ban, Send, ExternalLink, ShieldAlert } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const Footer: React.FC = () => {
  const { setCurrentView } = useAppStore();

  return (
    <footer className="bg-slate-950 text-white border-t border-slate-800/80 w-full relative z-10">
      {/* MOBILE COMPACT FOOTER (sm:hidden) */}
      <div className="sm:hidden px-4 py-5 space-y-4 pb-24 text-center">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-md flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="MaklersizUy.uz" className="h-full w-full object-contain bg-white rounded-[10px] p-0.5" />
            </div>
            <span className="text-sm font-black tracking-tight text-white">
              Maklersiz<span className="text-emerald-400">Uy.uz</span>
            </span>
          </div>
          <a
            href="https://t.me/MaklersizUy_Support"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>💬 24/7 Support</span>
          </a>
        </div>
        <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
          <span>© 2026 MaklersizUy.uz</span>
          <span className="text-emerald-400 font-bold">0% Komissiya</span>
        </div>
      </div>

      {/* DESKTOP FULL FOOTER (hidden sm:block) */}
      <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8 w-full">
        {/* Verification Banner */}
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
                <Ban className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="font-black text-lg text-white leading-snug">
                  Makler yo'q. 0% Komissiya. 100% Xavfsiz.
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Kvartirani egasidan o'zingiz toping. Barcha e'lonlar AI va ShieldGuard tekshiruvidan o'tgan.
                </p>
              </div>
            </div>
            <button
              onClick={() => setCurrentView('VERIFICATION')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm px-6 py-3 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shrink-0"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Ishonchni Tekshirish</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-4 gap-6 text-xs pt-2">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-md flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="MaklersizUy.uz" className="h-full w-full object-contain bg-white rounded-[14px] p-1" />
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                Maklersiz<span className="text-emerald-400">Uy.uz</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              O'zbekistonda uy-joy ijarasini maklersiz, vositachisiz hamda to'g'ridan-to'g'ri egasidan topishga mo'ljallangan birinchi va eng yirik aqlli platforma.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 12 Viloyat
              </span>
              <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                0% Vositachilik
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">Tezkor Sahifalar</h4>
            <ul className="space-y-2 text-xs text-slate-400 font-medium">
              <li><button onClick={() => setCurrentView('SEARCH')} className="hover:text-emerald-400 transition-colors flex items-center gap-1">Kvartiralar katalogi</button></li>
              <li><button onClick={() => setCurrentView('VERIFICATION')} className="hover:text-emerald-400 transition-colors flex items-center gap-1">Verification markazi</button></li>
              <li><button onClick={() => setCurrentView('STUDENT_PROGRAM')} className="hover:text-emerald-400 transition-colors flex items-center gap-1">Talaba dasturi</button></li>
              <li><button onClick={() => setCurrentView('CREATE_LISTING')} className="hover:text-emerald-400 transition-colors flex items-center gap-1">E'lon joylash</button></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">Bizning Kafolat</h4>
            <ul className="space-y-2 text-xs text-slate-400 font-medium">
              <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Egasidan to'g'ridan-to'g'ri</li>
              <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Makler va firibgar filtri</li>
              <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />AI Trust Score tizimi</li>
              <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Talabalar uchun chegirmalar</li>
            </ul>
          </div>
        </div>

        {/* Telegram Support Section */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-md">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-base text-white">Qo'llab-quvvatlash Xizmati (Support 24/7)</div>
              <div className="text-xs text-slate-400 mt-0.5">Savollar, takliflar yoki e'loningiz bloklansa telegram orqali murojaat qiling</div>
            </div>
          </div>
          <a
            href="https://t.me/MaklersizUy_Support"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-black text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all shrink-0 active:scale-[0.98]"
          >
            <span>@MaklersizUy_Support</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Bottom copyright */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-500">
          <div>© 2026 MaklersizUy.uz platformasi. Barcha huquqlar himoyalangan.</div>
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <span>Made with</span>
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
            <span>for Uzbekistan</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
