/**
 * TopUpModal: Balance Top-Up using Click payment gateway.
 *
 * Provides two Click options as requested by Click documentation:
 * 1. Pay via Click (Click Up app / invoicing)
 * 2. Pay by Card (Uzcard / Humo / any bank card)
 */

import React, { useState } from 'react';
import { CreditCard, ExternalLink, Loader2, Sparkles, Wallet, X } from 'lucide-react';
import { PaymentApi } from '../../services/paymentApi';
import { useAppStore } from '../../stores/useAppStore';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PRESET_AMOUNTS = [5_000, 10_000, 20_000, 50_000, 70_000];

export const TopUpModal: React.FC<TopUpModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(20_000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const pushToast = useAppStore((s) => s.pushToast);

  if (!isOpen) return null;

  const currentAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;

  const handleSelectPreset = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handlePay = async (type: 'click' | 'card') => {
    if (currentAmount < 1_000) {
      pushToast('common.error.generic', 'warning');
      return;
    }

    try {
      setLoading(true);
      const res = await PaymentApi.createTopUp(currentAmount);
      const targetUrl = type === 'card' ? res.clickCardUrl : res.clickUrl;

      // Open Click payment in a new window or current tab
      window.location.href = targetUrl;
    } catch (err: any) {
      pushToast('common.error.generic', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Balansni to‘ldirish</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click to‘lov tizimi orqali xavfsiz to‘lov
            </p>
          </div>
        </div>

        {/* Amount Presets */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
            Tavsiya etilgan summalar (so‘m)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_AMOUNTS.map((amt) => {
              const active = !customAmount && selectedAmount === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleSelectPreset(amt)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-semibold border transition-all ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/60 hover:border-emerald-500'
                  }`}
                >
                  {amt.toLocaleString()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Amount Input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
            Yoki boshqa summa kiriting
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="Masalan: 35000"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
            />
            <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">SO‘M</span>
          </div>
        </div>

        {/* Total Display */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 mb-6 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">To‘lov summasi:</span>
          <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {currentAmount.toLocaleString()} so‘m
          </span>
        </div>

        {/* Click Payment Buttons (2 Buttons as instructed) */}
        <div className="space-y-3">
          {/* Button 1: Click Up / Invoicing */}
          <button
            type="button"
            disabled={loading || currentAmount < 1_000}
            onClick={() => handlePay('click')}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-sm">
                C
              </div>
              <div className="text-left">
                <div className="text-sm font-bold leading-tight">Click orqali to‘lash</div>
                <div className="text-[11px] text-blue-100">Click ilovasi yoki hisob raqami</div>
              </div>
            </div>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ExternalLink className="w-5 h-5 text-blue-200" />
            )}
          </button>

          {/* Button 2: Pay by Card (Uzcard / Humo) */}
          <button
            type="button"
            disabled={loading || currentAmount < 1_000}
            onClick={() => handlePay('card')}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white font-semibold shadow-lg shadow-slate-900/20 hover:from-slate-800 hover:to-slate-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none border border-slate-700/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold leading-tight">Plastik karta orqali</div>
                <div className="text-[11px] text-slate-400">Uzcard, Humo (Click-siz ham)</div>
              </div>
            </div>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ExternalLink className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
