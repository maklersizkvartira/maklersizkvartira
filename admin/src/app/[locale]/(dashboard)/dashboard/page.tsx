'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { ShieldAlert } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type {
  ActivityPoint,
  AdminBalances,
  AdminStats,
  DistrictPoint,
  PublicSettings,
  RegistrationPoint,
  TrafficPoint,
} from '@/shared/api/types';
import { useRole } from '@/providers/role-provider';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { toast } from '@/shared/ui/Toast';
import { STAT_COUNT } from '@/features/dashboard/dashboard-groups';
import { Reveal } from '@/features/dashboard/components/Reveal';
import { Storey } from '@/features/dashboard/components/Storey';
import { BalancesCard } from '@/features/dashboard/components/BalancesCard';
import { TriageCard } from '@/features/dashboard/components/TriageCard';
import { RiskCard } from '@/features/dashboard/components/RiskCard';
import { TodayCard } from '@/features/dashboard/components/TodayCard';
import { ListingFlowCard } from '@/features/dashboard/components/ListingFlowCard';
import { TrendCard } from '@/features/dashboard/components/TrendCard';
import { DistrictsCard } from '@/features/dashboard/components/DistrictsCard';
import { MonetizationCard } from '@/features/dashboard/components/MonetizationCard';
import { StatBand } from '@/features/dashboard/components/StatBand';

/**
 * The overview screen, arranged as a descending answer to one question: is
 * there work for me this morning.
 *
 * It used to be a wall of twenty-five identically weighted tiles, in the order
 * the API happens to serialise them, where `pendingListings`, `openReports`
 * and `pendingVerifications` sat at positions 12, 16 and 17 drawn exactly as
 * loudly as `totalViews`, and none of the three was clickable. Now the three
 * queues are the first thing on screen as tappable rows that link into the
 * page which clears them, and everything merely informational moved into the
 * reference band at the bottom. Nothing was removed: all 25 counters are still
 * on the page, one tap away at every width.
 *
 * Every number here is still a plain count from the backend. There is no trend
 * endpoint, so nothing on this page prints a delta — inventing one from the
 * "today" and "week" counters would be arithmetic the API never did. The one
 * derived figure is the hero's sum of the three queue depths, which is three
 * integers of the same kind with all three parts printed underneath it.
 */

/** How many days of history the three time charts ask for. The backend caps
 *  `days` at 90. The window is now printed once, by the trend card's chip,
 *  from this constant — the chart titles no longer hard-code it, so changing
 *  this number no longer means editing nine message strings. */
const CHART_DAYS = 7;
/** `limit` on the districts chart; the backend allows 1..30. */
const DISTRICT_LIMIT = 10;

/**
 * How often the stats spine re-reads itself.
 *
 * Two minutes, not one. `/admin/stats` runs about two dozen uncached
 * sequential COUNTs under a per-IP ceiling, the primary reader is on a phone
 * on cellular data, and the manual refresh below — which now invalidates all
 * six queries rather than only this one — is the appropriate path for someone
 * who wants a number NOW. Background polling is off for the same reason.
 */
const STATS_POLL_MS = 120_000;
/** The charts move far more slowly than the counters do. */
const CHART_POLL_MS = 300_000;

