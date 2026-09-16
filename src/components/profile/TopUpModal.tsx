/**
 * The balance top-up sheet: pick Click or Payme, pick an amount, pay.
 *
 * It is built on `Sheet` rather than on its own overlay, and that is most of
 * the fix. The previous version was a hand-rolled `fixed inset-0
 * overflow-y-auto` overlay with a `max-h-[90vh]` panel inside it; the panel's
 * body could not shrink, so the *overlay* scrolled instead — a scrollbar down
 * the right edge of the screen, the sheet floating loose from the bottom
 * edge, and the pay buttons cut off below the fold on a phone. `Sheet` gives
 * the body its own scroll, locks the page behind, pads the footer for the
 * home indicator, closes on Escape and backdrop, and returns focus.
 *
 * It is also shorter on purpose. Three gateways became two: "Uzum Bank —
 * Ulanmoqda" was a card that opened a paragraph explaining it did nothing.
 * Two Click buttons became one: "via the app" and "via a card" both led to
 * the same URL. The total-summary card, the "100% xavfsiz" line and the
 * "256-bit SSL" footer are gone — the amount is on the pay button, and the
 * one true sentence about safety (the card is entered on the gateway's page,
 * not ours) is under it.
 *
 * All copy goes through `account.topUp.*`. It was hard-coded Uzbek in a
 * profile page that otherwise follows the visitor's language.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { cn } from '../../lib/cn';
import { PaymentApi, type PaymentGateway } from '../../services/paymentApi';
import { useAppStore } from '../../stores/useAppStore';
import { Sheet } from '../ui/Sheet';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialGateway?: PaymentGateway;
  initialAmount?: number;
}

/** Mirrors PAYMENT_MIN/MAX_TOPUP_UZS on the backend, which is what actually decides. */
const MIN_AMOUNT = 1_000;
const MAX_AMOUNT = 5_000_000;

const PRESET_AMOUNTS = [10_000, 20_000, 50_000, 100_000];

type Gateway = Extract<PaymentGateway, 'click' | 'payme'>;

interface GatewayConfig {
  id: Gateway;
  name: string;
  iconSrc: string;
  hintKey: 'account.topUp.clickHint' | 'account.topUp.paymeHint';
  /** The brand colour, used for the selected state and the pay button. */
  accent: string;
  /** Text colour that reads on `accent`. Payme's cyan needs dark text. */
  onAccent: string;
}

const GATEWAYS: GatewayConfig[] = [
  {
    id: 'click',
    name: 'Click',
    iconSrc: '/brand/click-icon.svg',
    hintKey: 'account.topUp.clickHint',
    accent: '#0065FF',
    onAccent: '#ffffff',
  },
  {
    id: 'payme',
    name: 'Payme',
    iconSrc: '/brand/payme-app-icon.png',
    hintKey: 'account.topUp.paymeHint',
    accent: '#00CCCC',
    onAccent: '#062a2a',
  },
];

/**
 * The only places this sheet will send a customer to.
 *
 * The checkout link comes from our own API, but the API answer travels
 * through a proxy and a CDN, and a customer who has just pressed "pay" will
 * type a card into whatever page opens next. Refusing anything that is not
 * the gateway's own https origin costs nothing and closes that door.
 */
const GATEWAY_HOSTS = new Set(['my.click.uz', 'checkout.paycom.uz', 'checkout.test.paycom.uz']);

function isGatewayUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && GATEWAY_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** "35000" → "35 000". Digits only in, grouped out; the thousands separator
 *  is a no-break space so the number never wraps. */
