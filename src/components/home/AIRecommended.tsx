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
import { ListingsApi } from '../../services/listingsApi';
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

  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appending, setAppending] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Which request is allowed to write, and how to cancel the rest.
   *
   * The section had neither. It took no `AbortSignal` — `ListingsApi.list`
   * accepts one for exactly this — and no unmount guard, so a "load more" tap
   * followed by a fast reload raced two responses into the same state, and a
   * request that failed after the visitor had already navigated away pushed an
   * error toast onto a page they were no longer looking at.
   *
   * `alive` is set on the way IN as well as cleared on the way out. StrictMode
   * mounts every component twice, so a flag only ever cleared would be false
   * for the whole of the second mount — the one that stays — and the grid
   * would never paint in development.
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

  /**
   * Its own request, deliberately not the store's `fetchListings`.
   *
   * That action writes the shared `listings` array and shares one abort
   * controller with the catalogue and the map, so calling it from the home
   * page would abort whatever those had in flight and replace their rows with
   * a query they did not ask for. The home page is a shop window; it does not
   * get to move the shop.
   */
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
        const result = await ListingsApi.list({
          sortBy: 'RECOMMENDED',
          page: nextPage,
          pageSize: PAGE_SIZE,
          // Rentals AND sales. The home page says "E'lonlar", not "Ijara", and
          // omitting this asks the server for its RENT default — so the day a
          // property for sale is approved it would be missing from the only
          // listing section the home page has, with nothing saying so.
          dealType: 'ALL',
          // Everyone, always. This used to read the store's shared
          // `filters.audience` and, for a signed-in student, to override it
          // with STUDENT outright — so a filter chosen on the catalogue, or
          // merely the role on the account, silently removed listings from the
          // home page. There is no chip, no badge and no reset control on this
          // page, so nothing said a filter was on and nothing could turn it
          // off; a student account could not see the whole site at all.
          //
          // The home page is a shop window. It shows what there is, and the
          // catalogue is where a search gets narrowed.
          audience: 'ALL',
        }, controller.signal);
        // A superseded request must not paint. `alive` covers the unmount that
        // no abort can catch: the request that resolved first is still holding
        // this closure.
        if (!alive.current || ticket !== sequence.current) return;
        const rows = result?.data ?? [];
        setListings((current) => {
          if (!appendingNow) return rows;
          // A page boundary can repeat a row when something is published
          // mid-browse; two cards with one id is a duplicate React key.
          const seen = new Set(current.map((item) => item.id));
          return [...current, ...rows.filter((item) => !seen.has(item.id))];
        });
        setTotal(result?.totalCount ?? rows.length);
        setHasMore(result?.meta?.hasNext ?? false);
        setPage(nextPage);
      } catch {
        // A cancelled request is not a failure — it is this component
        // superseding itself — so it must not empty the grid or raise a toast.
        if (controller.signal.aborted || !alive.current || ticket !== sequence.current) {
          return;
        }
        if (!appendingNow) {
          setListings([]);
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
    [pushToast],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const canPost = !currentUser || canPublishListings(currentUser.role);

  return (
    <section
      aria-labelledby="home-recommended-title"
      // `gutter-safe`, not `px-3`: the categories grid directly below uses it,
      // and a 12px gutter both stepped 4px away from that neighbour and stayed
      // 12px when a landscape notch ate the left edge.
      className="gutter-safe mx-auto w-full max-w-7xl overflow-x-hidden py-6 sm:py-10"
    >
      <div className="mb-4 flex flex-row items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isMonetizationEnabled && (
              <Star className="h-5 w-5 text-warning" fill="currentColor" aria-hidden="true" />
            )}
            <h2
              id="home-recommended-title"
              className="text-lg font-black tracking-tight text-content sm:text-2xl"
            >
              {isMonetizationEnabled
                ? t('home.recommended.titleVIP' as never)
                : t('home.recommended.title' as never)}
            </h2>
            {isMonetizationEnabled && (
              // `warning`, not a `yellow-500` literal: the token flips with the
              // theme and a palette class does not, so this badge used to stay
              // light-mode ochre while the identical TOP badge on the catalogue
              // lifted to the dark-mode amber beside it.
              <span className="rounded-md border border-warning/20 bg-warning-soft px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-warning">
                VIP
              </span>
            )}
          </div>
          <p className="text-[11px] text-subtle sm:text-xs">
            {isMonetizationEnabled
              ? t('home.recommended.subtitleVIP' as never)
              : t('home.recommended.subtitle' as never)}
            {/* The count, once there is one. It is the difference between a
                page that looks like it is showing you a sample and one that
                says how much it is showing you. */}
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
          // `min-h-11`, not `py-1.5`. This is the home page's only route into
          // the full catalogue and it was a ~30px target on the device most of
          // this site is read on.
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
            className="grid w-full grid-cols-2 gap-2.5 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
          >
            {listings.map((listing, index) => (
              <li key={listing.id} className="min-w-0">
                {/* Only the first screenful is worth prioritising. Marking a
                    hundred images high-priority is the same as marking none. */}
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
