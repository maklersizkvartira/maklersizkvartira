import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ListingCard } from '../common/ListingCard';

export const AIRecommended: React.FC = () => {
  const { listings, setCurrentView } = useAppStore();

  // Filter listings with highest trust score
  const recommendedListings = listings
    .filter((l) => l.trustScore >= 70 && l.aiCheckStatus === 'APPROVED')
    .slice(0, 4);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mb-1">
            <Sparkles className="w-3.5 h-3.5 fill-emerald-600" /> Shield AI Tavsiyalari
          </div>
          <h2 className="text-2xl font-black text-slate-900">Eng Ishonchli E'lonlar</h2>
          <p className="text-xs text-slate-500">AI va hujjatlar orqali 100% tekshirilgan uylar</p>
        </div>

        <button
          onClick={() => setCurrentView('SEARCH')}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline group"
        >
          Barcha e'lonlarni ko'rish <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {recommendedListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
};
