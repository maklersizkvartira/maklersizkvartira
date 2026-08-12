import React from 'react';
import { Heart, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ListingCard } from '../common/ListingCard';

export const FavoritesPage: React.FC = () => {
  const { favorites, listings, setCurrentView } = useAppStore();

  const favListings = listings.filter((l) => favorites.includes(l.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 min-h-[85vh] space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-600 fill-rose-600" /> Saralangan Kvartiralar
          </h1>
          <p className="text-xs text-slate-500">Saqlab qo'yilgan e'lonlar ({favListings.length} ta)</p>
        </div>

        <button
          onClick={() => setCurrentView('SEARCH')}
          className="text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white border border-slate-200 px-3.5 py-2 rounded-xl"
        >
          ← Qidiruvga O'tish
        </button>
      </div>

      {favListings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {favListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 max-w-md mx-auto">
          <Heart className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">Saralangan e'lonlar yo'q</h3>
          <p className="text-xs text-slate-500">
            Kvartiralarni ko'rayotganda yurakcha tugmasini bosib saqlab qo'yishingiz mumkin.
          </p>
          <button
            onClick={() => setCurrentView('SEARCH')}
            className="bg-emerald-600 text-white font-bold text-xs px-6 py-2.5 rounded-xl"
          >
            E'lonlarni Ko'rish
          </button>
        </div>
      )}
    </div>
  );
};
