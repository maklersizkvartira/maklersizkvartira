/**
 * The home page's listings section.
 *
 * It used to be a rail: it asked the API for six listings, painted four of
 * them, and rotated that four-card window every ten seconds. With ten
 * listings live that meant four of the ten were never fetched at all — not
 * after a rotation, not after pressing a dot. They were simply not on the
 * home page in any state, and the only way to reach them was the "Barchasi"
 * link. Since this section is the *only* listing content the home page has,
 * the home page was showing under half of the site.
 *
 * It is a grid now, and it asks for everything the API will give it in one
 * request. The rotation went with the window, and good riddance: on a phone —
 * the primary device here — `onMouseEnter` never fires, so the only way to
 * pause it was to have already touched it, and a reader scrolling past had
 * the card under their thumb swapped for a different listing every ten
 * seconds. That is a WCAG 2.2.2 failure as well as an annoyance.
 *
 * Ranking still runs on the server. `sortBy: 'RECOMMENDED'` returns the same
 * intent the deleted client-side `aiEngine` did, without shipping a live
 * Gemini key to every visitor.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, RefreshCw, Star } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { ListingsApi, type ListingQuery } from '../../services/listingsApi';
import { MAX_PAGE_SIZE, useAppStore } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { Button } from '../ui/Field';
import { ListingCard, ListingCardSkeleton } from '../listings/ListingCard';
import { canPublishListings } from '../../types/roles';

/**
 * One request, and it holds the whole catalogue at today's size.
 *
 * 100 is the API's per-request maximum, not a target to paginate up to:
 * `page_size` is declared `le=100` and rejects 101 with a 422 rather than
 * clamping it. Past a hundred listings the button at the foot of the section
 * fetches the next page.
 */
const PAGE_SIZE = MAX_PAGE_SIZE;

/** How many placeholder cards to draw while the first page is in flight. */
const SKELETON_COUNT = 8;

