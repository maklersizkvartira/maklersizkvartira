'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Footprints } from 'lucide-react';

import { Skeleton } from '@/shared/ui/Skeleton';
import type { AdminStats, TrafficPoint } from '@/shared/api/types';
import { CountUp, IconTile, StatLabel, StatNum } from './stat-kit';
import { Sparkline } from './Sparkline';

/**
 * "What happened today", with enough context to know whether today is good.
 *
 * The sparkline is drawn from the traffic series the trend card has already
 * fetched, so a bare integer finally gets its seven-day shape at no extra
 * network cost. It is suppressed below two points rather than drawn flat: a
 * line through one measurement is a shape the data did not make.
 */

export function TodayCard({ stats, traffic }: { stats?: AdminStats; traffic: TrafficPoint[] }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const visitorSeries = useMemo(() => traffic.map((point) => point.visitors), [traffic]);

  const footer = [
    { key: 'todayNewUsers', value: stats?.todayNewUsers },
    { key: 'todayNewListings', value: stats?.todayNewListings },
    { key: 'todayAiQueries', value: stats?.todayAiQueries },
  ] as const;

  return (
    <div className="card card-cut-tr tone-accent flex h-full flex-col p-5">
      <IconTile size={32}>
        <Footprints size={16} />
      </IconTile>

      <StatLabel className="mt-3 block leading-[1.35]">{t('today.title')}</StatLabel>

      <div className="mt-2">
        {stats ? (
          <StatNum size={30}>
            <CountUp value={stats.visitorsToday} />
          </StatNum>
        ) : (
          <Skeleton width={64} height={30} radius="var(--radius-sm)" />
        )}
      </div>
      <p className="mt-1 text-[11px] leading-[1.35]" style={{ color: 'var(--color-text-muted)' }}>
        {t('kpi.visitorsToday')}
      </p>

      {/* The slot keeps its height whether or not a line lands in it. The
          traffic query resolves after the stats query, and without the
          reservation this card — and the one beside it, which shares the grid
          row — would grow by 42px the moment it did. */}
      <div className="mt-3 h-[30px]">
        <Sparkline values={visitorSeries} height={30} className="chart-wipe" />
      </div>

      <div
        className="mt-auto grid grid-cols-3 gap-2 border-t pt-3"
        style={{ borderColor: 'var(--color-border-light)' }}
      >
        {footer.map((cell) => (
          <div key={cell.key} className="min-w-0">
            {cell.value === undefined ? (
              <Skeleton width={28} height={15} radius="var(--radius-xs)" />
            ) : (
              <p className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {numberFormat.format(cell.value)}
              </p>
            )}
            <p className="truncate text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {t(`kpi.${cell.key}` as Parameters<typeof t>[0])}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
