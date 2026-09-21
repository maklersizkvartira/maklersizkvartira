/**
 * PromoteListingModal: Allows an owner to promote a listing to TOP (7 000 so'm)
 * or VIP (12 000 so'm) directly using wallet balance.
 */

import React, { useState } from 'react';
import { Check, Crown, Flame, Loader2, Sparkles, Wallet, X } from 'lucide-react';
import { PaymentApi } from '../../services/paymentApi';
import { useAppStore } from '../../stores/useAppStore';
import { TopUpModal } from '../profile/TopUpModal';
import type { Listing } from '../../types';

interface PromoteListingModalProps {
  isOpen: boolean;
  listing: Listing | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TOP_PRICE = 7_000;
const VIP_PRICE = 12_000;

export const PromoteListingModal: React.FC<PromoteListingModalProps> = ({
  isOpen,
  listing,
  onClose,
  onSuccess,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'TOP_LISTING' | 'VIP_LISTING'>('TOP_LISTING');
  const [loading, setLoading] = useState<boolean>(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState<boolean>(false);
  const pushToast = useAppStore((s) => s.pushToast);
  const currentUser = useAppStore((s) => s.currentUser);
  const refreshUser = useAppStore((s) => s.refreshUser);

  if (!isOpen || !listing) return null;

  const currentBalance = currentUser?.balance ?? 0;
  const cost = selectedPlan === 'TOP_LISTING' ? TOP_PRICE : VIP_PRICE;

  const handlePromote = async () => {
    if (currentBalance < cost) {
      // Was `common.error.generic` — "something went wrong" for the one case
      // the user can actually fix, and can fix in the sheet that opens next.
      pushToast('account.wallet.promoteShortfall', 'warning', {
        amount: (cost - currentBalance).toLocaleString(),
      });
      setIsTopUpOpen(true);
      return;
    }

    try {
      setLoading(true);
      await PaymentApi.buyService(selectedPlan, listing.id);
      // Was `account.profile.nameSaved` — "your name has been updated",
      // after paying for a promotion.
      pushToast('account.wallet.promoteBought', 'success');
      await refreshUser?.();
      onSuccess();
      onClose();
    } catch (err) {
      // The server says which of insufficient_balance / listing_not_found /
      // not public it was; swallowing that left the owner with nothing to act on.
      const message = err instanceof Error && err.message ? err.message : 'common.error.generic';
      pushToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">E’lonni ko‘tarish</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                {listing.title}
              </p>
            </div>
          </div>

          {/* Current Balance Bar */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 mb-5 text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Sizning balansingiz:</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {currentBalance.toLocaleString()} so‘m
            </span>
          </div>

          {/* Promotion Plans */}
          <div className="space-y-3 mb-6">
            {/* TOP Plan */}
            <div
              onClick={() => setSelectedPlan('TOP_LISTING')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedPlan === 'TOP_LISTING'
                  ? 'border-amber-500 bg-amber-500/5 shadow-md shadow-amber-500/10'
                  : 'border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <Flame className="w-4 h-4 text-amber-500" />
                  TOP E’lon (7 kun)
                </div>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                  {TOP_PRICE.toLocaleString()} so‘m
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                E’loningiz katalogda eng yuqoriga chiqadi va ko‘rishlar soni 3-5 barobargacha oshadi.
              </p>
            </div>

            {/* VIP Plan */}
            <div
              onClick={() => setSelectedPlan('VIP_LISTING')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedPlan === 'VIP_LISTING'
                  ? 'border-purple-500 bg-purple-500/5 shadow-md shadow-purple-500/10'
                  : 'border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <Crown className="w-4 h-4 text-purple-500" />
                  VIP E’lon (7 kun)
                </div>
                <span className="text-sm font-black text-purple-600 dark:text-purple-400">
                  {VIP_PRICE.toLocaleString()} so‘m
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Maksimal e’tibor: e’lon maxsus ramka bilan ajratiladi va eng birinchilardan bo‘lib tavsiya etiladi.
              </p>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            disabled={loading}
            onClick={handlePromote}
            className={`w-full py-3.5 px-4 rounded-2xl text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
              selectedPlan === 'VIP_LISTING'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600'
            }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {cost.toLocaleString()} so‘mga faollashtirish
              </>
            )}
          </button>
        </div>
      </div>

      <TopUpModal
        isOpen={isTopUpOpen}
        initialAmount={Math.max(1000, cost - currentBalance)}
        onClose={() => setIsTopUpOpen(false)}
        onSuccess={() => {
          setIsTopUpOpen(false);
          void refreshUser?.();
        }}
      />
    </>
  );
};
