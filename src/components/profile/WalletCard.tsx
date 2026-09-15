/**
 * WalletCard: 3D Plastic Bank Card representation of user's wallet balance,
 * Click quick top-up, verified badge purchase, and transaction history.
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Copy,
  CreditCard,
  History,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import { PaymentApi, type WalletInfo, type WalletTransaction } from '../../services/paymentApi';
import { useAppStore } from '../../stores/useAppStore';
import { TopUpModal } from './TopUpModal';
import { BlueVerifiedBadge } from '../common/BlueVerifiedBadge';

const VERIFIED_BADGE_PRICE = 20_000;

export const WalletCard: React.FC = () => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [buyingBadge, setBuyingBadge] = useState<boolean>(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState<boolean>(false);
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

  const handleBuyBadge = async () => {
    if (!wallet) return;

    if (wallet.balance < VERIFIED_BADGE_PRICE) {
      pushToast('common.error.generic', 'warning');
      setIsTopUpOpen(true);
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

  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);

  const currentBalance = wallet?.balance ?? 0;
  const isVerified = Boolean(wallet?.isVerified || currentUser?.isVerified);
  const cardHolderName = (currentUser?.name || 'UYIZ FOYDALANUVCHISI').toUpperCase();
  const lastFourDigits = (currentUser?.phone?.replace(/\D/g, '').slice(-4)) || '7788';
  const paymentId = currentUser?.referralCode || (currentUser?.id ? currentUser.id.slice(0, 8).toUpperCase() : 'UYIZ01');
  const userPhone = currentUser?.phone || '';

  const copyToClipboard = (text: string, type: 'id' | 'phone') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
        {/* Card Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mening Hamyonim</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click orqali hisobni to‘ldirish va tezkor xizmatlar
              </p>
            </div>
          </div>
          <button
            onClick={fetchWallet}
            disabled={loading}
            title="Yangilash"
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 3D Plastic Card & Actions Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-7 items-stretch">
          {/* 3D Bank Card Component */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-[420px] aspect-[1.586] rounded-3xl p-6 relative overflow-hidden text-white flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.35),0_10px_25px_rgba(16,185,129,0.2)] border border-white/20 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 transition-all duration-300 hover:scale-[1.02] group">
              {/* Card Surface Sheen & Specular Glass Effects */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/20 pointer-events-none" />
              <div className="absolute -right-16 -bottom-16 w-56 h-56 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-16 -top-16 w-56 h-56 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

              {/* Card Top Row: Brand & Contactless Icon */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-emerald-900/50">
                    U
                  </div>
                  <div>
                    <span className="font-black text-sm tracking-wider bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                      UYIZ WALLET
                    </span>
                    <span className="block text-[8px] font-bold text-emerald-400/90 tracking-widest uppercase">
                      PREMIUM CARD
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* NFC Contactless waves icon */}
                  <svg
                    className="w-5 h-5 text-white/60"
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
                  <div className="flex items-center px-2 py-0.5 rounded-md bg-white/10 border border-white/20 backdrop-blur-xs">
                    <img
                      src="/brand/click-logo-white.svg"
                      alt="Click"
                      className="h-3.5 w-auto object-contain opacity-95"
                    />
                  </div>
                </div>
              </div>

              {/* Card Middle: EMV Golden Chip & Balance Display */}
              <div className="relative z-10 my-auto flex items-center justify-between gap-4">
                {/* Golden EMV Smart Chip */}
                <div className="shrink-0 w-11 h-9 rounded-md bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 border border-yellow-300 shadow-sm relative overflow-hidden flex items-center justify-center">
                  <div className="w-full h-[1px] bg-amber-800/40 absolute top-3" />
                  <div className="w-full h-[1px] bg-amber-800/40 absolute bottom-3" />
                  <div className="h-full w-[1px] bg-amber-800/40 absolute left-3.5" />
                  <div className="h-full w-[1px] bg-amber-800/40 absolute right-3.5" />
                  <div className="w-3.5 h-3.5 rounded border border-amber-800/50 bg-amber-300/30" />
                </div>

                {/* Balance */}
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Joriy Balans
                  </span>
                  <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                    {loading ? '...' : `${currentBalance.toLocaleString()} so‘m`}
                  </div>
                </div>
              </div>

              {/* Card Bottom Row: Cardholder name, To'lov ID & Card number */}
              <div className="relative z-10 pt-2 border-t border-white/10 flex items-end justify-between text-xs gap-2">
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Karta Egasi
                  </div>
                  <div className="font-mono font-bold text-slate-100 tracking-wider text-xs truncate max-w-[130px]">
                    {cardHolderName}
                  </div>
                </div>

                {/* To'lov ID badge directly on the 3D card */}
                <div className="px-2 py-0.5 rounded-lg bg-emerald-500/25 border border-emerald-400/40 text-center shadow-inner">
                  <div className="text-[7.5px] font-black text-emerald-300 uppercase tracking-wider">
                    To‘lov ID
                  </div>
                  <div className="font-mono font-black text-white text-[11px] tracking-wider">
                    {paymentId}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Karta Raqami
                  </div>
                  <div className="font-mono font-bold text-slate-200 tracking-widest text-xs">
                    •••• {lastFourDigits}
                  </div>
                </div>
              </div>
            </div>

            {/* Click App Direct Payment Information Box */}
            <div className="w-full max-w-[420px] mt-4 p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-slate-800/60 dark:to-slate-800/30 border border-blue-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    Click ilovasidan to‘lash
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400">
                      ID yoki Telefon
                    </span>
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2.5 text-xs">
                {/* ID Box */}
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="min-w-0 pr-1">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">To‘lov ID:</span>
                    <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-xs truncate block">{paymentId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(paymentId, 'id')}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                    title="Nusxalash"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Phone Box */}
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="min-w-0 pr-1">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Telefon raqam:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs truncate block">{userPhone || '—'}</span>
                  </div>
                  {userPhone && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(userPhone, 'phone')}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                      title="Nusxalash"
                    >
                      {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Click ilovasida qidiruvga <strong>«Uyiz.uz»</strong> deb yozib, yuqoridagi <strong>To‘lov ID</strong> yoki <strong>Telefon raqamingizni</strong> kiritib ham hisobingizni to‘g‘ridan-to‘g‘ri to‘ldirishingiz mumkin.
              </p>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            {/* Action 1: Hisobni to'ldirish */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <img
                    src="/brand/click-icon.svg"
                    alt="Click"
                    className="w-4 h-4 object-contain"
                  />
                  <span>Hisobni to‘ldirish</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click orqali 5 000 dan 70 000 so‘mgacha
                </p>
              </div>
              <button
                onClick={() => setIsTopUpOpen(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                To‘ldirish
              </button>
            </div>

            {/* Action 2: Rasmiy Ko'k Galochka */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                  <BlueVerifiedBadge size="sm" />
                  <span>Rasmiy Ko‘k Galochka</span>
                </div>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                  {VERIFIED_BADGE_PRICE.toLocaleString()} so‘m
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
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
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-lg shadow-blue-600/30 active:scale-95 transition-all disabled:opacity-60"
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
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
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
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(tx.createdAt).toLocaleString('uz-UZ', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
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
        onClose={() => setIsTopUpOpen(false)}
        onSuccess={() => {
          setIsTopUpOpen(false);
          fetchWallet();
        }}
      />
    </>
  );
};
