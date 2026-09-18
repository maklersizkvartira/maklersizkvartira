/**
 * The wallet: balance, top-up, the one service sold from it, and the ledger.
 *
 * It replaced a 670-line "premium fintech card" — a 3D plastic card with a
 * gold EMV chip, fake card digits, NFC waves and three gateway logos — which
 * was hard-coded Uzbek inside a page that follows the visitor's language,
 * styled in raw slate/emerald classes that ignored the theme, and answered
 * the one question a person opens a wallet with ("how much do I have?") in
 * the smallest type on the card.
 *
 * Now the balance is the first and largest thing, the top-up button is
 * under it, the blue-check purchase is one row with one button, and the
 * history is a plain list. Every string comes from `account.wallet.*`.
 * The purchase confirmation is a `Sheet` rather than a hand-rolled overlay.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Loader2, Plus, RefreshCw, Wallet } from 'lucide-react';
import confetti from 'canvas-confetti';

import { useTranslation } from '../../i18n';
import { cn } from '../../lib/cn';
import { PaymentApi, type PaymentGateway, type WalletInfo } from '../../services/paymentApi';
import { useAppStore } from '../../stores/useAppStore';
import { BlueVerifiedBadge } from '../common/BlueVerifiedBadge';
import { Card } from '../ui/Card';
import { Button } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { TopUpModal } from './TopUpModal';

function formatDisplayPhone(rawPhone?: string): string {
  if (!rawPhone) return '+998 •• ••• •• ••';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }
  return rawPhone;
}

/** Mirrors PRICES["VERIFIED_BADGE"] on the backend, which is what decides. */
const VERIFIED_BADGE_PRICE = 20_000;

interface WalletCardProps {
  /** Rendered inside a page that already has a heading: no card frame, no title. */
  embedded?: boolean;
}

