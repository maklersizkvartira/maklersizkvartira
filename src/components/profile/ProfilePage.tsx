import React, { useRef } from 'react';
import { LogOut, Home, GraduationCap, Camera, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const ProfilePage: React.FC = () => {
  const { currentUser, logout, setShowAuth, setCurrentView, updateAvatar } = useAppStore();
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
      <h1 className="text-2xl font-black text-slate-900">Profil</h1>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-slate-100"
          >
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center text-white ${isOwner ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                {isOwner ? <Home className="w-8 h-8" /> : <GraduationCap className="w-8 h-8" />}
              </div>
            )}
            <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] font-bold py-1 flex items-center justify-center gap-1">
              <Camera className="w-3 h-3" /> Rasm
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
          <div className="min-w-0">
            <div className="text-xl font-black text-slate-900 truncate">{currentUser.name}</div>
            <div className="text-sm font-bold text-emerald-700">{isOwner ? 'Uy egasi' : 'Talaba'}</div>
            <p className="text-xs text-slate-500 mt-1">
              {isOwner ? "Bu rasm e'loningizda talabalarga ko'rinadi." : "Rasmingiz egasi bilan chatda ko'rinadi."}
            </p>
          </div>
        </div>
        <div className="text-sm">
          <div className="text-slate-500 font-semibold">Telefon</div>
          <div className="font-bold text-slate-900 text-base">{currentUser.phone}</div>
        </div>
      </div>

      {isOwner && (
        <button
          onClick={() => setCurrentView('CREATE_LISTING')}
          className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl"
        >
          Yangi e'lon joylash
        </button>
      )}

      <a
        href="https://maklersizuy-admin.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 text-center transition-colors shadow-md"
      >
        <ShieldCheck className="w-5 h-5 text-emerald-400" /> Admin Panelni Ochish
      </a>

      <button
        onClick={() => {
          logout();
          setCurrentView('HOME');
        }}
        className="w-full bg-slate-100 text-slate-800 font-black py-4 rounded-xl flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" /> Chiqish
      </button>
    </div>
  );
};
