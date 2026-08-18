import React from 'react';
import { ShieldCheck, LogIn, User } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { AuthModal } from '../auth/AuthModal';

export const Header: React.FC = () => {
  const { setCurrentView, currentView, currentUser, setShowAuth } = useAppStore();

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <AuthModal />

      <div className="hidden sm:block bg-slate-900 text-white text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto font-medium">
          Makler yo'q. Komissiya yo'q. Kvartirani egasidan o'zingiz toping.
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
        <button onClick={() => setCurrentView('HOME')} className="flex items-center gap-2 shrink-0 min-w-0 group text-left">
          <img src="/logo.png" alt="MaklersizUy.uz" className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-[1.02]" />
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
