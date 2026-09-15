/**
 * WalletCard: Premium 3D Plastic Bank Card representation of user's wallet balance,
 * Multi-payment gateway top-up (Click, Payme, Uzum Bank), verified badge purchase, and transaction history.
 * Fully responsive: scales elegantly to fill mobile screens with high-trust FinTech aesthetic.
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PaymentApi, type PaymentGateway, type WalletInfo, type WalletTransaction } from '../../services/paymentApi';
import { useAppStore } from '../../stores/useAppStore';
import { TopUpModal } from './TopUpModal';
import { BlueVerifiedBadge } from '../common/BlueVerifiedBadge';

function formatDisplayPhone(rawPhone?: string): string {
  if (!rawPhone) return '+998 -- --- -- --';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }
  return rawPhone;
}

const VERIFIED_BADGE_PRICE = 20_000;

interface WalletCardProps {
  /** If true, renders seamlessly inside a parent mobile Sheet/Modal without redundant borders/headers */
  embedded?: boolean;
}

export const WalletCard: React.FC<WalletCardProps> = ({ embedded = false }) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [buyingBadge, setBuyingBadge] = useState<boolean>(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState<boolean>(false);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('click');
  const [topUpInitialAmount, setTopUpInitialAmount] = useState<number | undefined>(undefined);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState<boolean>(false);
  const pushToast = useAppStore((s) => s.pushToast);
  const currentUser = useAppStore((s) => s.currentUser);
  const refreshUser = useAppStore((s) => s.refreshUser);

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const data = await PaymentApi.getWalletInfo();
      setWallet(data);
    } catch (err: any) {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleOpenTopUp = (gw: PaymentGateway = 'click', amount?: number) => {
    setSelectedGateway(gw);
    setTopUpInitialAmount(amount);
    setIsTopUpOpen(true);
  };

  const effectiveBalance = wallet?.balance ?? currentUser?.balance ?? 0;

  const handleConfirmBuyBadge = async () => {
    if (effectiveBalance < VERIFIED_BADGE_PRICE) {
      const deficit = Math.max(1000, VERIFIED_BADGE_PRICE - effectiveBalance);
      setIsBadgeModalOpen(false);
      handleOpenTopUp('click', deficit);
      return;
    }

    try {
      setBuyingBadge(true);
      const res = await PaymentApi.buyService('VERIFIED_BADGE');
      
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (_) {}

      pushToast(res?.message || 'Rasmiy ko‘k galochka muvaffaqiyatli faollashtirildi!', 'success');
      await fetchWallet();
      await refreshUser?.();
      setIsBadgeModalOpen(false);
    } catch (err: any) {
      console.error('Xatolik:', err);
      pushToast(err?.message || 'common.error.generic', 'error');
    } finally {
      setBuyingBadge(false);
    }
  };

  const currentBalance = effectiveBalance;
  const isVerified = Boolean(wallet?.isVerified || currentUser?.isVerified);
  const cardHolderName = (currentUser?.name || 'UYIZ FOYDALANUVCHISI').toUpperCase();

  return (
    <>
      <div
        className={
          embedded
            ? 'space-y-5 pb-6'
            : 'bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-100 dark:border-slate-800 shadow-sm mb-6 space-y-6'
        }
      >
        {/* Header (Only shown when not embedded in mobile Sheet) */}
        {!embedded && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Mening Hamyonim
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click, Payme va Uzum Bank orqali tezkor to‘lov
                </p>
              </div>
            </div>
            <button
              onClick={fetchWallet}
              disabled={loading}
              title="Yangilash"
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* 3D Bank Card & Actions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* 3D VIP Bank Card (Standard ISO 7810 1.586 Proportion on Desktop & Mobile) */}
          <div className="lg:col-span-7 flex justify-center lg:justify-start w-full">
            <div className="w-full max-w-[480px] aspect-[1.586] rounded-3xl p-5 sm:p-6 relative overflow-hidden text-white flex flex-col justify-between shadow-[0_20px_45px_-10px_rgba(0,0,0,0.5),0_10px_25px_rgba(16,185,129,0.25)] border border-white/20 bg-gradient-to-br from-[#0a0f1d] via-[#0f1d24] to-[#042825] transition-all duration-300 hover:scale-[1.01] group">
              
              {/* Sheen & Holographic Neon Glow Effects */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/15 pointer-events-none" />
              <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/25 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-12 -top-12 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Card Top Row: Brand & Multi-gateway Official Badges */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-emerald-900/50">
                    U
                  </div>
                  <div>
                    <span className="font-black text-sm sm:text-base tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent">
                      UYIZ WALLET
                    </span>
                    <span className="block text-[8px] sm:text-[9px] font-bold text-emerald-400 tracking-widest uppercase">
                      PREMIUM FINTECH CARD
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* NFC Contactless waves icon */}
                  <svg
                    className="w-5 h-5 text-white/70"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                    <path d="M12 19a8.5 8.5 0 0 0 0-14" />
                    <path d="M15.5 21.5a12 12 0 0 0 0-19" />
                  </svg>
                  
                  {/* Multi-gateway badges pill */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md shadow-xs">
                    <img
                      src="/brand/click-icon.svg"
                      alt="Click"
                      className="h-4 w-4 object-contain"
                      title="Click"
                    />
                    <img
                      src="/brand/payme-app-icon.png"
                      alt="Payme"
                      className="h-4 w-4 object-cover rounded-xs"
                      title="Payme"
                    />
                    <img
                      src="/brand/uzum-app-icon.png"
                      alt="Uzum"
                      className="h-4 w-4 object-cover rounded-xs"
                      title="Uzum Bank"
                    />
                  </div>
                </div>
              </div>

              {/* Card Middle: Realistic Golden Smart Chip & Large Balance */}
              <div className="relative z-10 my-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* 3D Golden EMV Smart Chip */}
                  <div className="shrink-0 w-11 h-8 sm:w-13 sm:h-9.5 rounded-lg bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 border border-yellow-300 shadow-md relative overflow-hidden flex items-center justify-center">
                    <div className="w-full h-[1px] bg-amber-800/40 absolute top-2.5" />
                    <div className="w-full h-[1px] bg-amber-800/40 absolute bottom-2.5" />
                    <div className="h-full w-[1px] bg-amber-800/40 absolute left-3.5" />
                    <div className="h-full w-[1px] bg-amber-800/40 absolute right-3.5" />
                    <div className="w-3.5 h-3.5 rounded border border-amber-800/50 bg-amber-300/30" />
                  </div>

                  {/* Debossed simulated card digits */}
                  <div className="hidden sm:block font-mono text-[11px] font-bold text-slate-300/70 tracking-widest">
                    •••• {currentUser?.phone ? currentUser.phone.slice(-4) : '8899'}
                  </div>
                </div>

                {/* Balance Display */}
                <div className="text-right">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-300/90 block mb-0.5">
                    Joriy Balans
                  </span>
                  <div className="text-2xl sm:text-3xl lg:text-[32px] font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(16,185,129,0.7)]">
                    {loading ? '...' : `${currentBalance.toLocaleString()} so‘m`}
                  </div>
                </div>
              </div>

              {/* Card Bottom Row: Cardholder Name & Phone Number */}
              <div className="relative z-10 pt-3 border-t border-white/15 flex items-end justify-between">
                <div className="min-w-0 pr-3">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                    Karta Egasi
                  </div>
                  <div className="font-mono font-bold text-slate-100 tracking-wider text-xs sm:text-sm truncate max-w-[180px] sm:max-w-[240px]">
                    {cardHolderName}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-0.5">
                    Telefon raqam
                  </div>
                  <div className="font-mono font-black text-white tracking-wider text-xs sm:text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                    {formatDisplayPhone(currentUser?.phone)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 w-full">
            
            {/* Payment Providers Section */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Hisobni to‘ldirish
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Bir zumda tushadi
                </span>
              </div>

              {/* 3 Payment System Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* Card 1: Click */}
                <button
                  type="button"
                  onClick={() => handleOpenTopUp('click')}
                  className="py-3 px-2 sm:py-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border-2 border-blue-200/90 dark:border-blue-900/60 hover:border-blue-500 flex flex-col items-center justify-between text-center transition-all hover:scale-[1.02] active:scale-95 group shadow-sm"
                >
                  <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center p-2 shadow-sm border border-blue-100 dark:border-blue-900/60 mb-2">
                    <img
                      src="/brand/click-icon.svg"
                      alt="Click"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight">
                      Click
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Faol
                    </div>
                  </div>
                </button>

                {/* Card 2: Payme */}
                <button
                  type="button"
                  onClick={() => handleOpenTopUp('payme')}
                  className="py-3 px-2 sm:py-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border-2 border-teal-200/90 dark:border-teal-900/60 hover:border-teal-400 flex flex-col items-center justify-between text-center transition-all hover:scale-[1.02] active:scale-95 group shadow-sm"
                >
                  <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center p-1 shadow-sm border border-teal-100 dark:border-teal-900/60 mb-2 overflow-hidden">
                    <img
                      src="/brand/payme-app-icon.png"
                      alt="Payme"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight">
                      Payme
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Faol
                    </div>
                  </div>
                </button>

                {/* Card 3: Uzum Bank */}
                <button
                  type="button"
                  onClick={() => handleOpenTopUp('uzum')}
                  className="py-3 px-2 sm:py-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border-2 border-purple-200/90 dark:border-purple-900/60 hover:border-purple-500 flex flex-col items-center justify-between text-center transition-all hover:scale-[1.02] active:scale-95 group shadow-sm"
                >
                  <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center p-1 shadow-sm border border-purple-100 dark:border-purple-900/60 mb-2 overflow-hidden">
                    <img
                      src="/brand/uzum-app-icon.png"
                      alt="Uzum Bank"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight">
                      Uzum
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                      Tez kunda
                    </div>
                  </div>
                </button>
              </div>

              {/* Prominent Quick Top-Up CTA */}
              <button
                type="button"
                onClick={() => handleOpenTopUp('click')}
                className="w-full mt-3 h-12 sm:h-12 inline-flex items-center justify-center gap-2 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white text-sm font-black shadow-lg shadow-emerald-600/30 active:scale-98 transition-all"
              >
                <Plus className="w-5 h-5" />
                Hisobni to‘ldirish (Karta / Click)
              </button>
            </div>

            {/* Action 2: Rasmiy Ko'k Galochka */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                  <BlueVerifiedBadge size="sm" />
                  <span>Rasmiy Ko‘k Galochka</span>
                </div>
                <span className="text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400">
                  {VERIFIED_BADGE_PRICE.toLocaleString()} so‘m
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isVerified
                  ? 'Sizning hisobingiz tasdiqlangan va ko‘k galochka barcha e‘lonlaringizda faol!'
                  : 'Rieltor yoki Mulkdor ismingiz yonida rasmiy ko‘k galochka va yuqori ishonch reytingi.'}
              </p>

              {isVerified ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
                  <ShieldCheck className="w-4 h-4" />
                  Sizda ko‘k galochka faol
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsBadgeModalOpen(true)}
                  disabled={buyingBadge}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-60 ${
                    effectiveBalance >= VERIFIED_BADGE_PRICE
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-600/30'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25'
                  }`}
                >
                  <BlueVerifiedBadge size="xs" />
                  {effectiveBalance >= VERIFIED_BADGE_PRICE ? (
                    <span>Galochkani faollashtirish (Balansda mavjud)</span>
                  ) : (
                    <span>Galochka sotib olish (20 000 so‘m)</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Transactions History */}
        <div className="pt-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            <History className="w-4 h-4" />
            Oxirgi to‘lovlar va xaridlar tarixi
          </div>

          {wallet?.transactions && wallet.transactions.length > 0 ? (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {wallet.transactions.map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isPositive
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {tx.description}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(tx.createdAt).toLocaleString('uz-UZ', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-black ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {tx.amount.toLocaleString()} so‘m
                      </div>
                      <div className="text-[10px] text-slate-400">
                        qoldiq: {tx.balanceAfter.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-7 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              Hozircha hech qanday to‘lov amalga oshirilmagan
            </div>
          )}
        </div>
      </div>

      {/* Smart Verified Badge Confirmation Modal */}
      {isBadgeModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-left">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsBadgeModalOpen(false)}
              disabled={buyingBadge}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon Header */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 border-2 border-blue-200 dark:border-blue-800/80 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/20">
                <BlueVerifiedBadge size="lg" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Rasmiy Ko‘k Galochka
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                Mulkdor yoki Rieltor profilingizda yuqori ishonch reytingi
              </p>
            </div>

            {/* Content based on Balance availability */}
            {effectiveBalance >= VERIFIED_BADGE_PRICE ? (
              <>
                {/* Balance Breakdown Card */}
                <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 space-y-2 mb-4 text-xs">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>Hamyon balansingiz:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {effectiveBalance.toLocaleString()} so‘m
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>Xizmat narxi (bir martalik):</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      -20 000 so‘m
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between font-black text-emerald-600 dark:text-emerald-400">
                    <span>Xariddan so‘ng qoladi:</span>
                    <span>{(effectiveBalance - VERIFIED_BADGE_PRICE).toLocaleString()} so‘m</span>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-2 mb-5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Barcha e‘lonlaringizda ko‘k nishon aks etadi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Mijozlar ishonchini va qo‘ng‘iroqlarni 3 barobarga oshiradi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Bir martalik to‘lov — umrbod amal qiladi!</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleConfirmBuyBadge}
                    disabled={buyingBadge}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm shadow-lg shadow-blue-600/30 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {buyingBadge ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Balansdan faollashtirish (20 000 so‘m)
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBadgeModalOpen(false)}
                    disabled={buyingBadge}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Bekor qilish
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Deficit Card */}
                {(() => {
                  const deficit = VERIFIED_BADGE_PRICE - effectiveBalance;
                  return (
                    <>
                      <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2 mb-4 text-xs">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span>Xizmat narxi:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            20 000 so‘m
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span>Hamyoningizda:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {effectiveBalance.toLocaleString()} so‘m
                          </span>
                        </div>
                        <div className="pt-2 border-t border-amber-200 dark:border-amber-900/60 flex items-center justify-between font-black text-amber-700 dark:text-amber-400">
                          <span>Yetishmayotgan summa:</span>
                          <span>{deficit.toLocaleString()} so‘m</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-5">
                        Ko‘k galochkani faollashtirish uchun hisobingizga kamida{' '}
                        <strong className="text-slate-800 dark:text-white font-bold">
                          {deficit.toLocaleString()} so‘m
                        </strong>{' '}
                        to‘ldirishingiz kerak.
                      </p>

                      <div className="flex flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsBadgeModalOpen(false);
                            handleOpenTopUp('click', deficit);
                          }}
                          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-lg shadow-emerald-600/30 active:scale-98 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-5 h-5" />
                          Hisobni to‘ldirish ({deficit.toLocaleString()} so‘m)
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsBadgeModalOpen(false)}
                          className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                        >
                          Keyinroq
                        </button>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* TopUp Modal */}
      <TopUpModal
        isOpen={isTopUpOpen}
        initialGateway={selectedGateway}
        initialAmount={topUpInitialAmount}
        onClose={() => {
          setIsTopUpOpen(false);
          setTopUpInitialAmount(undefined);
        }}
        onSuccess={() => {
          setIsTopUpOpen(false);
          setTopUpInitialAmount(undefined);
          fetchWallet();
        }}
      />
    </>
  );
};
