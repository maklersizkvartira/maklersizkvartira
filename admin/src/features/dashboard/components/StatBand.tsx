'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import type { AdminStats } from '@/shared/api/types';
import { STAT_GROUPS, attentionTone, type GroupKey } from '@/features/dashboard/dashboard-groups';
import { Segmented } from './Segmented';
import { StatNum, TONE_CLASS } from './stat-kit';

/**
 * The complete reference band: all 25 counters, grouped, at the bottom of the
 * page. Nothing was dropped in the redesign — the numbers simply stopped
 * competing with the queue for the same attention.
 *
 * Some of these appear twice on the page: the three queue counts are also in
 * the hero, the listing counts are also in the flow card. That is deliberate
 * and should not be "fixed" by deleting one. The band is the complete index
 * you look a number up in; the cards above are views onto the handful that
 * need an action today. Pruning the band to only what is shown nowhere else
 * would make the index incomplete, which is the one thing it is for.
 *
 * It is a spec sheet on purpose: no icons, no tiles, no cards inside cards.
 * The `.card` is at zero padding so the hairlines run edge to edge into the
 * cut corner, and every value is a tabular numeral so the right edge of each
 * column is a straight line.
 *
 * Below xl the four group tabs ARE the navigation: a phone shows at most eight
 * rows instead of twenty-five. At xl the tabs disappear and all four groups
 * render as four columns — one component, one render, no duplicated markup,
 * and every number at most one tap away at every width.
 *
 * Three states, three appearances. `stats` being undefined used to mean only
 * "still loading", so a failed /admin/stats left twenty-five skeleton bars
 * shimmering at the bottom of the page forever — a spinner that never resolves
 * reads as a slow network, not as a request that already came back broken. The
 * error state replaces the band outright and carries the retry.
 */

export function StatBand({
  stats,
  error = false,
  onRetry,
}: {
  stats?: AdminStats;
  /** The stats request failed. Distinct from `stats === undefined`, which is
   *  the in-flight state and draws skeletons. */
  error?: boolean;
  onRetry?: () => void;
}) {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');
  const locale = useLocale();
  const [active, setActive] = useState<GroupKey>('people');

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const tabs = STAT_GROUPS.map((group) => ({
    key: group.key,
    label: t(`groups.${group.key}` as Parameters<typeof t>[0]),
  }));

  if (error) {
    return (
      <div className="card card-cut-bl">
        <EmptyState
          icon={<AlertTriangle size={26} />}
          tone="danger"
          title={c('error')}
          action={
            onRetry ? (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                {c('retry')}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="card card-cut-bl">
      <div className="px-5 pt-5 pb-4 xl:hidden">
        <Segmented
          items={tabs}
          value={active}
          onChange={setActive}
          ariaLabel={t('allMetrics')}
          className="seg-grid grid grid-cols-2 gap-1 sm:grid-cols-4"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4">
        {STAT_GROUPS.map((group, groupIndex) => (
          <section
            key={group.key}
            /* `hidden xl:block` and `xl:border-l` are Tailwind's to own. This
               is exactly the element the cascade-layer trap would bite: an
               unlayered `display` on any class here would beat `hidden` and
               all four groups would stack on a phone. */
            className={`${group.key === active ? '' : 'hidden xl:block'} ${groupIndex > 0 ? 'xl:border-l' : ''}`}
            style={{ borderColor: 'var(--color-border-light)' }}
          >
            <p className="stat-label px-5 py-2.5" style={{ background: 'var(--color-surface-2)' }}>
              {t(`groups.${group.key}` as Parameters<typeof t>[0])}
            </p>

            <div className="px-5">
              {group.items.map((item) => {
                const value = stats?.[item.key] ?? 0;
                const tone = stats ? attentionTone(item.key, value) : 'neutral';

                return (
                  <div
                    key={item.key}
                    className={`stat-row ${TONE_CLASS[tone]} flex items-baseline justify-between gap-3 py-2.5`}
                  >
                    <span
                      className="min-w-0 truncate text-[12px]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {t(`kpi.${item.key}` as Parameters<typeof t>[0])}
                    </span>

                    {stats ? (
                      <span className="flex shrink-0 items-baseline gap-1">
                        <StatNum size={15} toned={tone !== 'neutral'}>
                          {numberFormat.format(value)}
                        </StatNum>
                        {/* A part is easier to judge against its whole than on
                            its own — 40 rejected out of 60 and out of 6000 are
                            different platforms. */}
                        {item.outOf && (
                          <span
                            className="text-[11px] tabular-nums"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {`/ ${numberFormat.format(stats[item.outOf])}`}
                          </span>
                        )}
                      </span>
                    ) : (
                      <Skeleton width={44} height={14} radius="var(--radius-xs)" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
