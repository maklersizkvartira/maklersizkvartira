'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ExternalLink, KeyRound, RefreshCw, Wallet } from 'lucide-react';

import type { AiCost } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';

import { Figure, SectionHead } from './ai-kit';

/**
 * What the assistant has actually cost — or an honest account of why we cannot
 * say, which is the answer to "the OpenAI balance never arrives".
 *
 * It never arrived because there is nothing to arrive. OpenAI publishes no
 * credit or remaining-balance figure for an API key at all: the
 * `/dashboard/billing/credit_grants` route that used to answer that question
 * was withdrawn, and the backend hardcoded `costAvailable: false` in its place.
 * What OpenAI does publish is SPEND over a window, through the organisation
 * costs API, and only to an organisation ADMIN key — an ordinary `sk-...` key
 * collects a 401 there.
 *
 * So this card has two states and no third:
 *
 *  · `available` — the two real figures, exactly as OpenAI returned them.
 *  · anything else — the instruction that fixes it, naming the environment
 *    variable the server is missing and linking the page where the key is
 *    created. It is written to read as a setup step, not as a failure.
 *
 * What it must never do is print a money figure while `available` is false, or
 * derive one from the message counts in the card below: tokens are not
 * dollars, and a plausible wrong number on this screen is worse than an
 * admitted gap. The amounts arrive as `null` for exactly that reason, and
 * `formatAmount` below refuses to substitute a zero for one.
 *
 * `envVar` and `docsUrl` come from the server on every response, the good path
 * included, so neither string is hardcoded here — if the backend renames the
 * variable, this card renames it with no edit.
 */

interface AiCostCardProps {
  /**
   * `undefined` while `/admin/balances` is in flight, and also against a
   * backend older than the costs work — in which case the card says the figure
   * is unavailable and stops there rather than reading `reason` off nothing.
   */
  cost: AiCost | undefined;
  loading: boolean;
  /** A refetch is in flight; the button spins and cannot be pressed twice. */
  refreshing: boolean;
  onRefresh: () => void;
}

export function AiCostCard({ cost, loading, refreshing, onRefresh }: AiCostCardProps) {
  const t = useTranslations('ai');
  const locale = useLocale();

  const available = cost?.available === true;
  /** A missing key is a setup step; a refused one is a problem. Different tone. */
  const setupTone = !cost || cost.reason === 'no_admin_key';

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        // 'usd' arrives lowercase from the API. Intl canonicalises the case
        // itself, but the fallback has to be a valid code either way — and usd
        // is the only currency this route reports in.
        currency: (cost?.currency ?? 'usd').toUpperCase(),
        minimumFractionDigits: 2,
        // Four, because four is what the backend rounds to. A month that has
        // cost $0.0031 must read as $0.0031; printed as $0.00 it would be a
        // different and wrong claim about the account.
        maximumFractionDigits: 4,
      }),
    [locale, cost?.currency],
  );

  /** The instant the figures were read, on the reader's own clock. */
  const clockFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }),
    [locale],
  );

  /**
   * The window's first day, pinned to UTC.
   *
   * `periodStart` is midnight UTC on the 1st. Formatted in the browser's zone
   * it still says "1 September" in Tashkent, but in any zone behind UTC it
   * would name the last day of the previous month — a date that contradicts
   * the figure beside it.
   */
  const monthFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }),
    [locale],
  );

  /** Null stays an em dash. This is the guard that keeps an invented 0 off the card. */
  const formatAmount = (amount: number | null) => (amount === null ? '—' : money.format(amount));

  const reasonText =
    cost && !cost.available && cost.reason
      ? t(`cost.reason.${cost.reason}` as Parameters<typeof t>[0], { envVar: cost.envVar })
      : null;

  return (
    <section className={`card p-5 ${available || setupTone ? 'tone-accent' : 'tone-warning'}`}>
      <SectionHead
        icon={available ? <Wallet size={17} /> : setupTone ? <KeyRound size={17} /> : <AlertTriangle size={17} />}
        title={t('cost.title')}
        subtitle={available ? t('cost.subtitle') : undefined}
        aside={
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={13} />}
            onClick={onRefresh}
            loading={refreshing}
            disabled={loading}
          >
            {/* The word stays visible on a phone rather than collapsing to the
                glyph: an icon-only 32px button is under the finger-sized target
                the rest of this panel holds itself to. */}
            {t('cost.refresh')}
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          <Figure label={t('cost.monthToDate')} value="" loading size={26} />
          <Figure label={t('cost.today')} value="" loading size={26} />
        </div>
      ) : available && cost ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Figure label={t('cost.monthToDate')} value={formatAmount(cost.monthToDateUsd)} size={26} />
            <Figure label={t('cost.today')} value={formatAmount(cost.todayUsd)} size={26} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-4">
            {cost.periodStart && (
              <span className="chip">
                {t('cost.period', { date: monthFormat.format(new Date(cost.periodStart)) })}
              </span>
            )}
            <span className="chip">
              {t('cost.asOf', { time: clockFormat.format(new Date(cost.asOf)) })}
            </span>
            {/* Said out loud rather than hidden, because the refresh button
                above can return the same two numbers twice: the backend serves
                this from a five-minute cache, and a reader who pressed refresh
                deserves to know why nothing moved. */}
            {cost.cached && <span className="chip">{t('cost.cached')}</span>}
          </div>
        </>
      ) : (
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {t('cost.unavailable')}
          </p>

          {reasonText && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {reasonText}
            </p>
          )}

          {cost?.status !== undefined && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
              {t('cost.status', { status: cost.status })}
            </p>
          )}

          {cost && (
            <a
              href={cost.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              {t('cost.docsLink')}
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}

          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t('cost.neverEstimated')}
          </p>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t('cost.usageStillShown')}
          </p>

          {cost && (
            <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
              {t('cost.asOf', { time: clockFormat.format(new Date(cost.asOf)) })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
