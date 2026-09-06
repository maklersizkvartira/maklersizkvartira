'use client';

/**
 * How much we sent and how much of it stuck, over three windows at once.
 *
 * The failure rate is the number this card is built around: it is the only
 * thing on the page that says something is wrong BEFORE the support calls
 * start, and it is only readable against a neighbour — 4% today next to 0.3%
 * this month is a provider that broke this morning, and the same 4% on both is
 * simply what this account costs. So the three windows are rows of one card
 * rather than three cards or a tab strip: nothing here is worth hiding behind
 * a tap, and the comparison is the point.
 *
 * Two honesty rules, both inherited from the payload:
 *
 *  · `failureRate` is null when nothing was sent, and null is an em dash, never
 *    0%. "Nothing went out" and "everything went out fine" are different facts,
 *    and on the all-time window they are worlds apart. A window with no rows at
 *    all prints the sentence instead of a grid of zeros.
 *  · `parts` is billable segments, not messages. A long text is split and each
 *    piece is charged, so parts is what tracks the invoice while `total` tracks
 *    how many people were texted. The footnote says so, because the two numbers
 *    disagreeing is otherwise read as a bug.
 */

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { SmsOverview } from '@/shared/api/types';
import { Skeleton } from '@/shared/ui/Skeleton';

/** Narrowest window first: today is what a reader opens this page about. */
const WINDOWS = ['today', 'month', 'allTime'] as const;

/**
 * The three statuses that are usually zero. Shown only when they are not —
 * a permanent row of zeros teaches the eye to skip the line, and SKIPPED
 * suddenly being non-zero is exactly the thing that has to be noticed, because
 * it means SMS_ENABLED is off and codes are being logged instead of sent.
 */
const RARE_STATUSES = ['queued', 'skipped', 'unknown'] as const;

export function SmsCountersCard({
  data,
  isError = false,
}: {
  data?: SmsOverview;
  /** The read failed; print dashes rather than a skeleton that never settles. */
  isError?: boolean;
}) {
  const t = useTranslations('sms.overview');
  const locale = useLocale();

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  /** 0..1 from the backend, already rounded to 4dp — one decimal of percent is
   *  as much as that supports without inventing precision. */
  const pf = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }),
    [locale],
  );

  return (
    <div className="card flex h-full flex-col p-5">
      {WINDOWS.map((key, index) => {
        const counts = data?.counters[key];
        // Paired with their values here rather than filtered and re-indexed in
        // the JSX, so nothing below has to assert that `counts` is still there.
        const rare = counts
          ? RARE_STATUSES.filter((status) => counts[status] > 0).map((status) => ({
              status,
              value: counts[status],
            }))
          : [];

        return (
          <div key={key} className={index > 0 ? 'stat-row mt-4 pt-4' : ''}>
            {/* The window's name on a line of its own, with the statuses that
                are usually zero pushed to the end of it. Five cells under one
                heading beats a label column beside them: the three windows then
                share one set of gridlines, which is what makes today's failure
                rate legible against the month's at a glance. */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="stat-label">{t(`windows.${key}`)}</span>
              {rare.length > 0 && (
                <span
                  className="flex flex-wrap gap-x-3 text-[11px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {rare.map((item) => (
                    <span key={item.status}>
                      {t(`counters.${item.status}`)} {nf.format(item.value)}
                    </span>
                  ))}
                </span>
              )}
            </div>

            {counts && counts.total === 0 ? (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {t('nothingSent')}
              </p>
            ) : (
              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
                <Cell
                  label={t('counters.total')}
                  value={counts && nf.format(counts.total)}
                  isError={isError}
                  strong
                />
                <Cell
                  label={t('counters.sent')}
                  value={counts && nf.format(counts.sent)}
                  isError={isError}
                />
                <Cell
                  label={t('counters.failed')}
                  value={counts && nf.format(counts.failed)}
                  isError={isError}
                  // Red on any failure at all, and on nothing else. A "how bad
                  // is bad" scale here would be a threshold this product has
                  // never agreed on, invented in a component.
                  alarming={counts !== undefined && counts.failed > 0}
                />
                <Cell
                  label={t('counters.failureRate')}
                  value={
                    counts && (counts.failureRate === null ? '—' : pf.format(counts.failureRate))
                  }
                  isError={isError}
                  alarming={
                    counts !== undefined && counts.failureRate !== null && counts.failureRate > 0
                  }
                />
                <Cell
                  label={t('counters.parts')}
                  value={counts && nf.format(counts.parts)}
                  isError={isError}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-auto border-t pt-3.5" style={{ borderColor: 'var(--color-border-light)' }}>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {t('partsHint')}
        </p>
        {/* The windows are UTC days, the same ones the dashboard counts — so
            "today" starts at 05:00 in Tashkent, and a quiet early morning here
            is five hours of yesterday's traffic rather than a dead provider. */}
        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {t('utcNote')}
        </p>
      </div>
    </div>
  );
}

/** One number and its caption. `value` undefined means the payload has not
 *  arrived: a skeleton while it is coming, an em dash once it has failed. */
function Cell({
  label,
  value,
  isError,
  alarming = false,
  strong = false,
}: {
  label: string;
  value: string | undefined;
  isError: boolean;
  alarming?: boolean;
  /** The window's anchor figure — how many people were texted. Carries the
   *  display face so the four cells beside it read as its breakdown. */
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      {value === undefined && !isError ? (
        <Skeleton width={strong ? 48 : 36} height={strong ? 19 : 16} radius="var(--radius-xs)" />
      ) : (
        <p
          className={strong ? 'stat-num' : 'text-[15px] font-semibold tabular-nums'}
          style={{
            ...(strong ? { fontSize: 19 } : {}),
            color: alarming
              ? 'var(--color-danger)'
              : value === undefined
                ? 'var(--color-text-muted)'
                : 'var(--color-text-primary)',
          }}
        >
          {value ?? '—'}
        </p>
      )}
      <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
    </div>
  );
}
