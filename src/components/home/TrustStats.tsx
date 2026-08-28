/**
 * Platform figures.
 *
 * The previous version hardcoded "1,240+ verified owners" and "840+ brokers
 * blocked". Those numbers had no source, so they are gone: this panel now
 * renders only what the API actually reports, and says so when it reports
 * nothing. The 0% commission tile is a policy, not a measurement, which is
 * why it is always shown.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Ban,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { useTranslation, type TranslationKey } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/Field';

interface TrustStat {
  id: string;
  value: string;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}

export const TrustStats: React.FC = () => {
  const { t, formatNumber } = useTranslation();

  const totalCount = useAppStore((state) => state.totalCount);
  const featured = useAppStore((state) => state.featured);
  const loading = useAppStore((state) => state.listingsLoading);
  const error = useAppStore((state) => state.listingsError);
  const fetchListings = useAppStore((state) => state.fetchListings);
  const fetchFeatured = useAppStore((state) => state.fetchFeatured);

  const [isExpanded, setIsExpanded] = useState(false);
  const requested = useRef(false);

  // The home page may render before anything has queried the catalogue; ask
  // once so the tiles have real figures instead of zeroes.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    if (totalCount === 0) void fetchListings({ page: 1 });
    if (!featured || featured.length === 0) void fetchFeatured();
  }, [totalCount, featured?.length, fetchListings, fetchFeatured]);

  const retry = () => {
    void fetchListings({ page: 1 });
    void fetchFeatured();
  };

  const stats: TrustStat[] = [
    {
      id: 'commission',
      value: '0%',
      labelKey: 'home.stats.commission',
      hintKey: 'home.stats.commissionHint',
      icon: Ban,
      tone: 'bg-brand/20 text-brand',
    },
  ];

  if (totalCount > 0) {
    stats.unshift({
      id: 'active',
      value: formatNumber(totalCount),
      labelKey: 'home.stats.activeListings',
      hintKey: 'home.stats.activeListingsHint',
      icon: ShieldCheck,
      tone: 'bg-info/20 text-info',
    });
  }

  if (featured.length > 0) {
    stats.push({
      id: 'featured',
      value: formatNumber(featured.length),
      labelKey: 'home.stats.featuredListings',
      hintKey: 'home.stats.featuredListingsHint',
      icon: Sparkles,
      tone: 'bg-warning/20 text-warning',
    });
  }

  const hasLiveFigures = totalCount > 0 || featured.length > 0;

  return (
    <section className="w-full border-t border-line bg-gradient-to-br from-band to-band-2 px-3 py-4 text-on-band sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <button
          type="button"
          onClick={() => setIsExpanded((open) => !open)}
          aria-expanded={isExpanded}
          aria-controls="home-trust-stats-panel"
          className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-on-band/15 bg-on-band/5 p-4 transition-colors hover:bg-on-band/10 active:scale-[0.99]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-sm font-black leading-snug sm:text-base">
                {t('home.stats.toggleTitle')}
              </span>
              <span className="block text-xs leading-snug text-on-band/60">
                {totalCount > 0
                  ? t('home.stats.toggleSubtitleWithCount', { count: formatNumber(totalCount) })
                  : t('home.stats.toggleSubtitle')}
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-on-band/10 px-3 py-1.5 text-xs font-bold">
            <span>{isExpanded ? t('home.stats.collapse') : t('home.stats.expand')}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </button>

        <div id="home-trust-stats-panel" hidden={!isExpanded}>
          {isExpanded && (
            <div className="rise-in space-y-5 pt-2">
              <div className="mx-auto max-w-xl space-y-1.5 px-1 text-center">
                <h2 className="text-lg font-black leading-snug tracking-tight sm:text-2xl">
                  {t('home.stats.title')}
                </h2>
                <p className="text-[11px] leading-relaxed text-on-band/60 sm:text-xs">
                  {t('home.stats.subtitle')}
                </p>
              </div>

              {loading && !hasLiveFigures ? (
                <div
                  className="grid w-full grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3"
                  aria-label={t('common.a11y.loading')}
                  aria-busy="true"
                >
                  {[0, 1, 2].map((slot) => (
                    <div
                      key={slot}
                      className="h-28 animate-shimmer rounded-2xl sm:h-36"
                      aria-hidden="true"
                    />
                  ))}
                </div>
              ) : (
                <>
                  <dl className="grid w-full grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3">
                    {stats.map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div
                          key={stat.id}
                          className="flex flex-col justify-between rounded-2xl border border-on-band/15 bg-on-band/5 p-3.5 sm:p-5"
                        >
                          <span
                            className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl sm:mb-3 sm:h-10 sm:w-10 ${stat.tone}`}
                          >
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                          </span>
                          <div>
                            <dd className="text-xl font-black tracking-tight sm:text-3xl">
                              {stat.value}
                            </dd>
                            <dt className="mt-0.5 text-[11px] font-extrabold leading-snug sm:text-sm">
                              {t(stat.labelKey)}
                            </dt>
                            <p className="mt-0.5 text-[10px] leading-snug text-on-band/60 sm:text-[11px]">
                              {t(stat.hintKey)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </dl>

                  {!hasLiveFigures && (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <p className="text-xs text-on-band/60">
                        {error ? t('common.error.network') : t('home.stats.unavailable')}
                      </p>
                      <Button type="button" variant="secondary" onClick={retry}>
                        {t('common.action.retry')}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default TrustStats;
