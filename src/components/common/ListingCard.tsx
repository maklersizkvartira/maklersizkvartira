import React from 'react';
import { Heart, MapPin, Train, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { Listing } from '../../types';
import { TrustScoreBadge } from './TrustScoreBadge';
import { useAppStore } from '../../stores/useAppStore';

interface ListingCardProps {
  listing: Listing;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
  const { favorites, toggleFavorite, setCurrentView } = useAppStore();
  const isFav = favorites.includes(listing.id);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount);
  };

  return (
    <div
      onClick={() => setCurrentView('LISTING_DETAIL', listing.id)}
      className="group bg-white rounded-2xl border border-slate-200 shadow-card hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col cursor-pointer hover:-translate-y-1 relative"
    >
      {/* Listing Image Container */}
      <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
        <img
          src={listing.images[0]}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        
        {/* Top Floating Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          <TrustScoreBadge score={listing.trustScore} size="sm" showText={false} />
          {listing.owner.isVerified && (
            <span className="bg-emerald-600/95 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3 h-3" /> Egasi Verified
            </span>
          )}
          {listing.isFeatured && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3 h-3 fill-white" /> Top E'lon
            </span>
          )}
        </div>

        {/* Favorite Heart Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(listing.id);
          }}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-transform active:scale-90 ${
            isFav
              ? 'bg-rose-500 text-white shadow-md'
              : 'bg-slate-900/40 text-white hover:bg-slate-900/70'
          }`}
          title={isFav ? "Saralangandan chiqarish" : "Saralanganlarga qo'shish"}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
        </button>

        {/* Room & Area Overlay */}
        <div className="absolute bottom-3 left-3 bg-slate-900/70 text-white text-xs px-2.5 py-1 rounded-lg backdrop-blur-sm">
          {listing.rooms} xonali • {listing.area} m² • {listing.floor}/{listing.totalFloors}-qavat
        </div>
      </div>

      {/* Listing Content */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <div className="text-lg font-bold text-slate-900">
              {formatPrice(listing.price)}{' '}
              <span className="text-xs font-normal text-slate-500">so'm/oy</span>
            </div>
            {listing.depositPrice > 0 && (
              <span className="text-[11px] text-slate-500 font-medium">
                Depozit: {formatPrice(listing.depositPrice)} so'm
              </span>
            )}
          </div>

          <h3 className="font-semibold text-slate-800 text-sm line-clamp-2 mb-2 group-hover:text-emerald-700 transition-colors">
            {listing.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{listing.district}, {listing.region}</span>
          </div>

          {listing.metroStation && (
            <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 rounded-md mb-2">
              <Train className="w-3 h-3 text-blue-600" />
              <span>{listing.metroStation} ({listing.metroDistanceMinutes} min)</span>
            </div>
          )}
        </div>

        {/* Owner Info & Safety Signal */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-2 text-xs">
          <div className="flex items-center gap-2">
            <img
              src={listing.owner.avatar}
              alt={listing.owner.name}
              className="w-6 h-6 rounded-full object-cover border border-slate-200"
            />
            <span className="font-medium text-slate-700 truncate max-w-[120px]">
              {listing.owner.name}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Maklersiz
          </div>
        </div>
      </div>
    </div>
  );
};
