import React, { useState } from 'react';
import { 
  ShieldCheck, LogIn, User, MapPin, Menu, X, Home, Search, MessageSquare, 
  PlusCircle, List, GraduationCap, LogOut, ChevronDown, Sparkles, Award, Phone,
  Heart, Layers, Handshake, Users, TrainFront, TrendingDown, Building2
} from 'lucide-react';
import { useAppStore, ViewState } from '../../stores/useAppStore';
import { AuthModal } from '../auth/AuthModal';

export const Header: React.FC = () => {
  const { 
    setCurrentView, currentView, currentUser, setShowAuth, logout, userXp,
    favorites, setFilters
  } = useAppStore();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCatMenu, setShowCatMenu] = useState(false);

  const xpVal = userXp || 120;
  const level = Math.floor(xpVal / 100) + 1;
  const xpInLevel = xpVal % 100;

  const navTo = (view: ViewState) => {
    setCurrentView(view);
    setShowSidebar(false);
    setShowCatMenu(false);
  };

  const handleLogout = () => {
    logout();
    setShowSidebar(false);
    setCurrentView('HOME');
  };

  const categoryItems = [
    {
      name: 'Sheriklikka',
      desc: 'Talaba va ijarachiga sherik',
      icon: Handshake,
      color: 'text-amber-500 bg-amber-50',
      action: () => {
        setFilters({ rentalType: 'ROOMMATE' });
        navTo('SEARCH');
      }
    },
    {
      name: 'Talabalar uchun',
      desc: 'OTMlar va OOTV yaqinida',
      icon: GraduationCap,
      color: 'text-blue-500 bg-blue-50',
      action: () => {
        setFilters({ audience: 'STUDENT' });
        navTo('SEARCH');
      }
    },
    {
      name: 'Oilalar uchun',
      desc: '2-3 xonali shinam uylar',
      icon: Users,
      color: 'text-emerald-500 bg-emerald-50',
      action: () => {
        setFilters({ roomsCount: 2 });
        navTo('SEARCH');
      }
    },
    {
      name: 'Metro yaqinida',
      desc: "1-5 daqiqa piyoda yo'l",
      icon: TrainFront,
      color: 'text-indigo-500 bg-indigo-50',
      action: () => {
        setFilters({ selectedMetro: 'Yunusobod' });
        navTo('SEARCH');
      }
    },
    {
      name: 'Arzon uylar',
      desc: 'Hamyonbop ijara narxlari',
      icon: TrendingDown,
      color: 'text-rose-500 bg-rose-50',
      action: () => {
        setFilters({ maxPrice: 4000000 });
        navTo('SEARCH');
      }
    },
    {
      name: 'Premium uylar',
      desc: 'Evroremont, jihozlangan',
      icon: Sparkles,
      color: 'text-purple-500 bg-purple-50',
      action: () => {
        setFilters({ minTrustScore: 90 });
        navTo('SEARCH');
      }
    },
  ];

  const districts = ['Chilonzor', 'Yunusobod', "Mirzo Ulug'bek", 'Yakkasaroy', 'Shayxontohur', 'Sergeli'];

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-slate-950 text-white border-b border-slate-800/80 shadow-lg">
      <AuthModal />

      {/* Top Notification Bar */}
      <div className="hidden sm:block bg-slate-900/90 text-slate-300 text-[11px] py-1.5 px-4 font-bold border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            MaklersizUy.uz — 0% Komissiya! Egasidan to'g'ridan-to'g'ri ijara va xonadosh topish.
          </span>
          <span className="text-emerald-400 font-mono">24/7 Qo'llab-quvvatlash: @MaklersizUy_Support</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo */}
        <button onClick={() => setCurrentView('HOME')} className="flex items-center gap-2 shrink-0 min-w-0 group text-left">
          <span className="text-lg sm:text-2xl font-black tracking-tighter text-white">
            MAKLERSIZ<span className="text-emerald-400">UY</span>
          </span>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7 text-xs sm:text-sm font-bold text-slate-300 relative">
          <button
            onClick={() => setCurrentView('HOME')}
            className={`hover:text-emerald-400 transition-colors ${currentView === 'HOME' ? 'text-emerald-400 font-black' : ''}`}
          >
            Bosh sahifa
          </button>
          <button
            onClick={() => setCurrentView('SEARCH')}
            className={`hover:text-emerald-400 transition-colors ${currentView === 'SEARCH' ? 'text-emerald-400 font-black' : ''}`}
          >
            Ijaraga olish
          </button>

          {/* Interactive Categories Dropdown Trigger */}
          <div
            className="relative"
            onMouseEnter={() => setShowCatMenu(true)}
            onMouseLeave={() => setShowCatMenu(false)}
          >
            <button
              type="button"
              onClick={() => setShowCatMenu((v) => !v)}
              className="flex items-center gap-1 hover:text-emerald-400 transition-colors py-2"
            >
              <span>Kategoriyalar</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showCatMenu ? 'rotate-180 text-emerald-400' : ''}`} />
            </button>

            {/* Categories Dropdown Popover */}
            {showCatMenu && (
              <div className="absolute top-full left-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-900 p-3 space-y-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] font-black text-slate-400 uppercase px-2 tracking-wider">
                  Bo'limni tanlang
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {categoryItems.map((cat, idx) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={idx}
                        onClick={cat.action}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 group"
                      >
                        <div className={`w-8 h-8 rounded-lg ${cat.color} flex items-center justify-center shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-slate-800 group-hover:text-emerald-600 transition-colors">
                            {cat.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate font-medium">
                            {cat.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 pt-2 px-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Mashhur tumanlar
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {districts.map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          setFilters({ selectedDistrict: d });
                          navTo('SEARCH');
                        }}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 px-2 py-1 rounded-md transition-colors"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setCurrentView('MAP')}
            className={`hover:text-emerald-400 transition-colors ${currentView === 'MAP' ? 'text-emerald-400 font-black' : ''}`}
          >
            Xarita
          </button>
          <button
            onClick={() => setCurrentView('STUDENT_PROGRAM')}
            className={`hover:text-emerald-400 transition-colors ${currentView === 'STUDENT_PROGRAM' ? 'text-emerald-400 font-black' : ''}`}
          >
            Talabalar uchun
          </button>
        </nav>

        {/* Right Header User Controls */}
        <div className="flex items-center gap-1 sm:gap-2.5">

          {/* Mobile Quick Favorites (Yurakcha) Button */}
          <button
            type="button"
            onClick={() => navTo('FAVORITES')}
            className="relative p-2 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-200 hover:text-white transition-colors shrink-0"
            title="Saralanganlar"
          >
            <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${favorites.length > 0 ? 'text-rose-500 fill-rose-500' : ''}`} />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </button>

          {/* User Avatar / Login status button */}
          {currentUser ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setShowSidebar(true)}
                className="flex items-center gap-1 sm:gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs sm:text-sm pl-1 pr-2 sm:pl-1.5 sm:pr-3 py-1 rounded-full transition-all shadow-xs"
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'}
                  alt=""
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-emerald-400 shrink-0"
                />
                <div className="text-left min-w-0 max-w-[60px] xs:max-w-[100px] sm:max-w-[150px]">
                  <div className="font-extrabold text-[10px] sm:text-xs text-white truncate leading-tight">{currentUser.name}</div>
                  <div className="hidden sm:block text-[10px] text-emerald-400 font-bold uppercase">{currentUser.role === 'OWNER' ? 'Uy Egasi' : 'Talaba'}</div>
                </div>
              </button>

              {/* Desktop Direct Logout Button */}
              <button
                onClick={handleLogout}
                title="Tizimdan chiqish"
                className="hidden sm:flex items-center justify-center p-2.5 rounded-full bg-slate-900 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-400 transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true, 'LOGIN')}
              className="text-xs sm:text-sm font-bold text-slate-200 hover:text-white px-1.5 sm:px-3 py-1.5 transition-colors"
            >
              Kirish
            </button>
          )}

          {/* E'lon berish button */}
          <button
            onClick={() => {
              if (!currentUser) {
                setShowAuth(true, 'REGISTER');
              } else {
                setCurrentView('CREATE_LISTING');
              }
            }}
            className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm px-2.5 sm:px-5 py-1.5 sm:py-2.5 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 shrink-0"
          >
            <span className="hidden xs:inline">E'lon berish</span>
            <span className="xs:hidden">+ E'lon</span>
          </button>

          {/* Sidebar Menu Drawer Toggle Button */}
          <button
            type="button"
            onClick={() => setShowSidebar((v) => !v)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Menyu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Slide-over Sidebar Drawer */}
      {showSidebar && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm flex justify-end" onClick={() => setShowSidebar(false)}>
          <div 
            className="w-full max-w-xs sm:max-w-sm bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300" 
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Sidebar Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tracking-tighter text-slate-900">
                    MAKLERSIZ<span className="text-emerald-600">UY</span>
                  </span>
                </div>
                <button 
                  onClick={() => setShowSidebar(false)} 
                  className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile Card inside Sidebar */}
              {currentUser ? (
                <div className="p-5 border-b border-slate-100 bg-gradient-to-b from-emerald-50/50 to-white space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'}
                        alt=""
                        className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                      />
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-slate-900 text-base truncate">{currentUser.name}</h3>
                      <div className="text-xs text-slate-500 font-semibold flex items-center gap-1 truncate mt-0.5">
                        <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{currentUser.phone}</span>
                      </div>
                      <div className="mt-1.5 inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>{currentUser.role === 'OWNER' ? 'Uy Egasi Profil' : 'Talaba Profil'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Level & XP Progress Card */}
                  <div className="bg-white border border-emerald-200/80 rounded-2xl p-3 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-black text-slate-800">
                      <span className="flex items-center gap-1 text-emerald-700">
                        <Award className="w-4 h-4 text-emerald-600" />
                        Daraja: {level}-seviya
                      </span>
                      <span className="text-[11px] font-extrabold text-slate-500">{xpVal} XP</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (xpInLevel / 100) * 100)}%` }} 
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 border-b border-slate-100 bg-slate-50 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Tizimga Kiring</h3>
                    <p className="text-xs text-slate-500 mt-0.5">E'lon joylash va uy egalari bilan bevosita bog'lanish uchun</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => { setShowSidebar(false); setShowAuth(true, 'LOGIN'); }}
                      className="bg-white border border-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl shadow-xs"
                    >
                      Kirish
                    </button>
                    <button
                      onClick={() => { setShowSidebar(false); setShowAuth(true, 'REGISTER'); }}
                      className="bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs"
                    >
                      Ro'yxatdan o'tish
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Items inside Sidebar */}
              <div className="p-3 space-y-1">
                <button
                  onClick={() => navTo('HOME')}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-3 transition-colors ${
                    currentView === 'HOME' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Home className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Bosh sahifa</span>
                </button>

                <button
                  onClick={() => navTo('SEARCH')}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-3 transition-colors ${
                    currentView === 'SEARCH' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Search className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Kvartiralar Izlash</span>
                </button>

                <button
                  onClick={() => navTo('FAVORITES')}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl font-extrabold text-xs flex items-center justify-between transition-colors ${
                    currentView === 'FAVORITES' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Heart className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Saralangan E'lonlar</span>
                  </div>
                  {favorites.length > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      {favorites.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => navTo('MAP')}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-3 transition-colors ${
                    currentView === 'MAP' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Interaktiv Xarita</span>
                </button>

                <button
                  onClick={() => navTo('CHAT')}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-3 transition-colors ${
                    currentView === 'CHAT' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Xabarlar va Muloqot</span>
                </button>

                {currentUser?.role === 'OWNER' && (
                  <>
                    <button
                      onClick={() => navTo('MY_LISTINGS')}
                      className={`w-full text-left px-3.5 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-3 transition-colors ${
                        currentView === 'MY_LISTINGS' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <List className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Mening E'lonlarim</span>
                    </button>

                    <button
                      onClick={() => navTo('CREATE_LISTING')}
                      className="w-full text-left px-3.5 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-3 bg-emerald-600 text-white shadow-sm"
                    >
                      <PlusCircle className="w-4 h-4 shrink-0" />
                      <span>+ Yangi E'lon Joylash</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => navTo('STUDENT_PROGRAM')}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-3 transition-colors ${
                    currentView === 'STUDENT_PROGRAM' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Talabalar Dasturi</span>
                </button>

                {currentUser && (
                  <button
                    onClick={() => navTo('PROFILE')}
                    className={`w-full text-left px-3.5 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-3 transition-colors ${
                      currentView === 'PROFILE' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Profil Sozlamalari</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar Footer Logout */}
            {currentUser && (
              <div className="p-4 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={handleLogout}
                  className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Tizimdan Chiqish</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
