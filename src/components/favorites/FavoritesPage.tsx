/**
 * Saved listings.
 *
 * Favourites are server-owned now, so this page fetches them rather than
 * intersecting a local id list with whatever happens to be in the listings
 * grid — the previous version silently hid a saved listing as soon as it fell
 * out of the current search results.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Heart, RefreshCw } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/Field';
import { ListingCard, ListingCardSkeleton } from '../listings/ListingCard';

export const FavoritesPage: React.FC = () => {
  const { t, formatNumber } = useTranslation();

  const favorites = useAppStore((state) => state.favorites);
  const fetchFavorites = useAppStore((state) => state.fetchFavorites);
  // The request state is the store's, not this component's.
  //
  // It used to be local `loading`/`failed` flags set from a try/catch around
  // `fetchFavorites()`. That action handles its own failure and resolves —
  // it never rejects — so the catch arm never ran and `failed` was never
  // true: a favourites request that had actually errored fell through to the
  // "nothing saved yet" empty state and told a signed-in visitor their saved
  // listings were gone, with no retry offered.
  const favoritesLoading = useAppStore((state) => state.favoritesLoading);
  const favoritesError = useAppStore((state) => state.favoritesError);
  const currentUser = useAppStore((state) => state.currentUser);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);

  // The store cannot be loading before the first effect runs, and an empty
  // list at that instant is indistinguishable from "nothing saved" — so the
  // skeleton is held until the first fetch has settled.
  const [settled, setSettled] = useState(false);

  const load = useCallback(() => {
    setSettled(false);
    let cancelled = false;
    void fetchFavorites().finally(() => {
      if (!cancelled) setSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchFavorites]);

  useEffect(() => load(), [load, currentUser]);

  const loading = Boolean(currentUser) && (!settled || favoritesLoading);
  const failed = !loading && Boolean(favoritesError);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
        {/* -------------------------------------------------------------- */}
        {/* Header                                                          */}
        {/* -------------------------------------------------------------- */}
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-black text-content sm:text-2xl">
              <Heart className="h-5 w-5 shrink-0 fill-danger text-danger sm:h-6 sm:w-6" aria-hidden="true" />
              <span className="truncate">{t('favorites.page.title')}</span>
            </h1>
            <p className="text-xs text-subtle" aria-live="polite">
              {currentUser
                ? t('favorites.page.count', { count: formatNumber(favorites.length) })
                : t('favorites.page.subtitle')}
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={() => setCurrentView('LISTINGS')}
            className="shrink-0 px-3 py-2 text-xs"
          >
            {t('favorites.page.browse')}
          </Button>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Body                                                            */}
        {/* -------------------------------------------------------------- */}
        {!currentUser ? (
          <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-line bg-surface p-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-subtle">
              <Heart className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-bold text-content">{t('favorites.guest.title')}</h2>
            <p className="text-xs text-muted">{t('favorites.guest.body')}</p>
            <Button onClick={() => setShowAuth(true, 'LOGIN')}>{t('favorites.guest.cta')}</Button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-6 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ListingCardSkeleton key={index} />
            ))}
          </div>
        ) : failed ? (
          <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-danger/30 bg-danger-soft p-8 text-center">
            <h2 className="text-sm font-bold text-danger">{t('favorites.error.title')}</h2>
            <p className="text-xs text-danger">{t('common.error.network')}</p>
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t('common.error.tryAgain')}
            </Button>
          </div>
        ) : favorites.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-6 lg:grid-cols-4">
            {favorites.map((listing, index) => (
              <ListingCard key={listing.id} listing={listing} priority={index < 4} />
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-line bg-surface p-12 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-subtle">
              <Heart className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-bold text-content">{t('favorites.empty.title')}</h2>
            <p className="text-xs text-muted">{t('favorites.empty.body')}</p>
            <Button onClick={() => setCurrentView('LISTINGS')}>{t('favorites.empty.cta')}</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;
