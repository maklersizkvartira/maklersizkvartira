'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays } from 'lucide-react';

import { Skeleton } from '@/shared/ui/Skeleton';
import type { ActivityPoint, RegistrationPoint, TrafficPoint } from '@/shared/api/types';
import { LineChart } from './LineChart';
import { BarChart } from './BarChart';
import { CHART_BODY_CLASS, ChartEmpty, ChartError, severityColor } from './chart-shared';
import { Segmented } from './Segmented';
import { CountUp, StatLabel, StatNum } from './stat-kit';

/**
 * The one full-width chart card, holding three of the four endpoints behind a
 * segmented switcher.
 *
 * Four stacked 240px charts is about a thousand pixels of scrolling on a
 * phone, and nobody reaches the fourth. One card with three thumb-sized pills
 * is one tap per question. All three queries fire in parallel on mount, so
 * switching never shows a spinner — the cost of the trade is that two series
 * can no longer be compared side by side, which is the honest downside of
 * this arrangement and the thing to revisit if anyone complains.
 *
 * Districts deliberately stays outside: its horizontal HTML bar rows are the
 * best chart in the panel on a small screen and share no x-axis with these.
 */

type SeriesKey = 'registrations' | 'traffic' | 'activity';

interface TrendCardProps {
  /** The window every series was fetched with; printed once, in the chip. */
  days: number;
  registrations: RegistrationPoint[];
  traffic: TrafficPoint[];
  activity: ActivityPoint[];
  loading: Record<SeriesKey, boolean>;
  /**
   * Per-series failure. Separate from `loading` and from an empty array on
   * purpose: the page hands this card `query.data ?? []`, so without this flag
   * a failed fetch arrives as an empty array and draws "nothing to chart yet".
   */
  error: Record<SeriesKey, boolean>;
  /** Refetch only the series the reader is actually looking at. */
  onRetry: (key: SeriesKey) => void;
  /** ISO date → the short axis label, in the reader's locale. */
  formatDay: (iso: string) => string;
}

interface ActiveSeries {
  loading: boolean;
  labels: string[];
  /** The measure avg and peak are computed over — see the note below. */
  buckets: number[];
  measure: string;
  chart: ReactNode;
}