export const AIRecommended: React.FC = () => {
  const { t, formatNumber } = useTranslation();

  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const currentUser = useAppStore((state) => state.currentUser);
  const pushToast = useAppStore((state) => state.pushToast);
  const isMonetizationEnabled = useAppStore((state) => state.isMonetizationEnabled);

  const [promotedListings, setPromotedListings] = useState<Listing[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appending, setAppending] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Which request is allowed to write, and how to cancel the rest.
   */
  const sequence = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      inFlight.current?.abort();
    };
  }, []);

  const load = useCallback(
    async (nextPage: number) => {
      const appendingNow = nextPage > 1;
      const ticket = ++sequence.current;
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      if (appendingNow) setAppending(true);
      else setLoading(true);
      setFailed(false);
      try {
        const query: ListingQuery = {
          sortBy: 'RECOMMENDED',
          page: nextPage,
          pageSize: PAGE_SIZE,
          dealType: 'ALL',
          audience: 'ALL',
        };

        const [result, featuredResult] = await Promise.all([
          ListingsApi.list(query, controller.signal),
          isMonetizationEnabled && nextPage === 1
            ? ListingsApi.featured(16).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (!alive.current || ticket !== sequence.current) return;
        const rawRows = result?.data ?? [];
        const featuredRows = featuredResult?.data ?? [];

        const isPaidVip = (item: Listing) => Boolean(
          item.isVip && (!item.vipUntil || new Date(item.vipUntil).getTime() > Date.now())
        );
        const isPaidTop = (item: Listing) => Boolean(
          item.isFeatured && (!item.featuredUntil || new Date(item.featuredUntil).getTime() > Date.now())
        );

        let currentPromoted = promotedListings;
        if (isMonetizationEnabled && nextPage === 1) {
          const candidatePromoted = [
            ...featuredRows,
            ...rawRows.filter((item) => isPaidVip(item) || isPaidTop(item)),
          ];
          const uniqueMap = new Map<string, Listing>();
          candidatePromoted.forEach((item) => uniqueMap.set(item.id, item));
          currentPromoted = Array.from(uniqueMap.values()).sort((a, b) => {
            const aVip = isPaidVip(a);
            const bVip = isPaidVip(b);
            if (aVip && !bVip) return -1;
            if (!aVip && bVip) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          setPromotedListings(currentPromoted);
        }

        const promotedIdSet = new Set(
          (isMonetizationEnabled ? currentPromoted : []).map((p) => p.id)
        );

        // Remaining/regular listings go to the main grid below
        const regularRows = isMonetizationEnabled && currentPromoted.length > 0
          ? rawRows.filter((item) => !promotedIdSet.has(item.id))
          : rawRows;

        setListings((current) => {
          if (!appendingNow) return regularRows;
          const seen = new Set(current.map((item) => item.id));
          return [...current, ...regularRows.filter((item) => !seen.has(item.id))];
        });
        setTotal(result?.totalCount ?? regularRows.length);
        setHasMore(result?.meta?.hasNext ?? false);
        setPage(nextPage);
      } catch {
        if (controller.signal.aborted || !alive.current || ticket !== sequence.current) {
          return;
        }
        if (!appendingNow) {
          setListings([]);
          setPromotedListings([]);
          setTotal(0);
          setHasMore(false);
        }
        setFailed(true);
        pushToast('home.recommended.error', 'error');
      } finally {
        if (alive.current && ticket === sequence.current) {
          setLoading(false);
          setAppending(false);
        }
      }
    },
    [pushToast, isMonetizationEnabled],
  );


  useEffect(() => {
    void load(1);
  }, [load]);

  const canPost = !currentUser || canPublishListings(currentUser.role);

  return (
    <section
      aria-labelledby="home-recommended-title"
      className="gutter-safe mx-auto w-full max-w-7xl overflow-x-hidden py-6 sm:py-10"
    >
      {/* ---------------------------------------------------------------- */}
      {/* 1. VIP & TOP Promoted Horizontal Row                             */}
      {/* ---------------------------------------------------------------- */}
      {isMonetizationEnabled && promotedListings.length > 0 && (
        <div className="mb-8 border-b border-line/60 pb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-warning" fill="currentColor" aria-hidden="true" />
              <h2 className="text-lg font-black tracking-tight text-content sm:text-xl">
                VIP & TOP eʼlonlar
              </h2>
              <span className="rounded-md border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-500">
                VIP & TOP
              </span>
            </div>
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">
              {formatNumber(promotedListings.length)} ta
            </span>
          </div>

          <div className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {promotedListings.map((listing) => (
              <div key={listing.id} className="w-[280px] sm:w-[310px] shrink-0 snap-start">
                <ListingCard listing={listing} priority />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 2. All Regular Listings Header & Controls                         */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-4 flex flex-row items-center justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="home-recommended-title"
            className="text-lg font-black tracking-tight text-content sm:text-2xl"
          >
            {t('home.recommended.title' as never)}
          </h2>
          <p className="text-[11px] text-subtle sm:text-xs">
            {t('home.recommended.subtitle' as never)}
            {total > 0 && (
              <span className="ml-1.5 font-bold text-muted">
                · {t('home.recommended.count', { count: formatNumber(total) })}
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('LISTINGS')}
          className="group flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-line bg-brand-soft px-3 py-1.5 text-xs font-extrabold text-brand-text transition-colors hover:bg-brand-soft-2"
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
          className="grid w-full grid-cols-2 gap-2.5 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
          aria-label={t('common.a11y.loading')}
          aria-busy="true"
        >
          {Array.from({ length: SKELETON_COUNT }, (_, slot) => (
            <ListingCardSkeleton key={slot} />
          ))}
        </div>
      ) : failed && listings.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-line bg-surface p-8 text-center">
          <p className="text-xs font-bold text-muted sm:text-sm">
            {t('home.recommended.error')}
          </p>
          <Button type="button" variant="secondary" onClick={() => void load(1)}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('common.action.retry')}
          </Button>
        </div>
      ) : listings.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-line bg-surface p-8 text-center">
          <p className="text-xs font-bold text-muted sm:text-sm">
            {t('home.recommended.empty')}
          </p>
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
            className="grid w-full grid-cols-2 gap-2.5 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
          >
            {listings.map((listing, index) => (
              <li key={listing.id} className="min-w-0">
                <ListingCard listing={listing} priority={index < 4} />
              </li>
            ))}
          </ul>


          {/* An append that failed keeps the rows it has and says so, rather
              than collapsing the grid back to the first page. */}
          {failed && listings.length > 0 && (
            <p className="mt-6 text-center text-xs font-bold text-danger">
              {t('home.recommended.error')}
            </p>
          )}

          {hasMore && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                loading={appending}
                onClick={() => void load(page + 1)}
              >
                {t('common.action.loadMore')}
              </Button>
              <p className="text-[11px] text-subtle">{t('home.recommended.loadMoreHint')}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default AIRecommended;
