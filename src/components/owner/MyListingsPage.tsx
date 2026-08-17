import React from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ListingCard } from '../common/ListingCard';

export const MyListingsPage: React.FC = () => {
  const { currentUser, listings, setCurrentView, removeListing, setShowAuth } = useAppStore();

  if (!currentUser || currentUser.role !== 'OWNER') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-black">Faqat uy egasi</h1>
        <p className="text-slate-600">E'lonlarni ko'rish uchun uy egasi sifatida kiring.</p>
        <button onClick={() => setShowAuth(true)} className="bg-emerald-600 text-white font-black px-6 py-3 rounded-xl">
          Kirish
        </button>
      </div>
    );
  }

  const mine = listings.filter((l) => l.owner.id === currentUser.id);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Mening e'lonlarim</h1>
          <p className="text-sm text-slate-500">{mine.length} ta kvartira</p>
        </div>
        <button
          onClick={() => setCurrentView('CREATE_LISTING')}
          className="bg-emerald-600 text-white font-black text-sm px-4 py-3 rounded-xl flex items-center gap-2"
        >
          <PlusCircle className="w-5 h-5" /> Yangi
        </button>
      </div>

      {mine.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <p className="text-lg font-bold text-slate-800">Hali e'lon yo'q</p>
          <p className="text-sm text-slate-500">Kvartirani joylashtiring. AI makler e'lonini o'tkazmaydi.</p>
          <button
            onClick={() => setCurrentView('CREATE_LISTING')}
            className="bg-emerald-600 text-white font-black px-6 py-3 rounded-xl"
          >
            E'lon joylash
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {mine.map((listing) => (
            <div key={listing.id} className="relative">
              <ListingCard listing={listing} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm("Bu e'lonni o'chirasizmi?")) removeListing(listing.id);
                }}
                className="absolute bottom-3 right-3 z-10 bg-white/95 text-rose-600 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-rose-200 shadow-sm flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> O'chirish
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
