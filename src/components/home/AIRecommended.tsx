import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ListingCard } from '../common/ListingCard';

export const AIRecommended: React.FC = () => {
  const { listings, setCurrentView } = useAppStore();

  // Filter listings with highest trust score
  const recommendedListings = listings
    .filter((l) => l.trustScore >= 70 && l.aiCheckStatus === 'APPROVED')
    .slice(0, 4);

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-row items-center justify-between mb-4 gap-2">
        <div>
          <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full mb-1 border border-emerald-200">
            <Sparkles className="w-3 h-3 fill-emerald-600" /> Shield AI Tavsiyalari
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">Eng Ishonchli E'lonlar</h2>
          <p className="text-[11px] sm:text-xs text-slate-500 hidden xs:block">AI va hujjatlar orqali 100% tekshirilgan uylar</p>
        </div>

        <button
          onClick={() => setCurrentView('SEARCH')}
          className="text-xs font-extrabold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline group shrink-0 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors"
        >
          <span>Barchasi</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
        {recommendedListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
};
