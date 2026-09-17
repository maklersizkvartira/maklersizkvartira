import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  X,
  Sparkles,
  Coins,
  Trophy,
  ShoppingBag,
  CreditCard,
  Zap,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Crown,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  fetchSpinnerStatus,
  spinWheel,
  buySpins,
  fetchLeaderboard,
  requestWithdrawal,
  redeemCoinsToBalance,
  redeemCoinsForListing,
  type SpinnerStatus,
  type SpinnerSector,
  type LeaderboardData,
  type SpinResult,
} from '../../services/spinnerApi';
import { ListingsApi } from '../../services/listingsApi';
import type { Listing } from '../../types';
import { useAppStore } from '../../stores/useAppStore';

interface FortuneWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTutorial: () => void;
}

type ActiveTab = 'WHEEL' | 'LEADERBOARD' | 'STORE';

export const FortuneWheelModal: React.FC<FortuneWheelModalProps> = ({
  isOpen,
  onClose,
  onOpenTutorial,
}) => {
  const { currentUser, setShowAuth } = useAppStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('WHEEL');
  const [status, setStatus] = useState<SpinnerStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [winResult, setWinResult] = useState<SpinResult | null>(null);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  // Store / Cashout state
  const [cashoutAmount, setCashoutAmount] = useState<number>(1000);
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardHolder, setCardHolder] = useState<string>('');
  const [cashoutLoading, setCashoutLoading] = useState<boolean>(false);
  const [cashoutSuccess, setCashoutSuccess] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);

  // Balance exchange state
  const [balanceExchangeCoins, setBalanceExchangeCoins] = useState<number>(100);
  const [exchangeLoading, setExchangeLoading] = useState<boolean>(false);

  // Listing VIP/TOP redeem
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [listingPromoLoading, setListingPromoLoading] = useState<boolean>(false);

  // Audio / sound simulation
  const audioContextRef = useRef<AudioContext | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await fetchSpinnerStatus();
      setStatus(res);
      setTimeLeft(res.secondsUntilNextFreeSpin || 0);
    } catch (e) {
      console.error('Failed to load spinner status:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboardData = async () => {
    try {
      setLoadingLeaderboard(true);
      const data = await fetchLeaderboard();
      setLeaderboard(data);
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const loadUserListings = async () => {
    if (!currentUser) return;
    try {
      const items = await ListingsApi.mine();
      setMyListings(items || []);
      if (items && items.length > 0) {
        setSelectedListingId(items[0].id);
      }
    } catch (e) {
      console.warn('Failed to load user listings:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      if (currentUser) {
        loadUserListings();
      }
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (isOpen && activeTab === 'LEADERBOARD') {
      loadLeaderboardData();
    }
  }, [isOpen, activeTab]);

  // Countdown tick
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          loadStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sound click effect using Web Audio API
  const playClickSound = () => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      }
    } catch {
      // Audio context might be restricted
    }
  };

  const playJackpotFanfare = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#EAB308'],
      });
    } catch {
      // Confetti fallback
    }
  };

  // Perform spin action
  const handleSpin = async (usePaid: boolean = false) => {
    if (!currentUser) {
      setShowAuth(true, 'LOGIN');
      return;
    }

    if (spinning) return;

    try {
      setSpinning(true);
      setWinResult(null);

      const res = await spinWheel(usePaid);

      // Total sectors is 8
      const sectorCount = status?.sectors.length || 8;
      const sectorDegrees = 360 / sectorCount; // 45 deg
      const targetSectorIndex = res.sectorIndex;

      // Indicator is at TOP (angle 0 / 360)
      // Center of sector i is at i * 45 + 22.5
      const targetSectorAngle = targetSectorIndex * sectorDegrees + sectorDegrees / 2;
      
      // Calculate final wheel rotation
      const fullRotations = 360 * 6; // 6 full energetic turns
      // We want `(wheelRotation + delta) % 360` to align top pointer with target sector
      const currentMod = wheelRotation % 360;
      const neededMod = (360 - targetSectorAngle) % 360;
      let angleDelta = neededMod - currentMod;
      if (angleDelta < 0) angleDelta += 360;

      const finalRotation = wheelRotation + fullRotations + angleDelta;
      setWheelRotation(finalRotation);

      // Play tick sounds as it spins
      const tickInterval = setInterval(() => {
        playClickSound();
      }, 120);

      setTimeout(() => {
        clearInterval(tickInterval);
        setSpinning(false);
        setWinResult(res);
        playJackpotFanfare();

        // Update local status
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                coins: res.newCoinsTotal,
                canFreeSpin: res.canFreeSpin,
                paidSpinsAvailable: res.paidSpinsAvailable,
              }
            : null
        );

        if (!res.canFreeSpin) {
          setTimeLeft(24 * 3600);
        }
      }, 4200);
    } catch (e: any) {
      setSpinning(false);
      alert(e?.message || 'Aylantirishda xatolik yuz berdi. Iltimos qayta urining.');
    }
  };

  // Buy paid spins
  const handleBuySpins = async () => {
    if (!currentUser) {
      setShowAuth(true, 'LOGIN');
      return;
    }
    try {
      setLoading(true);
      const res = await buySpins();
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              paidSpinsAvailable: res.paidSpinsAvailable,
              balanceUzs: res.newBalance,
            }
          : null
      );
      alert(res.message);
    } catch (e: any) {
      alert(e?.message || 'Xarid qilishda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  // Handle cashout request
  const handleCashout = async (e: React.FormEvent) => {
    e.preventDefault();
    setStoreError(null);
    setCashoutSuccess(null);

    const cleanCard = cardNumber.replace(/\s+/g, '');
    if (!cleanCard || cleanCard.length < 16) {
      setStoreError('16 xonali karta raqamini to&apos;liq kiriting (Uzcard yoki Humo).');
      return;
    }

    if (cashoutAmount < 1000 || cashoutAmount > 10000) {
      setStoreError('Yechib olish summasi 1 000 so&apos;mdan 10 000 so&apos;mgacha bo&apos;lishi kerak.');
      return;
    }

    try {
      setCashoutLoading(true);
      const res = await requestWithdrawal(cleanCard, cashoutAmount, cardHolder);
      setCashoutSuccess(res.message);
      setStatus((prev) => (prev ? { ...prev, coins: res.remainingCoins } : null));
      setCardNumber('');
      setCardHolder('');
    } catch (err: any) {
      setStoreError(err?.message || 'Pul yechish so&apos;rovida xatolik.');
    } finally {
      setCashoutLoading(false);
    }
  };

  // Handle coin to balance exchange
  const handleExchangeToBalance = async () => {
    setStoreError(null);
    if (!status || status.coins < balanceExchangeCoins) {
      setStoreError('Yetarli miqdorda coin mavjud emas.');
      return;
    }
    try {
      setExchangeLoading(true);
      const res = await redeemCoinsToBalance(balanceExchangeCoins);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              coins: res.remainingCoins,
              balanceUzs: res.newBalance,
            }
          : null
      );
      alert(res.message);
    } catch (err: any) {
      setStoreError(err?.message || 'Balansga almashtirishda xatolik.');
    } finally {
      setExchangeLoading(false);
    }
  };

  // Handle listing VIP/TOP redeem
  const handleRedeemListing = async (serviceType: 'TOP_7_DAYS' | 'VIP_7_DAYS') => {
    setStoreError(null);
    if (!selectedListingId) {
      setStoreError('Iltimos, e&apos;lonni tanlang.');
      return;
    }
    try {
      setListingPromoLoading(true);
      const res = await redeemCoinsForListing(selectedListingId, serviceType);
      setStatus((prev) => (prev ? { ...prev, coins: res.remainingCoins } : null));
      alert(res.message);
    } catch (err: any) {
      setStoreError(err?.message || 'E&apos;lonni ko&apos;tarishda xatolik yuz berdi.');
    } finally {
      setListingPromoLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 rounded-3xl border border-amber-500/30 shadow-2xl shadow-amber-500/10 overflow-hidden z-10 my-auto text-white flex flex-col max-h-[92vh]"
        >
          {/* Top Bar Header */}
          <div className="relative px-5 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-md shadow-amber-500/30">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-xl">
                  🎡
                </div>
              </div>
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  Omad Barabani
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Uyiz Coin
                  </span>
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                  <Coins className="w-3.5 h-3.5" />
                  <span>{status ? status.coins.toLocaleString() : '0'} Coin</span>
                  {status && (
                    <span className="text-slate-400 font-normal">
                      (~{(status.coins * 10).toLocaleString()} so&apos;m)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenTutorial}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1 border border-white/10"
                title="Qoidalar va yo'riqnoma"
              >
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Qoidalar</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                aria-label="Yopish"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-5 pt-3 pb-2 flex gap-2 border-b border-white/10 bg-slate-900/40 shrink-0">
            <button
              onClick={() => setActiveTab('WHEEL')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'WHEEL'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>🎡 Baraban</span>
              {status?.canFreeSpin && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('LEADERBOARD')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'LEADERBOARD'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Reyting</span>
            </button>
            <button
              onClick={() => setActiveTab('STORE')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'STORE'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Do&apos;kon & Kartaga</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
            {/* TAB 1: WHEEL */}
            {activeTab === 'WHEEL' && (
              <div className="flex flex-col items-center">
                {/* Wheel Presentation */}
                <div className="relative my-4 flex items-center justify-center">
                  {/* Outer Glowing Ring */}
                  <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-orange-500/20 blur-xl pointer-events-none animate-pulse" />

                  {/* Top Pointer Indicator */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
                    <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-amber-400" />
                    <div className="w-2.5 h-2.5 bg-yellow-200 rounded-full mx-auto -mt-6 shadow-inner" />
                  </div>

                  {/* Rotating Wheel Container */}
                  <div
                    style={{
                      transform: `rotate(${wheelRotation}deg)`,
                      transition: spinning ? 'transform 4.2s cubic-bezier(0.12, 0.8, 0.15, 1)' : 'none',
                    }}
                    className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full border-4 border-amber-400/80 shadow-[0_0_30px_rgba(245,158,11,0.3)] overflow-hidden bg-slate-900"
                  >
                    {/* SVG Wheel Render */}
                    <svg viewBox="0 0 300 300" className="w-full h-full">
                      <defs>
                        <linearGradient id="goldJackpot" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#F59E0B" />
                          <stop offset="50%" stopColor="#FDE047" />
                          <stop offset="100%" stopColor="#D97706" />
                        </linearGradient>
                      </defs>

                      {/* 8 Sectors */}
                      {(status?.sectors || [
                        { index: 0, label: '50', coins: 50, color: '#2563EB' },
                        { index: 1, label: '100', coins: 100, color: '#059669' },
                        { index: 2, label: '150', coins: 150, color: '#D97706' },
                        { index: 3, label: '250', coins: 250, color: '#7C3AED' },
                        { index: 4, label: '350', coins: 350, color: '#DB2777' },
                        { index: 5, label: '500', coins: 500, color: '#0891B2' },
                        { index: 6, label: '1000', coins: 1000, color: '#EA580C' },
                        { index: 7, label: '2500★', coins: 2500, color: 'url(#goldJackpot)' },
                      ]).map((sector, i) => {
                        const startAngle = i * 45;
                        const endAngle = (i + 1) * 45;
                        const startRad = ((startAngle - 90) * Math.PI) / 180;
                        const endRad = ((endAngle - 90) * Math.PI) / 180;

                        const x1 = 150 + 150 * Math.cos(startRad);
                        const y1 = 150 + 150 * Math.sin(startRad);
                        const x2 = 150 + 150 * Math.cos(endRad);
                        const y2 = 150 + 150 * Math.sin(endRad);

                        const pathData = `M 150 150 L ${x1} ${y1} A 150 150 0 0 1 ${x2} ${y2} Z`;

                        // Text position
                        const midAngle = startAngle + 22.5;
                        const midRad = ((midAngle - 90) * Math.PI) / 180;
                        const textRadius = 100;
                        const textX = 150 + textRadius * Math.cos(midRad);
                        const textY = 150 + textRadius * Math.sin(midRad);

                        return (
                          <g key={i}>
                            <path
                              d={pathData}
                              fill={sector.color}
                              stroke="#1E293B"
                              strokeWidth="1.5"
                            />
                            <text
                              x={textX}
                              y={textY}
                              fill="#FFFFFF"
                              fontSize={i === 7 ? '13' : '14'}
                              fontWeight="bold"
                              textAnchor="middle"
                              dominantBaseline="central"
                              transform={`rotate(${midAngle}, ${textX}, ${textY})`}
                              className="drop-shadow-md"
                            >
                              {sector.coins === 2500 ? '2500 ★' : `${sector.coins}`}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* Central 3D Hub */}
                    <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-300 p-1 shadow-2xl flex items-center justify-center">
                      <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center text-center shadow-inner">
                        <span className="text-[10px] font-black text-amber-400 leading-none">
                          UYIZ
                        </span>
                        <span className="text-[8px] font-bold text-yellow-200">COIN</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Win Celebration Dialog */}
                <AnimatePresence>
                  {winResult && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="w-full max-w-sm p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/40 text-center my-3 shadow-lg"
                    >
                      <div className="inline-flex p-2 rounded-full bg-amber-500/20 text-amber-300 mb-2 animate-bounce">
                        <Trophy className="w-6 h-6" />
                      </div>
                      <h4 className="text-lg font-black text-amber-300">
                        {winResult.coinsWon >= 1000 ? '🎉 SUPER JACKPOT!' : '🎉 TABRIKLAYMIZ!'}
                      </h4>
                      <p className="text-sm text-white mt-1">
                        Sizga <span className="font-extrabold text-amber-400 text-base">+{winResult.coinsWon}</span> Uyiz Coin berildi!
                      </p>
                      <button
                        onClick={() => setWinResult(null)}
                        className="mt-3 py-1.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                      >
                        Ajoyib!
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Spin Controls */}
                <div className="w-full max-w-md mt-4 flex flex-col gap-3">
                  {status?.canFreeSpin ? (
                    <button
                      onClick={() => handleSpin(false)}
                      disabled={spinning}
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 font-black text-lg shadow-xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2 border border-emerald-300/40 animate-pulse"
                    >
                      {spinning ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span>Baraban aylanmoqda...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-6 h-6" />
                          <span>BEPUL AYLANTIRISH</span>
                        </>
                      )}
                    </button>
                  ) : (status?.paidSpinsAvailable || 0) > 0 ? (
                    <button
                      onClick={() => handleSpin(true)}
                      disabled={spinning}
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-lg shadow-xl shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2 border border-amber-300/40"
                    >
                      {spinning ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span>Aylanmoqda...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-6 h-6" />
                          <span>QO&apos;SHIMCHA AYLANTIRISH ({status?.paidSpinsAvailable} ta qoldi)</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {/* Timer */}
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span>Keyingi bepul imkoniyat:</span>
                        </div>
                        <span className="font-mono font-bold text-amber-300 text-base">
                          {formatCountdown(timeLeft)}
                        </span>
                      </div>

                      {/* Buy Spins CTA */}
                      <button
                        onClick={handleBuySpins}
                        disabled={loading || spinning}
                        className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-between border border-indigo-400/30"
                      >
                        <div className="flex items-center gap-2 text-left">
                          <Zap className="w-5 h-5 text-amber-400" />
                          <div>
                            <div>Kutishni istamaysizmi?</div>
                            <div className="text-[11px] text-indigo-200 font-normal">
                              Sayt hisobidan 1 000 so&apos;m evaziga 2 ta aylantirish
                            </div>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-white/20 text-xs font-black">
                          Sotib olish
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: LEADERBOARD */}
            {activeTab === 'LEADERBOARD' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      Musobaqa Reytingi
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Barcha ishtirokchilar orasida eng ko&apos;p coin yig&apos;gan peshqadamlar
                    </p>
                  </div>
                  <button
                    onClick={loadLeaderboardData}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                    title="Yangilash"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingLeaderboard ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {loadingLeaderboard ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    <span>Reyting yuklanmoqda...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard?.topUsers.map((user) => {
                      const isGold = user.rank === 1;
                      const isSilver = user.rank === 2;
                      const isBronze = user.rank === 3;

                      return (
                        <div
                          key={user.userId}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                            user.isCurrentUser
                              ? 'bg-amber-500/20 border-amber-500/50 shadow-md shadow-amber-500/10'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 text-center font-bold text-sm shrink-0">
                              {isGold ? (
                                <Crown className="w-5 h-5 text-yellow-400 mx-auto" />
                              ) : isSilver ? (
                                <Crown className="w-5 h-5 text-slate-300 mx-auto" />
                              ) : isBronze ? (
                                <Crown className="w-5 h-5 text-amber-600 mx-auto" />
                              ) : (
                                <span className="text-slate-400">#{user.rank}</span>
                              )}
                            </div>

                            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-200 shrink-0 overflow-hidden border border-white/10">
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={user.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{user.name.charAt(0).toUpperCase()}</span>
                              )}
                            </div>

                            <div>
                              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                                <span>{user.name}</span>
                                {user.isCurrentUser && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black">
                                    Siz
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 font-mono font-bold text-amber-400 text-sm">
                            <Coins className="w-4 h-4" />
                            <span>{user.coins.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Current user footer badge */}
                    {leaderboard && (
                      <div className="sticky bottom-0 p-3 rounded-2xl bg-gradient-to-r from-amber-600/30 via-slate-900 to-indigo-900/40 border border-amber-500/40 backdrop-blur-md flex items-center justify-between text-xs mt-4">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-amber-500 text-slate-950 font-bold">
                            #{leaderboard.myRank}
                          </span>
                          <span className="text-slate-200">
                            Sizning o&apos;rningiz ({leaderboard.totalParticipants} ishtirokchidan)
                          </span>
                        </div>
                        <div className="font-bold text-amber-300 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" />
                          <span>{leaderboard.myCoins.toLocaleString()} Coin</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: STORE & WITHDRAWAL */}
            {activeTab === 'STORE' && (
              <div className="space-y-6">
                {/* Global Message Banner */}
                {storeError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{storeError}</span>
                  </div>
                )}
                {cashoutSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                    <span>{cashoutSuccess}</span>
                  </div>
                )}

                {/* Section 1: Cashout to Real Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-emerald-500/30 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-emerald-400" />
                        Haqiqiy Kartaga Pul Yechish
                      </h3>
                      <p className="text-xs text-slate-300 mt-1">
                        Coinlarni Uzcard yoki Humo kartangizga yechib oling. So&apos;rov qoldirishingiz bilan qo&apos;llab-quvvatlash bo&apos;limiga yuboriladi va to&apos;lab beriladi!
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                      Uzcard / Humo
                    </span>
                  </div>

                  <form onSubmit={handleCashout} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Karta raqami (16 xonali):
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                          const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                          setCardNumber(formatted);
                        }}
                        placeholder="8600 •••• •••• •••• yoki 9860..."
                        maxLength={19}
                        required
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Karta egasining Ism-familiyasi (ixtiyoriy):
                      </label>
                      <input
                        type="text"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        placeholder="Masalan: Azizbek Aliyev"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Yechib olish summasi (1 000 - 10 000 so&apos;m):
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[1000, 2000, 5000, 10000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setCashoutAmount(amt)}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                              cashoutAmount === amt
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {amt.toLocaleString()} so&apos;m
                            <span className="block text-[10px] font-normal opacity-80">
                              {amt / 10} coin
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={cashoutLoading}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {cashoutLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                      <span>Pul yechish so&apos;rovini yuborish</span>
                    </button>
                  </form>
                </div>

                {/* Section 2: Exchange to Site Balance */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base flex items-center gap-2">
                        <Coins className="w-5 h-5 text-amber-400" />
                        Sayt Balansiga Almashtirish
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Har 100 coin = 1 000 so&apos;m saytdagi hamyoningizga qo&apos;shiladi.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={balanceExchangeCoins}
                      onChange={(e) => setBalanceExchangeCoins(Number(e.target.value))}
                      className="px-3 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400 flex-1"
                    >
                      <option value={100}>100 Coin = 1 000 so&apos;m</option>
                      <option value={200}>200 Coin = 2 000 so&apos;m</option>
                      <option value={500}>500 Coin = 5 000 so&apos;m</option>
                      <option value={1000}>1 000 Coin = 10 000 so&apos;m</option>
                    </select>

                    <button
                      onClick={handleExchangeToBalance}
                      disabled={exchangeLoading}
                      className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition-colors"
                    >
                      {exchangeLoading ? 'Almashtirilmoqda...' : 'Hisobga o&apos;tkazish'}
                    </button>
                  </div>
                </div>

                {/* Section 3: Upgrade Listings to VIP / TOP */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-400" />
                      E&apos;lonlarni TOP va VIP qilish (7 kun)
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Coinlar yordamida e&apos;loningizni eng yuqori qatorlarga chiqaring.
                    </p>
                  </div>

                  {myListings.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Sizda hozircha faol e&apos;lonlar mavjud emas.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      <label className="block text-xs text-slate-300 font-semibold">
                        E&apos;lonni tanlang:
                      </label>
                      <select
                        value={selectedListingId}
                        onChange={(e) => setSelectedListingId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
                      >
                        {myListings.map((listing) => (
                          <option key={listing.id} value={listing.id}>
                            {listing.title || `E'lon #${listing.id}`} ({listing.price?.toLocaleString()} so&apos;m)
                          </option>
                        ))}
                      </select>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleRedeemListing('TOP_7_DAYS')}
                          disabled={listingPromoLoading || (status?.coins || 0) < 500}
                          className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/40 hover:bg-indigo-500/30 text-left transition-all disabled:opacity-40"
                        >
                          <div className="text-xs font-bold text-indigo-300">TOP ga chiqarish</div>
                          <div className="text-[11px] text-slate-300 mt-0.5">7 kun davomida</div>
                          <div className="text-xs font-black text-amber-400 mt-1">500 Coin</div>
                        </button>

                        <button
                          onClick={() => handleRedeemListing('VIP_7_DAYS')}
                          disabled={listingPromoLoading || (status?.coins || 0) < 1000}
                          className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-left transition-all disabled:opacity-40"
                        >
                          <div className="text-xs font-bold text-amber-300">VIP qilish</div>
                          <div className="text-[11px] text-slate-300 mt-0.5">7 kun davomida</div>
                          <div className="text-xs font-black text-amber-400 mt-1">1 000 Coin</div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
