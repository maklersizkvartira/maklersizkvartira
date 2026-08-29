'use client';

import { useMemo, type ComponentType } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronRight, Clock, Flag, Inbox, ShieldCheck } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { useRole } from '@/providers/role-provider';
import { Skeleton } from '@/shared/ui/Skeleton';
import type { AdminStats } from '@/shared/api/types';
import { workTone, worstTone, type StatKey, type ToneName } from '@/features/dashboard/dashboard-groups';
import { CountUp, IconTile, LivePill, Meter, StatLabel, StatNum, TONE_CLASS } from './stat-kit';

/**
 * The hero, and the reason the page was rebuilt: it answers "is there work
 * for me" before the reader has decided to look for it.
 *
 * The three counters below are the only ones on `/admin/stats` that represent
 * a decision a moderator can make — everything else is either history or
 * traffic. Each row links straight into the page that clears it, gated by the
 * same route table the sidebar uses, so a MODERATOR never sees a queue they
 * would be 403'd out of.
 *
 * The big number is a SUM of the three, which is the one derived number on a
 * page whose standing policy is "no arithmetic the API never did". It is
 * defensible because all three are integers of the same kind and all three
 * parts are printed directly underneath the whole; if the product owner still
 * objects, make the headline `pendingListings` alone and the composition
 * survives untouched.
 */

interface QueueDef {
  key: Extract<StatKey, 'pendingListings' | 'openReports' | 'pendingVerifications'>;
  href: string;
  Icon: ComponentType<{ size?: number }>;
}

const QUEUES: readonly QueueDef[] = [
  { key: 'pendingListings', href: '/listings', Icon: Clock },
  { key: 'openReports', href: '/reports', Icon: Flag },
  { key: 'pendingVerifications', href: '/verifications', Icon: ShieldCheck },
];

export function TriageCard({ stats }: { stats?: AdminStats }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const { canAccess } = useRole();

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const rows = useMemo(
    () =>
      QUEUES.filter((queue) => canAccess(queue.href)).map((queue) => {
        const value = stats?.[queue.key] ?? 0;
        return { ...queue, value, tone: stats ? workTone(queue.key, value) : ('neutral' as ToneName) };
      }),
    [stats, canAccess],
  );

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const largest = Math.max(...rows.map((row) => row.value), 1);
  const tone: ToneName = stats && total > 0 ? worstTone(rows.map((row) => row.tone)) : 'neutral';
  const clear = Boolean(stats) && total === 0;

  return (
    <div
      className={`card card-cut-bl card-hero ${TONE_CLASS[tone]} flex h-full flex-col p-5 sm:p-6`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* The tile is the zero state's whole announcement: a green tick
              rather than a green banner. A clear board should read as calm,
              not as another thing shouting. */}
          <IconTile size={36} className={clear ? 'tone-success' : ''}>
            {clear ? <Check size={18} /> : <Inbox size={18} />}
          </IconTile>
          <StatLabel className="truncate">{t('triage.title')}</StatLabel>
        </div>
        {total > 0 && <LivePill label={t('triage.live')} />}
      </div>

      <div className="mt-4 flex items-baseline gap-3">
        {stats ? (
          <StatNum muted={clear} className="text-[44px] sm:text-[56px]">
            <CountUp value={total} />
          </StatNum>
        ) : (
          <Skeleton width={96} height={44} radius="var(--radius-sm)" />
        )}
        <span
          className="max-w-[124px] text-[12px] leading-[1.35]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {clear ? t('triage.clear') : t('triage.caption')}
        </span>
      </div>

      {/* Bleeds to the card edge so the hairlines run the full width and get
          clipped by the cut corner for free. */}
      <div className="mt-5 -mx-5 sm:-mx-6">
        {rows.map((row) => (
          <Link
            key={row.key}
            href={row.href}
            className={`queue-row tap rail ${TONE_CLASS[row.tone]} flex min-h-[56px] items-center gap-3 px-5 sm:px-6`}
          >
            <IconTile size={32}>
              <row.Icon size={16} />
            </IconTile>

            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-[13px] font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {t(`kpi.${row.key}` as Parameters<typeof t>[0])}
              </span>
              {/* Relative to the biggest queue, so the bar answers which one
                  is worst while the numeral answers how many. */}
              <Meter value={row.value} max={largest} height={3} className="mt-1.5" />
            </span>

            {stats ? (
              <StatNum size={20} toned={row.value > 0} muted={row.value === 0} className="shrink-0">
                {numberFormat.format(row.value)}
              </StatNum>
            ) : (
              <Skeleton width={28} height={18} radius="var(--radius-xs)" />
            )}

            <ChevronRight size={15} className="shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          </Link>
        ))}
      </div>

      {/* Two totals in body font on purpose. Demoting them is what keeps the
          56px number the only display numeral on the card. */}
      <div
        className="mt-auto flex items-center gap-5 border-t pt-4"
        style={{ borderColor: 'var(--color-border-light)' }}
      >
        <FooterFigure
          label={t('kpi.totalListings')}
          value={stats ? numberFormat.format(stats.totalListings) : null}
        />
        <span
          aria-hidden="true"
          className="h-8 w-px shrink-0"
          style={{ background: 'var(--color-border)' }}
        />
        <FooterFigure
          label={t('kpi.totalUsers')}
          value={stats ? numberFormat.format(stats.totalUsers) : null}
        />
      </div>
    </div>
  );
}

function FooterFigure({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      {value === null ? (
        <Skeleton width={56} height={17} radius="var(--radius-xs)" className="mt-1" />
      ) : (
        <p className="text-[17px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {value}
        </p>
      )}
    </div>
  );
}
