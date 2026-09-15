/**
 * TopUpModal: Balance Top-Up using Click payment gateway.
 *
 * Provides two Click payment options:
 * 1. Pay via Click (Click Up app / Click account) with official Click logo
 * 2. Pay by Card (Uzcard / Humo / Visa) processed securely via Click
 */

import React, { useState } from 'react';
import { CreditCard, ExternalLink, Info, Loader2, ShieldCheck, Wallet, X } from 'lucide-react';
import { PaymentApi } from '../../services/paymentApi';
import { useAppStore } from '../../stores/useAppStore';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PRESET_AMOUNTS = [5_000, 10_000, 20_000, 50_000, 70_000];

export const TopUpModal: React.FC<TopUpModalProps> = ({ isOpen, onClose }) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(20_000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [activePaymentType, setActivePaymentType] = useState<'click' | 'card' | null>(null);
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
      setActivePaymentType(type);
      
      const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/profile` : undefined;
      const res = await PaymentApi.createTopUp(currentAmount, returnUrl);
      
      const targetUrl = res.clickUrl || res.clickCardUrl;

      if (!targetUrl) {
        throw new Error('To‘lov havolasi olinmadi');
      }

      // Redirect user to the official Click payment portal
      window.location.href = targetUrl;
    } catch (err: any) {
      console.error('Click to‘lovida xatolik:', err);
      pushToast('common.error.generic', 'error');
    } finally {
      setLoading(false);
      setActivePaymentType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          aria-label="Yopish"
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Click branding */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center border border-blue-100 dark:border-blue-900/40 shrink-0">
            <img
              src="/brand/click-icon.svg"
              alt="Click Icon"
              className="w-7 h-7 object-contain"
              onError={(e) => {
                // Fallback to Wallet icon if SVG fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              Balansni to‘ldirish
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Click rasmiy to‘lov tizimi orqali</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </p>
          </div>
        </div>

        {/* Amount Presets */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
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
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition-all ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25 scale-[1.02]'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/60 hover:border-blue-500'
                  }`}
                >
                  {amt.toLocaleString()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Amount Input */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Yoki boshqa summa kiriting
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="Masalan: 35000"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            <span className="absolute right-4 top-3.5 text-xs font-black text-slate-400">
              SO‘M
            </span>
          </div>
        </div>

        {/* Total Display */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 to-indigo-50/70 dark:from-slate-800/60 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700/60 mb-5 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            To‘lov summasi:
          </span>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {currentAmount.toLocaleString()} so‘m
          </span>
        </div>

        {/* Payment Buttons Section */}
        <div className="space-y-3 mb-5">
          {/* Button 1: Click Official Logo Button */}
          <button
            type="button"
            disabled={loading || currentAmount < 1_000}
            onClick={() => handlePay('click')}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-[#0065FF] hover:bg-[#0052cc] text-white font-bold shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none group"
          >
            <div className="flex items-center gap-3.5">
              <div className="h-9 px-2.5 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
                <img
                  src="/brand/click-logo-white.svg"
                  alt="Click"
                  className="h-5 w-auto object-contain"
                />
              </div>
              <div className="text-left">
                <div className="text-sm font-black leading-tight flex items-center gap-1.5">
                  Click orqali to‘lash
                </div>
                <div className="text-[11px] text-blue-100/90 font-normal">
                  Click ilovasi yoki hisob raqami
                </div>
              </div>
            </div>
            {loading && activePaymentType === 'click' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ExternalLink className="w-5 h-5 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>

          {/* Button 2: Pay by Plastic Card (Uzcard / Humo) */}
          <button
            type="button"
            disabled={loading || currentAmount < 1_000}
            onClick={() => handlePay('card')}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white font-bold shadow-lg shadow-slate-900/25 hover:from-slate-800 hover:to-slate-750 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none border border-slate-700/60 group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0 text-emerald-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black leading-tight flex items-center gap-1.5">
                  Plastik karta orqali
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                    Uzcard / Humo
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-normal">
                  Barcha bank kartalari qabul qilinadi
                </div>
              </div>
            </div>
            {loading && activePaymentType === 'card' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ExternalLink className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>

          {/* Quick tip on card payment flow */}
          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-start gap-2.5 text-left">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-bold text-slate-800 dark:text-white">Karta bilan to‘lash:</span> Click sahifasiga o‘tgach, u yerda <strong className="text-blue-600 dark:text-blue-400">«Karta orqali / Оплата без регистрации»</strong> tugmasini bosib, Uzcard yoki Humo karta raqamingizni kiritasiz.
            </p>
          </div>
        </div>

        {/* Trust Guarantee Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>To‘lovlar Click tizimi orqali 100% xavfsiz va himoyalangan</span>
        </div>
      </div>
    </div>
  );
};
