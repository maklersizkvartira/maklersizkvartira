import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ListingCard } from '../common/ListingCard';
import { rankListings } from '../../services/aiEngine';

const PAGE_SIZE = 4;

export const AIRecommended: React.FC = () => {
  const { listings, setCurrentView, audience, currentUser } = useAppStore();
  const [start, setStart] = useState(0);
  const [paused, setPaused] = useState(false);

  const pool = useMemo(() => {
    const who = currentUser?.role === 'STUDENT' ? 'STUDENT' : audience;
    return rankListings(listings, { audience: who }).map((r) => r.listing);
  }, [listings, audience, currentUser]);

  useEffect(() => {
    if (pool.length <= 1 || paused) return;
    const id = window.setInterval(() => {
      setStart((s) => (s + 1) % pool.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [pool.length, paused]);

  const visible = useMemo(() => {
    if (pool.length === 0) return [];
    const size = Math.min(PAGE_SIZE, pool.length);
    return Array.from({ length: size }, (_, i) => pool[(start + i) % pool.length]);
  }, [pool, start]);

  const pageCount = Math.max(1, pool.length);
  const pageIndex = start % pageCount;

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10 w-full overflow-x-hidden">
      <div className="flex flex-row items-center justify-between mb-4 gap-2">
        <div>
          <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full mb-1 border border-emerald-200">
            <Sparkles className="w-3 h-3 fill-emerald-600" /> Shield AI Tavsiyalari
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">Eng Ishonchli E'lonlar</h2>
          <p className="text-[11px] sm:text-xs text-slate-500">Maklersiz, egasidan to'g'ridan-to'g'ri</p>
        </div>

        <button
          onClick={() => setCurrentView('SEARCH')}
          className="text-xs font-extrabold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 group shrink-0 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors"
        >
          <span>Barchasi</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <p className="text-xs sm:text-sm text-slate-500 font-bold">Hozircha e'lonlar mavjud emas.</p>
          <button
            onClick={() => setCurrentView('CREATE_LISTING')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition shadow-md"
          >
            + Birinchi bo'lib e'lon joylash
          </button>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6 w-full"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
        >
          {visible.map((listing) => (
            <div key={`${start}-${listing.id}`} className="listing-swap min-w-0">
              <ListingCard listing={listing} />
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setStart(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === pageIndex ? 'w-5 bg-emerald-600' : 'w-1.5 bg-slate-300'
              }`}
              aria-label={`Sahifa ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