function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export const TopUpModal: React.FC<TopUpModalProps> = ({
  isOpen,
  onClose,
  initialGateway = 'click',
  initialAmount,
}) => {
  const { t, formatNumber } = useTranslation();
  const pushToast = useAppStore((s) => s.pushToast);

  const [gateway, setGateway] = useState<Gateway>(initialGateway === 'payme' ? 'payme' : 'click');
  /** The amount as typed, digits only. A preset writes into it too, so
   *  there is one source of truth rather than a preset AND a custom field
   *  that had to be reconciled on every read. Opens at the minimum, not at
   *  a suggested figure: the field should show the least a person can pay,
   *  and anything more is their choice. */
  const [amountDigits, setAmountDigits] = useState<string>(String(initialAmount || MIN_AMOUNT));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed when the sheet is reopened with a different suggestion, e.g. the
  // exact shortfall for a badge purchase.
  useEffect(() => {
    if (!isOpen) return;
    setGateway(initialGateway === 'payme' ? 'payme' : 'click');
    setAmountDigits(String(initialAmount ? Math.round(initialAmount) : MIN_AMOUNT));
    setError(null);
    setLoading(false);
  }, [isOpen, initialGateway, initialAmount]);

  const amount = Number(amountDigits) || 0;
  const config = GATEWAYS.find((g) => g.id === gateway) ?? GATEWAYS[0];

  const amountError = useMemo(() => {
    if (!amountDigits) return null;
    if (amount < MIN_AMOUNT) return t('account.topUp.amountTooLow', { min: formatNumber(MIN_AMOUNT) });
    if (amount > MAX_AMOUNT) return t('account.topUp.amountTooHigh', { max: formatNumber(MAX_AMOUNT) });
    return null;
  }, [amount, amountDigits, formatNumber, t]);

  const canPay = amount >= MIN_AMOUNT && amount <= MAX_AMOUNT && !loading;

  const handleAmountInput = (raw: string) => {
    // Digits only, and never more than the maximum has: a seventh digit on a
    // phone keyboard is far more often a slip than a real 10-million top-up.
    const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
    setAmountDigits(digits);
    setError(null);
  };

  const handlePay = async () => {
    if (!canPay) return;
    setLoading(true);
    setError(null);
    try {
      const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/profile` : undefined;
      const res = await PaymentApi.createTopUp(amount, returnUrl, gateway);
      const targetUrl = gateway === 'payme' ? res.paymeUrl : res.clickUrl || res.clickCardUrl;
      if (!targetUrl || !isGatewayUrl(targetUrl)) {
        throw new Error(t('account.topUp.noLink'));
      }
      // The page is leaving; the spinner stays until it has.
      window.location.href = targetUrl;
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t('common.error.generic');
      setError(message);
      pushToast(message, 'error');
      setLoading(false);
    }
  };

  const payLabel = loading
    ? t('account.topUp.redirecting')
    : t('account.topUp.pay', { gateway: config.name, amount: formatNumber(Math.max(amount, 0)) });

  return (
    <Sheet
      open={isOpen}
      onClose={loading ? () => undefined : onClose}
      title={t('account.topUp.title')}
      description={t('account.topUp.subtitle', { gateway: config.name })}
      size="sm"
      dismissOnBackdrop={!loading}
      footer={
        <div className="space-y-2.5">
          {error && (
            <p role="alert" className="text-xs font-semibold text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handlePay}
            disabled={!canPay}
            style={{ backgroundColor: config.accent, color: config.onAccent }}
            className="press flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black shadow-lg transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <img src={config.iconSrc} alt="" className="h-6 w-6 rounded-md object-cover" />
            )}
            <span>{payLabel}</span>
          </button>
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-subtle">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            <span>{t('account.topUp.cardNote')}</span>
          </p>
        </div>
      }
    >
      <div className="space-y-5 pt-1">
        {/* 1. Gateway */}
        <fieldset>
          <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-subtle">
            {t('account.topUp.gateway')}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {GATEWAYS.map((gw) => {
              const selected = gw.id === gateway;
              return (
                <button
                  key={gw.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setGateway(gw.id);
                    setError(null);
                  }}
                  style={selected ? { borderColor: gw.accent, boxShadow: `0 0 0 1px ${gw.accent}` } : undefined}
                  className={cn(
                    'press flex min-h-[64px] items-center gap-2.5 rounded-2xl border px-2.5 py-3 text-left transition-colors',
                    selected ? 'bg-surface-2' : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <img
                    src={gw.iconSrc}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-content">{gw.name}</span>
                    <span className="block whitespace-nowrap text-[10px] leading-tight text-muted">
                      {t(gw.hintKey)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 2. Amount */}
        <div>
          <label
            htmlFor="topup-amount"
            className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-subtle"
          >
            {t('account.topUp.amount')}
          </label>
          <div className="mb-2 grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((preset) => {
              const active = amount === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleAmountInput(String(preset))}
                  style={active ? { backgroundColor: config.accent, color: config.onAccent, borderColor: config.accent } : undefined}
                  className={cn(
                    'press min-h-11 rounded-xl border text-xs font-black transition-colors',
                    active ? 'shadow-md' : 'border-line bg-surface text-content hover:bg-surface-2',
                  )}
                >
                  {formatNumber(preset)}
                </button>
              );
            })}
          </div>
          <div className="relative">
            <input
              id="topup-amount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('account.topUp.customPlaceholder')}
              value={groupDigits(amountDigits)}
              onChange={(e) => handleAmountInput(e.target.value)}
              aria-invalid={amountError ? true : undefined}
              aria-describedby="topup-amount-hint"
              className={cn(
                'h-12 w-full rounded-xl border bg-surface pl-4 pr-16 text-base font-black text-content outline-none transition-colors placeholder:font-semibold placeholder:text-subtle focus:border-brand',
                amountError ? 'border-danger' : 'border-line',
              )}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-subtle">
              {t('account.topUp.currency')}
            </span>
          </div>
          <p
            id="topup-amount-hint"
            className={cn('mt-1.5 text-[11px]', amountError ? 'font-semibold text-danger' : 'text-subtle')}
          >
            {amountError ??
              t('account.topUp.range', { min: formatNumber(MIN_AMOUNT), max: formatNumber(MAX_AMOUNT) })}
          </p>
        </div>
      </div>
    </Sheet>
  );
};
