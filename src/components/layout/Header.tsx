import React from 'react';
import { ShieldCheck, LogIn, User, MapPin } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { AuthModal } from '../auth/AuthModal';

export const Header: React.FC = () => {
  const { setCurrentView, currentView, currentUser, setShowAuth } = useAppStore();

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      <AuthModal />

      <div className="hidden sm:block bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-950 text-white text-[11px] py-1.5 px-4 font-bold border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span>🏠 MaklersizUy.uz — 0% Komissiya! Uy egasi va ijarachini to'g'ridan-to'g'ri bog'laydi.</span>
          <span className="text-emerald-400 font-mono">24/7 Qo'llab-quvvatlash: @MaklersizUy_Support</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
        <button onClick={() => setCurrentView('HOME')} className="flex items-center gap-2.5 shrink-0 min-w-0 group text-left">
          <div className="h-10 sm:h-11 w-10 sm:w-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform flex items-center justify-center shrink-0">
            <img 
              src="/logo.png" 
              alt="MaklersizUy.uz" 
              className="h-full w-full object-contain bg-white rounded-[14px] p-1" 
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-base sm:text-xl font-black tracking-tight text-slate-900 leading-none group-hover:text-emerald-600 transition-colors">
                Maklersiz<span className="text-emerald-600">Uy.uz</span>
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-300">
                0%
              </span>
            </div>
            <span className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase leading-none mt-1">
              Vositachisiz • Egasi
            </span>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-700">
          <button
            onClick={() => setCurrentView('HOME')}
            className={`hover:text-emerald-600 transition-colors ${currentView === 'HOME' ? 'text-emerald-600' : ''}`}
          >
            Bosh sahifa
          </button>
          <button
            onClick={() => setCurrentView('SEARCH')}
            className={`hover:text-emerald-600 transition-colors ${currentView === 'SEARCH' ? 'text-emerald-600' : ''}`}
          >
            Kvartiralar
          </button>
          <button
            onClick={() => setCurrentView('MAP')}
            className={`hover:text-emerald-600 transition-colors flex items-center gap-1.5 ${currentView === 'MAP' ? 'text-emerald-600 font-black' : ''}`}
          >
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Xarita</span>
          </button>

          {currentUser?.role === 'OWNER' ? (
            <>
              <button
                onClick={() => setCurrentView('MY_LISTINGS')}
                className={`hover:text-emerald-600 transition-colors ${currentView === 'MY_LISTINGS' ? 'text-emerald-600' : ''}`}
              >
                Mening e'lonlarim
              </button>
              <button
                onClick={() => setCurrentView('CREATE_LISTING')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-xl transition-colors text-xs flex items-center gap-1 shadow-sm"
              >
                + E'lon joylash
              </button>
            </>
          ) : (
            <button
              onClick={() => setCurrentView('STUDENT_PROGRAM')}
              className={`hover:text-emerald-600 transition-colors ${currentView === 'STUDENT_PROGRAM' ? 'text-emerald-600' : ''}`}
            >
              Talabalar uchun
            </button>
          )}
        </nav>

        {currentUser ? (
          <button
            onClick={() => setCurrentView('PROFILE')}
            className="flex items-center gap-2 bg-slate-100 text-slate-900 font-bold text-sm pl-1.5 pr-3 py-1 rounded-full max-w-[46%]"
          >
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <User className="w-4 h-4" />
              </span>
            )}
            <span className="truncate">{currentUser.name.split(' ')[0]}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setShowAuth(true, 'LOGIN')}
              className="text-slate-800 hover:bg-slate-100 font-bold text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-slate-300 transition-colors flex items-center gap-1"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              <span>Kirish</span>
            </button>
            <button
              onClick={() => setShowAuth(true, 'REGISTER')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1 shrink-0"
            >
              <span>Ro'yxatdan o'tish</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
