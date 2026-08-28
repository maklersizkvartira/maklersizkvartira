/**
 * The owner's dashboard: every listing they posted, with its live counters and
 * the moderation verdict the server attached to it.
 *
 * The counters come straight from the API (`state.myListings`), so an outage
 * shows an error state instead of the invented numbers the previous build
 * rendered from mock data. The aggregate panel is derived from those same
 * rows — `viewsCount`, `favoritesCount`, `contactCount`, `trustScore` and
 * `aiCheckStatus` all arrive on `GET /listings/my` — so it needs no second
 * request and can never disagree with the list underneath it.
 *
 * Loading, failure and "you have not posted anything yet" render as three
 * visibly different things. They used to collapse into the same grey box,
 * which is why an owner whose request had failed concluded their listings had
 * been deleted.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Edit3,
  ExternalLink,
  Eye,
  Heart,
  Image as ImageIcon,
  Phone,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Trash2,
  Users,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import type { AICheckStatus, Listing } from '../../types';
import { cn } from '../../lib/cn';
import { useHaptics } from '../../hooks/useHaptics';
import { Card, CardEmpty, SectionCard } from '../ui/Card';
import { Button } from '../ui/Field';
import { EditListingModal } from './EditListingModal';
import { canPublishListings } from '../../types/roles';

/** Maps the server's moderation verdict onto a shared status label and tone. */
function moderationTone(status: AICheckStatus): { key: string; className: string } {
  switch (status) {
    case 'APPROVED':
      return { key: 'common.status.approved', className: 'bg-success-soft text-success' };
    case 'PENDING':
      return { key: 'common.status.pending', className: 'bg-warning-soft text-warning' };
    case 'UNDER_REVIEW':
      return { key: 'common.status.underReview', className: 'bg-info-soft text-info' };
    case 'WARNING':
      return { key: 'common.status.warning', className: 'bg-warning-soft text-warning' };
    case 'REJECTED':
      return { key: 'common.status.rejected', className: 'bg-danger-soft text-danger' };
    case 'VERIFICATION_REQUIRED':
      return {
        key: 'owner.my.moderation.verificationRequired',
        className: 'bg-info-soft text-info',
      };
    default:
      return { key: 'common.status.pending', className: 'bg-warning-soft text-warning' };
  }
}

/**
 * The three-way split the panel reports.
 *
 * Anything that is neither published nor refused is still in a queue, so
 * WARNING and VERIFICATION_REQUIRED count as pending: they name work the owner
 * or a moderator has left to do, not a verdict that has been reached.
 */
function moderationBucket(status: AICheckStatus): 'approved' | 'rejected' | 'pending' {
  if (status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  return 'pending';
}

interface OwnerTotals {
  listings: number;
  approved: number;
  pending: number;
  rejected: number;
  views: number;
  favorites: number;
  contacts: number;
  /** Mean of `trustScore`; 0 when there is nothing to average. */
  avgTrust: number;
}

function summarise(listings: Listing[]): OwnerTotals {
  const totals: OwnerTotals = {
    listings: listings.length,
    approved: 0,
    pending: 0,
    rejected: 0,
    views: 0,
    favorites: 0,
    contacts: 0,
    avgTrust: 0,
  };

  let trustSum = 0;
  for (const listing of listings) {
    totals[moderationBucket(listing.aiCheckStatus)] += 1;
    totals.views += listing.viewsCount ?? 0;
    totals.favorites += listing.favoritesCount ?? 0;
    totals.contacts += listing.contactCount ?? 0;
    trustSum += listing.trustScore ?? 0;
  }
  if (listings.length > 0) totals.avgTrust = trustSum / listings.length;

  return totals;
}

// ---------------------------------------------------------------------------
/** One aggregate figure in the panel above the list. */
const StatTile: React.FC<{
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
}> = ({ label, value, icon: Icon, iconClassName }) => (
  <Card tone="nested" padding="none" className="p-3 sm:p-4">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
        {label}
      </span>
      <Icon className={cn('h-4 w-4 shrink-0', iconClassName)} aria-hidden="true" />
    </div>
    <p className="mt-1 text-xl font-black text-content sm:text-2xl">{value}</p>
  </Card>
);

/** One leg of the approved / pending / rejected split. */
const SplitPill: React.FC<{ label: string; value: string; className: string }> = ({
  label,
  value,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-baseline gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
      className,
    )}
  >
    <span className="text-sm font-black">{value}</span>
    {label}
  </span>
);

