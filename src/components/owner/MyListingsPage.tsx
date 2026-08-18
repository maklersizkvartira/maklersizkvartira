import React from 'react';
import { PlusCircle, Trash2, Edit3 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ListingCard } from '../common/ListingCard';
import { EditListingModal } from './EditListingModal';

export const MyListingsPage: React.FC = () => {
  const { currentUser, listings, setCurrentView, removeListing, setEditingListing, setShowAuth } = useAppStore();

  if (!currentUser || currentUser.role !== 'OWNER') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-black">Faqat uy egasi</h1>
        <p className="text-slate-600">E'lonlarni ko'rish va boshqarish uchun uy egasi sifatida kiring.</p>
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
          <p className="text-sm text-slate-500">{mine.length} ta aktiv e'lon</p>
        </div>
        <button
          onClick={() => setCurrentView('CREATE_LISTING')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm px-4 py-3 rounded-xl flex items-center gap-2 shadow-lg transition"
        >
          <PlusCircle className="w-5 h-5" /> Yangi E'lon
        </button>
      </div>

      {mine.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <p className="text-lg font-bold text-slate-800">Hali e'lon joylashtirmagansiz</p>
          <p className="text-sm text-slate-500">Kvartirangizni joylashtiring. AI makler e'lonini o'tkazmaydi.</p>
          <button
            onClick={() => setCurrentView('CREATE_LISTING')}
            className="bg-emerald-600 text-white font-black px-6 py-3 rounded-xl"
          >
            E'lon joylash
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mine.map((listing) => (
            <div key={listing.id} className="relative group">
              <ListingCard listing={listing} />
              
              {/* Management Action Bar */}
              <div className="mt-2 bg-slate-900 border border-slate-800 rounded-2xl p-2 flex items-center justify-between gap-2 shadow-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingListing(listing);
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Tahrirlash</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Haqiqatan ham ushbu e'lonni o'chirasizmi?")) {
                      removeListing(listing.id);
                    }
                  }}
                  className="flex-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 font-extrabold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>O'chirish</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global Edit Listing Modal */}
      <EditListingModal />
    </div>
  );
};