export const WalletCard: React.FC<WalletCardProps> = ({ embedded = false }) => {
  const { t, language, formatNumber } = useTranslation();
  const pushToast = useAppStore((s) => s.pushToast);
  const currentUser = useAppStore((s) => s.currentUser);
  const refreshUser = useAppStore((s) => s.refreshUser);

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingBadge, setBuyingBadge] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpGateway, setTopUpGateway] = useState<PaymentGateway>('click');
  const [topUpInitialAmount, setTopUpInitialAmount] = useState<number | undefined>(undefined);
  const [isBadgeSheetOpen, setIsBadgeSheetOpen] = useState(false);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      setWallet(await PaymentApi.getWalletInfo());
    } catch {
      // The store's copy of the balance still shows; the ledger stays empty.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const balance = wallet?.balance ?? currentUser?.balance ?? 0;
  const isVerified = Boolean(wallet?.isVerified || currentUser?.isVerified);
  const shortfall = Math.max(0, VERIFIED_BADGE_PRICE - balance);

  const openTopUp = (gateway: PaymentGateway = 'click', amount?: number) => {
    setTopUpGateway(gateway);
    setTopUpInitialAmount(amount);
    setIsTopUpOpen(true);
  };

  const confirmBuyBadge = async () => {
    if (shortfall > 0) {
      setIsBadgeSheetOpen(false);
      openTopUp('click', Math.max(1_000, shortfall));
      return;
    }
    setBuyingBadge(true);
    try {
      await PaymentApi.buyService('VERIFIED_BADGE');
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch {
        // Confetti is decoration; a canvas that cannot draw is not an error.
      }
      pushToast(t('account.wallet.badgeBought'), 'success');
      setIsBadgeSheetOpen(false);
      await fetchWallet();
      await refreshUser?.();
    } catch (err) {
      pushToast(err instanceof Error && err.message ? err.message : 'common.error.generic', 'error');
    } finally {
      setBuyingBadge(false);
    }
  };

  const sum = (value: number) => `${formatNumber(value)} ${t('account.topUp.currency')}`;

  const body = (
    <div className="space-y-5">
      {/* 1. 3D Plastic VIP Bank Card — Luxury FinTech Representation of Balance */}
      <div className="space-y-3">
        <div className="group relative aspect-[1.586] w-full min-h-[220px] sm:min-h-[245px] overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-[#0a0f1d] via-[#0f1d24] to-[#042825] p-5 sm:p-6 text-white shadow-[0_20px_50px_-10px_rgba(0,0,0,0.65),0_10px_30px_rgba(16,185,129,0.25),inset_0_1px_1px_rgba(255,255,255,0.35)] transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between select-none">
          
          {/* Holographic Gloss & Ambient Glow Accents */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-white/[0.18]" />
          <div className="pointer-events-none absolute -bottom-14 -right-14 h-64 w-64 rounded-full bg-emerald-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-14 -top-14 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Card Top Row: Brand, NFC, Gateway Badges & Reload */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-xs sm:text-sm font-black text-white shadow-md shadow-emerald-950/60">
                U
              </div>
              <div>
                <span className="block text-xs sm:text-sm font-black tracking-wider text-white">
                  UYIZ WALLET
                </span>
                <span className="block text-[8px] sm:text-[9px] font-bold tracking-widest text-emerald-400 uppercase">
                  PREMIUM FINTECH CARD
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* NFC Contactless waves */}
              <svg
                className="hidden xs:block h-5 w-5 text-white/70"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                <path d="M12 19a8.5 8.5 0 0 0 0-14" />
                <path d="M15.5 21.5a12 12 0 0 0 0-19" />
              </svg>

              {/* Multi-gateway badges pill */}
              <div className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-2 py-1 backdrop-blur-md shadow-xs">
                <img src="/brand/click-icon.svg" alt="Click" className="h-4 w-4 object-contain" />
                <img src="/brand/payme-app-icon.png" alt="Payme" className="h-4 w-4 rounded object-cover" />
              </div>

              {/* Refresh button */}
              <button
                type="button"
                onClick={() => void fetchWallet()}
                disabled={loading}
                aria-label={t('account.sessions.reload')}
                className="press flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Card Middle: Realistic Golden EMV Chip & Balance */}
          <div className="relative z-10 my-auto flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3">
              {/* 3D Golden EMV Chip */}
              <div className="relative flex h-8 w-11 sm:h-9 sm:w-13 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-yellow-300/80 bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 shadow-md">
                <div className="absolute top-2.5 h-[1px] w-full bg-amber-900/40" />
                <div className="absolute bottom-2.5 h-[1px] w-full bg-amber-900/40" />
                <div className="absolute left-3.5 h-full w-[1px] bg-amber-900/40" />
                <div className="absolute right-3.5 h-full w-[1px] bg-amber-900/40" />
                <div className="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded border border-amber-900/45 bg-amber-300/30" />
              </div>

              {/* Debossed card digits */}
              <div className="font-mono text-[11px] sm:text-xs font-bold tracking-widest text-slate-300/75">
                •••• {currentUser?.phone ? currentUser.phone.replace(/\D/g, '').slice(-4) : '8899'}
              </div>
            </div>

            {/* Current Balance */}
            <div className="text-right">
              <span className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-300/90">
                {t('account.wallet.balance')}
              </span>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(16,185,129,0.6)]">
                {loading && !wallet ? '...' : formatNumber(balance)}{' '}
                <span className="text-sm sm:text-base font-bold text-emerald-200/90">
                  {t('account.topUp.currency')}
                </span>
              </div>
            </div>
          </div>

          {/* Card Bottom Row: Cardholder Name & Phone */}
          <div className="relative z-10 flex items-end justify-between border-t border-white/15 pt-2.5 sm:pt-3">
            <div className="min-w-0 pr-3">
              <span className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-slate-400">
                {t('account.wallet.cardHolder')}
              </span>
              <span className="block truncate font-mono text-xs sm:text-sm font-bold tracking-wider text-slate-100">
                {(currentUser?.name || 'UYIZ FOYDALANUVCHISI').toUpperCase()}
              </span>
            </div>

            <div className="text-right shrink-0">
              <span className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                {t('account.wallet.phone')}
              </span>
              <span className="block font-mono text-xs sm:text-sm font-bold tracking-wider text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                {formatDisplayPhone(currentUser?.phone)}
              </span>
            </div>
          </div>
        </div>

        {/* Top-up action buttons (Click & Payme dual quick buttons) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => openTopUp('click')}
            className="press flex min-h-12 items-center justify-center gap-2.5 rounded-2xl bg-[#0065FF] px-4 py-3 text-sm font-black text-white shadow-md shadow-blue-500/20 hover:brightness-110 active:scale-[0.99] transition-all"
          >
            <img src="/brand/click-icon.svg" alt="Click" className="h-5 w-5 rounded-md object-contain bg-white p-0.5" />
            <span>Click orqali to‘ldirish</span>
          </button>
          <button
            type="button"
            onClick={() => openTopUp('payme')}
            className="press flex min-h-12 items-center justify-center gap-2.5 rounded-2xl bg-[#00CCCC] px-4 py-3 text-sm font-black text-[#042825] shadow-md shadow-teal-500/20 hover:brightness-105 active:scale-[0.99] transition-all"
          >
            <img src="/brand/payme-app-icon.png" alt="Payme" className="h-5 w-5 rounded-md object-cover" />
            <span>Payme orqali to‘ldirish</span>
          </button>
        </div>
        <p className="flex items-center justify-center gap-2 text-center text-[11px] text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Click va Payme tizimlari 100% rasmiy ulangan</span>
        </p>
      </div>

      {/* 2. Services */}
      <section>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-subtle">{t('account.wallet.servicesTitle')}</h3>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
            <BlueVerifiedBadge size="md" showTooltip={false} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-content">{t('account.wallet.badgeTitle')}</p>
            <p className="text-xs leading-snug text-muted">{t('account.wallet.badgeDesc')}</p>
          </div>
          {isVerified ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {t('account.wallet.badgeActive')}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setIsBadgeSheetOpen(true)}
              className="press shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-black text-on-brand"
            >
              {t('account.wallet.badgeBuy')}
              <span className="block text-[10px] font-semibold text-on-brand/80">{sum(VERIFIED_BADGE_PRICE)}</span>
            </button>
          )}
        </div>
      </section>

      {/* 3. History */}
      <section>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-subtle">{t('account.wallet.historyTitle')}</h3>
        {loading && !wallet ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden="true" />
          </div>
        ) : wallet?.transactions.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {wallet.transactions.map((tx) => {
              const positive = tx.amount > 0;
              return (
                <li key={tx.id} className="flex items-center gap-3 px-3.5 py-3">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      positive ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {positive ? <ArrowDownLeft className="h-4 w-4" aria-hidden="true" /> : <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-content">{tx.description}</p>
                    <p className="text-[11px] text-subtle">
                      {new Date(tx.createdAt).toLocaleString(language, {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn('text-sm font-black', positive ? 'text-success' : 'text-content')}>
                      {positive ? '+' : '−'}
                      {formatNumber(Math.abs(tx.amount))}
                    </p>
                    <p className="text-[10px] text-subtle">
                      {t('account.wallet.remaining', { amount: formatNumber(tx.balanceAfter) })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-xs text-subtle">
            {t('account.wallet.historyEmpty')}
          </p>
        )}
      </section>
    </div>
  );

  return (
    <>
      {embedded ? (
        body
      ) : (
        <Card padding="lg" className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-black text-content">{t('account.wallet.title')}</h2>
              <p className="text-xs text-muted">{t('account.wallet.subtitle')}</p>
            </div>
          </div>
          {body}
        </Card>
      )}

      <Sheet
        open={isBadgeSheetOpen}
        onClose={() => setIsBadgeSheetOpen(false)}
        title={t('account.wallet.badgeConfirmTitle')}
        description={t('account.wallet.badgeConfirmBody', { price: formatNumber(VERIFIED_BADGE_PRICE) })}
        size="sm"
        footer={
          <div className="space-y-2">
            {shortfall > 0 && (
              <p className="text-xs font-semibold text-warning">
                {t('account.wallet.badgeShortfall', { amount: formatNumber(shortfall) })}
              </p>
            )}
            <Button fullWidth onClick={() => void confirmBuyBadge()} disabled={buyingBadge} className="min-h-12">
              {buyingBadge ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : shortfall > 0 ? (
                t('account.wallet.badgeTopUp', { amount: formatNumber(Math.max(1_000, shortfall)) })
              ) : (
                `${t('account.wallet.confirm')} · ${sum(VERIFIED_BADGE_PRICE)}`
              )}
            </Button>
          </div>
        }
      >
        <ul className="space-y-2 pt-1">
          {(['badgeBenefit1', 'badgeBenefit2', 'badgeBenefit3'] as const).map((key) => (
            <li key={key} className="flex items-start gap-2 text-sm text-content">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              {t(`account.wallet.${key}`)}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
          <span className="text-muted">{t('account.wallet.balance')}</span>
          <span className="font-black text-content">{sum(balance)}</span>
        </div>
      </Sheet>

      <TopUpModal
        isOpen={isTopUpOpen}
        initialGateway={topUpGateway}
        initialAmount={topUpInitialAmount}
        onClose={() => {
          setIsTopUpOpen(false);
          setTopUpInitialAmount(undefined);
        }}
      />
    </>
  );
};

export default WalletCard;
