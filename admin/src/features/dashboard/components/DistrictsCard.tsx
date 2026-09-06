'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Skeleton } from '@/shared/ui/Skeleton';
import type { DistrictPoint } from '@/shared/api/types';
import { AnalyticsCard } from './AnalyticsCard';
import { BarChart } from './BarChart';

/**
 * Listings per district, busiest first. Lives on /analytics now, not on the
 * overview — it answers "where is the inventory", which is a question worth a
 * minute, not a question worth the top of the morning's screen.
 *
 * The chart itself is untouched by that move: its horizontal arrangement is
 * plain HTML rows, so it needs no minimum width, no rotated labels and no
 * scaling fix, and it is the one chart in the panel that is already right on a
 * 360px screen. This is genuinely an endpoint that can answer `[]` — a fresh
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
 *
 * The header count and the summary total are two different numbers and both
 * are worth printing: how many districts have any inventory at all, and how
 * many listings the drawn bars add up to.
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
  /** What `limit` the query asked for; sizes the skeleton, nothing else. */
  limit: number;
}) {
  const t = useTranslations('analytics');
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const total = districts.reduce((sum, point) => sum + point.count, 0);

  return (
    <AnalyticsCard
      title={t('charts.districts')}
      trailing={
        !loading && !error && districts.length > 0 ? (
          <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            {districts.length}
          </span>
        ) : undefined
      }
      loading={loading}
      error={error}
      empty={districts.length === 0}
      onRetry={onRetry}
      skeleton={
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: limit }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton width="42%" height={12} radius="var(--radius-xs)" />
              <Skeleton height={10} radius="var(--radius-xs)" />
            </div>
          ))}
        </div>
      }
      // No per-day average and no peak: a ranked list has no time axis, and
      // the tallest bar is already the first row on the card.
      summary={[{ key: 'listings', figures: [t('summary.total', { count: nf.format(total) })] }]}
    >
      <BarChart
        horizontal
        showValues
        labels={districts.map((point) => point.district)}
        series={[
          {
            key: 'listings',
            label: t('charts.districts'),
            values: districts.map((point) => point.count),
          },
        ]}
      />
    </AnalyticsCard>
  );
}
