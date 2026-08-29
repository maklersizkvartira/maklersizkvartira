'use client';

import { useMemo, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, LockKeyhole } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { useRole } from '@/providers/role-provider';
import { Skeleton } from '@/shared/ui/Skeleton';
import type { AdminStats } from '@/shared/api/types';
import { attentionTone, worstTone, type ToneName } from '@/features/dashboard/dashboard-groups';
import { CountUp, IconTile, StatLabel, StatNum, TONE_CLASS } from './stat-kit';

/**
 * "Is anything wrong today" — failed sign-ins and SMS deliverability, the two
 * counters that describe the platform misbehaving rather than the platform
 * being used.
 *
 * Both lines link into the page that explains them, which is what makes this
 * card part of the triage set rather than a read-only reading. Both links are
 * gated: `/security` and `/sms` are ADMIN routes, so a MODERATOR sees the same
 * numbers as plain text with no dead affordance.
 *
 * The tone paints the icon tile, the numeral and the 3px rail — never the card
 * background. A red card for three failed sign-ins would be lying about the
 * severity of three failed sign-ins.
 */

export function RiskCard({ stats }: { stats?: AdminStats }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const { canAccess } = useRole();

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const failedLogins = stats?.failedLoginsToday ?? 0;
  const smsFailed = stats?.smsFailedToday ?? 0;
  const smsTotal = stats?.smsToday ?? 0;

  const loginTone: ToneName = stats ? attentionTone('failedLoginsToday', failedLogins) : 'neutral';
  const smsTone: ToneName = stats ? attentionTone('smsFailedToday', smsFailed) : 'neutral';
  const tone = worstTone([loginTone, smsTone]);
  const clear = Boolean(stats) && failedLogins === 0 && smsFailed === 0;

  return (
    <div className={`card card-cut-br rail ${TONE_CLASS[tone]} flex h-full flex-col p-5`}>
      <IconTile size={32}>
        <LockKeyhole size={16} />
      </IconTile>

      {/* Wraps rather than truncates: at the two-up width "Xavfsizlik va
          SMS" does not fit on one line, and half a label is worse than a
          taller card. */}
      <StatLabel className="mt-3 block leading-[1.35]">{t('risk.title')}</StatLabel>

      <TapTarget href="/security" enabled={canAccess('/security')}>
        {stats ? (
          <StatNum size={30} toned={loginTone !== 'neutral'} muted={failedLogins === 0}>
            <CountUp value={failedLogins} />
          </StatNum>
        ) : (
          <Skeleton width={64} height={30} radius="var(--radius-sm)" />
        )}
        <p className="mt-1 text-[11px] leading-[1.35]" style={{ color: 'var(--color-text-muted)' }}>
          {t('kpi.failedLoginsToday')}
        </p>
      </TapTarget>

      <div
        className="mt-auto border-t pt-3"
        style={{ borderColor: 'var(--color-border-light)' }}
      >
        {clear ? (
          <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            {t('risk.clear')}
          </p>
        ) : (
          <TapTarget href="/sms" enabled={canAccess('/sms')} row>
            <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {t('kpi.smsFailedToday')}
            </span>
            {/* A failure count without its denominator is a number nobody can
                act on: 12 of 14 and 12 of 4000 are different mornings. */}
            <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {stats ? `${numberFormat.format(smsFailed)} / ${numberFormat.format(smsTotal)}` : '—'}
            </span>
          </TapTarget>
        )}
      </div>
    </div>
  );
}

/**
 * A block that becomes a link when the reader's rank can open the page behind
 * it, and stays a plain box otherwise. The negative margins let the pressed
 * state span the card's full width instead of stopping at the text.
 */
function TapTarget({
  href,
  enabled,
  row = false,
  children,
}: {
  href: string;
  enabled: boolean;
  row?: boolean;
  children: ReactNode;
}) {
  const layout = row ? 'flex items-baseline gap-2' : 'block';

  if (!enabled) return <div className={`${layout} mt-2`}>{children}</div>;

  return (
    <Link
      href={href}
      className={`tap ${layout} -mx-5 mt-2 rounded-[var(--radius-sm)] px-5 py-1.5`}
    >
      {children}
      {row && <ChevronRight size={13} className="shrink-0" style={{ color: 'var(--color-text-muted)' }} />}
    </Link>
  );
}
