'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { useRole } from '@/providers/role-provider';
import { Skeleton } from '@/shared/ui/Skeleton';
import type { AdminStats } from '@/shared/api/types';
import type { StatKey, ToneName } from '@/features/dashboard/dashboard-groups';
import { CountUp, Meter, StatLabel, StatNum, TONE_CLASS } from './stat-kit';

/**
 * The listing pipeline as a shape rather than as six separate integers.
 *
 * Two questions are answered side by side, deliberately with two different
 * denominators: the BAR is drawn against the largest stage, so the funnel's
 * silhouette is legible even when one stage dwarfs the rest, while the PER CENT
 * beside it is of the total, because "what share of everything is still
 * waiting" is the question a moderator actually asks. Mixing the two would
 * make both wrong.
 *
 * When there are no listings at all, every share is suppressed rather than
 * printed as "0%" five times over.
 */

interface Stage {
  key: Extract<StatKey, 'approvedListings' | 'pendingListings' | 'rejectedListings' | 'featuredListings'>;
  tone: ToneName;
}

const STAGES: readonly Stage[] = [
  { key: 'approvedListings', tone: 'success' },
  { key: 'pendingListings', tone: 'warning' },
  { key: 'rejectedListings', tone: 'danger' },
  { key: 'featuredListings', tone: 'accent' },
];

export function ListingFlowCard({ stats }: { stats?: AdminStats }) {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');
  const locale = useLocale();
  const { canAccess } = useRole();

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const percentFormat = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
    [locale],
  );

  const total = stats?.totalListings ?? 0;
  const stages = STAGES.map((stage) => ({ ...stage, value: stats?.[stage.key] ?? 0 }));
  const largest = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <div className="card card-cut-tl flex h-full flex-col p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
        <div className="shrink-0 xl:w-[168px]">
          <StatLabel className="block truncate">{t('flow.title')}</StatLabel>

          <div className="mt-2">
            {stats ? (
              <StatNum size={28}>
                <CountUp value={total} />
              </StatNum>
            ) : (
              <Skeleton width={80} height={28} radius="var(--radius-sm)" />
            )}
          </div>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            {t('kpi.totalListings')}
          </p>

          <ModerationSplit
            approved={stats?.approvedListings ?? 0}
            pending={stats?.pendingListings ?? 0}
            rejected={stats?.rejectedListings ?? 0}
          />
        </div>

        <div className="flex flex-1 flex-col gap-2.5">
          {stages.map((stage, index) => (
            <div
              key={stage.key}
              className={`${TONE_CLASS[stage.tone]} grid grid-cols-[84px_1fr_auto] items-center gap-3`}
            >
              <span className="truncate text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                {t(`kpi.${stage.key}` as Parameters<typeof t>[0])}
              </span>

              {/* Cascaded so the pipeline fills top-down rather than all at
                  once, on the same easing as every other entrance here. */}
              <Meter
                value={stage.value}
                max={largest}
                height={8}
                delayMs={Math.min(index * 60, 240)}
              />

              <span className="flex shrink-0 items-baseline gap-1.5">
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {stats ? numberFormat.format(stage.value) : '—'}
                </span>
                {stats && total > 0 && (
                  <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    {percentFormat.format(stage.value / total)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="mt-auto flex items-center justify-between gap-3 border-t pt-3"
        style={{ borderColor: 'var(--color-border-light)' }}
      >
        <span className="min-w-0 truncate text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
          {t('kpi.todayNewListings')}
          <span className="ml-2 font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {stats ? numberFormat.format(stats.todayNewListings) : '—'}
          </span>
        </span>

        {canAccess('/listings') && (
          <Link
            href="/listings"
            className="text-accent flex shrink-0 items-center gap-1 text-[12px] font-semibold"
          >
            {c('view')}
            <ChevronRight size={13} />
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Moderation health in one 8px track, normalised to the three moderation
 * outcomes rather than to the whole catalogue — this asks "of the listings
 * that have been through review, how did they land", which the stage bars
 * beside it cannot answer because they are scaled against the largest stage.
 *
 * It carries no legend of its own: the four stage bars to its right name every
 * segment and use the same tones, so a legend here would be the same three
 * words printed twice.
 */
function ModerationSplit({
  approved,
  pending,
  rejected,
}: {
  approved: number;
  pending: number;
  rejected: number;
}) {
  const sum = approved + pending + rejected;
  if (sum <= 0) return null;

  const parts = [
    { key: 'approved', value: approved, colour: 'var(--color-success)' },
    { key: 'pending', value: pending, colour: 'var(--color-warning)' },
    { key: 'rejected', value: rejected, colour: 'var(--color-danger)' },
  ];

  return (
    <span
      aria-hidden="true"
      className="mt-4 flex h-2 w-full overflow-hidden"
      style={{ borderRadius: 'var(--radius-full)', background: 'var(--color-surface-3)', gap: 2 }}
    >
      {parts.map((part) =>
        part.value > 0 ? (
          <span
            key={part.key}
            className="block h-full"
            style={{
              width: `${(part.value / sum) * 100}%`,
              background: part.colour,
              borderRadius: 'var(--radius-full)',
            }}
          />
        ) : null,
      )}
    </span>
  );
}
