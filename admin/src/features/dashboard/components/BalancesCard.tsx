'use client';

/**
 * What the paid services have left.
 *
 * SMS credit is the number on this page with the sharpest edge: when it runs
 * out, registration stops and nothing in the product says why — a visitor
 * simply never receives a code, and the first anyone hears of it is a support
 * message. It was visible only to whoever ran `scripts/check_sms` from a
 * terminal. Now it is on the screen that gets looked at.
 *
 * The assistant's row is usage, not money, and says so. OpenAI publishes no
 * credit endpoint for an ordinary API key — the old `credit_grants` route was
 * withdrawn and the cost API needs an organisation admin key — so a spend
 * figure here would have to be invented. Message counts are what we genuinely
 * know, and the note points at the one place the money can be read.
 */

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MessageSquare, Send, TriangleAlert } from 'lucide-react';

import type { AdminBalances } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';

/**
 * Below this many remaining messages the row turns amber.
 *
 * Sized against a day rather than a number: signup runs at a few dozen codes
 * on a busy day, so a few hundred left is a week of warning and enough time to
 * top up without anybody noticing a gap.
 */
const LOW_SMS = 300;

export function BalancesCard({
  data,
  isError,
  onRetry,
}: {
  data?: AdminBalances;
  isError?: boolean;
  /**
   * Re-read the provider. This card is the one on the page whose number comes
   * from outside the database, so a failed read is routine — and until this
   * existed the only way out of the em-dash was the 120s poll.
   */
  onRetry?: () => void;
}) {
  const t = useTranslations('dashboard.balances');
  const c = useTranslations('common');
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const sms = data?.sms ?? null;
  const remaining = sms?.remainingSms ?? null;
  const low = remaining !== null && remaining < LOW_SMS;

  /*
   * The four tokens this card used to name — --fg, --fg-muted, --border and
   * --accent-soft — are defined nowhere. An undefined custom property is
   * invalid at computed-value time, so every caption fell back to inherited
   * body ink instead of muted, the icon tiles lost their tint entirely and the
   * divider below painted currentColor: a full-strength rule where every other
   * card draws a hairline. These are the tokens that actually exist, and the
   * two tints now come through .tone-* like the rest of the dashboard rather
   * than a hard-coded amber.
   */
  return (
    <div className="card flex h-full flex-col gap-4 p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('title')}</h2>

      {/* -- SMS ------------------------------------------------------------ */}
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tone-bg)] text-[var(--tone)] ${
            low ? 'tone-warning' : 'tone-accent'
          }`}
        >
          {low ? <TriangleAlert size={18} /> : <Send size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--color-text-muted)]">{t('sms')}</p>
          {isError || !data ? (
            <p className="text-sm font-semibold text-[var(--color-text-muted)]">—</p>
          ) : sms === null ? (
            // Not zero. The provider being unreachable and the account being
            // empty are different emergencies and must not look the same.
            <p className="text-sm font-semibold text-[var(--color-text-muted)]">{t('smsUnknown')}</p>
          ) : (
            <>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {remaining === null
                  ? nf.format(sms.balance)
                  : t('smsRemaining', { count: nf.format(remaining) })}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {t('smsCredit', { amount: nf.format(Math.round(sms.balance)) })}
              </p>
            </>
          )}
        </div>
      </div>

      {/* -- Assistant ------------------------------------------------------ */}
      <div className="flex items-start gap-3 border-t border-[var(--color-border-light)] pt-4">
        <span className="tone-accent mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tone-bg)] text-[var(--tone)]">
          <MessageSquare size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--color-text-muted)]">{t('ai')}</p>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">
            {data ? nf.format(data.ai.messagesToday) : '—'}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {data
              ? t('aiMonth', { count: nf.format(data.ai.messagesThisMonth) })
              : null}
          </p>
          {data && !data.ai.costAvailable && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('aiCostNote')}</p>
          )}
        </div>
      </div>

      {/* Shown only when the read failed. Two em-dashes were the entire story
          until now, and the page's Refresh did not reach this query — so a
          provider hiccup left the card blank until the poll came round. */}
      {isError && onRetry && (
        <div className="mt-auto">
          <Button variant="secondary" size="sm" className="max-sm:w-full" onClick={onRetry}>
            {c('retry')}
          </Button>
        </div>
      )}
    </div>
  );
}
