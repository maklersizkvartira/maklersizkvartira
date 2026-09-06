'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldAlert } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type {
  ActivityPoint,
  DistrictPoint,
  RegistrationPoint,
  TrafficPoint,
} from '@/shared/api/types';
import { useRole } from '@/providers/role-provider';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Reveal } from '@/features/dashboard/components/Reveal';
import { Segmented } from '@/features/dashboard/components/Segmented';
import { StatLabel } from '@/features/dashboard/components/stat-kit';
import { LineChart } from '@/features/dashboard/components/LineChart';
import { BarChart } from '@/features/dashboard/components/BarChart';
import { severityColor } from '@/features/dashboard/components/chart-shared';
import {
  AnalyticsCard,
  type SummaryGroup,
} from '@/features/dashboard/components/AnalyticsCard';
import { DistrictsCard } from '@/features/dashboard/components/DistrictsCard';

/**
 * The charts, on a page of their own.
 *
 * They used to sit under the overview, where they made it long enough that the
 * three queues at the top — the only things on that screen anybody has to act
 * on — were a scroll away on a phone, and where four extra network reads
 * delayed the counters above them. They also had nowhere to put a window
 * control: the dashboard drew a fixed seven days because a chart nobody came
 * to the page for cannot justify a toolbar.
 *
 * Here they can. The window is 7, 30 or 90 days — 90 is the backend's own cap
 * on `days` — and it drives all three time series at once, so "did the dip
 * last week show up in registrations too" is one tap rather than three
 * settings. The districts chart takes a count instead of a window, because it
 * has no time axis.
 *
 * Every chart owns its query, its error and its retry. Four independent reads
 * is the point: the districts endpoint failing must not blank the traffic
 * chart, and re-reading one must not re-read the other three.
 *
 * MODERATOR, matching `ROUTE_MIN_ROLE['/analytics']` and the `RequireModerator`
 * dependency on all four `/admin/chart/*` routes. Nothing here is per-person
 * data — it is counts per day and counts per district.
 */

/**
 * The windows on offer. The backend caps `days` at 90, so 90 is the widest
 * honest option; anything larger would be silently clamped and the chip would
 * then name a period the chart does not draw.
 */
const RANGE_DAYS = [7, 30, 90] as const;
type RangeDays = (typeof RANGE_DAYS)[number];

/** `limit` on the districts chart; the backend allows 1..30. */
const DISTRICT_LIMITS = [10, 20, 30] as const;
type DistrictLimit = (typeof DISTRICT_LIMITS)[number];

