/**
 * WalletCard: 3D Plastic Bank Card representation of user's wallet balance,
 * Multi-payment gateway top-up (Click, Payme, Uzum Bank), verified badge purchase, and transaction history.
 * Fully optimized for both Mobile and Desktop screens.
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CreditCard,
  History,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
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

export const WalletCard: React.FC = () => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [buyingBadge, setBuyingBadge] = useState<boolean>(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState<boolean>(false);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('click');
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

  const handleOpenTopUp = (gw: PaymentGateway = 'click') => {
    setSelectedGateway(gw);
    setIsTopUpOpen(true);
  };

  const handleBuyBadge = async () => {
    if ((wallet?.balance ?? 0) < VERIFIED_BADGE_PRICE) {
      handleOpenTopUp('click');
      return;
    }

    try {
      setBuyingBadge(true);
      await PaymentApi.buyService('VERIFIED_BADGE');
      pushToast('account.profile.nameSaved', 'success');
      await fetchWallet();
      await refreshUser?.();
    } catch (err: any) {
      pushToast('common.error.generic', 'error');
    } finally {
      setBuyingBadge(false);
    }
  };

  const currentBalance = wallet?.balance ?? 0;
  const isVerified = Boolean(wallet?.isVerified || currentUser?.isVerified);
  const cardHolderName = (currentUser?.name || 'UYIZ FOYDALANUVCHISI').toUpperCase();

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
        
        {/* Card Header */}
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Mening Hamyonim
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click, Payme va Uzum Bank orqali tezkor to‘lov
              </p>
            </div>
          </div>
          <button
            onClick={fetchWallet}
            disabled={loading}
            title="Yangilash"
            className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 3D Plastic Card & Actions Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 mb-6 sm:mb-7 items-stretch">
          
          {/* 3D Bank Card Component (Responsive aspect ratio and typography) */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-[420px] aspect-[1.586] rounded-2xl sm:rounded-3xl p-4 sm:p-6 relative overflow-hidden text-white flex flex-col justify-between shadow-[0_16px_40px_rgba(0,0,0,0.3),0_8px_20px_rgba(16,185,129,0.18)] border border-white/20 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 transition-all duration-300 hover:scale-[1.01] group">
              
              {/* Card Surface Sheen & Specular Glass Effects */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/20 pointer-events-none" />
              <div className="absolute -right-16 -bottom-16 w-56 h-56 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-16 -top-16 w-56 h-56 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

              {/* Card Top Row: Brand & Multi-gateway Badges */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-emerald-900/50">
                    U
                  </div>
                  <div>
                    <span className="font-black text-xs sm:text-sm tracking-wider bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                      UYIZ WALLET
                    </span>
                    <span className="block text-[7px] sm:text-[8px] font-bold text-emerald-400/90 tracking-widest uppercase">
                      MULTI-PAYMENT CARD
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* NFC Contactless waves icon */}
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white/60"
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
                  
                  {/* Multi-gateway mini icons */}
                  <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-white/10 border border-white/20 backdrop-blur-xs">
                    <img
                      src="/brand/click-icon.svg"
                      alt="Click"
                      className="h-3 w-3 sm:h-3.5 sm:w-3.5 object-contain"
                      title="Click"
                    />
                    <img
                      src="/brand/payme-app-icon.png"
                      alt="Payme"
                      className="h-3 w-3 sm:h-3.5 sm:w-3.5 object-cover rounded-xs"
                      title="Payme"
                    />
                    <img
                      src="/brand/uzum-app-icon.png"
                      alt="Uzum"
                      className="h-3 w-3 sm:h-3.5 sm:w-3.5 object-cover rounded-xs"
                      title="Uzum Bank"
                    />
                  </div>
                </div>
              </div>

              {/* Card Middle: EMV Chip & Balance */}
              <div className="relative z-10 my-auto flex items-center justify-between gap-3">
                {/* Golden EMV Smart Chip */}
                <div className="shrink-0 w-9 h-7 sm:w-11 sm:h-9 rounded-md bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 border border-yellow-300 shadow-sm relative overflow-hidden flex items-center justify-center">
                  <div className="w-full h-[1px] bg-amber-800/40 absolute top-2 sm:top-3" />
                  <div className="w-full h-[1px] bg-amber-800/40 absolute bottom-2 sm:bottom-3" />
                  <div className="h-full w-[1px] bg-amber-800/40 absolute left-2.5 sm:left-3.5" />
                  <div className="h-full w-[1px] bg-amber-800/40 absolute right-2.5 sm:right-3.5" />
                  <div className="w-3 h-3 rounded border border-amber-800/50 bg-amber-300/30" />
                </div>

                {/* Balance */}
                <div className="text-right">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Joriy Balans
                  </span>
                  <div className="text-xl sm:text-3xl font-black tracking-tight text-emerald-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                    {loading ? '...' : `${currentBalance.toLocaleString()} so‘m`}
                  </div>
                </div>
              </div>

              {/* Card Bottom Row: Cardholder name & Phone Number */}
              <div className="relative z-10 pt-2 sm:pt-3 border-t border-white/15 flex items-end justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <div className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Karta Egasi
                  </div>
                  <div className="font-mono font-bold text-slate-100 tracking-wider text-[11px] sm:text-xs truncate max-w-[150px] sm:max-w-[190px]">
                    {cardHolderName}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[8px] sm:text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                    Telefon raqam
                  </div>
                  <div className="font-mono font-black text-white tracking-wider text-[11px] sm:text-xs drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                    {formatDisplayPhone(currentUser?.phone)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3.5">
            
            {/* Payment Systems Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Hisobni to‘ldirish
                </span>
                <span className="text-[11px] text-slate-400">
                  Bir zumda tushadi
                </span>
              </div>

              {/* 3 Payment Provider Cards: Click, Payme, Uzum Bank */}
              <div className="grid grid-cols-3 gap-2">
                {/* Card 1: Click */}
                <button
                  type="button"
                  onClick={() => handleOpenTopUp('click')}
                  className="p-2.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 hover:border-blue-500 flex flex-col items-center justify-between text-center transition-all hover:scale-[1.02] active:scale-95 group shadow-xs"
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center p-1.5 shadow-xs border border-blue-100 dark:border-blue-900/60 mb-1.5">
                    <img
                      src="/brand/click-icon.svg"
                      alt="Click"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      Click
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Faol
                    </div>
                  </div>
                </button>

                {/* Card 2: Payme */}
                <button
                  type="button"
                  onClick={() => handleOpenTopUp('payme')}
                  className="p-2.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/40 hover:border-teal-400 flex flex-col items-center justify-between text-center transition-all hover:scale-[1.02] active:scale-95 group shadow-xs"
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center p-0.5 shadow-xs border border-teal-100 dark:border-teal-900/60 mb-1.5 overflow-hidden">
                    <img
                      src="/brand/payme-app-icon.png"
                      alt="Payme"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      Payme
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                      Tez kunda
                    </div>
                  </div>
                </button>

                {/* Card 3: Uzum Bank */}
                <button
                  type="button"
                  onClick={() => handleOpenTopUp('uzum')}
                  className="p-2.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/40 hover:border-purple-500 flex flex-col items-center justify-between text-center transition-all hover:scale-[1.02] active:scale-95 group shadow-xs"
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center p-0.5 shadow-xs border border-purple-100 dark:border-purple-900/60 mb-1.5 overflow-hidden">
                    <img
                      src="/brand/uzum-app-icon.png"
                      alt="Uzum Bank"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      Uzum
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                      Tez kunda
                    </div>
                  </div>
                </button>
              </div>

              {/* Main Quick Top-Up Button */}
              <button
                type="button"
                onClick={() => handleOpenTopUp('click')}
                className="w-full mt-2.5 h-11 sm:h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                Hisobni to‘ldirish (Karta / Click)
              </button>
            </div>

            {/* Action 2: Rasmiy Ko'k Galochka */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  <BlueVerifiedBadge size="sm" />
                  <span>Rasmiy Ko‘k Galochka</span>
                </div>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                  {VERIFIED_BADGE_PRICE.toLocaleString()} so‘m
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                {isVerified
                  ? 'Sizning hisobingiz tasdiqlangan va ko‘k galochka barcha e‘lonlaringizda faol!'
                  : 'Rieltor yoki Mulkdor ismingiz yonida rasmiy ko‘k galochka va yuqori ishonch reytingi.'}
              </p>

              {isVerified ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                  Sizda ko‘k galochka faol
                </div>
              ) : (
                <button
                  onClick={handleBuyBadge}
                  disabled={buyingBadge}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/25 active:scale-95 transition-all disabled:opacity-60"
                >
                  {buyingBadge ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <BlueVerifiedBadge size="xs" />
                      Galochka sotib olish (20 000 so‘m)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Transactions History */}
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            <History className="w-4 h-4" />
            Oxirgi to‘lovlar va xaridlar tarixi
          </div>

          {wallet?.transactions && wallet.transactions.length > 0 ? (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {wallet.transactions.map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isPositive
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[170px] sm:max-w-none">
                          {tx.description}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-400">
                          {new Date(tx.createdAt).toLocaleString('uz-UZ', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-bold ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-slate-200'
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
            <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              Hozircha hech qanday to‘lov amalga oshirilmagan
            </div>
          )}
        </div>
      </div>

      {/* TopUp Modal */}
      <TopUpModal
        isOpen={isTopUpOpen}
        initialGateway={selectedGateway}
        onClose={() => setIsTopUpOpen(false)}
        onSuccess={() => {
          setIsTopUpOpen(false);
          fetchWallet();
        }}
      />
    </>
  );
};
