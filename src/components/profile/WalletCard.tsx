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
      {/* 1. Balance — the reason the page exists. */}
      <div className="rounded-2xl bg-brand p-5 text-on-brand shadow-brand">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-on-brand/80">{t('account.wallet.balance')}</p>
          <button
            type="button"
            onClick={() => void fetchWallet()}
            disabled={loading}
            aria-label={t('account.sessions.reload')}
            className="press flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-on-brand disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
          {formatNumber(balance)} <span className="text-lg font-bold text-on-brand/85">{t('account.topUp.currency')}</span>
        </p>
        <button
          type="button"
          onClick={() => openTopUp('click')}
          className="press mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-brand shadow-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('account.wallet.topUp')}
        </button>
        <p className="mt-2.5 flex items-center gap-2 text-[11px] text-on-brand/80">
          <img src="/brand/click-icon.svg" alt="Click" className="h-4 w-4 rounded" />
          <img src="/brand/payme-app-icon.png" alt="Payme" className="h-4 w-4 rounded" />
          {t('account.wallet.methods')}
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
