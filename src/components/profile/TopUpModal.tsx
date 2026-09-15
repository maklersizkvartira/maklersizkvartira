/**
 * TopUpModal: Balance Top-Up gateway supporting Click, Payme, and Uzum Bank.
 *
 * Provides tabbed/card selection for:
 * 1. Click (Active - Click Up app or Uzcard/Humo plastic cards)
 * 2. Payme (Teal branding, Payme checkout setup ready)
 * 3. Uzum Bank (Purple branding, Uzum Bank checkout setup ready)
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { PaymentApi, type PaymentGateway } from '../../services/paymentApi';
import { useAppStore } from '../../stores/useAppStore';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialGateway?: PaymentGateway;
}

const PRESET_AMOUNTS = [5_000, 10_000, 20_000, 50_000, 70_000];

interface GatewayConfig {
  id: PaymentGateway;
  name: string;
  badge: string;
  isReady: boolean;
  iconSrc: string;
  logoWhiteSrc: string;
  primaryColor: string;
  hoverBg: string;
  activeBorder: string;
  activeBg: string;
  description: string;
}

const GATEWAYS: GatewayConfig[] = [
  {
    id: 'click',
    name: 'Click',
    badge: 'Faol',
    isReady: true,
    iconSrc: '/brand/click-icon.svg',
    logoWhiteSrc: '/brand/click-logo-white.svg',
    primaryColor: '#0065FF',
    hoverBg: 'hover:border-blue-500',
    activeBorder: 'border-blue-600 dark:border-blue-500',
    activeBg: 'bg-blue-50/80 dark:bg-blue-950/40',
    description: 'Click Up ilovasi yoki Uzcard / Humo kartasi',
  },
  {
    id: 'payme',
    name: 'Payme',
    badge: 'Ulanmoqda',
    isReady: false,
    iconSrc: '/brand/payme-app-icon.png',
    logoWhiteSrc: '/brand/payme-logo-white.svg',
    primaryColor: '#00CCCC',
    hoverBg: 'hover:border-teal-400',
    activeBorder: 'border-teal-500 dark:border-teal-400',
    activeBg: 'bg-teal-50/80 dark:bg-teal-950/40',
    description: 'Payme ilovasi yoki Uzcard / Humo kartasi',
  },
  {
    id: 'uzum',
    name: 'Uzum Bank',
    badge: 'Ulanmoqda',
    isReady: false,
    iconSrc: '/brand/uzum-app-icon.png',
    logoWhiteSrc: '/brand/uzum-brand.png',
    primaryColor: '#7000FF',
    hoverBg: 'hover:border-purple-500',
    activeBorder: 'border-purple-600 dark:border-purple-500',
    activeBg: 'bg-purple-50/80 dark:bg-purple-950/40',
    description: 'Uzum ilovasi yoki Uzum Bank kartasi',
  },
];

export const TopUpModal: React.FC<TopUpModalProps> = ({
  isOpen,
  onClose,
  initialGateway = 'click',
}) => {
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>(initialGateway);
  const [selectedAmount, setSelectedAmount] = useState<number>(20_000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [activePaymentType, setActivePaymentType] = useState<'app' | 'card' | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    if (initialGateway) {
      setSelectedGateway(initialGateway);
    }
  }, [initialGateway, isOpen]);

  if (!isOpen) return null;

  const currentAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;
  const currentGatewayConfig = GATEWAYS.find((g) => g.id === selectedGateway) || GATEWAYS[0];

  const handleSelectPreset = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    setInfoNotice(null);
  };

  const handleGatewayChange = (gw: PaymentGateway) => {
    setSelectedGateway(gw);
    setInfoNotice(null);
  };

  const handlePay = async (type: 'app' | 'card') => {
    if (currentAmount < 1_000) {
      pushToast('common.error.generic', 'warning');
      return;
    }

    // If Payme or Uzum Bank (Merchant account pending)
    if (!currentGatewayConfig.isReady) {
      const gwName = currentGatewayConfig.name;
      setInfoNotice(
        `${gwName} to‘lov tizimi hozirda merchant integratsiyasi bosqichida. Tez orada ushbu tizim orqali to‘g‘ridan-to‘g‘ri to‘lash imkoniyati to‘liq ishga tushadi. Hozircha Click orqali Uzcard yoki Humo kartangiz bilan bir zumda hisobni to‘ldirishingiz mumkin!`
      );
      return;
    }

    try {
      setLoading(true);
      setActivePaymentType(type);

      const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/profile` : undefined;
      const res = await PaymentApi.createTopUp(currentAmount, returnUrl, 'click');

      const targetUrl = type === 'card' ? (res.clickCardUrl || res.clickUrl) : (res.clickUrl || res.clickCardUrl);

      if (!targetUrl) {
        throw new Error('To‘lov havolasi olinmadi');
      }

      // Redirect user to the official payment portal
      window.location.href = targetUrl;
    } catch (err: any) {
      console.error('To‘lovda xatolik:', err);
      pushToast('common.error.generic', 'error');
    } finally {
      setLoading(false);
      setActivePaymentType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          aria-label="Yopish"
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 transition-colors shadow-sm"
            style={{
              backgroundColor: `${currentGatewayConfig.primaryColor}15`,
              borderColor: `${currentGatewayConfig.primaryColor}30`,
            }}
          >
            <img
              src={currentGatewayConfig.iconSrc}
              alt={currentGatewayConfig.name}
              className="w-7 h-7 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              Balansni to‘ldirish
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <span>{currentGatewayConfig.name} to‘lov tizimi orqali</span>
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  currentGatewayConfig.isReady ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </p>
          </div>
        </div>

        {/* 1. Payment Provider Selection Cards (Click, Payme, Uzum Bank) */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
            To‘lov tizimini tanlang
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {GATEWAYS.map((gw) => {
              const isSelected = selectedGateway === gw.id;
              return (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => handleGatewayChange(gw.id)}
                  className={`relative p-3 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between items-center text-center gap-2 group ${
                    isSelected
                      ? `${gw.activeBorder} ${gw.activeBg} shadow-md scale-[1.02] ring-2 ring-offset-1 dark:ring-offset-slate-900`
                      : `bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600 ${gw.hoverBg}`
                  }`}
                  style={isSelected ? { outlineColor: gw.primaryColor } : {}}
                >
                  {/* Status badge */}
                  <div className="absolute top-1.5 right-1.5">
                    {gw.isReady ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Faol
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                        <Clock className="w-2.5 h-2.5" />
                        Tez kunda
                      </span>
                    )}
                  </div>

                  {/* Logo Icon */}
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 p-1.5 shadow-xs border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0 mt-2">
                    <img
                      src={gw.iconSrc}
                      alt={gw.name}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Provider Name */}
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      {gw.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {gw.id === 'click' ? 'Click Up' : gw.id === 'payme' ? 'Payme App' : 'Uzum App'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Amount Presets */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Tavsiya etilgan summalar (so‘m)
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
            {PRESET_AMOUNTS.map((amt) => {
              const active = !customAmount && selectedAmount === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleSelectPreset(amt)}
                  className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all ${
                    active
                      ? 'text-white shadow-md scale-[1.02]'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: currentGatewayConfig.primaryColor,
                          borderColor: currentGatewayConfig.primaryColor,
                          boxShadow: `0 4px 14px ${currentGatewayConfig.primaryColor}40`,
                        }
                      : {}
                  }
                >
                  {amt.toLocaleString()}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Custom Amount Input */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Yoki boshqa summa kiriting
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="Masalan: 35000"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setInfoNotice(null);
              }}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:border-transparent outline-none transition-all text-sm"
              style={{
                ['--tw-ring-color' as any]: currentGatewayConfig.primaryColor,
              }}
            />
            <span className="absolute right-4 top-3 text-xs font-black text-slate-400">
              SO‘M
            </span>
          </div>
        </div>

        {/* 4. Total Display */}
        <div
          className="p-3.5 rounded-2xl border mb-4 flex items-center justify-between transition-colors"
          style={{
            backgroundColor: `${currentGatewayConfig.primaryColor}0d`,
            borderColor: `${currentGatewayConfig.primaryColor}26`,
          }}
        >
          <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
            Tanlangan to‘lov summasi:
          </span>
          <span
            className="text-xl sm:text-2xl font-black tracking-tight"
            style={{ color: currentGatewayConfig.primaryColor }}
          >
            {currentAmount.toLocaleString()} so‘m
          </span>
        </div>

        {/* Notification / Info banner if user taps a pending gateway */}
        {infoNotice && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              {infoNotice}
              <button
                type="button"
                onClick={() => setSelectedGateway('click')}
                className="mt-2 inline-flex items-center gap-1 font-black text-blue-600 dark:text-blue-400 hover:underline"
              >
                Click orqali davom etish <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* 5. Dynamic Payment Buttons Section according to Selected Provider */}
        <div className="space-y-2.5 mb-5">
          {/* PROVIDER 1: CLICK */}
          {selectedGateway === 'click' && (
            <>
              {/* Button: Click Official */}
              <button
                type="button"
                disabled={loading || currentAmount < 1_000}
                onClick={() => handlePay('app')}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#0065FF] hover:bg-[#0052cc] text-white font-bold shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 px-2 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
                    <img
                      src="/brand/click-logo-white.svg"
                      alt="Click"
                      className="h-4 w-auto object-contain"
                    />
                  </div>
                  <div className="text-left">
                    <div className="text-xs sm:text-sm font-black leading-tight">
                      Click ilovasi orqali to‘lash
                    </div>
                    <div className="text-[10px] text-blue-100/90 font-normal">
                      Click Up yoki hisob raqami orqali
                    </div>
                  </div>
                </div>
                {loading && activePaymentType === 'app' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
                )}
              </button>

              {/* Button: Uzcard / Humo Card via Click */}
              <button
                type="button"
                disabled={loading || currentAmount < 1_000}
                onClick={() => handlePay('card')}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white font-bold shadow-lg shadow-slate-900/25 hover:from-slate-800 hover:to-slate-750 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none border border-slate-700/60 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0 text-emerald-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs sm:text-sm font-black leading-tight flex items-center gap-1.5">
                      Plastik karta orqali
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">
                        Uzcard / Humo
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      Barcha bank kartalari bir zumda qabul qilinadi
                    </div>
                  </div>
                </div>
                {loading && activePaymentType === 'card' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                )}
              </button>

              <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-start gap-2 text-left">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-bold text-slate-800 dark:text-white">Karta bilan to‘lash:</span> Click sahifasida <strong className="text-blue-600 dark:text-blue-400">«Karta orqali / Оплата без регистрации»</strong> tugmasini bosib, Uzcard yoki Humo kartangizni kiritasiz.
                </p>
              </div>
            </>
          )}

          {/* PROVIDER 2: PAYME */}
          {selectedGateway === 'payme' && (
            <>
              {/* Button: Payme Official */}
              <button
                type="button"
                disabled={loading || currentAmount < 1_000}
                onClick={() => handlePay('app')}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#00CCCC] hover:bg-[#00b5b5] text-slate-950 font-black shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all disabled:opacity-50 group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 px-2 rounded-xl bg-black/10 flex items-center justify-center border border-black/10 shrink-0">
                    <img
                      src="/brand/payme-logo-white.svg"
                      alt="Payme"
                      className="h-4 w-auto object-contain"
                    />
                  </div>
                  <div className="text-left">
                    <div className="text-xs sm:text-sm font-black leading-tight text-slate-900">
                      Payme ilovasi orqali to‘lash
                    </div>
                    <div className="text-[10px] text-slate-800/80 font-medium">
                      Payme hisobi yoki kartalar orqali
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-800 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Status Info Box for Payme */}
              <div className="p-3.5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50 flex items-start gap-2.5 text-left">
                <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                    Payme merchant integratsiyasi ulanmoqda
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Payme orqali to‘lov qilish uchun tizim tayyorlandi. Rasmiy merchant hisob ma‘lumotlari kiritilishi bilan to‘lov to‘g‘ridan-to‘g‘ri ochiladi.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* PROVIDER 3: UZUM BANK */}
          {selectedGateway === 'uzum' && (
            <>
              {/* Button: Uzum Bank Official */}
              <button
                type="button"
                disabled={loading || currentAmount < 1_000}
                onClick={() => handlePay('app')}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#7000FF] hover:bg-[#6200e0] text-white font-black shadow-lg shadow-purple-500/25 active:scale-[0.98] transition-all disabled:opacity-50 group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 px-2 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
                    <img
                      src="/brand/uzum-logo-white.svg"
                      alt="Uzum Bank"
                      className="h-4 w-auto object-contain"
                    />
                  </div>
                  <div className="text-left">
                    <div className="text-xs sm:text-sm font-black leading-tight text-white">
                      Uzum Bank ilovasi orqali to‘lash
                    </div>
                    <div className="text-[10px] text-purple-200/90 font-medium">
                      Uzum ilovasi yoki Uzum kartasi
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-purple-200 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Status Info Box for Uzum Bank */}
              <div className="p-3.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 flex items-start gap-2.5 text-left">
                <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                    Uzum Bank to‘lov tizimi sozlanmoqda
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Uzum Bank bilan tezkor to‘lov shartnomasi rasmiylashtirilmoqda. Ma‘lumotlar faollashtirilgach, Uzum ilovasidan bir tugma bilan to‘lov amalga oshiriladi.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Trust Guarantee Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-2 text-center text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Barcha to‘lovlar 100% xavfsiz va shifrlangan tizimlar orqali amalga oshiriladi</span>
        </div>
      </div>
    </div>
  );
};
