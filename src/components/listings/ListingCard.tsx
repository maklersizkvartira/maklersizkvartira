/**
 * A listing card.
 *
 * Two shapes from one component: the default vertical card for the grid, and
 * a horizontal `list` variant. Both share the same badge, price and trust
 * treatment so a listing looks like itself wherever it appears.
 */

import React, { useState } from 'react';
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
  Video,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { AppLink } from '../../router/AppLink';
import { listingPath } from '../../seo/routes';
import { listingSlug } from '../../seo/slugs';

interface ListingCardProps {
  listing: Listing;
  variant?: 'grid' | 'list' | 'compact';
  /** Renders the promoted styling used by the featured rail. */
  promoted?: boolean;
  onOpen?: (listing: Listing) => void;
  priority?: boolean;
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
}) => {
  const { t, formatPrice, formatRelativeTime } = useTranslation();
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const [imageError, setImageError] = useState(false);

  const isFavorite = favoriteIds.has(listing.id);
  const cover = listing.images?.[0];
  const trust = trustTone(listing.trustScore ?? 0);
  const href = listingPath({ id: listing.id, slug: listingSlug(listing) });

  const open = () => {
    if (onOpen) onOpen(listing);
    else setCurrentView('LISTING_DETAIL', listing.id);
  };

  const handleFavorite = (event: React.MouseEvent) => {
    event.stopPropagation();
    void toggleFavorite(listing.id);
  };

  const isList = variant === 'list';

  const media = (
    <div
      className={`relative shrink-0 overflow-hidden bg-surface-2 ${
        isList ? 'h-full w-36 sm:w-52' : 'aspect-[4/3] w-full'
      }`}
    >
      {cover && !imageError ? (
        /* The property photo is the content, not decoration: an empty alt told
           Google Images and every screen reader to ignore it. */
        <img
          src={cover}
          alt={listing.title}
          width={isList ? 208 : 800}
          height={isList ? 176 : 600}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onError={() => setImageError(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-subtle">
          <ImageIcon className="h-8 w-8" aria-hidden="true" />
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
        aria-label={isFavorite ? t('common.action.unfavorite') : t('common.action.favorite')}
        aria-pressed={isFavorite}
        className="absolute right-2 top-2 rounded-full bg-surface/90 p-2 shadow-sm backdrop-blur transition-all hover:scale-110 active:scale-95"
      >
        <Heart
          className={`h-4 w-4 transition-colors ${
            isFavorite ? 'fill-danger text-danger' : 'text-muted'
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Bottom-right media hints */}
      <div className="absolute bottom-2 right-2 flex gap-1.5">
        {listing.videoUrl && (
          <span className="rounded-md bg-black/70 p-1.5 text-white" title={t('listings.amenities.video')}>
            <Video className="h-3 w-3" aria-hidden="true" />
          </span>
        )}
        {listing.images?.length > 1 && (
          <span className="rounded-md bg-black/70 px-1.5 py-1 text-[10px] font-bold text-white">
            {listing.images.length}
          </span>
        )}
      </div>
    </div>
  );

  const body = (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 ${isList ? 'p-3.5' : 'p-4'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-black leading-tight text-content">
          {formatPrice(listing.price)}
          <span className="ml-1 text-xs font-semibold text-subtle">
            {t('listings.card.perMonth')}
          </span>
        </p>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black ${trust.className}`}
          title={t('common.badge.trustScore', { score: listing.trustScore })}
        >
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          {listing.trustScore}
        </span>
      </div>

      {/* The one real anchor on the card. The whole tile stays clickable, but
          a `<div onClick>` is invisible to a crawler — without this there is
          no link from any grid to any listing, and nothing below the home
          page is discoverable. */}
      <h3 className="line-clamp-2 text-sm font-bold leading-snug text-content">
        <AppLink
          to={href}
          onClick={(event) => event.stopPropagation()}
          className="transition-colors hover:text-brand-text"
        >
          {listing.title}
        </AppLink>
      </h3>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <BedDouble className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.filters.roomsValue', { count: listing.rooms })}
        </span>
        {listing.area ? (
          <span className="inline-flex items-center gap-1">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            {listing.area} {t('common.units.sqm')}
          </span>
        ) : null}
        {listing.district ? (
          <span className="inline-flex items-center gap-1 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {listing.district}
          </span>
        ) : null}
      </div>

      {listing.metroStation && (
        <p className="inline-flex items-center gap-1 text-xs font-semibold text-brand-text">
          <Train className="h-3.5 w-3.5" aria-hidden="true" />
          {listing.metroDistanceMinutes
            ? t('listings.card.metro', {
                station: listing.metroStation,
                minutes: listing.metroDistanceMinutes,
              })
            : listing.metroStation}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-[10px] font-black text-brand-text">
          {t('common.badge.noCommission')}
        </span>
        <span className="text-[11px] text-subtle">
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
      className={`group cursor-pointer overflow-hidden rounded-2xl border bg-surface shadow-card
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised
        focus-visible:outline-none
        ${promoted ? 'border-warning/40 ring-1 ring-warning/20' : 'border-line'}
        ${isList ? 'flex h-36 sm:h-44' : 'flex flex-col'}`}
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
      variant === 'list' ? 'flex h-36 sm:h-44' : ''
    }`}
    aria-hidden="true"
  >
    <div
      className={`animate-shimmer ${
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