export function TrendCard({
  days,
  registrations,
  traffic,
  activity,
  loading,
  error,
  onRetry,
  formatDay,
}: TrendCardProps) {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');
  const [series, setSeries] = useState<SeriesKey>('registrations');

  const options = [
    { key: 'registrations' as const, label: t('charts.registrations') },
    { key: 'traffic' as const, label: t('charts.traffic') },
    { key: 'activity' as const, label: t('charts.activity') },
  ];

  const active = buildSeries();
  const hasData = active.labels.length > 0;
  const showError = !active.loading && error[series];
  /** Only a finished, SUCCESSFUL query that came back with nothing is "empty". */
  const showEmpty = !active.loading && !showError && !hasData;
  /** avg / peak / period describe real measurements, so neither a failure nor
   *  an empty result may print them. */
  const showFigures = !showError && !showEmpty;

  /**
   * avg and peak are computed over ONE named measure per series, never over a
   * sum of unlike series. Adding visitors to views would produce a number that
   * is true of nothing; the measure's name is printed beside the figure so the
   * reader is never left guessing what the average averages.
   */
  const avg = active.buckets.length
    ? active.buckets.reduce((sum, value) => sum + value, 0) / active.buckets.length
    : 0;
  const peak = active.buckets.length ? Math.max(...active.buckets) : 0;

  function buildSeries(): ActiveSeries {
    if (series === 'traffic') {
      return {
        loading: loading.traffic,
        labels: traffic.map((point) => formatDay(point.date)),
        buckets: traffic.map((point) => point.visitors),
        measure: t('charts.visitors'),
        chart: (
          <LineChart
            labels={traffic.map((point) => formatDay(point.date))}
            series={[
              { key: 'visitors', label: t('charts.visitors'), values: traffic.map((p) => p.visitors) },
              { key: 'views', label: t('charts.views'), values: traffic.map((p) => p.views) },
            ]}
          />
        ),
      };
    }

    if (series === 'activity') {
      const totals = activity.map((point) => point.info + point.notice + point.warning + point.critical);
      return {
        loading: loading.activity,
        labels: activity.map((point) => formatDay(point.date)),
        buckets: totals,
        measure: t('charts.count'),
        chart: (
          // Severity is a state, so the series take the status colours rather
          // than the neutral chart slots. INFO and NOTICE therefore share the
          // accent on purpose — every segment is named in the legend, so no
          // meaning rests on the hue alone.
          <BarChart
            stacked
            labels={activity.map((point) => formatDay(point.date))}
            series={[
              { key: 'INFO', label: 'INFO', values: activity.map((p) => p.info), color: severityColor('INFO') },
              { key: 'NOTICE', label: 'NOTICE', values: activity.map((p) => p.notice), color: severityColor('NOTICE') },
              { key: 'WARNING', label: 'WARNING', values: activity.map((p) => p.warning), color: severityColor('WARNING') },
              { key: 'CRITICAL', label: 'CRITICAL', values: activity.map((p) => p.critical), color: severityColor('CRITICAL') },
            ]}
          />
        ),
      };
    }

    return {
      loading: loading.registrations,
      labels: registrations.map((point) => formatDay(point.date)),
      buckets: registrations.map((point) => point.count),
      measure: t('charts.count'),
      chart: (
        <LineChart
          area
          labels={registrations.map((point) => formatDay(point.date))}
          series={[
            {
              key: 'registrations',
              label: t('charts.count'),
              values: registrations.map((point) => point.count),
            },
          ]}
        />
      ),
    };
  }

  return (
    <div className="card card-cut-bl p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {t('trend.title')}
          </h2>
          <p
            className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span className="chip inline-flex shrink-0 items-center gap-1.5">
              <CalendarDays size={11} />
              {t('trend.window', { days })}
            </span>
            {t('charts.utcNote')}
          </p>
        </div>

        {/* Three equal pills on a phone, an inline row above sm. This is where
            three separate card titles used to be. */}
        <Segmented
          items={options}
          value={series}
          onChange={setSeries}
          ariaLabel={t('trend.title')}
          className="grid w-full grid-cols-3 gap-1 sm:inline-grid sm:w-auto sm:grid-flow-col"
        />
      </div>

      {/* Re-keyed on the active series so the wipe replays on every switch. */}
      <div key={series} className="chart-wipe mt-4">
        {active.loading ? (
          <div className={`skeleton ${CHART_BODY_CLASS}`} />
        ) : showError ? (
          <ChartError text={c('error')} retryLabel={c('retry')} onRetry={() => onRetry(series)} />
        ) : showEmpty ? (
          <ChartEmpty text={t('charts.noData')} />
        ) : (
          active.chart
        )}
      </div>

      {/* The rail keeps its place while the query is in flight, so the card is
          its final height from the first paint. It is dropped only when the
          endpoint genuinely came back with nothing — an average over no
          measurements is not a figure that can be shown. */}
      {showFigures && (
        <div
          className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4 border-t pt-4"
          style={{ borderColor: 'var(--color-border-light)' }}
        >
          <div>
            <StatLabel className="block">{t('trend.avg')}</StatLabel>
            <span className="mt-1.5 flex items-baseline gap-1.5">
              {active.loading ? (
                <Skeleton width={56} height={22} radius="var(--radius-xs)" />
              ) : (
                <>
                  <StatNum size={22}>
                    <CountUp value={avg} decimals={1} />
                  </StatNum>
                  <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                    {active.measure}
                  </span>
                </>
              )}
            </span>
          </div>

          <div>
            <StatLabel className="block">{t('trend.peak')}</StatLabel>
            <span className="mt-1.5 flex items-baseline gap-1.5">
              {active.loading ? (
                <Skeleton width={56} height={22} radius="var(--radius-xs)" />
              ) : (
                <>
                  <StatNum size={22}>
                    <CountUp value={peak} />
                  </StatNum>
                  <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                    {active.measure}
                  </span>
                </>
              )}
            </span>
          </div>

          <div className="ml-auto text-right">
            <StatLabel className="block">{t('trend.period')}</StatLabel>
            {active.loading ? (
              <Skeleton width={120} height={12} radius="var(--radius-xs)" className="mt-2.5" />
            ) : (
              <p className="mt-2 text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                {t('trend.range', {
                  from: active.labels[0] ?? '',
                  to: active.labels[active.labels.length - 1] ?? '',
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
