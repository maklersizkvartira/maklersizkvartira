import React from 'react';
import { Phone, Send, Headphones, Heart } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const Footer: React.FC = () => {
  const { setCurrentView, setFilters } = useAppStore();

  return (
    <footer className="bg-[#181a20] text-slate-300 border-t border-slate-800 w-full relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12 w-full">
        {/* Main Grid: 2-column on mobile, 4-column on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6 sm:gap-8 text-xs sm:text-sm">
          {/* Column 1: Logo, Social Icons & Phone Numbers (Full width on mobile) */}
          <div className="col-span-2 sm:col-span-1 space-y-3 pb-2 sm:pb-0 border-b sm:border-b-0 border-slate-800">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <img src="/logo.png" alt="MaklersizUy.uz" className="h-8 sm:h-10 w-auto object-contain bg-white rounded-lg p-1 shadow-md" />
              <div className="flex items-center gap-2">
                <a
                  href="https://t.me/MaklersizUy_Support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 hover:bg-blue-600 text-white flex items-center justify-center transition-colors border border-slate-700 shadow-inner"
                  title="Telegram"
                >
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 hover:bg-pink-600 text-white flex items-center justify-center transition-colors border border-slate-700 shadow-inner"
                  title="Instagram"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-col gap-3 sm:gap-2 pt-1 font-medium text-slate-200 text-xs sm:text-sm">
              <a
                href="tel:+998937188885"
                className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors group"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="font-mono tracking-wide">+998 (93) 718-88-85</span>
              </a>

              <a
                href="tel:+998700797237"
                className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors group"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="font-mono tracking-wide">+998 (70) 079-72-37</span>
              </a>
            </div>
          </div>

          {/* Column 2: Platforma */}
          <div className="space-y-2 sm:space-y-3">
            <h4 className="text-xs sm:text-base font-bold text-white tracking-wide uppercase sm:normal-case">Platforma</h4>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-400 font-medium">
              <li>
                <button onClick={() => setCurrentView('HOME')} className="hover:text-white transition-colors text-left">
                  Biz haqimizda
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('STUDENT_PROGRAM')} className="hover:text-white transition-colors text-left">
                  Hamkorlik
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('VERIFICATION')} className="hover:text-white transition-colors text-left">
                  Maxfiylik siyosati
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('PROFILE')} className="hover:text-white transition-colors text-left">
                  Hisobni o'chirish
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Ko'chmas Mulk Ijarasi */}
          <div className="space-y-2 sm:space-y-3">
            <h4 className="text-xs sm:text-base font-bold text-white tracking-wide uppercase sm:normal-case">Mulk ijarasi</h4>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-400 font-medium">
              <li>
                <button onClick={() => { setFilters({ rentalType: 'FULL' }); setCurrentView('SEARCH'); }} className="hover:text-white transition-colors text-left">
                  Kvartira
                </button>
              </li>
              <li>
                <button onClick={() => { setFilters({ rentalType: 'ROOMMATE' }); setCurrentView('SEARCH'); }} className="hover:text-white transition-colors text-left">
                  Sherikchilikka
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('SEARCH')} className="hover:text-white transition-colors text-left">
                  Uy / Hovli
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('SEARCH')} className="hover:text-white transition-colors text-left">
                  Yer uchastkasi
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Ijara Turlari */}
          <div className="col-span-2 sm:col-span-1 space-y-2 sm:space-y-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            <h4 className="text-xs sm:text-base font-bold text-white tracking-wide uppercase sm:normal-case">Ijara turlari</h4>
            <ul className="grid grid-cols-2 sm:grid-cols-1 gap-1.5 text-xs sm:text-sm text-slate-400 font-medium">
              <li>
                <button onClick={() => setCurrentView('SEARCH')} className="hover:text-white transition-colors text-left">
                  Oylik ijara
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('STUDENT_PROGRAM')} className="hover:text-white transition-colors text-left">
                  Talabalar uchun
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('SEARCH')} className="hover:text-white transition-colors text-left">
                  Kunlik ijara
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('SEARCH')} className="hover:text-white transition-colors text-left">
                  Dacha / Hujra
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright */}
        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pb-16 sm:pb-0">
          <div>© 2026 MaklersizUy.uz platformasi. Barcha huquqlar himoyalangan.</div>
          <div className="flex items-center gap-1.5 text-slate-400 font-medium">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
            <span>for Uzbekistan</span>
          </div>
        </div>
      </div>

      {/* Floating Support Headset Button */}
      <a
        href="https://t.me/MaklersizUy_Support"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 bg-blue-600 hover:bg-blue-500 text-white p-3.5 rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
        title="24/7 Support boti bilan bog'lanish"
      >
        <Headphones className="w-6 h-6" />
      </a>
    </footer>
  );
};
