import React, { useState } from 'react';
import { 
  ShieldCheck, Search, PlusCircle, Heart, MessageSquare, 
  Award, Shield, BookOpen, Layers, ChevronDown, LogIn
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { AuthModal } from '../auth/AuthModal';

export const Header: React.FC = () => {
  const { 
    currentView, setCurrentView, 
    currentRole, setCurrentRole,
    searchQuery, setSearchQuery,
    userXp, favorites,
    verifications, reports
  } = useAppStore();

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const pendingAdminCount = verifications.filter((v) => v.status === 'PENDING').length + reports.filter((r) => r.status === 'OPEN').length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setCurrentView('SEARCH');
    }
  };

  const roleLabel =
    currentRole === 'TENANT' ? 'Tenant' :
    currentRole === 'OWNER' ? 'Owner' : 'Admin';
  const roleEmoji =
    currentRole === 'TENANT' ? '👤' :
    currentRole === 'OWNER' ? '🏠' : '🛡️';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm w-full">
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Top Banner */}
      <div className="bg-slate-900 text-white text-xs py-1.5 px-3 sm:px-4 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="bg-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
              AI Powered 🛡️
            </span>
            <span className="text-slate-300 text-[11px] truncate hidden sm:inline">
              O'zbekistonning birinchi AI va Trust Score bilan himoyalangan maklersiz platformasi
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-slate-300 text-[10px] sm:text-[11px] shrink-0">
            <button 
              onClick={() => setCurrentView('STUDENT_PROGRAM')}
              className="hidden sm:flex hover:text-emerald-400 font-medium items-center gap-1 transition-colors"
            >
              <BookOpen className="w-3 h-3 text-amber-400" /> Talabalar Moduli
            </button>
            <button 
              onClick={() => setCurrentView('REFERRAL')}
              className="hover:text-emerald-400 font-medium flex items-center gap-1 transition-colors"
            >
              <Award className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="hidden xs:inline">Trust XP</span>
              <span>({userXp})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 w-full min-w-0">
        <div 
          onClick={() => setCurrentView('HOME')}
          className="flex items-center gap-2 cursor-pointer group shrink-0 min-w-0"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white shadow-emerald shadow-md group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-4.5 h-4.5 sm:w-6 sm:h-6 w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] sm:text-xl font-black text-slate-900 tracking-tight leading-none">
              Maklersiz<span className="text-emerald-600">.uz</span>
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium tracking-wide mt-0.5 hidden sm:block">
              Egasidan Halol Ijara
            </div>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tuman, metro yoki universitet bo'yicha qidiring..."
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        </form>

        <div className="flex items-center gap-0.5 sm:gap-3 shrink-0">
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-700">
            <button
              onClick={() => setCurrentView('SEARCH')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${currentView === 'SEARCH' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'hover:bg-slate-100'}`}
            >
              Kvartiralar
            </button>
            <button
              onClick={() => setCurrentView('VERIFICATION')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${currentView === 'VERIFICATION' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'hover:bg-slate-100'}`}
            >
              <Shield className="w-4 h-4 text-emerald-600" /> Verification
            </button>
            <button
              onClick={() => setCurrentView('ECOSYSTEM_PREVIEW')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${currentView === 'ECOSYSTEM_PREVIEW' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'hover:bg-slate-100'}`}
            >
              <Layers className="w-4 h-4 text-indigo-600" /> Ekotizim
            </button>
          </nav>

          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 sm:px-3 rounded-full shadow-sm transition-colors"
            title="Kirish"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Kirish</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] sm:text-xs font-semibold p-2 sm:px-2.5 sm:py-1.5 rounded-full border border-slate-300 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 hidden sm:inline-block"></span>
              <span className="sm:hidden text-sm leading-none">{roleEmoji}</span>
              <span className="hidden sm:inline truncate">
                {roleEmoji} {roleLabel}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Rejimni Tanlang
                </div>
                <button
                  onClick={() => { setCurrentRole('TENANT'); setShowRoleDropdown(false); setCurrentView('HOME'); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 flex items-center gap-2 text-slate-700"
                >
                  <span>👤</span> Tenant (Ijarachi)
                </button>
                <button
                  onClick={() => { setCurrentRole('OWNER'); setShowRoleDropdown(false); setCurrentView('CREATE_LISTING'); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 flex items-center gap-2 text-slate-700"
                >
                  <span>🏠</span> Owner (Uy Egasi)
                </button>
                <button
                  onClick={() => { setCurrentRole('ADMIN'); setShowRoleDropdown(false); setCurrentView('ADMIN'); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 text-emerald-800 font-bold flex items-center gap-2 border-t border-slate-100"
                >
                  <span>🛡️</span> Admin Control Center
                  {pendingAdminCount > 0 && (
                    <span className="ml-auto bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {pendingAdminCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setCurrentView('FAVORITES')}
            className="relative p-2 text-slate-600 hover:text-rose-600 hover:bg-slate-100 rounded-full transition-colors"
            title="Saralanganlar"
          >
            <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
            {favorites.length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentView('CHAT')}
            className="relative p-2 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-full transition-colors"
            title="Xabarlar"
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
          </button>

          <button
            onClick={() => setCurrentView('CREATE_LISTING')}
            className="hidden sm:flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs px-3.5 py-2 rounded-full shadow-md shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>E'lon Berish</span>
          </button>
        </div>
      </div>
    </header>
  );
};
