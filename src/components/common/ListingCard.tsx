import React from 'react';
import { 
  Heart, ShieldCheck, MapPin, Train, Eye, Video, 
  Sparkles, CheckCircle2, AlertTriangle, ArrowRight 
} from 'lucide-react';
import { Listing } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { TrustScoreBadge } from './TrustScoreBadge';

interface ListingCardProps {
  listing: Listing;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
  const { 
    setCurrentView, 
    toggleFavorite, favorites 
  } = useAppStore();

  const favorite = favorites.includes(listing.id);

  const handleCardClick = () => {
    setCurrentView('LISTING_DETAIL', listing.id);
  };

  return (
    <div className="group bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-card hover:shadow-xl transition-all duration-300 flex flex-col justify-between w-full max-w-full">
      {/* Top Image Section */}
      <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden cursor-pointer" onClick={handleCardClick}>
        <img
          src={listing.images[0]}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-black/30 pointer-events-none" />

        {/* Top Badges: Trust Score & Favorite */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <TrustScoreBadge score={listing.trustScore} />
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(listing.id);
            }}
            className={`p-2 rounded-full backdrop-blur-md transition-transform active:scale-90 ${
              favorite
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-slate-900/60 text-white hover:bg-slate-900/80'
            }`}
          >
            <Heart className={`w-4 h-4 ${favorite ? 'fill-white' : ''}`} />
          </button>
        </div>

        {/* Bottom Image Overlay Badges */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-1.5 text-white text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded-md font-semibold border border-white/20">
              {listing.rooms} xona • {listing.area} m²
            </span>
            {listing.hasVirtualTour && (
              <span className="bg-emerald-600/90 backdrop-blur-md text-white font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-400/30">
                <Sparkles className="w-3 h-3 text-amber-300" /> 360° Tour
              </span>
            )}
          </div>

          {listing.owner.isVerified && (
            <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Owner
            </span>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3 w-full">
        <div className="space-y-2">
          {/* Location & District */}
          <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-1">
            <div className="flex items-center gap-1 font-medium text-slate-700 truncate max-w-[200px]">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{listing.region}, {listing.district}</span>
            </div>

            {listing.metroStation && (
              <div className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                <Train className="w-3 h-3" />
                <span>{listing.metroStation} ({listing.metroDistanceMinutes} daq)</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h3 
            onClick={handleCardClick}
            className="font-extrabold text-sm sm:text-base text-slate-900 line-clamp-2 hover:text-emerald-700 cursor-pointer transition-colors leading-snug"
          >
            {listing.title}
          </h3>

          {/* AI Check Status Pill */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {listing.aiCheckStatus === 'APPROVED' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> AI Checked • 0% Makler
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> AI Review
              </span>
            )}
          </div>
        </div>

        {/* Footer Price & Details CTA */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Oylik Ijara</div>
            <div className="text-base sm:text-lg font-black text-emerald-800 tracking-tight">
              {(listing.price / 1000000).toFixed(1)} <span className="text-xs font-bold text-slate-600">mln so'm</span>
            </div>
          </div>

          <button
            onClick={handleCardClick}
            className="bg-slate-900 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-1 shadow-sm shrink-0"
          >
            <span>Batafsil</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
