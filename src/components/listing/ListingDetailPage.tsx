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
  X,
} from 'lucide-react';

import { VerificationBadge } from '../common/VerificationBadge';
import { sellerTypeOf } from '../../types/roles';
import { useTranslation } from '../../i18n';
import { AMENITIES } from '../../data/amenities';
import { ApiError } from '../../services/http';
import { ListingsApi } from '../../services/listingsApi';
import { trackEvent } from '../../services/analytics';
import { useAppStore } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { Button, SelectInput } from '../ui/Field';
import { localisedPath } from '../../router/language';
import { listingPath } from '../../seo/routes';
import { listingSlug } from '../../seo/slugs';
import { useSeoHead } from '../../seo/useSeoHead';
import { Breadcrumbs } from '../seo/Breadcrumbs';
import { buildPageCopy } from '../../seo/meta';

type LoadStatus = 'loading' | 'ready' | 'notFound' | 'error';

/** Same thresholds as ListingCard, so one listing reads the same everywhere. */
function trustToneClass(score: number): string {
  if (score >= 80) return 'bg-brand-soft text-brand-text';
  if (score >= 60) return 'bg-info-soft text-info';
  if (score >= 40) return 'bg-warning-soft text-warning';
  return 'bg-danger-soft text-danger';
}

/**
 * Server-side reason codes paired with their labels.
 *
 * `BROKER` is deliberately absent. Professional agents publish here alongside
 * owners, so "this is a broker listing" is no longer a complaint about
 * anything — and a confirmed report now costs the listing real reliability
 * points, which would make offering it actively unfair. The value survives in
 * the database enum for the rows that were filed before the change.
 */
