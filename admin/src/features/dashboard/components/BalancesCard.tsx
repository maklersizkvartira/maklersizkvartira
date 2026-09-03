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
}: {
  data?: AdminBalances;
  isError?: boolean;
}) {
  const t = useTranslations('dashboard.balances');
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const sms = data?.sms ?? null;
  const remaining = sms?.remainingSms ?? null;
  const low = remaining !== null && remaining < LOW_SMS;

  return (
    <div className="card flex h-full flex-col gap-4 p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-[var(--fg)]">{t('title')}</h2>

      {/* -- SMS ------------------------------------------------------------ */}
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
            low ? 'bg-amber-500/15 text-amber-600' : 'bg-[var(--accent-soft)] text-[var(--accent)]'
          }`}
        >
          {low ? <TriangleAlert size={18} /> : <Send size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--fg-muted)]">{t('sms')}</p>
          {isError || !data ? (
            <p className="text-sm font-semibold text-[var(--fg-muted)]">—</p>
          ) : sms === null ? (
            // Not zero. The provider being unreachable and the account being
            // empty are different emergencies and must not look the same.
            <p className="text-sm font-semibold text-[var(--fg-muted)]">{t('smsUnknown')}</p>
          ) : (
            <>
              <p className="text-lg font-bold text-[var(--fg)]">
                {remaining === null
                  ? nf.format(sms.balance)
                  : t('smsRemaining', { count: nf.format(remaining) })}
              </p>
              <p className="text-xs text-[var(--fg-muted)]">
                {t('smsCredit', { amount: nf.format(Math.round(sms.balance)) })}
              </p>
            </>
          )}
        </div>
      </div>

      {/* -- Assistant ------------------------------------------------------ */}
      <div className="flex items-start gap-3 border-t border-[var(--border)] pt-4">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <MessageSquare size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--fg-muted)]">{t('ai')}</p>
          <p className="text-lg font-bold text-[var(--fg)]">
            {data ? nf.format(data.ai.messagesToday) : '—'}
          </p>
          <p className="text-xs text-[var(--fg-muted)]">
            {data
              ? t('aiMonth', { count: nf.format(data.ai.messagesThisMonth) })
              : null}
          </p>
          {data && !data.ai.costAvailable && (
            <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('aiCostNote')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
