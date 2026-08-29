'use client';

import { useTranslations } from 'next-intl';

import { Skeleton } from '@/shared/ui/Skeleton';
import type { DistrictPoint } from '@/shared/api/types';
import { BarChart } from './BarChart';
import { ChartEmpty, ChartError } from './chart-shared';

/**
 * Listings per district, busiest first.
 *
 * The chart itself is untouched: its horizontal arrangement is plain HTML
 * rows, so it needs no minimum width, no rotated labels and no scaling fix,
 * and it is the one chart on the page that is already right on a 360px
 * screen. This is genuinely an endpoint that can answer `[]` — a fresh
 * deployment has no listings — so the empty state is a real state, not a
 * theoretical one.
 *
 * The loading skeleton draws one row per district the query asked for rather
 * than a single 240px block, because a ten-row list is roughly 380px tall and
 * a 240px placeholder would move everything under it as the data lands.
 *
 * Precisely BECAUSE `[]` is a legitimate answer here, a failed request must not
 * borrow the empty state: this card is the one a reader will believe. The three
 * states are therefore drawn three ways — shimmering rows, muted "nothing yet"
 * text, and a red line with a retry — and the page passes `isError` in rather
 * than flattening the query to `data ?? []`.
 */

export function DistrictsCard({
  districts,
  loading,
  error,
  onRetry,
  limit,
}: {
  districts: DistrictPoint[];
  loading: boolean;
  /** The request failed — NOT the same thing as a platform with no listings. */
  error: boolean;
  onRetry: () => void;
  limit: number;
}) {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');

  return (
    <div className="card card-cut-br p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {t('charts.districts')}
        </h2>
        {!loading && !error && districts.length > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            {districts.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: limit }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton width="42%" height={12} radius="var(--radius-xs)" />
              <Skeleton height={10} radius="var(--radius-xs)" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ChartError text={c('error')} retryLabel={c('retry')} onRetry={onRetry} />
      ) : districts.length === 0 ? (
        <ChartEmpty text={t('charts.noData')} />
      ) : (
        <BarChart
          horizontal
          showValues
          labels={districts.map((point) => point.district)}
          series={[
            {
              key: 'listings',
              label: t('charts.count'),
              values: districts.map((point) => point.count),
            },
          ]}
        />
      )}
    </div>
  );
}