/**
 * How often the charts re-read themselves.
 *
 * Five minutes, the same as they polled at on the dashboard. A day bucket
 * cannot move faster than the day does, and the primary reader is on a phone
 * on cellular data; the Refresh button is the path for someone who wants a
 * chart re-read NOW. Background polling is off for the same reason.
 */
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

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const c = useTranslations('common');
  const e = useTranslations('errors');
  /** The audit feed's vocabulary for the four severities, already shipped in
   *  all three locales by the /audit screen. */
  const a = useTranslations('audit');
  const locale = useLocale();
  const { canAccess } = useRole();
  const dayFormat = useDayFormatter();

  const [days, setDays] = useState<RangeDays>(7);
  const [districtLimit, setDistrictLimit] = useState<DistrictLimit>(10);

  /**
   * Keyed by the window, so switching to 30 days and back to 7 is instant and
   * the 7-day traffic series the dashboard already holds for its sparkline is
   * shared rather than fetched a second time.
   */
  const registrationsQuery = useQuery({
    queryKey: ['chart', 'registrations', days],
    queryFn: ({ signal }) =>
      http.get<RegistrationPoint[]>(api.charts.registrations(days), { signal }),
    refetchInterval: CHART_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const trafficQuery = useQuery({
    queryKey: ['chart', 'traffic', days],
    queryFn: ({ signal }) => http.get<TrafficPoint[]>(api.charts.traffic(days), { signal }),
    refetchInterval: CHART_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const activityQuery = useQuery({
    queryKey: ['chart', 'activity', days],
    queryFn: ({ signal }) => http.get<ActivityPoint[]>(api.charts.activity(days), { signal }),
    refetchInterval: CHART_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const districtsQuery = useQuery({
    queryKey: ['chart', 'districts', districtLimit],
    queryFn: ({ signal }) =>
      http.get<DistrictPoint[]>(api.charts.districts(districtLimit), { signal }),
    refetchInterval: CHART_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const queries = [registrationsQuery, trafficQuery, activityQuery, districtsQuery];
  const refreshing = queries.some((query) => query.isFetching);
  const refreshAll = () => {
    void Promise.all(queries.map((query) => query.refetch()));
  };

  const registrations = registrationsQuery.data ?? [];
  const traffic = trafficQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const districts = districtsQuery.data ?? [];

  const formatDay = (iso: string) => dayFormat.format(new Date(iso));

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  /** One decimal on the average, none anywhere else: a mean of 18.4 signups a
   *  day is a real measurement, a mean of 18.4285714 is noise. */
  const nfAvg = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );

  /**
   * Total, daily average and peak over ONE named measure.
   *
   * Never over a sum of unlike series: adding visitors to views would produce
   * a number that is true of nothing. The measure's own name is printed beside
   * the figures so the reader is never left guessing what the average
   * averages. `perDay` is off for a measure with no time axis.
   */
  const measure = (
    key: string,
    label: string,
    values: number[],
    { perDay = true }: { perDay?: boolean } = {},
  ): SummaryGroup => {
    const total = values.reduce((sum, value) => sum + value, 0);
    const figures = [t('summary.total', { count: nf.format(total) })];
    if (values.length > 0) {
      if (perDay) {
        figures.push(t('summary.avgPerDay', { count: nfAvg.format(total / values.length) }));
      }
      figures.push(t('summary.peak', { count: nf.format(Math.max(...values)) }));
    }
    return { key, label, figures };
  };

  const rangeOptions = RANGE_DAYS.map((value) => ({
    // Segmented keys are strings; the window itself is a number, so it is
    // parsed back out on change rather than kept as a string in state.
    key: String(value),
    label: t('range.days', { count: value }),
  }));

  const limitOptions = DISTRICT_LIMITS.map((value) => ({
    key: String(value),
    label: t('limit.value', { count: value }),
  }));

  // The page's own gate, alongside the sidebar's. A rank that cannot reach the
  // route must not be able to type the URL into a browser either.
  if (!canAccess('/analytics')) {
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
          <Button variant="secondary" size="sm" onClick={refreshAll} loading={refreshing}>
            {c('refresh')}
          </Button>
        }
      />

      {/* One toolbar for both controls, above the charts rather than inside
          them: the window applies to three of the four cards, so a switcher
          living in one card's header would have looked like it belonged to
          that card alone. Full-width pills on a phone, an inline row from sm. */}
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <StatLabel className="shrink-0">{t('range.label')}</StatLabel>
          <Segmented
            items={rangeOptions}
            value={String(days)}
            onChange={(key) => setDays(Number(key) as RangeDays)}
            ariaLabel={t('range.label')}
            className="grid w-full grid-cols-3 gap-1 sm:inline-grid sm:w-auto sm:grid-flow-col"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <StatLabel className="shrink-0">{t('limit.label')}</StatLabel>
          <Segmented
            items={limitOptions}
            value={String(districtLimit)}
            onChange={(key) => setDistrictLimit(Number(key) as DistrictLimit)}
            ariaLabel={t('limit.label')}
            className="grid w-full grid-cols-3 gap-1 sm:inline-grid sm:w-auto sm:grid-flow-col"
          />
        </div>
      </div>

      {/* Said once, for the whole page. Every bucket on every chart here is a
          UTC day, which in Tashkent starts at 05:00 — a reader comparing
          "today" on this page with a wall clock deserves to know that. */}
      <p className="mb-4 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        {t('utcNote')}
      </p>

      {/* Two up from xl, one column everywhere else. The two wide charts go
          full width: a 90-day stacked bar and a 30-row ranked list are both
          charts that stop being readable when halved. */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Reveal index={0}>
          <AnalyticsCard
            title={t('charts.registrations')}
            loading={registrationsQuery.isLoading}
            error={registrationsQuery.isError}
            empty={registrations.length === 0}
            onRetry={() => void registrationsQuery.refetch()}
            summary={[
              measure(
                'registrations',
                t('summary.registrations'),
                registrations.map((point) => point.count),
              ),
            ]}
          >
            <LineChart
              area
              labels={registrations.map((point) => formatDay(point.date))}
              series={[
                {
                  key: 'registrations',
                  label: t('summary.registrations'),
                  values: registrations.map((point) => point.count),
                },
              ]}
            />
          </AnalyticsCard>
        </Reveal>

        <Reveal index={1}>
          <AnalyticsCard
            title={t('charts.traffic')}
            loading={trafficQuery.isLoading}
            error={trafficQuery.isError}
            empty={traffic.length === 0}
            onRetry={() => void trafficQuery.refetch()}
            // Two measures, two groups. Views get a total only: a page view is
            // a consequence of a visit, so its average and its peak say the
            // same thing the visitor figures beside them already said.
            summary={[
              measure(
                'visitors',
                t('summary.visitors'),
                traffic.map((point) => point.visitors),
              ),
              measure('views', t('summary.views'), traffic.map((point) => point.views), {
                perDay: false,
              }),
            ]}
          >
            <LineChart
              labels={traffic.map((point) => formatDay(point.date))}
              series={[
                {
                  key: 'visitors',
                  label: t('summary.visitors'),
                  values: traffic.map((point) => point.visitors),
                },
                {
                  key: 'views',
                  label: t('summary.views'),
                  values: traffic.map((point) => point.views),
                },
              ]}
            />
          </AnalyticsCard>
        </Reveal>

        <Reveal index={2} className="xl:col-span-2">
          <AnalyticsCard
            title={t('charts.activity')}
            loading={activityQuery.isLoading}
            error={activityQuery.isError}
            empty={activity.length === 0}
            onRetry={() => void activityQuery.refetch()}
            // Summed across the four severities, which is legitimate where
            // visitors + views is not: these are four counts of the same
            // thing, an audit event, split by how loud it was.
            summary={[
              measure(
                'events',
                t('summary.events'),
                activity.map((point) => point.info + point.notice + point.warning + point.critical),
              ),
            ]}
          >
            {/* Severity is a state, so the series take the status colours
                rather than the neutral chart slots. INFO and NOTICE therefore
                share the accent on purpose — the legend names every segment in
                the reader's own language, so no meaning rests on the hue
                alone. `key` stays the wire value: it is the React list key
                downstream and the stable id the colour follows. */}
            <BarChart
              stacked
              labels={activity.map((point) => formatDay(point.date))}
              series={[
                { key: 'INFO', label: a('severity.INFO'), values: activity.map((p) => p.info), color: severityColor('INFO') },
                { key: 'NOTICE', label: a('severity.NOTICE'), values: activity.map((p) => p.notice), color: severityColor('NOTICE') },
                { key: 'WARNING', label: a('severity.WARNING'), values: activity.map((p) => p.warning), color: severityColor('WARNING') },
                { key: 'CRITICAL', label: a('severity.CRITICAL'), values: activity.map((p) => p.critical), color: severityColor('CRITICAL') },
              ]}
            />
          </AnalyticsCard>
        </Reveal>

        <Reveal index={3} className="xl:col-span-2">
          <DistrictsCard
            districts={districts}
            loading={districtsQuery.isLoading}
            error={districtsQuery.isError}
            onRetry={() => void districtsQuery.refetch()}
            limit={districtLimit}
          />
        </Reveal>
      </div>
    </div>
  );
}
