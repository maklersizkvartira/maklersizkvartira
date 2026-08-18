import React from 'react';
import { PlusCircle, List, MessageSquare, User, Home } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const OwnerDashboard: React.FC = () => {
  const { currentUser, setCurrentView, listings } = useAppStore();
  const mine = listings.filter((l) => currentUser && l.owner.id === currentUser.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Uy egasi</p>
        <h1 className="text-2xl font-black text-slate-900 leading-tight">
          Salom, {currentUser?.name.split(' ')[0] || 'egasi'}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Kvartirani o'zingiz joylashtirasiz. Makler yo'q.
        </p>
      </div>

      <button
        onClick={() => setCurrentView('CREATE_LISTING')}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-5 text-left shadow-lg shadow-emerald-600/20"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <PlusCircle className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xl font-black">E'lon joylash</div>
            <div className="text-sm text-emerald-100">Kvartira rasmlari va narxini yozing</div>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={() => setCurrentView('MY_LISTINGS')}
          className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-emerald-400"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
              <List className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-black text-slate-900">Mening e'lonlarim</div>
              <div className="text-sm text-slate-500">{mine.length} ta e'lon</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setCurrentView('CHAT')}
          className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-emerald-400"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">Chat</div>
              <div className="text-sm text-slate-500">Talabalar bilan gaplashing</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setCurrentView('PROFILE')}
          className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-emerald-400"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">Profil</div>
              <div className="text-sm text-slate-500">Ism, telefon, chiqish</div>
            </div>
          </div>
        </button>
      </div>

      <button
        onClick={() => setCurrentView('SEARCH')}
        className="w-full text-center text-sm font-bold text-slate-500 py-3"
      >
        <Home className="w-4 h-4 inline mr-1" />
        Barcha kvartiralarni ko'rish
      </button>
    </div>
  );
};
