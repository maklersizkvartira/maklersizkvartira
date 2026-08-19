import React, { useRef } from 'react';
import { LogOut, Home, GraduationCap, Camera, ShieldCheck, UserCheck, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const ProfilePage: React.FC = () => {
  const { currentUser, logout, setShowAuth, setCurrentView, updateAvatar, switchRole } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-black">Siz kirmagansiz</h1>
        <p className="text-slate-600">Uy egasi yoki talaba sifatida kiring.</p>
        <button onClick={() => setShowAuth(true)} className="bg-emerald-600 text-white font-black px-6 py-3.5 rounded-xl w-full">
          Kirish
        </button>
      </div>
    );
  }

  const isOwner = currentUser.role === 'OWNER';

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') updateAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-black text-slate-900">Profil Sozlamalari</h1>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-slate-100 group border-2 border-emerald-500/30"
          >
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center text-white ${isOwner ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                {isOwner ? <Home className="w-8 h-8" /> : <GraduationCap className="w-8 h-8" />}
              </div>
            )}
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] font-bold py-1 flex items-center justify-center gap-1">
              <Camera className="w-3 h-3" /> Rasm
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
          <div className="min-w-0 flex-1">
            <div className="text-xl font-black text-slate-900 truncate">{currentUser.name}</div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isOwner ? 'Uy Egasi Profil' : 'Talaba Profil'}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isOwner ? "E'loningizda rasmingiz talabalarga ko'rinadi." : "Rasmingiz uy egasi bilan muloqotda ko'rinadi."}
            </p>
          </div>
        </div>

        <div className="text-sm border-t border-slate-100 pt-3">
          <div className="text-slate-500 font-semibold text-xs">Telefon raqam</div>
          <div className="font-bold text-slate-900 text-base">{currentUser.phone}</div>
        </div>
      </div>

      {/* Role Switcher Section */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-xs font-black text-slate-200">Tizimdagi Rolingiz</div>
              <div className="text-[11px] text-slate-400 font-medium">Hozirgi holat: <span className="text-emerald-400 font-bold">{isOwner ? 'Uy Egasi' : 'Talaba'}</span></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => switchRole('OWNER')}
            className={`p-3 rounded-xl text-left border transition-all ${
              isOwner
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md font-black'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 font-bold'
            }`}
          >
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              <span className="text-xs">Uy Egasi</span>
            </div>
            <div className="text-[10px] opacity-80 mt-0.5 font-normal">Kvartira e'lon berish</div>
          </button>

          <button
            type="button"
            onClick={() => switchRole('STUDENT')}
            className={`p-3 rounded-xl text-left border transition-all ${
              !isOwner
                ? 'bg-blue-600 text-white border-blue-500 shadow-md font-black'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 font-bold'
            }`}
          >
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              <span className="text-xs">Talaba</span>
            </div>
            <div className="text-[10px] opacity-80 mt-0.5 font-normal">Kvartira qidirish</div>
          </button>
        </div>
      </div>

      {isOwner && (
        <button
          onClick={() => setCurrentView('CREATE_LISTING')}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
        >
          + Yangi e'lon joylash
        </button>
      )}

      <button
        onClick={() => {
          logout();
          setCurrentView('HOME');
        }}
        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut className="w-5 h-5 text-slate-600" /> Chiqish
      </button>
    </div>
  );
};
