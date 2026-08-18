import React from 'react';
import { 
  Heart, ShieldCheck, MapPin, Train, 
  Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Share2 
} from 'lucide-react';
import { Listing } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { TrustScoreBadge } from './TrustScoreBadge';

interface ListingCardProps {
  listing: Listing;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
  const { setCurrentView, toggleFavorite, favorites, currency } = useAppStore();
  const favorite = favorites.includes(listing.id);
  const cover = listing.images?.[0];

  const handleCardClick = () => {
    setCurrentView('LISTING_DETAIL', listing.id);
  };

  const USD_RATE = 12800;
  const priceInUsd = listing.price > 10000 ? Math.round(listing.price / USD_RATE) : listing.price;
  const priceInUzs = listing.price > 10000 ? listing.price : listing.price * USD_RATE;

  return (
    <div
      onClick={handleCardClick}
      className="group bg-white rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 shadow-card hover:shadow-xl transition-all duration-300 flex flex-col w-full min-w-0 cursor-pointer h-full"
    >
      <div className="relative aspect-[4/3] w-full bg-slate-200 animate-pulse overflow-hidden">
        {cover && (
          <img
            src={cover}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 opacity-0"
            loading="lazy"
            decoding="async"
            onLoad={(e) => {
              e.currentTarget.classList.remove('opacity-0');
              e.currentTarget.parentElement?.classList.remove('animate-pulse');
            }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-transparent to-black/20 pointer-events-none" />

        <div className="absolute top-1.5 left-1.5 right-1.5 sm:top-3 sm:left-3 sm:right-3 flex items-start justify-between gap-1">
          <TrustScoreBadge score={listing.trustScore} showText={false} size="sm" />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const shareUrl = `${window.location.origin}/?listing=${listing.id}`;
                if (navigator.share) {
                  navigator.share({
                    title: listing.title,
                    text: `🏠 ${listing.title} — ${listing.price.toLocaleString('uz-UZ')} so'm. Maklersiz, 0% komissiya!`,
                    url: shareUrl,
                  }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(shareUrl);
                  alert("🔗 E'lon havolasi ko'chirildi!");
                }
              }}
              className="p-1.5 sm:p-2 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white backdrop-blur-md transition-transform active:scale-90 shrink-0"
              title="Ulashish"
            >
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(listing.id);
              }}
              className={`p-1.5 sm:p-2 rounded-full backdrop-blur-md transition-transform active:scale-90 shrink-0 ${
                favorite ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-900/60 text-white'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${favorite ? 'fill-white' : ''}`} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-3 sm:left-3 sm:right-3 flex items-center justify-between gap-1 text-white">
          <span className="bg-slate-900/80 backdrop-blur-md px-1.5 sm:px-2 py-0.5 rounded-md font-semibold text-[10px] sm:text-xs border border-white/20">
            {listing.rooms} xona • {listing.area} m²
          </span>
          {listing.owner.isVerified && (
            <span className="bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 text-[9px] sm:text-[10px]">
              <ShieldCheck className="w-3 h-3" />
              <span className="hidden sm:inline">Egasidan</span>
            </span>
          )}
        </div>
      </div>

      <div className="p-2.5 sm:p-5 flex-1 flex flex-col justify-between gap-1.5 sm:gap-3 min-w-0">
        <div className="space-y-1 sm:space-y-2 min-w-0">
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-500 min-w-0">
            <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate font-medium text-slate-700">{listing.district}</span>
            {listing.metroStation && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full shrink-0 ml-auto">
                <Train className="w-3 h-3" />
                {listing.metroStation}
              </span>
            )}
          </div>

          <h3 className="font-extrabold text-[12px] sm:text-base text-slate-900 line-clamp-2 group-hover:text-emerald-700 transition-colors leading-snug">
            {listing.title}
          </h3>

          <div className="hidden sm:flex items-center gap-2 pt-1 flex-wrap">
            {listing.isRoommate && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                🤝 Sherikchilikka
              </span>
            )}
            {listing.aiCheckStatus === 'APPROVED' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 0% makler
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> AI tekshiruvi
              </span>
            )}
            {listing.videoUrl && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                🎥 Video Sharh
              </span>
            )}
          </div>
        </div>

        <div className="pt-1.5 sm:pt-3 border-t border-slate-100 flex items-end justify-between gap-1 min-w-0">
          <div className="min-w-0 flex items-center gap-1.5">
            <img
              src={listing.owner?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'}
              alt={listing.owner?.name || 'Uy Egasi'}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
            <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">{(listing.owner?.name || 'Uy Egasi').split(' ')[0]}</div>
            <div className="text-[13px] sm:text-lg font-black text-emerald-700 tracking-tight leading-tight">
              {currency === 'USD' ? (
                <span>${priceInUsd}<span className="text-[10px] sm:text-xs font-bold text-slate-500">{listing.isRoommate ? ' / kishi' : ' / oy'}</span></span>
              ) : (
                <span>{(priceInUzs / 1000000).toFixed(1)}<span className="text-[10px] sm:text-xs font-bold text-slate-500">{listing.isRoommate ? ' mln/kishi' : ' mln'}</span></span>
              )}
            </div>
            </div>
          </div>
          <span className="hidden sm:inline-flex bg-slate-900 group-hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-colors items-center gap-1 shadow-sm shrink-0">
            Batafsil
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
};