const REPORT_REASONS = [
  ['SCAM', 'listings.report.reasons.scam'],
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
  LAND: 'listings.propertyType.land',
  COMMERCIAL: 'listings.propertyType.commercial',
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
export const ListingDetailPage: React.FC = () => {
  const { t, tRaw, formatDate, formatNumber, formatPrice } = useTranslation();

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
  const route = useAppStore((state) => state.route);
  const language = useAppStore((state) => state.language);
  const navigate = useAppStore((state) => state.navigate);

  const [listing, setListing] = useState<Listing | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadToken, setReloadToken] = useState(0);

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
    trackEvent('listing_view', {
      listing_id: listing.id,
      district: listing.district ?? '',
      rooms: listing.rooms ?? 0,
    });
  }, [status, listing, recordView]);

  // The readable address needs the title, which only exists once the listing
  // has loaded. Replacing rather than pushing keeps one history entry per
  // listing, and moves `/e/<uuid>` onto the same canonical URL that the
  // sitemap and every internal link use.
  useEffect(() => {
    if (status !== 'ready' || !listing) return;
    const canonical = listingPath({ id: listing.id, slug: listingSlug(listing) });
    if (canonical !== route.path) navigate(canonical, { replace: true });
  }, [status, listing, route.path, navigate]);

  useSeoHead(route, language, {
    listing: status === 'ready' ? listing : null,
    noindex: status === 'notFound' || status === 'error',
    formatPrice,
  });

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
    const url = `${window.location.origin}${listingPath({ id: listing.id, slug: listingSlug(listing) })}`;
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
    // The moment a search visitor becomes a lead. It is the only
    // honest way to tell a page that ranks from a page that works.
    trackEvent('contact_reveal', { listing_id: listing.id, district: listing?.district ?? '' });
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
  // Through the shared helper rather than a second reading of the field, so a
  // listing cannot be an owner's in the grid and an agent's on this page.
  const isAgentListing = sellerTypeOf(listing) === 'AGENT';
  const joinedDate = listing.owner?.joinedDate;
  const joinedLabel =
    joinedDate && !Number.isNaN(new Date(joinedDate).getTime()) ? formatDate(joinedDate) : null;
  const activeImage = images[imageIndex] ?? images[0];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-6 pb-24 lg:pb-6">
      {/* The trail doubles as BreadcrumbList structured data, which is what
          Google shows under the result instead of a bare UUID URL. */}
      <Breadcrumbs
        crumbs={buildPageCopy(route, language, { listing }).crumbs}
        label={t('common.a11y.menu')}
      />

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
            title={t('listings.detail.trustTooltip', { score: listing.trustScore ?? 0 })}
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
      {/* Photos only. A listing used to be able to carry a video tour, which
          put a tab bar above this box and a player inside it; the field is
          gone from the product, so the gallery is the whole of the media
          block again. */}
      <div className="space-y-3">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-2 shadow-card sm:aspect-video">
          {activeImage ? (
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

        {images.length > 1 && (
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
                <img
                  src={image}
                  alt={t('listings.detail.photoOf', {
                    title: listing.title,
                    index: index + 1,
                  })}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
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
            {listing.landArea ? (
              <div className="space-y-1 border-line sm:border-l">
                <dt className="flex items-center justify-center gap-1 text-xs font-medium text-subtle">
                  <Maximize2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                  {t('listings.detail.landAreaLabel')}
                </dt>
                <dd className="text-base font-extrabold text-content">
                  {t('listings.detail.landAreaValue', { value: listing.landArea })}
                </dd>
              </div>
            ) : null}
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
              {AMENITIES.map(({ key, listingLabelKey, Icon }) => {
                const available = Boolean(listing[key]);
                return (
                  <li
                    key={key}
                    className={`flex items-center gap-2 rounded-xl border p-3 ${
                      available
                        ? 'border-brand/30 bg-brand-soft text-brand-text'
                        : 'border-line bg-surface-2 text-subtle'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{tRaw(listingLabelKey)}</span>
                    {available ? (
                      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                    )}
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

          {/* Reliability.

              This block used to be the moderation verdict: a heading that
              named an automated scanner and a list of the objections it had
              raised, printed verbatim. No such scan runs any more — a listing
              publishes as it is written — so the section explains the one
              rule that is left. The figure starts at 100 and moves only when
              an administrator confirms a complaint, which is a fact about
              this listing's record and not a machine's opinion of it. */}
          <section className={`${cardClass} space-y-4 p-5 sm:p-6`}>
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-brand" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-extrabold text-content">
                    {t('listings.detail.trustTitle')}
                  </h2>
                  <p className="text-[11px] text-subtle">{t('listings.detail.trustSubtitle')}</p>
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black ${trustToneClass(
                  listing.trustScore ?? 0,
                )}`}
                title={t('listings.detail.trustTooltip', { score: listing.trustScore ?? 0 })}
              >
                {t('common.badge.trustScore', { score: listing.trustScore ?? 0 })}
              </span>
            </div>

            <div className="space-y-2">
              {/* A full score is the clean record, and anything below it means
                  at least one complaint has been upheld. The tick is reserved
                  for the first case: a green check beside "complaints have
                  been confirmed" would read as reassurance. */}
              {(listing.trustScore ?? 0) >= 100 ? (
                <p className="flex items-start gap-2 text-xs font-semibold text-content">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  <span>{t('listings.detail.trustNoComplaints')}</span>
                </p>
              ) : (
                <p className="flex items-start gap-2 text-xs font-semibold text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t('listings.detail.trustHasComplaints')}</span>
                </p>
              )}
              <p className="text-xs leading-relaxed text-subtle">
                {t('listings.detail.trustExplainer')}
              </p>
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
                {/* The same badge the grid card carries, in the same two
                    tones, because this is the same promise: it stood here as
                    an unconditional "direct contact" and an agent's listing
                    made that a false one. It leads the line above the
                    publisher block, so who is offering the flat is read
                    before the price is acted on. */}
                <span
                  className={`rounded-md px-2 py-0.5 font-black ${
                    isAgentListing ? 'bg-info-soft text-info' : 'bg-brand-soft text-brand-text'
                  }`}
                >
                  {t(isAgentListing ? 'listings.seller.agentBadge' : 'listings.seller.ownerBadge')}
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

            {/* Publisher.

                Not "owner" any more, in the heading or in the fallback name.
                An agent's listing put a real agent's name under a block
                headed "Uy egasi" and, when the account had no name on it,
                under the word "Uy egasi" itself — on the one card a visitor
                reads to decide who they are about to ring.

                Both halves of every one of these ternaries come from
                `listings.seller`, because the two families do not describe the
                same people: `common.role.*` names an account's role, and in
                English it says "Landlord" where this slot's agent half says
                "Real-estate agent" — one screen, two vocabularies. */}
            <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
              <h3 className="sr-only">
                {t(isAgentListing ? 'listings.seller.agentLabel' : 'listings.seller.ownerLabel')}
              </h3>
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
                    {listing.owner?.name ||
                      t(
                        isAgentListing
                          ? 'listings.seller.agentLabel'
                          : 'listings.seller.ownerLabel',
                      )}
                  </p>
                  {/* A person's name reads the same whoever they are, so on an
                      agent listing this is the line that says what the name
                      above it is — and which firm, when the listing carries
                      one. The agency is snapshotted at publish time rather
                      than read from the account, so it is the name that was
                      true when this flat went up.

                      With neither a name nor an agency there is nothing left
                      to qualify: the line above has already fallen back to
                      the label, and this would print it a second time. */}
                  {isAgentListing && (listing.agencyName || listing.owner?.name) && (
                    <p className="truncate text-[11px] font-bold text-info">
                      {listing.agencyName
                        ? t('listings.seller.agency', { name: listing.agencyName })
                        : t('listings.seller.agentLabel')}
                    </p>
                  )}
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
                {/* The PERSON's score, not the listing's. It is a different
                    number under a different rule — it rises when an account is
                    verified — so it carries its own label rather than the one
                    that explains confirmed complaints.

                    Which person, though, has to agree with the badge three
                    rows up: the figure is the publishing account's, so on an
                    agent's listing the fixed "owner" wording credited it to
                    somebody who has no account on this page at all. */}
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black ${trustToneClass(
                    listing.owner?.trustScore ?? 0,
                  )}`}
                >
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {t(
                    isAgentListing
                      ? 'listings.seller.trustAgent'
                      : 'listings.detail.ownerTrustScore',
                    { score: listing.owner?.trustScore ?? 0 },
                  )}
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
                {/* The one control the whole page is built to get pressed, so
                    it is the last place that may name the wrong party: the
                    badge, the name and the agency line above it had already
                    said "agent" while this still offered to contact an owner
                    who never sees the message. */}
                {t(isAgentListing ? 'listings.seller.contactAgent' : 'listings.card.contactOwner')}
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
                  {t(
                    isAgentListing
                      ? 'listings.seller.phoneUnavailableAgent'
                      : 'listings.detail.phoneUnavailable',
                  )}
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

      {/* Mobile Sticky Bottom Contact Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-line bg-surface/95 backdrop-blur-md px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-muted block">{t('listings.detail.priceTitle')}</span>
            <p className="text-base font-black text-content truncate">
              {priceLabel}
              <span className="text-[11px] font-normal text-muted ml-1">
                {listing.isRoommate ? t('common.units.perPerson') : t('common.units.perMonth')}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {listing.contactTelegram && (
              <a
                href={`https://t.me/${listing.contactTelegram.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="press flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                title="Telegram"
              >
                <Send className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={async () => {
                if (!currentUser) {
                  setShowAuth(true, 'LOGIN');
                  return;
                }
                try {
                  const { chatApi } = await import('../../services/chatApi');
                  const conv = await chatApi.startOrGetConversation(listing.id);
                  setCurrentView('CHAT', null, conv.id);
                } catch {
                  useAppStore.getState().pushToast('common.error.generic', 'error');
                }
              }}
              className="press flex h-10 items-center gap-1.5 px-3 rounded-xl bg-surface-2 border border-line text-content text-xs font-bold"
            >
              <MessageSquare className="h-4 w-4 text-brand" />
              <span>Chat</span>
            </button>
            {phoneVisible && ownerPhone ? (
              <a
                href={`tel:${ownerPhone.replace(/[^\d+]/g, '')}`}
                className="press flex h-10 items-center gap-1.5 px-3.5 rounded-xl bg-brand text-on-brand text-xs font-extrabold shadow-brand"
              >
                <Phone className="h-4 w-4" />
                <span>Qo‘ng‘iroq</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={handleRevealPhone}
                className="press flex h-10 items-center gap-1.5 px-3.5 rounded-xl bg-brand text-on-brand text-xs font-extrabold shadow-brand"
              >
                <Phone className="h-4 w-4" />
                <span>{currentUser ? 'Telefon' : 'Raqam'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetailPage;
