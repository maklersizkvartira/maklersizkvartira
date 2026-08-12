import React from 'react';
import { ShieldCheck, Heart, Award, Sparkles, BookOpen, Layers } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const Footer: React.FC = () => {
  const { setCurrentView } = useAppStore();

  return (
    <footer className="bg-slate-900 text-white pt-12 pb-24 md:pb-12 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand & Vision */}
        <div className="space-y-4 md:col-span-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-lg font-black tracking-tight">
              Maklersiz<span className="text-emerald-400">.uz</span>
            </span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            O'zbekistonda kvartira topish jarayonini xavfsiz, tez va maklersiz qilish uchun qurilgan AI bilan kuchaytirilgan rental platformasi.
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Ishonch brendi & Premium Trust Score</span>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="font-bold text-sm text-slate-200 mb-3 uppercase tracking-wider">Navigatsiya</h4>
          <ul className="space-y-2 text-xs text-slate-400">
            <li>
              <button onClick={() => setCurrentView('SEARCH')} className="hover:text-emerald-400 transition-colors">
                Barcha Kvartiralar
              </button>
            </li>
            <li>
              <button onClick={() => setCurrentView('STUDENT_PROGRAM')} className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-amber-400" /> Talabalar Moduli (TATU, INHA, WIUT)
              </button>
            </li>
            <li>
              <button onClick={() => setCurrentView('VERIFICATION')} className="hover:text-emerald-400 transition-colors">
                5-Bosqichli Verification
              </button>
            </li>
            <li>
              <button onClick={() => setCurrentView('REFERRAL')} className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                <Award className="w-3 h-3 text-emerald-400" /> Referral & Trust XP
              </button>
            </li>
          </ul>
        </div>

        {/* Ecosystem & Stage Preview */}
        <div>
          <h4 className="font-bold text-sm text-slate-200 mb-3 uppercase tracking-wider">Property Super App</h4>
          <ul className="space-y-2 text-xs text-slate-400">
            <li>
              <button onClick={() => setCurrentView('ECOSYSTEM_PREVIEW')} className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-400" /> Digital Rental Agreement
              </button>
            </li>
            <li>
              <button onClick={() => setCurrentView('ECOSYSTEM_PREVIEW')} className="hover:text-emerald-400 transition-colors">
                RentPay & Depozit Himoyasi
              </button>
            </li>
            <li>
              <button onClick={() => setCurrentView('ECOSYSTEM_PREVIEW')} className="hover:text-emerald-400 transition-colors">
                Moving & Home Services
              </button>
            </li>
            <li>
              <button onClick={() => setCurrentView('ECOSYSTEM_PREVIEW')} className="hover:text-emerald-400 transition-colors">
                Mortgage Marketplace (Stage 5)
              </button>
            </li>
          </ul>
        </div>

        {/* Safety & Contact */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Xavfsizlik Tizimi</h4>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-xs space-y-1.5 text-slate-300">
            <div className="font-semibold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> 100% Anti-Scam Shield
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Barcha rasmlar hashing (pHash) orqali tekshiriladi va maklerlik harakatlari avtomatik bloklanadi.
            </p>
          </div>
          <div className="text-[11px] text-slate-500">
            © 2026 Maklersiz.uz. Barcha huquqlar himoyalangan.
          </div>
        </div>
      </div>
    </footer>
  );
};
