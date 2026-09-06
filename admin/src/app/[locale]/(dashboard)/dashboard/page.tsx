'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { ShieldAlert } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type {
  AdminBalances,
  AdminStats,
  PublicSettings,
  TrafficPoint,
} from '@/shared/api/types';
import { useRole } from '@/providers/role-provider';
import { useConfirm } from '@/providers/confirm-provider';
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
 * The deep charts are no longer here. Registrations, traffic, activity and
 * districts moved to /analytics, which is what they were always for: they
 * answer questions worth a minute, not the question this page answers, and
 * four extra reads over cellular data delayed every counter above them while
 * pushing the queues below the fold on a phone. What is left is what needs
 * watching — the queues, what the paid services cost, today, and the platform
 * mode — with the twenty-five counters still one tap away at the bottom. The
 * one chart that stayed is the visitor sparkline inside the Today card, which
 * is a shape rather than a chart and is drawn from a series this page fetches
 * anyway.
 *
 * Every number here is still a plain count from the backend. There is no trend
 * endpoint, so nothing on this page prints a delta — inventing one from the
 * "today" and "week" counters would be arithmetic the API never did. The one
 * derived figure is the hero's sum of the three queue depths, which is three
 * integers of the same kind with all three parts printed underneath it.
 */

/**
 * The window behind the Today card's visitor sparkline, and the only reason
 * this page still reads a chart endpoint.
 *
 * Seven days because that is the shape a single day needs to be read against,
 * and because it matches the window /analytics opens on — the two pages share
 * one react-query cache entry, so arriving here from there costs no request at
 * all.
 */
const SPARKLINE_DAYS = 7;

/**
 * How often the stats spine re-reads itself.
 *
 * Two minutes, not one. `/admin/stats` runs about two dozen uncached
 * sequential COUNTs under a per-IP ceiling, the primary reader is on a phone
 * on cellular data, and the manual refresh below — which invalidates every
 * query on the page rather than only this one — is the appropriate path for
 * someone who wants a number NOW. Background polling is off for the same
 * reason.
 */
const STATS_POLL_MS = 120_000;
/** The sparkline's series moves far more slowly than the counters do. */
const CHART_POLL_MS = 300_000;

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');
  const e = useTranslations('errors');
  const locale = useLocale();
  const { can, canAccess } = useRole();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: ({ signal }) => http.get<AdminStats>(api.stats, { signal }),
    refetchInterval: STATS_POLL_MS,
    refetchIntervalInBackground: false,
  });

  /**
   * Fetched on its own, and allowed to fail on its own.
   *
   * This one leaves the building twice — the SMS provider for credit, OpenAI
   * for spend — so it is slower and less reliable than the database counters
   * beside it. Folded into `stats` a struggling provider would have delayed
   * every number on the page.
   */
  const balancesQuery = useQuery({
    queryKey: ['balances'],
    queryFn: ({ signal }) => http.get<AdminBalances>(api.balances, { signal }),
    refetchInterval: STATS_POLL_MS,
    refetchIntervalInBackground: false,
  });

  /**
   * The last chart read on this page, and it is here for the sparkline alone.
   *
   * Same query key /analytics uses for its default window, so the two pages
   * share one cache entry instead of asking the same question twice.
   */
  const trafficQuery = useQuery({
    queryKey: ['chart', 'traffic', SPARKLINE_DAYS],
    queryFn: ({ signal }) =>
      http.get<TrafficPoint[]>(api.charts.traffic(SPARKLINE_DAYS), { signal }),
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

  const monetizationOn = monetizationQuery.data?.is_monetization_enabled === true;

  const toggleMonetization = useMutation({
    mutationFn: () => http.post(api.settings.toggleMonetization),
    // The toggle route answers with an acknowledgement and no new value, so the
    // only way to learn the result is to read /settings again.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['public-settings'] });
      // Said out loud, because the status pill several lines up the card is
      // otherwise the only sign that the site's billing mode just changed —
      // and it does not move until that refetch lands. `monetizationOn` still
      // holds the state before the tap here, so the message names the state
      // the platform is now in.
      toast.success(c('success'), monetizationOn ? t('monetizationOff') : t('monetizationOn'));
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  /**
   * Refresh means refresh. It used to refetch only `['stats']` while the
   * charts and the monetization state went on showing whatever they had, so
   * the button silently did a fifth of what it said.
   *
   * `balancesQuery` belongs in here too, and was the last omission: SMS credit
   * and the assistant's spend are the two numbers on the page that come from
   * outside, so they are both the most likely to have failed and the ones an
   * admin most wants to re-read on demand — after topping the account up, the
   * button has to reach them rather than leave the card on its 120s poll.
   */
  const queries = [statsQuery, balancesQuery, trafficQuery, monetizationQuery];
  const refreshing = queries.some((query) => query.isFetching);
  const refreshAll = () => {
    void Promise.all(queries.map((query) => query.refetch()));
  };

  const stats = statsQuery.data;
  const traffic = trafficQuery.data ?? [];

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
          mb-6/mb-8. There is deliberately no bottom padding here any more: the
          mobile dock's clearance moved into DashboardLayout, which now reserves
          it once for every page. The `pb-24 lg:pb-4` that used to live on this
          div stacked on top of that and left ~192px of dead space under the
          reference band on a phone. */}
      <div className="flex flex-col gap-4">
        {/* ── 1 · Triage ───────────────────────────────────────────────────
            A failed /admin/stats says nothing about the traffic series or the
            balances, so the error replaces this floor only and everything
            below still renders. */}
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
                onRetry={() => void balancesQuery.refetch()}
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

        {/* ── 2 · Platform mode ────────────────────────────────────────────
            Headless on purpose: the card's own label says "Monetization", and
            a Storey heading above it would be a second label for one thing.
            Held to a third of the width on a desktop so it keeps reading as
            one switch rather than as a banner — it is the only control on the
            page, not the subject of it. */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Reveal index={4}>
            <MonetizationCard
              enabled={monetizationOn}
              loading={monetizationQuery.isLoading}
              error={monetizationQuery.isError}
              onRetry={() => void monetizationQuery.refetch()}
              canToggle={can('monetizationToggle')}
              toggling={toggleMonetization.isPending}
              // Confirmed in BOTH directions, unlike the staff switch that
              // skips the dialog for the harmless one — neither direction is
              // harmless here. This is a full-width button in the scroll
              // path of a phone, and one accidental contact either publishes
              // paid promotion to every visitor of a live site or takes it
              // away. Only `isDestructive` differs.
              onToggle={async () => {
                const ok = await confirm({
                  title: t('monetization'),
                  message: monetizationOn
                    ? t('monetizationOffConfirm')
                    : t('monetizationOnConfirm'),
                  isDestructive: monetizationOn,
                  confirmLabel: monetizationOn
                    ? t('monetizationDisable')
                    : t('monetizationEnable'),
                });
                if (ok) toggleMonetization.mutate();
              }}
            />
          </Reveal>
        </div>

        {/* ── 3 · Everything else ──────────────────────────────────────── */}
        <Storey
          id="reference"
          label={t('allMetrics')}
          right={
            <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
              {STAT_COUNT}
            </span>
          }
        >
          <Reveal index={5}>
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