/** A per-listing counter. Three of them sit under each row. */
const RowCounter: React.FC<{
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
}> = ({ label, value, icon: Icon, iconClassName }) => (
  <div className="rounded-2xl border border-line bg-surface-2 p-3">
    <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-muted">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClassName)} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </div>
    <p className="mt-1 text-lg font-black text-content">{value}</p>
  </div>
);

// ---------------------------------------------------------------------------
export const MyListingsPage: React.FC = () => {
  const { t, tRaw, formatNumber, formatPrice } = useTranslation();
  const haptics = useHaptics();

  const currentUser = useAppStore((state) => state.currentUser);
  const myListings = useAppStore((state) => state.myListings);
  // Its own loading and error fields: a failed my-listings load used to arm
  // the catalogue's shared `listingsError`, so an owner's outage surfaced as a
  // broken search page they had never opened.
  const myListingsLoading = useAppStore((state) => state.myListingsLoading);
  const myListingsError = useAppStore((state) => state.myListingsError);
  const fetchMyListings = useAppStore((state) => state.fetchMyListings);
  const removeListing = useAppStore((state) => state.removeListing);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const switchRole = useAppStore((state) => state.switchRole);
  const pushToast = useAppStore((state) => state.pushToast);

  // The store cannot be loading before the first effect runs, and an empty
  // array at that instant is indistinguishable from "no listings" — so the
  // skeleton is held until the first fetch has settled.
  const [settled, setSettled] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);

  const isOwner = canPublishListings(currentUser?.role);

  useEffect(() => {
    if (!isOwner) {
      setSettled(true);
      return;
    }
    let cancelled = false;
    void fetchMyListings().finally(() => {
      if (!cancelled) setSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, fetchMyListings]);

  const totals = useMemo(() => summarise(myListings), [myListings]);

  if (!currentUser) {
    return (
      <div className="gutter-safe mx-auto max-w-md space-y-4 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-text">
          <BarChart3 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-black text-content">{t('owner.gate.myListingsTitle')}</h1>
        <p className="text-sm text-muted">{t('owner.gate.myListingsBody')}</p>
        <Button fullWidth className="press" onClick={() => setShowAuth(true, 'LOGIN')}>
          {t('common.action.signIn')}
        </Button>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="gutter-safe mx-auto max-w-md space-y-4 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Users className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-black text-content">{t('owner.gate.myListingsTitle')}</h1>
        <p className="text-sm text-muted">{t('owner.gate.studentBody')}</p>
        <Button
          fullWidth
          className="press"
          onClick={() => {
            void switchRole('OWNER').catch(() => pushToast('owner.gate.switchFailed', 'error'));
          }}
        >
          {t('owner.gate.switchToOwner')}
        </Button>
      </div>
    );
  }

  const loading = !settled || myListingsLoading;
  const failed = !loading && Boolean(myListingsError);
  const refresh = () => {
    haptics.tap();
    void fetchMyListings();
  };

  return (
    // The bottom pad clears the fixed bottom nav, which only exists below lg.
    <div className="gutter-safe mx-auto w-full max-w-6xl space-y-6 py-6 pb-28 lg:pb-12">
      <Card padding="none" radius="3xl" className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-black text-content">
              <BarChart3 className="h-6 w-6 shrink-0 text-brand" aria-hidden="true" />
              <span className="truncate">{t('owner.my.title')}</span>
            </h1>
            <p className="mt-0.5 text-xs text-muted sm:text-sm">{t('owner.my.subtitle')}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              className="press shrink-0"
              onClick={refresh}
              disabled={loading}
              aria-label={t('common.action.refresh')}
            >
              <RefreshCw
                className={cn('h-4 w-4', myListingsLoading && 'animate-spin')}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{t('common.action.refresh')}</span>
            </Button>
            <Button
              className="press flex-1 sm:flex-none"
              onClick={() => setCurrentView('CREATE_LISTING')}
            >
              <PlusCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{t('owner.my.createCta')}</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* -- Aggregate panel ------------------------------------------------ */}
      {loading ? (
        <div
          className="space-y-6"
          aria-busy="true"
          aria-label={t('common.a11y.loading')}
        >
          <div
            className="space-y-4 rounded-3xl border border-line bg-surface p-4 sm:p-6"
            aria-hidden="true"
          >
            <div className="h-24 w-full animate-shimmer rounded-2xl" />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[0, 1, 2, 3].map((tile) => (
                <div key={tile} className="h-20 animate-shimmer rounded-2xl" />
              ))}
            </div>
          </div>

          {[0, 1].map((row) => (
            <div
              key={row}
              className="space-y-4 rounded-3xl border border-line bg-surface p-4 sm:p-6"
              aria-hidden="true"
            >
              <div className="h-16 w-full animate-shimmer rounded-2xl" />
              <div className="grid grid-cols-3 gap-2.5">
                {[0, 1, 2].map((tile) => (
                  <div key={tile} className="h-20 animate-shimmer rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : failed ? (
        <Card
          tone="ghost"
          padding="none"
          radius="3xl"
          className="space-y-3 border-danger/30 bg-danger-soft p-6 text-center sm:p-12"
        >
          <h2 className="text-lg font-bold text-danger">{t('owner.my.error.title')}</h2>
          <p className="mx-auto max-w-sm text-xs text-muted">{t('owner.my.error.body')}</p>
          <Button variant="secondary" className="press" onClick={refresh}>
            {t('common.action.retry')}
          </Button>
        </Card>
      ) : myListings.length === 0 ? (
        <CardEmpty
          icon={PlusCircle}
          title={t('owner.stats.empty')}
          body={t('owner.my.empty.body')}
          action={
            <Button className="press" onClick={() => setCurrentView('CREATE_LISTING')}>
              <PlusCircle className="h-5 w-5" aria-hidden="true" />
              {t('owner.stats.emptyCta')}
            </Button>
          }
        />
      ) : (
        <>
          <SectionCard
            title={t('owner.stats.title')}
            description={t('owner.stats.subtitle')}
            icon={BarChart3}
            padding="none"
            radius="3xl"
            className="p-4 sm:p-6"
          >
            <Card tone="nested" padding="none" className="p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
                {t('owner.stats.totalListings')}
              </p>
              <p className="text-3xl font-black text-content">
                {formatNumber(totals.listings)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <SplitPill
                  label={t('owner.stats.approved')}
                  value={formatNumber(totals.approved)}
                  className="bg-success-soft text-success"
                />
                <SplitPill
                  label={t('owner.stats.pending')}
                  value={formatNumber(totals.pending)}
                  className="bg-warning-soft text-warning"
                />
                <SplitPill
                  label={t('owner.stats.rejected')}
                  value={formatNumber(totals.rejected)}
                  className="bg-danger-soft text-danger"
                />
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatTile
                label={t('owner.stats.views')}
                value={formatNumber(totals.views)}
                icon={Eye}
                iconClassName="text-info"
              />
              <StatTile
                label={t('owner.stats.favorites')}
                value={formatNumber(totals.favorites)}
                icon={Heart}
                iconClassName="text-danger"
              />
              <StatTile
                label={t('owner.stats.contacts')}
                value={formatNumber(totals.contacts)}
                icon={Phone}
                iconClassName="text-brand"
              />
              <StatTile
                label={t('owner.stats.avgTrust')}
                // A mean of integers is rarely one, and rounding it to a whole
                // number turns 79.5 into the same figure as 80.
                value={formatNumber(totals.avgTrust, { maximumFractionDigits: 1 })}
                icon={ShieldCheck}
                iconClassName="text-warning"
              />
            </div>
          </SectionCard>

          {/* -- The listings themselves ----------------------------------- */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-content">
              {t('owner.my.listTitle', { count: myListings.length })}
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {myListings.map((listing) => {
                const views = listing.viewsCount ?? 0;
                const favorites = listing.favoritesCount ?? 0;
                const contacts = listing.contactCount ?? 0;
                const messages = listing.conversationCount ?? 0;
                // Both routes to the owner count as interest, so conversion is
                // measured against either — counting only revealed numbers made
                // a listing people message rather than ring look dead.
                const conversion =
                  views > 0 ? (((contacts + messages) / views) * 100).toFixed(1) : '0.0';
                const status = moderationTone(listing.aiCheckStatus);
                const cover = listing.images?.[0];
                const reasons = listing.aiRiskReasons ?? [];

                return (
                  <Card
                    as="article"
                    key={listing.id}
                    padding="none"
                    radius="3xl"
                    className="space-y-4 p-4 transition-colors hover:border-line-2 sm:p-6"
                  >
                    <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        {cover ? (
                          <img
                            src={cover}
                            alt=""
                            loading="lazy"
                            className="h-14 w-16 shrink-0 rounded-2xl border border-line object-cover sm:h-16 sm:w-20"
                          />
                        ) : (
                          <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface-2 text-subtle sm:h-16 sm:w-20">
                            <ImageIcon className="h-6 w-6" aria-hidden="true" />
                          </span>
                        )}

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black',
                                status.className,
                              )}
                            >
                              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                              {tRaw(status.key)}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-black text-muted">
                              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                              {t('common.filters.trustScore')}{' '}
                              {formatNumber(listing.trustScore ?? 0)}
                            </span>
                            {listing.isRoommate && (
                              <span className="rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-black text-info">
                                {t('common.rentalType.roommate')}
                              </span>
                            )}
                          </div>

                          <h3 className="mt-1 truncate text-sm font-extrabold text-content sm:text-base">
                            {listing.title}
                          </h3>

                          <p className="mt-0.5 text-xs font-extrabold text-brand-text">
                            {formatPrice(listing.price)}
                            <span className="font-semibold text-subtle">
                              {listing.isRoommate
                                ? t('common.units.perPerson')
                                : t('common.units.perMonth')}
                            </span>
                            {listing.district ? (
                              <span className="ml-1 font-semibold text-subtle">
                                · {t('owner.my.districtLabel', { district: listing.district })}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentView('LISTING_DETAIL', listing.id)}
                          className="press inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-surface-2 px-3 text-xs font-bold text-content transition-colors hover:bg-surface-3 sm:flex-none"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{t('owner.my.openListing')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(listing)}
                          className="press inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-brand px-3.5 text-xs font-extrabold text-on-brand shadow-brand sm:flex-none"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{t('common.action.edit')}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={t('common.action.delete')}
                          onClick={() => {
                            if (window.confirm(t('owner.my.deleteConfirm'))) {
                              haptics.warn();
                              void removeListing(listing.id);
                            }
                          }}
                          className="press inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-danger/40 bg-danger-soft px-3 text-xs font-extrabold text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <RowCounter
                        label={t('owner.stats.views')}
                        value={formatNumber(views)}
                        icon={Eye}
                        iconClassName="text-info"
                      />
                      <RowCounter
                        label={t('owner.stats.favorites')}
                        value={formatNumber(favorites)}
                        icon={Heart}
                        iconClassName="text-danger"
                      />
                      <RowCounter
                        label={t('owner.stats.contacts')}
                        value={formatNumber(contacts)}
                        icon={Phone}
                        iconClassName="text-brand"
                      />
                    </div>

                    <div className="flex flex-col items-start justify-between gap-2 rounded-2xl bg-surface-2 p-3 text-xs sm:flex-row sm:items-center">
                      <span className="inline-flex items-center gap-2 font-bold text-content">
                        <TrendingUp className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                        {t('owner.my.metrics.conversion', { rate: conversion })}
                      </span>
                      <span className="text-subtle">{t('owner.my.metrics.conversionHint')}</span>
                    </div>

                    <Card tone="nested" padding="none" className="space-y-1.5 p-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
                        {t('owner.my.moderation.title')}
                      </p>
                      {reasons.length > 0 ? (
                        <>
                          <p className="text-xs font-bold text-content">
                            {t('owner.my.moderation.reasons')}
                          </p>
                          <ul className="list-inside list-disc space-y-1 text-xs text-muted">
                            {reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className="text-xs text-subtle">{t('owner.my.moderation.noReasons')}</p>
                      )}
                    </Card>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

      {editing && (
        <EditListingModal
          listing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void fetchMyListings();
          }}
        />
      )}
    </div>
  );
};

export default MyListingsPage;
