/**
 * The owner's dashboard: every listing they posted, with its live counters and
 * the moderation verdict the server attached to it.
 *
 * The counters come straight from the API (`state.myListings`), so an outage
 * shows an error state instead of the invented numbers the previous build
 * rendered from mock data.
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Edit3,
  ExternalLink,
  Eye,
  Heart,
  Image as ImageIcon,
  MessageSquare,
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

interface StatCardProps {
  label: string;
  hint: string;
  value: string;
  icon: React.ReactNode;
  className: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, hint, value, icon, className }) => (
  <div className={`space-y-1 rounded-2xl border border-line p-4 shadow-card ${className}`}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-extrabold uppercase tracking-wider">{label}</span>
      {icon}
    </div>
    <p className="text-2xl font-black text-content sm:text-3xl">{value}</p>
    <p className="text-[11px] font-semibold text-muted">{hint}</p>
  </div>
);

const MetricTile: React.FC<{ label: string; hint: string; value: string; icon: React.ReactNode }> = ({
  label,
  hint,
  value,
  icon,
}) => (
  <div className="space-y-1 rounded-2xl border border-line bg-surface-2 p-3">
    <div className="flex items-center justify-between text-[11px] font-extrabold text-muted">
      <span>{label}</span>
      {icon}
    </div>
    <p className="text-lg font-black text-content">{value}</p>
    <p className="text-[10px] font-medium text-subtle">{hint}</p>
  </div>
);

export const MyListingsPage: React.FC = () => {
  const { t, tRaw, formatNumber, formatPrice } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const myListings = useAppStore((state) => state.myListings);
  const fetchMyListings = useAppStore((state) => state.fetchMyListings);
  const removeListing = useAppStore((state) => state.removeListing);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const switchRole = useAppStore((state) => state.switchRole);
  const pushToast = useAppStore((state) => state.pushToast);

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);

  const isOwner = canPublishListings(currentUser?.role);

  useEffect(() => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void fetchMyListings()
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner, fetchMyListings]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-text">
          <BarChart3 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-black text-content">{t('owner.gate.myListingsTitle')}</h1>
        <p className="text-sm text-muted">{t('owner.gate.myListingsBody')}</p>
        <Button fullWidth onClick={() => setShowAuth(true, 'LOGIN')}>
          {t('common.action.signIn')}
        </Button>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Users className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-black text-content">{t('owner.gate.myListingsTitle')}</h1>
        <p className="text-sm text-muted">{t('owner.gate.studentBody')}</p>
        <Button
          fullWidth
          onClick={() => {
            void switchRole('OWNER').catch(() => pushToast('owner.gate.switchFailed', 'error'));
          }}
        >
          {t('owner.gate.switchToOwner')}
        </Button>
      </div>
    );
  }

  const totalViews = myListings.reduce((sum, item) => sum + (item.viewsCount ?? 0), 0);
  const totalFavorites = myListings.reduce((sum, item) => sum + (item.favoritesCount ?? 0), 0);
  const totalContacts = myListings.reduce((sum, item) => sum + (item.contactCount ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-6 pb-24 sm:px-6 sm:pb-12">
      <div className="flex flex-col justify-between gap-3 rounded-3xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-content">
            <BarChart3 className="h-6 w-6 text-brand" aria-hidden="true" />
            <span>{t('owner.my.title')}</span>
          </h1>
          <p className="mt-0.5 text-xs text-muted sm:text-sm">{t('owner.my.subtitle')}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setFailed(false);
              void fetchMyListings()
                .catch(() => setFailed(true))
                .finally(() => setLoading(false));
            }}
            aria-label={t('common.action.refresh')}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('common.action.refresh')}</span>
          </Button>
          <Button onClick={() => setCurrentView('CREATE_LISTING')}>
            <PlusCircle className="h-5 w-5" aria-hidden="true" />
            <span>{t('owner.my.createCta')}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={t('owner.my.stats.views')}
          hint={t('owner.my.stats.viewsHint')}
          value={formatNumber(totalViews)}
          icon={<Eye className="h-5 w-5 text-info" aria-hidden="true" />}
          className="bg-info-soft"
        />
        <StatCard
          label={t('owner.my.stats.favorites')}
          hint={t('owner.my.stats.favoritesHint')}
          value={formatNumber(totalFavorites)}
          icon={<Heart className="h-5 w-5 text-danger" aria-hidden="true" />}
          className="bg-danger-soft"
        />
        <StatCard
          label={t('owner.my.stats.contacts')}
          hint={t('owner.my.stats.contactsHint')}
          value={formatNumber(totalContacts)}
          icon={<Phone className="h-5 w-5 text-brand" aria-hidden="true" />}
          className="bg-brand-soft"
        />
        <StatCard
          label={t('owner.my.stats.listings')}
          hint={t('owner.my.stats.listingsHint')}
          value={formatNumber(myListings.length)}
          icon={<ShieldCheck className="h-5 w-5 text-warning" aria-hidden="true" />}
          className="bg-warning-soft"
        />
      </div>

      {/* Chat volume used to be the fourth metric; the messaging backend is not
          wired up yet, so the tile is replaced rather than faked. */}
      <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-xs font-medium text-muted">
        <MessageSquare className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
        {t('owner.my.chatMetricUnavailable')}
      </p>

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label={t('common.a11y.loading')}>
          {[0, 1].map((row) => (
            <div
              key={row}
              className="space-y-4 rounded-3xl border border-line bg-surface p-4 sm:p-6"
              aria-hidden="true"
            >
              <div className="h-16 w-full animate-shimmer rounded-2xl" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[0, 1, 2, 3].map((tile) => (
                  <div key={tile} className="h-20 animate-shimmer rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : failed ? (
        <div className="space-y-3 rounded-3xl border border-danger/30 bg-danger-soft p-8 text-center sm:p-12">
          <h2 className="text-lg font-bold text-danger">{t('owner.my.error.title')}</h2>
          <p className="mx-auto max-w-sm text-xs text-muted">{t('owner.my.error.body')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setFailed(false);
              void fetchMyListings()
                .catch(() => setFailed(true))
                .finally(() => setLoading(false));
            }}
          >
            {t('common.action.retry')}
          </Button>
        </div>
      ) : myListings.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-line bg-surface p-8 text-center sm:p-12">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-text">
            <PlusCircle className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold text-content">{t('owner.my.empty.title')}</h2>
          <p className="mx-auto max-w-sm text-xs text-muted">{t('owner.my.empty.body')}</p>
          <Button onClick={() => setCurrentView('CREATE_LISTING')}>
            {t('owner.my.empty.cta')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-base font-extrabold text-content">
            {t('owner.my.listTitle', { count: myListings.length })}
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {myListings.map((listing) => {
              const views = listing.viewsCount ?? 0;
              const favorites = listing.favoritesCount ?? 0;
              const contacts = listing.contactCount ?? 0;
              const conversion = views > 0 ? ((contacts / views) * 100).toFixed(1) : '0.0';
              const status = moderationTone(listing.aiCheckStatus);
              const cover = listing.images?.[0];
              const reasons = listing.aiRiskReasons ?? [];

              return (
                <article
                  key={listing.id}
                  className="space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-2 sm:p-6"
                >
                  <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
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
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${status.className}`}
                          >
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                            {tRaw(status.key)}
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

                    <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => setCurrentView('LISTING_DETAIL', listing.id)}
                        className="inline-flex items-center gap-1 rounded-xl bg-surface-2 px-3 py-2 text-xs font-bold text-content transition-colors hover:bg-surface-3"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t('owner.my.openListing')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(listing)}
                        className="inline-flex items-center gap-1 rounded-xl bg-brand px-3.5 py-2 text-xs font-extrabold text-on-brand shadow-brand transition-transform active:scale-95"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t('common.action.edit')}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={t('common.action.delete')}
                        onClick={() => {
                          if (window.confirm(t('owner.my.deleteConfirm'))) {
                            void removeListing(listing.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-xs font-extrabold text-danger transition-transform active:scale-95"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <MetricTile
                      label={t('owner.my.metrics.views')}
                      hint={t('owner.my.metrics.viewsHint')}
                      value={formatNumber(views)}
                      icon={<Eye className="h-4 w-4 text-info" aria-hidden="true" />}
                    />
                    <MetricTile
                      label={t('owner.my.metrics.favorites')}
                      hint={t('owner.my.metrics.favoritesHint')}
                      value={formatNumber(favorites)}
                      icon={<Heart className="h-4 w-4 text-danger" aria-hidden="true" />}
                    />
                    <MetricTile
                      label={t('owner.my.metrics.contacts')}
                      hint={t('owner.my.metrics.contactsHint')}
                      value={formatNumber(contacts)}
                      icon={<Phone className="h-4 w-4 text-brand" aria-hidden="true" />}
                    />
                    <MetricTile
                      label={t('common.filters.trustScore')}
                      hint={t('common.badge.aiChecked')}
                      value={formatNumber(listing.trustScore ?? 0)}
                      icon={<ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />}
                    />
                  </div>

                  <div className="flex flex-col items-start justify-between gap-2 rounded-2xl bg-surface-2 p-3 text-xs sm:flex-row sm:items-center">
                    <span className="inline-flex items-center gap-2 font-bold text-content">
                      <TrendingUp className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                      {t('owner.my.metrics.conversion', { rate: conversion })}
                    </span>
                    <span className="text-subtle">{t('owner.my.metrics.conversionHint')}</span>
                  </div>

                  <div className="space-y-1.5 rounded-2xl border border-line bg-surface-2 p-3">
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
                  </div>
                </article>
              );
            })}
          </div>
        </div>
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
