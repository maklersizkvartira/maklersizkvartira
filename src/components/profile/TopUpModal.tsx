/**
 * TopUpModal: Ultra-modern Mobile-First Balance Top-Up gateway
 * supporting Click, Payme, and Uzum Bank with native app feel (Bottom Sheet on mobile).
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
  Lock,
  RotateCcw,
  ShieldCheck,
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

const PRESET_AMOUNTS = [5_000, 10_000, 20_000, 50_000, 100_000];

interface GatewayConfig {
  id: PaymentGateway;
  name: string;
  badge: string;
  isReady: boolean;
  iconSrc: string;
  logoWhiteSrc: string;
  primaryColor: string;
  gradientFrom: string;
  gradientTo: string;
  activeBorder: string;
  activeBg: string;
  shadowColor: string;
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
    gradientFrom: '#0065FF',
    gradientTo: '#0047b3',
    activeBorder: 'border-[#0065FF] dark:border-[#0065FF]',
    activeBg: 'bg-blue-50/90 dark:bg-blue-950/50',
    shadowColor: 'rgba(0, 101, 255, 0.35)',
    description: 'Click Up ilovasi yoki barcha bank kartalari',
  },
  {
    id: 'payme',
    name: 'Payme',
    badge: 'Faol',
    isReady: true,
    iconSrc: '/brand/payme-app-icon.png',
    logoWhiteSrc: '/brand/payme-logo-white.svg',
    primaryColor: '#00CCCC',
    gradientFrom: '#00CCCC',
    gradientTo: '#009999',
    activeBorder: 'border-[#00CCCC] dark:border-[#00CCCC]',
    activeBg: 'bg-teal-50/90 dark:bg-teal-950/50',
    shadowColor: 'rgba(0, 204, 204, 0.35)',
    description: 'Payme ilovasi yoki Payme kartalari',
  },
  {
    id: 'uzum',
    name: 'Uzum Bank',
    badge: 'Ulanmoqda',
    isReady: false,
    iconSrc: '/brand/uzum-app-icon.png',
    logoWhiteSrc: '/brand/uzum-brand.png',
    primaryColor: '#7000FF',
    gradientFrom: '#7000FF',
    gradientTo: '#4d00b3',
    activeBorder: 'border-[#7000FF] dark:border-[#7000FF]',
    activeBg: 'bg-purple-50/90 dark:bg-purple-950/50',
    shadowColor: 'rgba(112, 0, 255, 0.35)',
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

    if (!currentGatewayConfig.isReady) {
      const gwName = currentGatewayConfig.name;
      setInfoNotice(
        `${gwName} to‘lov tizimi hozirda rasmiy merchant integratsiyasi bosqichida. Tez kunda ushbu tizim to‘liq ishga tushadi. Hozircha Click orqali Uzcard yoki Humo kartangiz bilan bir zumda to‘ldirishingiz mumkin!`
      );
      return;
    }

    try {
      setLoading(true);
      setActivePaymentType(type);

      const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/profile` : undefined;
      const res = await PaymentApi.createTopUp(currentAmount, returnUrl, selectedGateway);

      let targetUrl: string | undefined;
      if (selectedGateway === 'payme') {
        targetUrl = res.paymeUrl;
      } else {
        targetUrl = type === 'card' ? (res.clickCardUrl || res.clickUrl) : (res.clickUrl || res.clickCardUrl);
      }

      if (!targetUrl) {
        throw new Error('To‘lov havolasi olinmadi');
      }

      window.location.href = targetUrl;
    } catch (err: any) {
      console.error('To‘lovda xatolik:', err);
      const errMsg = err?.message || err?.detail || 'common.error.generic';
      pushToast(errMsg, 'error');
    } finally {
      setLoading(false);
      setActivePaymentType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal Container: Bottom Sheet on Mobile, Centered Dialog on Desktop */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl p-5 sm:p-7 shadow-2xl border-t sm:border border-slate-100 dark:border-slate-800 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-200">
        
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          aria-label="Yopish"
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-0.5 space-y-4 sm:space-y-5">
          
          {/* Header */}
          <div className="flex items-center gap-3 pr-8">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center p-2 shrink-0 shadow-sm border transition-all duration-300"
              style={{
                backgroundColor: `${currentGatewayConfig.primaryColor}18`,
                borderColor: `${currentGatewayConfig.primaryColor}35`,
              }}
            >
              <img
                src={currentGatewayConfig.iconSrc}
                alt={currentGatewayConfig.name}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                Balansni to‘ldirish
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>{currentGatewayConfig.name} orqali tezkor to‘lov</span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    currentGatewayConfig.isReady
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                      : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                  }`}
                />
              </p>
            </div>
          </div>

          {/* 1. Payment Provider Cards (Click, Payme, Uzum Bank) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                To‘lov tizimini tanlang
              </label>
              <span className="text-[10px] text-slate-400">
                100% xavfsiz to‘lov
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {GATEWAYS.map((gw) => {
                const isSelected = selectedGateway === gw.id;
                return (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => handleGatewayChange(gw.id)}
                    className={`relative p-2.5 sm:p-3 rounded-2xl border text-center transition-all duration-200 flex flex-col items-center justify-between gap-1.5 sm:gap-2 active:scale-95 group ${
                      isSelected
                        ? `${gw.activeBorder} ${gw.activeBg} shadow-md ring-2 dark:ring-offset-slate-900 scale-[1.02]`
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                    style={
                      isSelected
                        ? {
                            boxShadow: `0 8px 20px -4px ${gw.shadowColor}`,
                            outlineColor: gw.primaryColor,
                          }
                        : {}
                    }
                  >
                    {/* Live Status indicator */}
                    <div className="absolute top-1.5 right-1.5">
                      {gw.isReady ? (
                        <span className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Faol
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                          <Clock className="w-2.5 h-2.5" />
                          Kutilmoqda
                        </span>
                      )}
                    </div>

                    {/* Official App Icon */}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white dark:bg-slate-900 p-1 shadow-xs border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0 mt-2 overflow-hidden">
                      <img
                        src={gw.iconSrc}
                        alt={gw.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>

                    {/* Provider Name */}
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                        {gw.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {gw.id === 'click' ? 'Click Up' : gw.id === 'payme' ? 'Payme App' : 'Uzum App'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Amount Presets (Thumb-friendly buttons on mobile) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Tavsiya etilgan summalar
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
              {PRESET_AMOUNTS.map((amt) => {
                const active = !customAmount && selectedAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleSelectPreset(amt)}
                    className={`h-10 sm:h-9 px-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 flex items-center justify-center ${
                      active
                        ? 'text-white shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: currentGatewayConfig.primaryColor,
                            borderColor: currentGatewayConfig.primaryColor,
                            boxShadow: `0 4px 12px ${currentGatewayConfig.shadowColor}`,
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
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Yoki boshqa summa kiriting
              </label>
              {customAmount && (
                <button
                  type="button"
                  onClick={() => setCustomAmount('')}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5"
                >
                  <RotateCcw className="w-3 h-3" /> Tozalash
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Masalan: 35000"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setInfoNotice(null);
                }}
                className="w-full h-12 px-4 pr-16 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white font-black text-base focus:ring-2 focus:border-transparent outline-none transition-all"
                style={{
                  ['--tw-ring-color' as any]: currentGatewayConfig.primaryColor,
                }}
              />
              <span className="absolute right-4 top-3.5 text-xs font-black text-slate-400">
                SO‘M
              </span>
            </div>
            <span className="block text-[10px] text-slate-400 mt-1">
              Minimal to‘lov summasi: 1 000 so‘m
            </span>
          </div>

          {/* 4. Total Display Card */}
          <div
            className="p-3.5 rounded-2xl border flex items-center justify-between transition-all duration-300"
            style={{
              backgroundColor: `${currentGatewayConfig.primaryColor}0d`,
              borderColor: `${currentGatewayConfig.primaryColor}30`,
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center p-1"
                style={{ backgroundColor: `${currentGatewayConfig.primaryColor}20` }}
              >
                <img
                  src={currentGatewayConfig.iconSrc}
                  alt={currentGatewayConfig.name}
                  className="w-full h-full object-contain rounded-xs"
                />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                To‘lov summasi:
              </span>
            </div>
            <span
              className="text-xl sm:text-2xl font-black tracking-tight"
              style={{ color: currentGatewayConfig.primaryColor }}
            >
              {currentAmount.toLocaleString()} so‘m
            </span>
          </div>

          {/* Pending Gateway Notice (if user clicks Payme or Uzum Bank) */}
          {infoNotice && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                {infoNotice}
                <button
                  type="button"
                  onClick={() => setSelectedGateway('click')}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
                >
                  Click orqali to‘lash <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* 5. Dynamic Payment Action Buttons according to Selected Provider */}
          <div className="space-y-2.5">
            {/* PROVIDER 1: CLICK (Fully Active) */}
            {selectedGateway === 'click' && (
              <>
                {/* Button: Click Official App */}
                <button
                  type="button"
                  disabled={loading || currentAmount < 1_000}
                  onClick={() => handlePay('app')}
                  className="w-full flex items-center justify-between px-4 py-3.5 sm:py-4 rounded-2xl bg-[#0065FF] hover:bg-[#0052cc] text-white font-bold shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 px-2.5 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
                      <img
                        src="/brand/click-logo-white.svg"
                        alt="Click"
                        className="h-4 sm:h-5 w-auto object-contain"
                      />
                    </div>
                    <div className="text-left">
                      <div className="text-xs sm:text-sm font-black leading-tight">
                        Click ilovasi orqali to‘lash
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-blue-100/90 font-normal">
                        Click Up ilovasi yoki hisob raqami
                      </div>
                    </div>
                  </div>
                  {loading && activePaymentType === 'app' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
                  )}
                </button>

                {/* Button: Plastic Card via Click */}
                <button
                  type="button"
                  disabled={loading || currentAmount < 1_000}
                  onClick={() => handlePay('card')}
                  className="w-full flex items-center justify-between px-4 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white font-bold shadow-lg shadow-slate-900/25 hover:from-slate-800 hover:to-slate-750 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none border border-slate-700/60 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0 text-emerald-400">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs sm:text-sm font-black leading-tight flex items-center gap-1.5">
                        Plastik karta orqali
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                          Uzcard / Humo
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-slate-400 font-normal">
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

                <div className="p-2.5 sm:p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-start gap-2 text-left">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-bold text-slate-800 dark:text-white">Karta bilan to‘lash:</span> Click sahifasida <strong className="text-blue-600 dark:text-blue-400">«Karta orqali / Оплата без регистрации»</strong> tugmasini bosib, Uzcard yoki Humo kartangizni kiritasiz.
                  </p>
                </div>
              </>
            )}

            {/* PROVIDER 2: PAYME (Official Setup Ready) */}
            {selectedGateway === 'payme' && (
              <>
                {/* Button: Payme Official App */}
                <button
                  type="button"
                  disabled={loading || currentAmount < 1_000}
                  onClick={() => handlePay('app')}
                  className="w-full flex items-center justify-between px-4 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-[#00CCCC] to-[#00b3b3] hover:from-[#00b3b3] hover:to-[#009999] text-slate-950 font-black shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all disabled:opacity-50 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-black/10 flex items-center justify-center border border-black/10 shrink-0 overflow-hidden p-1">
                      <img
                        src="/brand/payme-app-icon.png"
                        alt="Payme"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                    <div className="text-left">
                      <div className="text-xs sm:text-sm font-black leading-tight text-slate-950">
                        Payme orqali to‘lash
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-slate-800/80 font-medium">
                        Payme ilovasi yoki bank kartasi bilan
                      </div>
                    </div>
                  </div>
                  {loading && activePaymentType === 'app' ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
                  ) : (
                    <ExternalLink className="w-4 h-4 text-slate-900 group-hover:translate-x-0.5 transition-transform" />
                  )}
                </button>

                <div className="p-3.5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50 flex items-start gap-2.5 text-left">
                  <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                      Rasmiy Payme to‘lov sahifasi
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tugmani bosganingizda to‘g‘ridan-to‘g‘ri Payme ilovasi yoki veb-sahifasiga yo‘naltirilasiz. To‘lov amalga oshirilishi bilan hisobingiz bir zumda to‘ldiriladi.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* PROVIDER 3: UZUM BANK (Official Setup Ready) */}
            {selectedGateway === 'uzum' && (
              <>
                {/* Button: Uzum Bank Official App */}
                <button
                  type="button"
                  disabled={loading || currentAmount < 1_000}
                  onClick={() => handlePay('app')}
                  className="w-full flex items-center justify-between px-4 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-[#7000FF] to-[#5900CC] hover:from-[#6200e0] hover:to-[#4d00b3] text-white font-black shadow-lg shadow-purple-500/25 active:scale-[0.98] transition-all disabled:opacity-50 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0 overflow-hidden p-1">
                      <img
                        src="/brand/uzum-app-icon.png"
                        alt="Uzum Bank"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                    <div className="text-left">
                      <div className="text-xs sm:text-sm font-black leading-tight text-white">
                        Uzum Bank ilovasi orqali to‘lash
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-purple-200/90 font-medium">
                        Uzum Bank ilovasi yoki Uzum karta
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-purple-200 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <div className="p-3.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 flex items-start gap-2.5 text-left">
                  <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                      Uzum Bank to‘lov tizimi sozlanmoqda
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Uzum Bank merchant ma‘lumotlari tasdiqlangach, Uzum ilovasi orqali bir tugma bilan to‘lash yo‘lga qo‘yiladi. Hozirda Click orqali Uzcard va Humo kartalari to‘liq faol.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedGateway('click')}
                      className="mt-2 text-xs font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Click orqali to‘ldirish <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Trust Guarantee Footer */}
          <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-1.5 text-center text-[10px] sm:text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>256-bit SSL xavfsiz shifrlangan to‘lov protokoli</span>
          </div>

        </div>
      </div>
    </div>
  );
};
