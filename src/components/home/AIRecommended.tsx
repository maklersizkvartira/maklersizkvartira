/**
 * The recommended rail.
 *
 * Ranking used to run in the browser through the deleted `aiEngine`, which
 * shipped a live Gemini key to every visitor. The server owns it now:
 * `sortBy: 'RECOMMENDED'` returns the same intent, and the audience the
 * shopper is browsing as is passed along so students still see student homes.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { ListingsApi } from '../../services/listingsApi';
import { useAppStore } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { Button } from '../ui/Field';
import { ListingCard, ListingCardSkeleton } from '../listings/ListingCard';
import { canPublishListings } from '../../types/roles';

/** Fetch a few more than fit, so the rail has something to rotate through. */
const POOL_SIZE = 6;
const VISIBLE = 4;
const ROTATE_MS = 10_000;

export const AIRecommended: React.FC = () => {
  const { t } = useTranslation();

  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const currentUser = useAppStore((state) => state.currentUser);
  const audienceFilter = useAppStore((state) => state.filters.audience);
  const pushToast = useAppStore((state) => state.pushToast);

  const [pool, setPool] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [start, setStart] = useState(0);
  const [paused, setPaused] = useState(false);

  const audience = currentUser?.role === 'STUDENT' ? 'STUDENT' : audienceFilter;

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await ListingsApi.list({
        sortBy: 'RECOMMENDED',
        pageSize: POOL_SIZE,
        audience,
      });
      setPool(result.data);
      setStart(0);
    } catch {
      setPool([]);
      setFailed(true);
      pushToast('home.recommended.error', 'error');
    } finally {
      setLoading(false);
    }
  }, [audience, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pool.length <= VISIBLE || paused) return;
    const id = window.setInterval(() => {
      setStart((current) => (current + 1) % pool.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [pool.length, paused]);

  const visible = useMemo(() => {
    if (pool.length <= VISIBLE) return pool;
    return Array.from({ length: VISIBLE }, (_, offset) => pool[(start + offset) % pool.length]);
  }, [pool, start]);

  const canPost = !currentUser || canPublishListings(currentUser.role);

  return (
    <section
      aria-labelledby="home-recommended-title"
      className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-6 sm:px-6 sm:py-10"
    >
      <div className="mb-4 flex flex-row items-center justify-between gap-2">
        <div>
          <h2
            id="home-recommended-title"
            className="text-lg font-black tracking-tight text-content sm:text-2xl"
          >
            {t('home.recommended.title')}
          </h2>
          <p className="text-[11px] text-subtle sm:text-xs">{t('home.recommended.subtitle')}</p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('LISTINGS')}
          className="group flex shrink-0 items-center gap-1 rounded-xl border border-line bg-brand-soft px-3 py-1.5 text-xs font-extrabold text-brand-text transition-colors hover:bg-brand-soft-2"
        >
          <span>{t('home.recommended.viewAll')}</span>
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </button>
      </div>

      {loading ? (
        <div
          className="grid w-full grid-cols-2 gap-2.5 sm:gap-6 lg:grid-cols-4"
          aria-label={t('common.a11y.loading')}
          aria-busy="true"
        >
          {Array.from({ length: VISIBLE }, (_, slot) => (
            <ListingCardSkeleton key={slot} />
          ))}
        </div>
      ) : failed ? (
        <div className="space-y-3 rounded-3xl border border-line bg-surface p-8 text-center">
          <p className="text-xs font-bold text-muted sm:text-sm">
            {t('home.recommended.error')}
          </p>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('common.action.retry')}
          </Button>
        </div>
      ) : pool.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-line bg-surface p-8 text-center">
          <p className="text-xs font-bold text-muted sm:text-sm">{t('home.recommended.empty')}</p>
          {canPost && (
            <Button type="button" onClick={() => setCurrentView('CREATE_LISTING')}>
              {t('home.recommended.emptyCta')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <ul
            aria-label={t('home.recommended.listLabel')}
            className="grid w-full grid-cols-2 gap-2.5 sm:gap-6 lg:grid-cols-4"
            // Rotation stops while the visitor is reading or tabbing through.
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
          >
            {visible.map((listing, index) => (
              <li key={listing.id} className="min-w-0">
                <ListingCard listing={listing} priority={index < 2} />
              </li>
            ))}
          </ul>

          {pool.length > VISIBLE && (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              {pool.map((listing, index) => (
                <button
                  key={listing.id}
                  type="button"
                  onClick={() => setStart(index)}
                  aria-label={t('common.a11y.goToPage', { page: index + 1 })}
                  aria-current={index === start % pool.length}
                  className={`h-1.5 rounded-full transition-all ${
                    index === start % pool.length ? 'w-5 bg-brand' : 'w-1.5 bg-surface-3'
                  }`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default AIRecommended;
