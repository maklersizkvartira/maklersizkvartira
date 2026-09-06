'use client';

/**
 * What the paid services have left, and what they are costing.
 *
 * SMS credit is the number on this page with the sharpest edge: when it runs
 * out, registration stops and nothing in the product says why — a visitor
 * simply never receives a code, and the first anyone hears of it is a support
 * message. It was visible only to whoever ran `scripts/check_sms` from a
 * terminal. Now it is on the screen that gets looked at.
 *
 * The assistant's half used to say — correctly, at the time — that no money
 * figure existed. That is still true of CREDIT: OpenAI withdrew
 * `/dashboard/billing/credit_grants` and publishes no remaining-balance route
 * for an ordinary `sk-...` key, so "how much is left" is a question nobody can
 * answer from an API. SPEND is a different question, and it does have an
 * answer: the organisation costs API, which the backend now reads whenever an
 * admin key is configured. So this card prints the real figure when there is
 * one, and when there is not it says which environment variable is unset and
 * where the key is made — both taken from the payload, never hardcoded here,
 * so the panel and the server cannot drift apart on the variable's name.
 *
 * What it never does is put a number on the money line that OpenAI did not
 * send. `monthToDateUsd` and `todayUsd` are null whenever `cost.available` is
 * false, precisely so that no template can print an estimate, and nothing here
 * multiplies a message count by a price per token. The message counts stay on
 * screen in every failure state — they come from our own database and are
 * exact — but they are usage, and they are labelled as usage. A wrong figure
 * on the money row is worse than an honest gap.
 */

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, CircleDollarSign, MessageSquare, Send, TriangleAlert } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { useRole } from '@/providers/role-provider';
import type { AdminBalances, AiCost } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';