/** ISO date → a short axis label in the reader's locale. */
function useDayFormatter() {
  const locale = useLocale();
  return useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    [locale],
  );
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');
  const e = useTranslations('errors');
  const locale = useLocale();
  const { can, canAccess } = useRole();
  const queryClient = useQueryClient();
  const dayFormat = useDayFormatter();

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: ({ signal }) => http.get<AdminStats>(api.stats, { signal }),
    refetchInterval: STATS_POLL_MS,
    refetchIntervalInBackground: false,
  });

  /**
   * Fetched on its own, and allowed to fail on its own.
   *
   * This one calls the SMS provider over the network, so it is slower and
   * less reliable than the database counters beside it. Folded into `stats`
   * a struggling provider would have delayed every number on the page.
   */
  const balancesQuery = useQuery({
    queryKey: ['balances'],
    queryFn: ({ signal }) => http.get<AdminBalances>(api.balances, { signal }),
    refetchInterval: STATS_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const registrationsQuery = useQuery({
    queryKey: ['chart', 'registrations', CHART_DAYS],
    queryFn: ({ signal }) =>
      http.get<RegistrationPoint[]>(api.charts.registrations(CHART_DAYS), { signal }),
    refetchInterval: CHART_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const trafficQuery = useQuery({
    queryKey: ['chart', 'traffic', CHART_DAYS],
    queryFn: ({ signal }) => http.get<TrafficPoint[]>(api.charts.traffic(CHART_DAYS), { signal }),
    refetchInterval: CHART_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const districtsQuery = useQuery({
    queryKey: ['chart', 'districts', DISTRICT_LIMIT],
    queryFn: ({ signal }) =>
      http.get<DistrictPoint[]>(api.charts.districts(DISTRICT_LIMIT), { signal }),
    refetchInterval: CHART_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const activityQuery = useQuery({
    queryKey: ['chart', 'activity', CHART_DAYS],
    queryFn: ({ signal }) => http.get<ActivityPoint[]>(api.charts.activity(CHART_DAYS), { signal }),
    refetchInterval: CHART_POLL_MS,
    refetchIntervalInBackground: false,
  });

  /**
   * `GET /settings` is the one unauthenticated, un-enveloped, snake_case route
   * in the API — hence `http.raw.get` and `skipAuth`.
   */
  const monetizationQuery = useQuery({
    queryKey: ['public-settings'],
    queryFn: ({ signal }) =>
      http.raw.get<PublicSettings>(api.settings.publicRead, { signal, skipAuth: true }),
  });

  const toggleMonetization = useMutation({
    mutationFn: () => http.post(api.settings.toggleMonetization),
    // The toggle route answers with an acknowledgement and no new value, so the
    // only way to learn the result is to read /settings again.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public-settings'] }),
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  /**
   * Refresh means refresh. It used to refetch only `['stats']` while the four
   * charts and the monetization state went on showing whatever they had, so
   * the button silently did a fifth of what it said.
   */
  const queries = [
    statsQuery,
    registrationsQuery,
    trafficQuery,
    districtsQuery,
    activityQuery,
    monetizationQuery,
  ];
  const refreshing = queries.some((query) => query.isFetching);
  const refreshAll = () => {
    void Promise.all(queries.map((query) => query.refetch()));
  };

  const stats = statsQuery.data;
  const registrations = registrationsQuery.data ?? [];
  const traffic = trafficQuery.data ?? [];
  const districts = districtsQuery.data ?? [];
  const activity = activityQuery.data ?? [];

  const formatDay = (iso: string) => dayFormat.format(new Date(iso));

  /** TrendCard shows one series at a time; retrying refetches only that one. */
  const retryTrend = (key: 'registrations' | 'traffic' | 'activity') => {
    const query =
      key === 'traffic' ? trafficQuery : key === 'activity' ? activityQuery : registrationsQuery;
    void query.refetch();
  };

  const monetizationOn = monetizationQuery.data?.is_monetization_enabled === true;

  // The page's own gate, alongside the sidebar's. Every other guarded page
  // carries one; this is the eleventh. A rank that cannot reach the route must
  // not be able to type the URL into a browser either.
  if (!canAccess('/dashboard')) {
    return (
      <div className="card">
        <EmptyState icon={<ShieldAlert size={26} />} title={e('forbidden')} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            {/* Staleness made visible rather than inferred: the dot says the
                page is keeping itself current, the timestamp says how current,
                and a failed read turns both red instead of leaving an old
                time on screen looking authoritative. */}
            {(statsQuery.dataUpdatedAt > 0 || statsQuery.isError) && (
              <span
                className="chip inline-flex items-center gap-1.5"
                style={
                  statsQuery.isError
                    ? { color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' }
                    : undefined
                }
              >
                <span
                  className={`status-dot ${refreshing ? 'animate-pulse-status' : ''}`}
                  style={{
                    width: 6,
                    height: 6,
                    background: statsQuery.isError ? 'var(--color-danger)' : 'var(--color-success)',
                  }}
                />
                {statsQuery.isError
                  ? t('live.error')
                  : t('refreshedAt', {
                      time: new Date(statsQuery.dataUpdatedAt).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={refreshAll} loading={refreshing}>
              {c('refresh')}
            </Button>
          </>
        }
      />

      {/* One gutter for the whole page — 16px, everywhere, so the vertical
          rhythm cannot drift the way it did when each block carried its own
          mb-6/mb-8. The bottom padding is room for the fixed mobile dock: it
          floats 16px from the bottom below 1024px and would otherwise sit on
          top of the reference band, which is now the last thing on the page. */}
      <div className="flex flex-col gap-4 pb-24 lg:pb-4">
        {/* ── 1 · Triage ───────────────────────────────────────────────────
            A failed /admin/stats says nothing about /admin/chart/*, so the
            error replaces this floor only and everything below still renders. */}
        {statsQuery.error ? (
          <div className="card card-cut-bl flex flex-wrap items-center gap-4 p-5">
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
                {c('error')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {statsQuery.error instanceof Error ? statsQuery.error.message : e('network')}
              </p>
            </div>
            <Button variant="secondary" size="sm" className="max-sm:w-full" onClick={() => statsQuery.refetch()}>
              {c('retry')}
            </Button>
          </div>
        ) : (
          /* 27:20:20 is 1.35:1:1 written without a decimal point — Tailwind's
             scanner silently drops an arbitrary grid template containing a
             `.`, and a dropped class here would collapse the hero row to a
             single column on desktop with nothing in the build to say so. */
          <section id="triage" className="scroll-mt-[76px] grid gap-4 xl:grid-cols-[27fr_20fr_20fr]">
            <Reveal index={0} className="xl:row-span-2">
              <TriageCard stats={stats} />
            </Reveal>

            <Reveal index={1}>
              <BalancesCard
                data={balancesQuery.data}
                isError={balancesQuery.isError}
              />
            </Reveal>

            {/* Full width at 360px, two-up from sm, then dissolved by
                `xl:contents` so both cards become direct children of the outer
                template. Two 148px cards on the narrowest phone would truncate
                "Muvaffaqiyatsiz kirishlar" to four characters, and a label
                nobody can read is a number nobody can use. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:contents">
              <Reveal index={1}>
                <RiskCard stats={stats} />
              </Reveal>
              <Reveal index={2}>
                <TodayCard stats={stats} traffic={traffic} />
              </Reveal>
            </div>

            <Reveal index={3} className="xl:col-span-2">
              <ListingFlowCard stats={stats} />
            </Reveal>
          </section>
        )}

        {/* ── 2 · What changed ─────────────────────────────────────────── */}
        <Storey id="trend" label={t('sections.trend')}>
          <Reveal index={4}>
            <TrendCard
              days={CHART_DAYS}
              registrations={registrations}
              traffic={traffic}
              activity={activity}
              loading={{
                registrations: registrationsQuery.isLoading,
                traffic: trafficQuery.isLoading,
                activity: activityQuery.isLoading,
              }}
              error={{
                registrations: registrationsQuery.isError,
                traffic: trafficQuery.isError,
                activity: activityQuery.isError,
              }}
              onRetry={retryTrend}
              formatDay={formatDay}
            />
          </Reveal>
        </Storey>

        {/* ── 3 · Coverage and mode ────────────────────────────────────── */}
        <Storey id="reach" label={t('sections.reach')}>
          {/* 8:5 is 1.6:1 — see the note on the hero row above. */}
          <div className="grid gap-4 xl:grid-cols-[8fr_5fr]">
            <Reveal index={5}>
              <DistrictsCard
                districts={districts}
                loading={districtsQuery.isLoading}
                error={districtsQuery.isError}
                onRetry={() => void districtsQuery.refetch()}
                limit={DISTRICT_LIMIT}
              />
            </Reveal>
            <Reveal index={6}>
              <MonetizationCard
                enabled={monetizationOn}
                loading={monetizationQuery.isLoading}
                error={monetizationQuery.isError}
                onRetry={() => void monetizationQuery.refetch()}
                canToggle={can('monetizationToggle')}
                toggling={toggleMonetization.isPending}
                onToggle={() => toggleMonetization.mutate()}
              />
            </Reveal>
          </div>
        </Storey>

        {/* ── 4 · Everything else ──────────────────────────────────────── */}
        <Storey
          id="reference"
          label={t('allMetrics')}
          right={
            <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
              {STAT_COUNT}
            </span>
          }
        >
          <Reveal index={7}>
            <StatBand
              stats={stats}
              error={statsQuery.isError}
              onRetry={() => void statsQuery.refetch()}
            />
          </Reveal>
        </Storey>
      </div>
    </div>
  );
}
