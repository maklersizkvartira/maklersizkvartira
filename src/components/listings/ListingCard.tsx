/**
 * A listing card.
 *
 * Two shapes from one component: the default vertical card for the grid, and
 * a horizontal `list` variant. Both share the same badge, price and trust
 * treatment so a listing looks like itself wherever it appears.
 *
 * The photo is a slow carousel. Owners upload five or six rooms and the grid
 * only ever showed the first one, so a flat with a photographed kitchen and a
 * flat with nothing but a hallway looked identical until you opened them.
 *
 * Every card in a row is the same height, and that is a contract the card
 * keeps on its own rather than something its callers arrange. Three pieces
 * hold it: `h-full` on the root, so the card fills the row a stretching grid
 * gives it — several call sites wrap the card in a `<li>` or a `<div>`, and
 * there the wrapper stretched while the card inside it kept its content
 * height; a reserved two-line title, so a short title cannot shorten the
 * card; and `mt-auto` on the closing row, so the parts that should agree
 * across neighbouring cards sit at the same distance from the bottom no
 * matter how many optional rows — metro, district, area — a listing has.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BedDouble,
  Heart,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  ShieldCheck,
  Sparkles,
  Train,
  Users,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { cn } from '../../lib/cn';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAppStore } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { sellerTypeOf } from '../../types/roles';
import { AppLink } from '../../router/AppLink';
import { listingPath } from '../../seo/routes';
import { listingSlug } from '../../seo/slugs';

/** Beyond this the dots stop being readable and the extra layers cost more
 *  than they show. The detail page is where the full gallery lives. */
const MAX_SLIDES = 5;

/** Slow enough to read the rest of the card between changes. */
const ROTATE_MS = 10_000;

// ---------------------------------------------------------------------------
// One ticker for every card on the page.
//
// A `setInterval` per card meant a twenty-four card grid woke the main thread
// twenty-four times per cycle, each wake at its own offset, so the page never
// got a quiet frame and the cards drifted out of step with each other. A
// single module-level interval with a subscriber set costs one timer no
// matter how many cards are mounted, and it stops itself when the last card
// unsubscribes.
// ---------------------------------------------------------------------------
type TickSubscriber = () => void;

const tickSubscribers = new Set<TickSubscriber>();
let tickerId: number | null = null;

function subscribeToTicker(subscriber: TickSubscriber): () => void {
  tickSubscribers.add(subscriber);
  if (tickerId === null && typeof window !== 'undefined') {
    tickerId = window.setInterval(() => {
      // A backgrounded tab is not being looked at, and advancing there only
      // means the visitor comes back to a photo they never saw arrive.
      if (typeof document !== 'undefined' && document.hidden) return;
      tickSubscribers.forEach((run) => run());
    }, ROTATE_MS);
  }
  return () => {
    tickSubscribers.delete(subscriber);
    if (tickSubscribers.size === 0 && tickerId !== null) {
      window.clearInterval(tickerId);
      tickerId = null;
    }
  };
}

/** The next slot that actually has a picture, or the current one if none has. */
function nextSlide(current: number, total: number, failed: ReadonlySet<number>): number {
  for (let step = 1; step <= total; step += 1) {
    const candidate = (current + step) % total;
    if (!failed.has(candidate)) return candidate;
  }
  return current;
}

interface ListingCardProps {
  listing: Listing;
  variant?: 'grid' | 'list' | 'compact';
  /** Renders the promoted styling used by the featured rail. */
  promoted?: boolean;
  onOpen?: (listing: Listing) => void;
  priority?: boolean;
  /**
   * Rotate the photos on the shared ticker. Defaults to "yes, when there is
   * more than one photo", which is why none of the nine call sites pass it.
   * Pass `false` where a card must hold still — a screenshot, a print view,
   * or a dense list where movement in nine places at once is noise.
   */
  autoRotate?: boolean;
}