/**
 * Below this many remaining messages the SMS row turns amber.
 *
 * Sized against a day rather than a number: signup runs at a few dozen codes
 * on a busy day, so a few hundred left is a week of warning and enough time to
 * top up without anybody noticing a gap.
 *
 * The backend has a threshold of its own — `lowBalanceWarnSum`, on
 * `/admin/sms/overview` — and the two are deliberately not merged: that one is
 * so'm of credit and this one is messages, `/admin/balances` does not carry it,
 * and the route that does is ADMIN-only while this card is read by moderators.
 * The SMS page styles against the backend's figure; this card keeps its own.
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
   * Re-read the provider. This card is the one on the page whose numbers come
   * from outside the database — two outside services, now — so a failed read
   * is routine, and until this existed the only way out of the em-dash was the
   * 120s poll.
   */
  onRetry?: () => void;
}) {
  const t = useTranslations('dashboard.balances');
  const c = useTranslations('common');
  const locale = useLocale();
  const { can, canAccess } = useRole();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const sms = data?.sms ?? null;
  /**
   * `remaining_sms`, in the provider's own snake_case.
   *
   * This line read `sms?.remainingSms` for the whole life of the card. The
   * provider block is passed through unreshaped, so that key was `undefined`
   * on every single response and the row silently fell back to printing raw
   * credit — which is why "N codes left" never once appeared on this screen.
   */
  const remaining = sms?.remaining_sms ?? null;
  const low = remaining !== null && remaining < LOW_SMS;

  const cost = data?.ai.cost;

  /**
   * Money, in the currency the payload names.
   *
   * Two decimals for a sum a person would call a sum, four for the fractions
   * of a cent an assistant actually costs on a quiet day: rounding a genuine
   * $0.0037 of spend down to "$0.00" would read as "nothing was spent", which
   * is the one thing this row must never say by accident.
   */
  const money = useMemo(() => {
    const currency = (cost?.currency ?? 'usd').toUpperCase();
    const build = (digits: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    const coarse = build(2);
    const fine = build(4);
    return (value: number) => (value > 0 && value < 0.01 ? fine : coarse).format(value);
  }, [locale, cost?.currency]);

  /** A figure we do not have is an em dash, never a zero. See the note at the
   *  two call sites: `available` and a null amount can arrive together, and
   *  the difference between "nothing was spent" and "we could not find out"
   *  is the whole reason this block exists. */
  const amount = (value: number | null | undefined) =>
    value === null || value === undefined ? '—' : money(value);

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
              {/* Said in words, not only in amber: the colour of an icon tile
                  is not something a reader glancing at a phone decodes. */}
              {low && (
                <p className="mt-0.5 text-xs font-semibold text-[var(--color-warning)]">
                  {t('smsLow')}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* -- Assistant usage ------------------------------------------------
          Counts, from our own tables, and labelled as counts. They stay on
          screen in every state of the money row below — including the states
          where OpenAI told us nothing at all. */}
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
            {data ? t('aiMonth', { count: nf.format(data.ai.messagesThisMonth) }) : null}
          </p>
        </div>
      </div>

      {/* -- Assistant spend ------------------------------------------------ */}
      <div className="flex items-start gap-3 border-t border-[var(--color-border-light)] pt-4">
        <span
          className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tone-bg)] text-[var(--tone)] ${
            cost?.available ? 'tone-accent' : 'tone-neutral'
          }`}
        >
          <CircleDollarSign size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--color-text-muted)]">{t('aiCost')}</p>
          {isError || !cost ? (
            <p className="text-sm font-semibold text-[var(--color-text-muted)]">—</p>
          ) : cost.available ? (
            <>
              {/* The amount is inside the phrase because the phrase is what
                  makes it unambiguous: a bare "$12.34" beside a message count
                  invites the reader to guess which window it covers.

                  An em dash for a missing amount, never `?? 0`. A zero here
                  reads as "the assistant is free", which is a claim about
                  money we would be making on the provider's behalf — and this
                  file's own contract is that a null amount is precisely how a
                  figure we do not have arrives. The AI page renders the same
                  payload the same way; two screens disagreeing about what an
                  unknown looks like is how one of them gets believed. */}
              <p className="text-[15px] font-bold text-[var(--color-text-primary)]">
                {t('aiCostMonth', { amount: amount(cost.monthToDateUsd) })}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {t('aiCostToday', { amount: amount(cost.todayUsd) })}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">
                {t('aiCostUnavailable')}
              </p>
              {/* The whole point of the row. Which variable, and where the key
                  is made — not "contact your administrator". */}
              <CostReason cost={cost} />
            </>
          )}
          {cost && !isError && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
              <span>
                {t('asOf', {
                  time: new Date(cost.asOf).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </span>
              {/* Only when it is true. A "from cache" note on a fresh read
                  would make every figure on the card look second-hand. */}
              {cost.cached && <span className="chip">{t('cached')}</span>}
            </p>
          )}
        </div>
      </div>

      {/* -- Where to go next -----------------------------------------------
          Two links, not a menu: each of the two services now has a page that
          carries everything about it, and this is the card that sends a reader
          there with a reason already in hand. /sms is ADMIN on both the route
          table and the backend, so a moderator is never shown a door that
          403s; /ai sits on the same rung as this dashboard. */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {canAccess('/sms') && (
          <Link
            href="/sms"
            className="chip tap inline-flex items-center gap-1 text-[var(--color-text-secondary)]"
          >
            {t('openSmsPage')}
            <ChevronRight size={12} aria-hidden="true" />
          </Link>
        )}
        <Link
          href="/ai"
          className="chip tap inline-flex items-center gap-1 text-[var(--color-text-secondary)]"
        >
          {/* "Set it up" is a promise, so it is only made to the rank that can
              keep it: reading the assistant's settings is ADMIN+. Everyone
              else gets the plain destination. */}
          {cost && !cost.available && can('aiSettingsRead') ? t('aiCostSetup') : t('openAiPage')}
          <ChevronRight size={12} aria-hidden="true" />
        </Link>

        {/* Shown only when the read failed. Two em-dashes were the entire story
            until now, and the page's Refresh did not reach this query — so a
            provider hiccup left the card blank until the poll came round. */}
        {isError && onRetry && (
          <Button variant="secondary" size="sm" className="ml-auto max-sm:w-full" onClick={onRetry}>
            {c('retry')}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Why there is no money figure, in the reader's own language.
 *
 * Spelled out one reason at a time rather than through a computed
 * `cost.reason.${reason}` key: two of the four take `{envVar}` and two do not,
 * and a templated key would have to be cast past next-intl's typing, which is
 * the check that would otherwise catch a reason the backend adds later. The
 * prose itself lives in the `ai` namespace beside the AI page's own copy of
 * this block — one wording for both screens, so they cannot start disagreeing
 * about what an admin key is.
 */
function CostReason({ cost }: { cost: AiCost }) {
  const ai = useTranslations('ai');
  const envVar = cost.envVar;

  const text =
    cost.reason === 'no_admin_key'
      ? ai('cost.reason.no_admin_key', { envVar })
      : cost.reason === 'key_rejected'
        ? ai('cost.reason.key_rejected', { envVar })
        : cost.reason === 'provider_unreachable'
          ? ai('cost.reason.provider_unreachable')
          : cost.reason === 'provider_error'
            ? ai('cost.reason.provider_error')
            : null;

  if (text === null) return null;

  return (
    <p className="mt-1 text-[11px] leading-[1.45] text-[var(--color-text-muted)]">{text}</p>
  );
}
