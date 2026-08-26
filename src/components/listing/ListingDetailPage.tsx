/**
 * Listing detail.
 *
 * The listing is fetched by id instead of being dug out of whatever happens to
 * sit in the store: a deep link (`/?listing=…`) has no result list behind it,
 * and the previous fuzzy id matching ("does one id end with the other") could
 * open the wrong flat.
 *
 * The owner's phone number is not part of the public payload. When the server
 * withholds it the UI still shows the contact block, but as a prompt to sign
 * in — a revealed number is what `recordContact` counts, so it must only fire
 * when a real number reaches the screen.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  Flag,
  GraduationCap,
  Heart,
  Image as ImageIcon,
  Layers,
  MapPin,
  Maximize2,
  MessageSquare,
  Pencil,
  Phone,
  Send,
  Share2,
  ShieldCheck,
  Train,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';

import { VerificationBadge } from '../common/VerificationBadge';
import { useTranslation } from '../../i18n';
import { ApiError } from '../../services/http';
import { ListingsApi } from '../../services/listingsApi';
import { useAppStore } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { Button, SelectInput } from '../ui/Field';

type LoadStatus = 'loading' | 'ready' | 'notFound' | 'error';

/** Same thresholds as ListingCard, so one listing reads the same everywhere. */
function trustToneClass(score: number): string {
  if (score >= 80) return 'bg-brand-soft text-brand-text';
  if (score >= 60) return 'bg-info-soft text-info';
  if (score >= 40) return 'bg-warning-soft text-warning';
  return 'bg-danger-soft text-danger';
}

const AMENITY_FIELDS = [
  ['furnished', 'listings.amenities.furnished'],
  ['parking', 'listings.amenities.parking'],
  ['internet', 'listings.amenities.internet'],
  ['airConditioning', 'listings.amenities.airConditioning'],
  ['washingMachine', 'listings.amenities.washingMachine'],
  ['petsAllowed', 'listings.amenities.petsAllowed'],
] as const;

/** Server-side reason codes paired with their labels. */
const REPORT_REASONS = [
  ['SCAM', 'listings.report.reasons.scam'],
  ['BROKER', 'listings.report.reasons.broker'],
  ['FAKE_LISTING', 'listings.report.reasons.fakeListing'],
  ['FAKE_PHOTOS', 'listings.report.reasons.fakePhotos'],
  ['WRONG_PRICE', 'listings.report.reasons.wrongPrice'],
  ['SPAM', 'listings.report.reasons.spam'],
  ['HARASSMENT', 'listings.report.reasons.harassment'],
  ['OTHER', 'listings.report.reasons.other'],
] as const;

const PROPERTY_TYPE_KEYS = {
  APARTMENT: 'listings.propertyType.apartment',
  HOUSE: 'listings.propertyType.house',
  ROOM: 'listings.propertyType.room',
  STUDIO: 'listings.propertyType.studio',
  DORMITORY: 'listings.propertyType.dormitory',
} as const;

const SAFETY_TIPS = ['tip1', 'tip2', 'tip3', 'tip4'] as const;

const cardClass = 'rounded-2xl border border-line bg-surface shadow-card';

// ---------------------------------------------------------------------------
const DetailSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6" aria-busy="true" aria-label={label}>
    <div className="h-9 w-32 animate-shimmer rounded-xl" />
    <div className="space-y-2.5">
      <div className="h-6 w-2/3 animate-shimmer rounded-md" />
      <div className="h-4 w-1/3 animate-shimmer rounded-md" />
    </div>
    <div className="aspect-[4/3] w-full animate-shimmer rounded-2xl sm:aspect-video" />
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="h-24 w-full animate-shimmer rounded-2xl" />
        <div className="h-40 w-full animate-shimmer rounded-2xl" />
        <div className="h-32 w-full animate-shimmer rounded-2xl" />
      </div>
      <div className="h-72 w-full animate-shimmer rounded-2xl" />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
/**
 * Builds a YouTube embed URL, or returns null.
 *
 * Substring-matching "youtube.com" anywhere in the string let an owner point
 * the iframe at any site they liked (`https://evil.example/?x=youtube.com`),
 * so the host is parsed and compared exactly.
 */
function youTubeEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const host = url.hostname.replace(/^www\./, '');
  let videoId: string | null = null;

  if (host === 'youtu.be') {
    videoId = url.pathname.slice(1);
  } else if (host === 'youtube.com' || host === 'm.youtube.com') {
    videoId = url.pathname.startsWith('/embed/')
      ? url.pathname.slice('/embed/'.length)
      : url.searchParams.get('v');
  } else {
    return null;
  }

  return videoId && /^[A-Za-z0-9_-]{6,20}$/.test(videoId)
    ? `https://www.youtube.com/embed/${videoId}`
    : null;
}

export const ListingDetailPage: React.FC = () => {
  const { t, formatDate, formatNumber, formatPrice } = useTranslation();

  const selectedListingId = useAppStore((state) => state.selectedListingId);
  const currentUser = useAppStore((state) => state.currentUser);
  const currency = useAppStore((state) => state.currency);
  const fxRate = useAppStore((state) => state.fxRate);
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const removeListing = useAppStore((state) => state.removeListing);
  const recordView = useAppStore((state) => state.recordView);
  const recordContact = useAppStore((state) => state.recordContact);
  const pushToast = useAppStore((state) => state.pushToast);

  const [listing, setListing] = useState<Listing | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  const [activeMedia, setActiveMedia] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [imageIndex, setImageIndex] = useState(0);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0][0]);
  const [reportText, setReportText] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const viewedIdRef = useRef<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Load ----------------------------------------------------------------
  useEffect(() => {
    if (!selectedListingId) {
      setListing(null);
      setStatus('notFound');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setPhoneVisible(false);
    setImageIndex(0);
    setActiveMedia('IMAGE');

    ListingsApi.byId(selectedListingId)
      .then((data) => {
        if (cancelled) return;
        setListing(data);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setListing(null);
        setStatus(error instanceof ApiError && error.status === 404 ? 'notFound' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedListingId, reloadToken]);

  // One view per listing: the ref survives StrictMode's double-invoked effects.
  useEffect(() => {
    if (status !== 'ready' || !listing) return;
    if (viewedIdRef.current === listing.id) return;
    viewedIdRef.current = listing.id;
    recordView(listing.id);
  }, [status, listing, recordView]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  // Escape closes the report dialog, as a dialog is expected to.
  useEffect(() => {
    if (!reportOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setReportOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reportOpen]);

  // -- Derived -------------------------------------------------------------
  const images = useMemo(
    () => Array.from(new Set((listing?.images ?? []).filter(Boolean))),
    [listing],
  );

  const displayAddress = useMemo(() => {
    if (!listing) return '';
    const address = (listing.address ?? '').trim();
    const district = (listing.district ?? '').trim();
    const region = (listing.region ?? '').trim();
    const parts: string[] = [];

    if (address) parts.push(address);
    // Skip a part the free-text address already names, so the line does not
    // read "Chilonzor 12 , Chilonzor tumani".
    if (district && !address.toLowerCase().includes(district.toLowerCase())) {
      parts.push(t('listings.detail.districtNamed', { name: district }));
    }
    if (
      region &&
      !address.toLowerCase().includes(region.toLowerCase()) &&
      !district.toLowerCase().includes(region.toLowerCase())
    ) {
      parts.push(region);
    }
    return parts.join(', ');
  }, [listing, t]);

  const ownerPhone = (listing?.owner?.phone ?? '').trim();
  const isOwnListing = Boolean(currentUser && listing && currentUser.id === listing.owner?.id);
  const isFavorite = listing ? favoriteIds.has(listing.id) : false;

  // Everything is stored in UZS; a USD listing is normalised once, here.
  const priceUzs = listing
    ? listing.currency === 'USD'
      ? listing.price * fxRate
      : listing.price
    : 0;
  const depositUzs = listing?.depositPrice
    ? listing.currency === 'USD'
      ? listing.depositPrice * fxRate
      : listing.depositPrice
    : 0;
  const priceLabel =
    currency === 'USD' ? formatPrice(priceUzs / fxRate, 'USD') : formatPrice(priceUzs);
  const depositLabel =
    currency === 'USD' ? formatPrice(depositUzs / fxRate, 'USD') : formatPrice(depositUzs);

  // -- Actions -------------------------------------------------------------
  const handleShare = useCallback(async () => {
    if (!listing) return;
    const url = `${window.location.origin}/?listing=${encodeURIComponent(listing.id)}`;
    const text = t('listings.card.shareText', { title: listing.title, price: priceLabel });

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: listing.title, text, url });
        return;
      } catch (error: unknown) {
        // A dismissed share sheet is a choice, not a failure.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      pushToast('layout.toast.copiedLink', 'success');
    } catch {
      pushToast('common.error.generic', 'error');
    }
  }, [listing, priceLabel, pushToast, t]);

  const handleRevealPhone = useCallback(() => {
    if (!listing) return;
    // The number is missing from the payload for viewers the server does not
    // trust yet; signing in is what usually unlocks it.
    if (!currentUser) {
      setShowAuth(true, 'LOGIN');
      return;
    }
    if (!ownerPhone) return;
    setPhoneVisible(true);
    recordContact(listing.id);
  }, [currentUser, listing, ownerPhone, recordContact, setShowAuth]);

  const handleDelete = useCallback(async () => {
    if (!listing) return;
    setDeleting(true);
    try {
      await removeListing(listing.id);
      setCurrentView('MY_LISTINGS');
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }, [listing, removeListing, setCurrentView]);

  const handleReportSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!listing || reportSending) return;
      setReportSending(true);
      try {
        await ListingsApi.report(listing.id, reportReason, reportText.trim());
        setReportSent(true);
        setReportText('');
        closeTimerRef.current = setTimeout(() => {
          setReportOpen(false);
          setReportSent(false);
        }, 2200);
      } catch (error: unknown) {
        pushToast(
          error instanceof ApiError && error.isNetwork
            ? 'common.error.network'
            : 'common.error.generic',
          'error',
        );
      } finally {
        setReportSending(false);
      }
    },
    [listing, pushToast, reportReason, reportSending, reportText],
  );

  // -- Non-content states --------------------------------------------------
  if (status === 'loading') {
    return <DetailSkeleton label={t('common.a11y.loading')} />;
  }

  if (status !== 'ready' || !listing) {
    const isMissing = status === 'notFound';
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-subtle">
          {isMissing ? (
            <MapPin className="h-7 w-7" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          )}
        </span>
        <h1 className="text-xl font-black text-content">
          {isMissing ? t('listings.detail.notFoundTitle') : t('common.state.error')}
        </h1>
        <p className="text-sm text-muted">
          {isMissing ? t('listings.detail.notFoundBody') : t('common.error.generic')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!isMissing && (
            <Button variant="secondary" onClick={() => setReloadToken((token) => token + 1)}>
              {t('common.error.tryAgain')}
            </Button>
          )}
          <Button onClick={() => setCurrentView('LISTINGS')}>
            {t('listings.detail.backToList')}
          </Button>
        </div>
      </div>
    );
  }

  const propertyTypeKey = PROPERTY_TYPE_KEYS[listing.propertyType];
  const joinedDate = listing.owner?.joinedDate;
  const joinedLabel =
    joinedDate && !Number.isNaN(new Date(joinedDate).getTime()) ? formatDate(joinedDate) : null;
  const activeImage = images[imageIndex] ?? images[0];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
      {/* ------------------------------------------------------------------ */}
      {/* Toolbar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCurrentView('LISTINGS')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-muted shadow-card transition-colors hover:text-content"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden xs:inline">{t('common.action.back')}</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => void toggleFavorite(listing.id)}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite ? t('common.action.unfavorite') : t('common.action.favorite')
            }
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
              isFavorite
                ? 'border-danger/30 bg-danger-soft text-danger'
                : 'border-line bg-surface text-muted hover:text-content'
            }`}
          >
            <Heart
              className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {isFavorite ? t('listings.card.savedListing') : t('listings.card.saveListing')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label={t('listings.card.shareListing')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-brand-soft px-3 py-2 text-xs font-bold text-brand-text transition-colors hover:bg-brand-soft-2"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('common.action.share')}</span>
          </button>

          <button
            type="button"
            onClick={() => setReportOpen(true)}
            aria-label={t('common.action.report')}
            aria-haspopup="dialog"
            className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-bold text-danger transition-opacity hover:opacity-80"
          >
            <Flag className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('common.action.report')}</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Heading                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black ${trustToneClass(
              listing.trustScore ?? 0,
            )}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('common.badge.trustScore', { score: listing.trustScore ?? 0 })}
          </span>

          {listing.owner?.verificationLevel ? (
            <VerificationBadge level={listing.owner.verificationLevel} size="sm" />
          ) : null}

          {listing.isRoommate ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-warning-soft px-2.5 py-1 text-[11px] font-black text-warning">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {t('common.rentalType.roommate')}
              {' · '}
              {t('listings.card.roommateSpots', {
                count: listing.roommateSpotsAvailable ?? 1,
              })}
            </span>
          ) : null}

          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-muted">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {t('listings.card.viewsCount', { count: formatNumber(listing.viewsCount ?? 0) })}
          </span>
        </div>

        <h1 className="text-2xl font-black leading-tight text-content sm:text-3xl">
          {listing.title}
        </h1>

        {isOwnListing && (
          <div className={`${cardClass} flex flex-wrap items-center justify-between gap-3 p-3.5`}>
            <p className="text-xs font-bold text-muted">{t('listings.detail.ownerToolbar')}</p>

            {confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-danger">
                  {t('listings.detail.confirmDelete')}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  aria-busy={deleting || undefined}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-danger px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting && (
                    <span
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                  )}
                  {t('common.action.confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-xl px-3 py-2 text-xs font-bold text-muted transition-colors hover:bg-surface-2 hover:text-content"
                >
                  {t('common.action.cancel')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Editing lives on the owner's listings screen, which owns the form. */}
                <button
                  type="button"
                  onClick={() => setCurrentView('MY_LISTINGS')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-on-brand shadow-brand transition-all active:scale-[0.98]"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('common.action.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2 text-xs font-bold text-danger transition-opacity hover:opacity-80"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('common.action.delete')}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
          {displayAddress && (
            <span className="inline-flex items-center gap-1 font-semibold text-content">
              <MapPin className="h-4 w-4 text-brand" aria-hidden="true" />
              {displayAddress}
            </span>
          )}

          {listing.metroStation && (
            <span className="inline-flex items-center gap-1 font-semibold text-info">
              <Train className="h-4 w-4" aria-hidden="true" />
              {listing.metroDistanceMinutes
                ? t('listings.card.metro', {
                    station: listing.metroStation,
                    minutes: listing.metroDistanceMinutes,
                  })
                : listing.metroStation}
            </span>
          )}

          {listing.universityName && (
            <span className="inline-flex items-center gap-1 font-semibold text-warning">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              {listing.universityDistanceMinutes
                ? t('listings.card.university', {
                    name: listing.universityName,
                    minutes: listing.universityDistanceMinutes,
                  })
                : listing.universityName}
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Media                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        {listing.videoUrl && (
          <div
            className="hide-scrollbar flex items-center gap-2 overflow-x-auto border-b border-line pb-2"
            role="group"
            aria-label={t('listings.detail.mediaTabsLabel')}
          >
            <button
              type="button"
              onClick={() => setActiveMedia('IMAGE')}
              aria-pressed={activeMedia === 'IMAGE'}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-black transition-colors ${
                activeMedia === 'IMAGE'
                  ? 'bg-brand text-on-brand'
                  : 'bg-surface-2 text-muted hover:text-content'
              }`}
            >
              {t('listings.detail.photosTab', { count: images.length })}
            </button>
            <button
              type="button"
              onClick={() => setActiveMedia('VIDEO')}
              aria-pressed={activeMedia === 'VIDEO'}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-colors ${
                activeMedia === 'VIDEO'
                  ? 'bg-brand text-on-brand'
                  : 'bg-surface-2 text-muted hover:text-content'
              }`}
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              {t('listings.detail.videoTab')}
            </button>
          </div>
        )}

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-2 shadow-card sm:aspect-video">
          {activeMedia === 'VIDEO' && listing.videoUrl ? (
            youTubeEmbedUrl(listing.videoUrl) ? (
              <iframe
                src={youTubeEmbedUrl(listing.videoUrl) as string}
                title={t('listings.detail.videoTitle')}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video controls src={listing.videoUrl} className="h-full w-full object-contain">
                {t('listings.detail.videoUnsupported')}
              </video>
            )
          ) : activeImage ? (
            <>
              <img
                src={activeImage}
                alt={listing.title}
                className="h-full w-full object-cover"
                decoding="async"
              />
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setImageIndex((index) => (index - 1 + images.length) % images.length)
                    }
                    aria-label={t('common.a11y.prevImage')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 p-2 text-content shadow-card backdrop-blur transition-transform hover:scale-110"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageIndex((index) => (index + 1) % images.length)}
                    aria-label={t('common.a11y.nextImage')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 p-2 text-content shadow-card backdrop-blur transition-transform hover:scale-110"
                  >
                    <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
                  </button>
                  <span
                    className="absolute bottom-2 right-2 rounded-md bg-surface/90 px-2 py-1 text-[11px] font-bold text-content backdrop-blur"
                    aria-live="polite"
                  >
                    {t('listings.detail.imageOf', {
                      current: imageIndex + 1,
                      total: images.length,
                    })}
                  </span>
                </>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-subtle">
              <ImageIcon className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
        </div>

        {activeMedia === 'IMAGE' && images.length > 1 && (
          <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => setImageIndex(index)}
                aria-label={t('listings.detail.showImage', { index: index + 1 })}
                aria-current={imageIndex === index}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                  imageIndex === index
                    ? 'border-brand'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Body                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-6 lg:col-span-2">
          {/* Key specs */}
          <dl className={`${cardClass} grid grid-cols-2 gap-4 p-5 text-center sm:grid-cols-4`}>
            <div className="space-y-1">
              <dt className="flex items-center justify-center gap-1 text-xs font-medium text-subtle">
                <BedDouble className="h-3.5 w-3.5" aria-hidden="true" />
                {t('common.filters.rooms')}
              </dt>
              <dd className="text-base font-extrabold text-content">
                {t('common.filters.roomsValue', { count: listing.rooms })}
              </dd>
            </div>
            <div className="space-y-1 border-line sm:border-l">
              <dt className="flex items-center justify-center gap-1 text-xs font-medium text-subtle">
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('common.filters.area')}
              </dt>
              <dd className="text-base font-extrabold text-content">
                {formatNumber(listing.area)} {t('common.units.sqm')}
              </dd>
            </div>
            <div className="space-y-1 border-line sm:border-l">
              <dt className="flex items-center justify-center gap-1 text-xs font-medium text-subtle">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                {t('listings.detail.floorLabel')}
              </dt>
              <dd className="text-base font-extrabold text-content">
                {t('common.units.floor', { floor: listing.floor, total: listing.totalFloors })}
              </dd>
            </div>
            <div className="space-y-1 border-line sm:border-l">
              <dt className="flex items-center justify-center gap-1 text-xs font-medium text-subtle">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('common.filters.propertyType')}
              </dt>
              <dd className="text-base font-extrabold text-content">
                {propertyTypeKey ? t(propertyTypeKey) : '—'}
              </dd>
            </div>
          </dl>

          {/* Description */}
          <section className={`${cardClass} space-y-3 p-5 sm:p-6`}>
            <h2 className="text-lg font-extrabold text-content">
              {t('listings.detail.aboutTitle')}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
              {listing.description}
            </p>
          </section>

          {/* Location */}
          <section className={`${cardClass} space-y-3 p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-content">
                <MapPin className="h-5 w-5 text-brand" aria-hidden="true" />
                {t('listings.detail.locationTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setCurrentView('MAP', listing.id)}
                className="rounded-xl border border-line bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-brand-text transition-colors hover:bg-brand-soft-2"
              >
                {t('listings.detail.viewOnMap')}
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-4">
              <p className="text-sm font-bold text-content">{displayAddress}</p>
              <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <div className="inline-flex items-center gap-1">
                  <dt>{t('common.filters.region')}:</dt>
                  <dd className="font-bold text-content">{listing.region}</dd>
                </div>
                <div className="inline-flex items-center gap-1">
                  <dt>{t('common.filters.district')}:</dt>
                  <dd className="font-bold text-content">{listing.district}</dd>
                </div>
                {listing.metroStation && (
                  <div className="inline-flex items-center gap-1">
                    <dt>{t('common.filters.metro')}:</dt>
                    <dd className="font-bold text-brand-text">
                      {listing.metroDistanceMinutes
                        ? t('listings.card.metro', {
                            station: listing.metroStation,
                            minutes: listing.metroDistanceMinutes,
                          })
                        : listing.metroStation}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </section>

          {/* Amenities */}
          <section className={`${cardClass} space-y-4 p-5 sm:p-6`}>
            <h2 className="text-lg font-extrabold text-content">
              {t('listings.detail.amenitiesTitle')}
            </h2>
            <ul className="grid grid-cols-2 gap-3 text-xs font-semibold sm:grid-cols-3">
              {AMENITY_FIELDS.map(([field, labelKey]) => {
                const available = Boolean(listing[field]);
                return (
                  <li
                    key={field}
                    className={`flex items-center gap-2 rounded-xl border p-3 ${
                      available
                        ? 'border-brand/30 bg-brand-soft text-brand-text'
                        : 'border-line bg-surface-2 text-subtle'
                    }`}
                  >
                    {available ? (
                      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{t(labelKey)}</span>
                    <span className="sr-only">
                      {available
                        ? t('listings.detail.amenityAvailable')
                        : t('listings.detail.amenityUnavailable')}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Moderation verdict */}
          <section className={`${cardClass} space-y-4 p-5 sm:p-6`}>
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-brand" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-extrabold text-content">
                    {t('listings.detail.aiTitle')}
                  </h2>
                  <p className="text-[11px] text-subtle">{t('listings.detail.aiSubtitle')}</p>
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black ${trustToneClass(
                  listing.trustScore ?? 0,
                )}`}
              >
                {t('common.badge.trustScore', { score: listing.trustScore ?? 0 })}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted">
                {t('listings.detail.aiReasonsTitle')}
              </h3>
              {listing.aiRiskReasons?.length ? (
                <ul className="space-y-1.5">
                  {listing.aiRiskReasons.map((reason) => (
                    <li
                      key={reason}
                      className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 p-2.5 text-xs text-muted"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-subtle">{t('listings.detail.aiNoReasons')}</p>
              )}
            </div>
          </section>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Sidebar                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-5">
          <section className={`${cardClass} space-y-5 p-5 sm:p-6 lg:sticky lg:top-24`}>
            <div className="space-y-1.5">
              <h2 className="text-xs font-semibold text-subtle">
                {t('listings.detail.priceTitle')}
              </h2>
              <p className="text-3xl font-black text-content">
                {priceLabel}
                <span className="ml-1 text-sm font-medium text-subtle">
                  {listing.isRoommate
                    ? t('common.units.perPerson')
                    : t('common.units.perMonth')}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="rounded-md bg-brand-soft px-2 py-0.5 font-black text-brand-text">
                  {t('common.badge.noCommission')}
                </span>
                <span className={listing.utilitiesIncluded ? 'text-brand-text' : 'text-subtle'}>
                  {listing.utilitiesIncluded
                    ? t('listings.card.utilitiesIncluded')
                    : t('listings.detail.utilitiesExcluded')}
                </span>
                <span className="text-muted">
                  {depositUzs > 0
                    ? t('listings.card.deposit', { amount: depositLabel })
                    : t('listings.card.noDeposit')}
                </span>
              </div>
            </div>

            {/* Owner */}
            <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
              <h3 className="sr-only">{t('listings.detail.ownerTitle')}</h3>
              <div className="flex items-center gap-3">
                {listing.owner?.avatar ? (
                  <img
                    src={listing.owner.avatar}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full border-2 border-brand object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-3 text-subtle">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-content">
                    {listing.owner?.name || t('common.role.owner')}
                  </p>
                  {joinedLabel && (
                    <p className="text-[11px] text-subtle">
                      {t('listings.detail.memberSince', { date: joinedLabel })}
                    </p>
                  )}
                  <p className="text-[11px] text-subtle">
                    {t('listings.detail.ownerRentals', {
                      count: listing.owner?.successfulRentals ?? 0,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black ${trustToneClass(
                    listing.owner?.trustScore ?? 0,
                  )}`}
                >
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {t('common.badge.trustScore', { score: listing.owner?.trustScore ?? 0 })}
                </span>
                {listing.owner?.verificationLevel ? (
                  <VerificationBadge level={listing.owner.verificationLevel} size="sm" />
                ) : null}
              </div>

              {listing.preferredContactTime && (
                <p className="text-[11px] text-subtle">
                  {t('listings.detail.contactHours', { time: listing.preferredContactTime })}
                </p>
              )}
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <Button
                variant="secondary"
                fullWidth
                disabled={listing.owner.id === currentUser?.id}
                onClick={async () => {
                  if (!currentUser) {
                    setShowAuth(true, 'LOGIN');
                    return;
                  }
                  try {
                    const { chatApi } = await import('../../services/chatApi');
                    const conv = await chatApi.startOrGetConversation(listing.id);
                    setCurrentView('CHAT', null, conv.id);
                  } catch (e) {
                    useAppStore.getState().pushToast('common.error.generic', 'error');
                  }
                }}
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                {t('listings.card.contactOwner')}
              </Button>

              {phoneVisible && ownerPhone ? (
                <a
                  href={`tel:${ownerPhone.replace(/[^\d+]/g, '')}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 py-3.5 text-base font-black tracking-wide text-brand-text"
                  aria-live="polite"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {ownerPhone}
                </a>
              ) : (
                <Button
                  fullWidth
                  onClick={handleRevealPhone}
                  disabled={Boolean(currentUser) && !ownerPhone}
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {currentUser ? t('listings.card.showPhone') : t('listings.card.phoneHidden')}
                </Button>
              )}

              {currentUser && !ownerPhone && (
                <p className="text-[11px] leading-tight text-warning">
                  {t('listings.detail.phoneUnavailable')}
                </p>
              )}

              {listing.contactTelegram && (
                <a
                  href={`https://t.me/${listing.contactTelegram.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 py-3 text-xs font-bold text-content transition-colors hover:bg-surface-3"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {t('listings.detail.telegramContact')}
                </a>
              )}
            </div>

            {/* Safety */}
            <div className="space-y-2 rounded-xl border border-warning/30 bg-warning-soft p-3.5">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('listings.safety.title')}
              </h3>
              <ul className="space-y-1">
                {SAFETY_TIPS.map((tip) => (
                  <li key={tip} className="flex items-start gap-1.5 text-[11px] leading-tight text-muted">
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warning"
                      aria-hidden="true"
                    />
                    {t(`listings.safety.${tip}`)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                aria-haspopup="dialog"
                className="text-[11px] font-bold text-danger underline-offset-2 hover:underline"
              >
                {t('listings.safety.reportCta')}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Report dialog                                                       */}
      {/* ------------------------------------------------------------------ */}
      {reportOpen && (
        <div
          className="auth-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-dialog-title"
        >
          <div className="auth-sheet w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-raised sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
              <h2
                id="report-dialog-title"
                className="flex items-center gap-1.5 text-lg font-extrabold text-content"
              >
                <Flag className="h-5 w-5 text-danger" aria-hidden="true" />
                {t('listings.report.title')}
              </h2>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                aria-label={t('common.a11y.closeDialog')}
                className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-content"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {reportSent ? (
              <div className="space-y-2 py-8 text-center" role="status">
                <CheckCircle2 className="mx-auto h-12 w-12 text-brand" aria-hidden="true" />
                <p className="text-sm font-bold text-content">{t('listings.report.success')}</p>
              </div>
            ) : (
              <form onSubmit={(event) => void handleReportSubmit(event)} className="space-y-4">
                <p className="text-xs text-muted">{t('listings.report.subtitle')}</p>

                <div className="space-y-1.5">
                  <label
                    htmlFor="report-reason"
                    className="block text-xs font-bold text-muted"
                  >
                    {t('listings.report.reasonLabel')}
                  </label>
                  <SelectInput
                    id="report-reason"
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)} className="w-full"
              >
                    {REPORT_REASONS.map(([value, labelKey]) => (
                      <option key={value} value={value}>
                        {t(labelKey)}
                      </option>
                    ))}
                  </SelectInput>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="report-details"
                    className="block text-xs font-bold text-muted"
                  >
                    {t('listings.report.detailsLabel')}
                  </label>
                  <textarea
                    id="report-details"
                    rows={3}
                    required
                    value={reportText}
                    onChange={(event) => setReportText(event.target.value)}
                    placeholder={t('listings.report.detailsPlaceholder')}
                    className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm font-medium text-content placeholder:text-subtle focus:border-brand focus:outline-none"
                  />
                </div>

                <Button type="submit" variant="danger" fullWidth loading={reportSending}>
                  {t('listings.report.submit')}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingDetailPage;
