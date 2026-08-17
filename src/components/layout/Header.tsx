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
        <button onClick={() => setCurrentView('HOME')} className="flex items-center gap-2 shrink-0 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-left min-w-0">
            <div className="text-[15px] sm:text-xl font-black text-slate-900 leading-none truncate">
              Maklersiz<span className="text-emerald-600">.uz</span>
            </div>
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
          <button
            onClick={() => setShowAuth(true)}
            className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold text-sm px-4 py-2 rounded-full"
          >
            <LogIn className="w-4 h-4" />
            Kirish
          </button>
        )}
      </div>
    </header>
  );
};