function trustTone(score: number): { label: string; className: string } {
  if (score >= 80) return { label: 'high', className: 'bg-brand-soft text-brand-text' };
  if (score >= 60) return { label: 'good', className: 'bg-info-soft text-info' };
  if (score >= 40) return { label: 'medium', className: 'bg-warning-soft text-warning' };
  return { label: 'low', className: 'bg-danger-soft text-danger' };
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  variant = 'grid',
  promoted = false,
  onOpen,
  priority = false,
  autoRotate,
}) => {
  const { t, formatPrice, formatRelativeTime } = useTranslation();
  const fxRate = useAppStore((state) => state.fxRate);

  /**
   * The same price in the other currency, or null when there is nothing
   * useful to add. Rounded to whole units in both directions: a rate is an
   * approximation and decimal places on an approximation only imply
   * precision that is not there.
   */
  const converted =
    fxRate > 0 && listing.price > 0
      ? listing.currency === 'USD'
        ? { amount: Math.round(listing.price * fxRate), currency: 'UZS' as const }
        : { amount: Math.round(listing.price / fxRate), currency: 'USD' as const }
      : null;
  const reducedMotion = useReducedMotion();
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const images = useMemo(() => (listing.images ?? []).slice(0, MAX_SLIDES), [listing.images]);

  /**
   * Which slots failed to load, not whether *the* image failed.
   *
   * A single boolean meant one dead URL out of five collapsed the card to the
   * placeholder even though four good photos were sitting right behind it.
   */
  const [failedSlides, setFailedSlides] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [slide, setSlide] = useState(0);
  const mediaRef = useRef<HTMLDivElement>(null);

  const isFavorite = favoriteIds.has(listing.id);
  const trust = trustTone(listing.trustScore ?? 0);
  const isAgentListing = sellerTypeOf(listing) === 'AGENT';
  const href = listingPath({ id: listing.id, slug: listingSlug(listing) });
  const rotates = autoRotate ?? images.length > 1;

  // A recycled card (the grid reuses positions as pages append) must not keep
  // the previous listing's slide or its dead-photo bookkeeping.
  useEffect(() => {
    setSlide(0);
    setFailedSlides(new Set<number>());
  }, [listing.id]);

  const handleImageError = useCallback((index: number) => {
    setFailedSlides((previous) => {
      if (previous.has(index)) return previous;
      const next = new Set(previous);
      next.add(index);
      return next;
    });
  }, []);

  // Landing on a slot whose photo has just 404'd would show the empty box
  // behind the stack for a full ten seconds.
  useEffect(() => {
    if (!failedSlides.has(slide)) return;
    setSlide((current) => nextSlide(current, images.length, failedSlides));
  }, [failedSlides, slide, images.length]);

  // The ticker fires for every card at once; a card reads its own live counts
  // through this rather than through the closure the effect captured, so a
  // photo that dies mid-cycle is skipped from the next tick on.
  const rotation = useRef({ total: images.length, failed: failedSlides });
  useEffect(() => {
    rotation.current = { total: images.length, failed: failedSlides };
  }, [images.length, failedSlides]);

  useEffect(() => {
    // `prefers-reduced-motion` clamps the CSS transition to nothing, which
    // turns the crossfade into a hard cut every ten seconds — worse than not
    // rotating at all. The stylesheet cannot stop a JS timer, so this does.
    if (!rotates || reducedMotion || images.length < 2) return undefined;

    const advance = () => {
      const { total, failed } = rotation.current;
      if (total < 2 || failed.size >= total - 1) return;
      setSlide((current) => nextSlide(current, total, failed));
    };

    const node = mediaRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      // Nothing to ask about visibility: rotate rather than freeze.
      return subscribeToTicker(advance);
    }

    // A card three screens down is burning bandwidth and layout work for a
    // picture nobody is looking at.
    let onScreen = false;
    const observer = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    const unsubscribe = subscribeToTicker(() => {
      if (onScreen) advance();
    });
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [rotates, reducedMotion, images.length]);

  const open = () => {
    if (onOpen) onOpen(listing);
    else setCurrentView('LISTING_DETAIL', listing.id);
  };

  const handleFavorite = (event: React.MouseEvent) => {
    event.stopPropagation();
    void toggleFavorite(listing.id);
  };

  const isList = variant === 'list';
  const hasPhoto = images.length > 0 && failedSlides.size < images.length;
  const activeSlide = Math.min(slide, Math.max(images.length - 1, 0));

  const media = (
    <div
      ref={mediaRef}
      className={cn(
        'relative shrink-0 overflow-hidden bg-surface-2',
        isList ? 'h-full w-36 sm:w-52' : 'aspect-[4/3] w-full',
      )}
    >
      {hasPhoto ? (
        /* The hover zoom lives on this wrapper, not on the layers. `.crossfade`
           is a whole `transition` declaration, so an element carrying both it
           and `transition-transform` keeps only one of them — and the one that
           lost was the zoom. */
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
          {images.map((src, index) =>
            failedSlides.has(index) ? null : (
              <img
                key={`${listing.id}-${index}`}
                src={src}
                /* The property photo is the content, not decoration: an empty
                   alt told Google Images and every screen reader to ignore it.
                   Only the layer on top is described — the others are the same
                   flat, and five identical alts is five announcements. */
                alt={index === activeSlide ? listing.title : ''}
                width={isList ? 208 : 800}
                height={isList ? 176 : 600}
                /* Only the first frame of a priority card is eager. Making
                   every layer eager would have the browser fetch five photos
                   per card before the one that is actually on screen, which is
                   exactly how an LCP is lost. */
                loading={priority && index === 0 ? 'eager' : 'lazy'}
                fetchPriority={priority && index === 0 ? 'high' : 'auto'}
                decoding="async"
                onError={() => handleImageError(index)}
                className={cn(
                  'crossfade absolute inset-0 h-full w-full object-cover',
                  index === activeSlide ? 'opacity-100' : 'opacity-0',
                )}
              />
            ),
          )}
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-subtle">
          <ImageIcon className="h-8 w-8" aria-hidden="true" />
          <span className="sr-only">{t('listings.card.photoNone')}</span>
        </div>
      )}

      {/* Top-left badges */}
      <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
        {promoted && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-warning px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {t('listings.featured.badge')}
          </span>
        )}
        {listing.isRoommate && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-info px-2 py-1 text-[10px] font-black text-white shadow-sm">
            <Users className="h-3 w-3" aria-hidden="true" />
            {t('common.rentalType.roommate')}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleFavorite}
        // The card root is a `role="button"` with its own key handler, so
        // without this a Space press on the heart also opened the listing.
        onKeyDown={(event) => event.stopPropagation()}
        aria-label={isFavorite ? t('common.action.unfavorite') : t('common.action.favorite')}
        aria-pressed={isFavorite}
        /* 44px under `sm`, where the pointer is a finger, and the original
           36 above it, where it is a cursor that does not miss. */
        className="press absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 shadow-sm backdrop-blur transition-all hover:scale-110 sm:h-9 sm:w-9"
      >
        <Heart
          className={cn(
            'h-4 w-4 transition-colors',
            isFavorite ? 'fill-danger text-danger' : 'text-muted',
          )}
          aria-hidden="true"
        />
      </button>

      {/* The count pill said "5" and did nothing. Dots say the same number,
          say which one you are on, and are the control for getting there. */}
      {hasPhoto && images.length > 1 && (
        <div
          role="group"
          aria-label={t('listings.card.photoPosition', {
            current: activeSlide + 1,
            total: images.length,
          })}
          className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-gradient-to-t from-black/40 to-transparent pb-1 pt-6"
        >
          {images.map((src, index) => (
            <button
              key={`${listing.id}-dot-${index}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setSlide(index);
              }}
              onKeyDown={(event) => event.stopPropagation()}
              aria-label={t('listings.card.photoDot', { index: index + 1 })}
              aria-current={index === activeSlide}
              /* The dot stays 6px; the button around it is a thumb.
                 At 24px square these sat close enough together that hitting
                 the wrong photo was easier than hitting the right one, and
                 this is the control that appears most on the busiest screen.
                 The negative margin gives the row back the height the taller
                 button takes, so nothing moves — the extra area simply
                 overlaps the photo above and below. */
              className="press -my-2.5 flex h-11 w-7 items-center justify-center"
            >
              <span
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === activeSlide ? 'w-4 bg-white' : 'w-1.5 bg-white/60',
                  failedSlides.has(index) && 'opacity-30',
                )}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const body = (
    <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${isList ? 'p-3' : 'p-3.5 sm:p-4'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-base sm:text-lg font-black leading-tight text-content">
          {/* The listing's own currency, not a converted one. A price set in
              dollars is a dollar price — rewriting it into so'm at today's
              rate would restate the owner's terms as something they never
              said, and would change on its own overnight. */}
          {formatPrice(listing.price, listing.currency)}
          <span className="ml-1 text-[10px] sm:text-xs font-semibold text-subtle">
            {t('listings.card.perMonth')}
          </span>
          {/* The other currency underneath, marked approximate. Most searchers
              here think in so'm and most agencies quote in dollars; showing
              only one of them makes somebody do arithmetic before they can
              compare two listings. */}
          {converted !== null && (
            <span className="block text-[10px] sm:text-xs font-semibold text-subtle">
              ≈ {formatPrice(converted.amount, converted.currency)}
            </span>
          )}
        </p>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] font-black ${trust.className}`}
          /* The bare number plus an icon is the whole explanation here, so the
             hover text has to carry the meaning: the figure starts at 100 and
             only a confirmed complaint moves it. Nothing about it is a scan. */
          title={t('listings.detail.trustTooltip', { score: listing.trustScore })}
        >
          <ShieldCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden="true" />
          {listing.trustScore}
        </span>
      </div>

      {/* The one real anchor on the card. The whole tile stays clickable, but
          a `<div onClick>` is invisible to a crawler — without this there is
          no link from any grid to any listing, and nothing below the home
          page is discoverable.

          The clamp alone did not make two neighbouring cards agree: it caps a
          long title at two lines but lets a short one occupy one, and that
          missing line was the difference in height between a card whose title
          fits and the card beside it. Reserving the clamped height fixes the
          card's tallest variable row at a constant. The floor is in `em`, so
          it tracks the 13px/14px step and `leading-snug` (1.375) without a
          second breakpoint: two lines is 2.75em, one line 1.375em. The list
          variant gets one line — its card is a fixed 144/176px and a second
          title line is what pushed the meta rows out of the bottom of it. */}
      <h3
        className={cn(
          'text-[13px] sm:text-sm font-bold leading-snug text-content',
          isList ? 'line-clamp-1 min-h-[1.375em]' : 'line-clamp-2 min-h-[2.75em]',
        )}
      >
        <AppLink
          to={href}
          onClick={(event) => {
            event.stopPropagation();
            // Where a caller owns what "open" means — the assistant overlay
            // closes itself on the way — the anchor defers to it instead of
            // navigating out from under it. Preventing the default is what
            // tells AppLink to stand down.
            if (onOpen) {
              event.preventDefault();
              onOpen(listing);
            }
          }}
          className="transition-colors hover:text-brand-text"
        >
          {listing.title}
        </AppLink>
      </h3>

      {/* The grid card wraps this row; the list card must not.
          A list card is a fixed 144/176px box with `overflow-hidden` on the
          root, and its budget is spent: price, one title line, this row, the
          optional metro line and the closing row leave under ten pixels of
          slack at 144. A second meta line costs ~21px, so on a narrow phone a
          listing that has rooms AND area AND district AND a metro station
          pushed the closing row — the seller badge and the age of the
          listing — out through the bottom edge, where the clip silently ate
          it. This is the same call the title makes two rows up and for the
          same reason: in the list variant a row that can grow is a row that
          breaks the card, so the district chip loses its tail (it already
          `truncate`s) instead of the card losing its last line. */}
      <div
        className={cn(
          'flex items-center gap-x-2 sm:gap-x-3 gap-y-1 text-[11px] sm:text-xs text-muted',
          isList ? 'min-w-0 flex-nowrap overflow-hidden' : 'flex-wrap',
        )}
      >
        {/* Rooms and the area are two or three characters and are the two
            figures a scan compares, so they never give up width; the district
            is the one that yields, which is why it is the only member of the
            row without `shrink-0`. In the wrapping grid variant none of this
            applies — nothing is competing for a single line there. */}
        <span className="inline-flex shrink-0 items-center gap-1">
          <BedDouble className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
          {t('common.filters.roomsValue', { count: listing.rooms })}
        </span>
        {listing.area ? (
          <span className="inline-flex shrink-0 items-center gap-1">
            <Maximize2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
            {listing.area} {t('common.units.sqm')}
          </span>
        ) : null}
        {listing.district ? (
          <span className="inline-flex min-w-0 items-center gap-1 truncate max-w-[80px] sm:max-w-none">
            <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" aria-hidden="true" />
            {listing.district}
          </span>
        ) : null}
      </div>

      {listing.metroStation && (
        <p className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-brand-text truncate">
          <Train className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
          {listing.metroDistanceMinutes
            ? t('listings.card.metro', {
                station: listing.metroStation,
                minutes: listing.metroDistanceMinutes,
              })
            : listing.metroStation}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        {/* This slot promised "direct contact" on every card in the grid,
            which is a claim about who picks up the phone — and agents publish
            here now, so on their listings it was simply untrue. Saying which
            of the two it is costs the same pixels and is the only version a
            visitor can act on.
            The agent tone is `info`, not `warning`: an agency listing is a
            legitimate one, and any of the colours this app spends on problems
            would turn a statement of fact into a caution. */}
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black',
            isAgentListing ? 'bg-info-soft text-info' : 'bg-brand-soft text-brand-text',
          )}
        >
          {t(isAgentListing ? 'listings.seller.agentBadge' : 'listings.seller.ownerBadge')}
        </span>
        <span className="text-[10px] sm:text-[11px] text-subtle">
          {listing.createdAt ? formatRelativeTime(listing.createdAt) : null}
        </span>
      </div>
    </div>
  );

  return (
    <article
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={listing.title}
      className={`group press-sm cursor-pointer overflow-hidden rounded-2xl border bg-surface shadow-card
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised
        focus-visible:outline-none
        ${promoted ? 'border-warning/40 ring-1 ring-warning/20' : 'border-line'}
        ${isList ? 'flex h-36 sm:h-44' : 'flex h-full flex-col'}`}
    >
      {media}
      {body}
    </article>
  );
};

// ---------------------------------------------------------------------------
export const ListingCardSkeleton: React.FC<{ variant?: 'grid' | 'list' }> = ({
  variant = 'grid',
}) => (
  <div
    className={`overflow-hidden rounded-2xl border border-line bg-surface ${
      // Same height contract as the real card: the skeleton grid is the first
      // thing a visitor sees, and a row of ragged placeholders resolving into
      // a row of even cards reads as the page settling twice.
      variant === 'list' ? 'flex h-36 sm:h-44' : 'flex h-full flex-col'
    }`}
    aria-hidden="true"
  >
    <div
      className={`animate-shimmer shrink-0 ${
        variant === 'list' ? 'h-full w-36 sm:w-52' : 'aspect-[4/3] w-full'
      }`}
    />
    <div className="flex-1 space-y-2.5 p-4">
      <div className="h-5 w-1/2 animate-shimmer rounded-md" />
      <div className="h-4 w-full animate-shimmer rounded-md" />
      <div className="h-4 w-2/3 animate-shimmer rounded-md" />
      <div className="h-3 w-1/3 animate-shimmer rounded-md" />
    </div>
  </div>
);

export default ListingCard;
