import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../../i18n';

type NetworkHealth = 'online' | 'slow' | 'offline';

interface PingStats {
  latencyMs: number | null;
  lastChecked: Date | null;
}

export const OfflineDetector: React.FC = () => {
  const { language } = useTranslation();
  const [networkStatus, setNetworkStatus] = useState<NetworkHealth>('online');
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [pingStats, setPingStats] = useState<PingStats>({ latencyMs: null, lastChecked: null });
  const [showGame, setShowGame] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const pingAbortControllerRef = useRef<AbortController | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Localization dictionary for network states
  const tNet = {
    uz: {
      offlineTitle: "Internet bilan aloqa uzildi",
      offlineDesc: "Qurilmangiz tarmoqqa ulanmagan. Iltimos, Wi-Fi yoki mobil internetni tekshiring.",
      slowTitle: "Internet aloqasi juda sust",
      slowDesc: "Tarmoq tezligi juda past. Ma'lumotlar kechikib yuklanishi mumkin.",
      reconnectedTitle: "Aloqa qayta tiklandi!",
      reconnectedDesc: "Internet muvaffaqiyatli ulandi. Barcha xizmatlar tayyor.",
      retryBtn: "Qayta tekshirish",
      checking: "Tekshirilmoqda...",
      minimizeBtn: "Oflayn ko'rish",
      expandBtn: "Batafsil",
      playGameBtn: "Internet yo'qligida mini-o'yin 🎮",
      hideGameBtn: "O'yinni yopish",
      ping: "Ping",
      ms: "ms",
      offlineModeBadge: "Oflayn rejim",
      slowModeBadge: "Sust aloqa",
      statusCheck: "Tarmoq holati",
      close: "Yopish",
      autoReconnectNotice: "Aloqa tiklanganda sahifa avtomatik yangilanadi"
    },
    ru: {
      offlineTitle: "Соединение с интернетом прервано",
      offlineDesc: "Устройство не подключено к сети. Пожалуйста, проверьте Wi-Fi или мобильный интернет.",
      slowTitle: "Очень медленный интернет",
      slowDesc: "Скорость соединения слишком низкая. Страницы могут открываться медленно.",
      reconnectedTitle: "Соединение восстановлено!",
      reconnectedDesc: "Интернет снова доступен. Все сервисы работают.",
      retryBtn: "Проверить снова",
      checking: "Проверка...",
      minimizeBtn: "Офлайн просмотр",
      expandBtn: "Развернуть",
      playGameBtn: "Мини-игра пока ждёте 🎮",
      hideGameBtn: "Закрыть игру",
      ping: "Пинг",
      ms: "мс",
      offlineModeBadge: "Офлайн режим",
      slowModeBadge: "Слабая связь",
      statusCheck: "Статус сети",
      close: "Закрыть",
      autoReconnectNotice: "При появлении связи всё обновится автоматически"
    },
    en: {
      offlineTitle: "No Internet Connection",
      offlineDesc: "Your device is offline. Please check your Wi-Fi or cellular network settings.",
      slowTitle: "Unstable / Slow Connection",
      slowDesc: "Network latency is very high. Content may take longer to load.",
      reconnectedTitle: "Connection Restored!",
      reconnectedDesc: "You are back online. All services are ready.",
      retryBtn: "Retry Connection",
      checking: "Checking...",
      minimizeBtn: "Browse Offline",
      expandBtn: "Details",
      playGameBtn: "Play Mini-Game while waiting 🎮",
      hideGameBtn: "Close Game",
      ping: "Latency",
      ms: "ms",
      offlineModeBadge: "Offline Mode",
      slowModeBadge: "Slow Connection",
      statusCheck: "Network Status",
      close: "Close",
      autoReconnectNotice: "Page will automatically resume once back online"
    }
  };

  const currentLang = (language === 'ru' ? 'ru' : language === 'en' ? 'en' : 'uz') as 'uz' | 'ru' | 'en';
  const labels = tNet[currentLang] || tNet.uz;

  // Active check ping using lightweight timestamp ping
  const checkConnectivity = useCallback(async (): Promise<{ status: NetworkHealth; latency: number | null }> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { status: 'offline', latency: null };
    }

    if (pingAbortControllerRef.current) {
      pingAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    pingAbortControllerRef.current = controller;

    const startTime = performance.now();
    try {
      // Use favicon.ico with cache buster for instant, lightweight ping
      const response = await fetch(`/favicon.ico?_net_check=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      const elapsed = Math.round(performance.now() - startTime);

      if (response.ok || response.type === 'opaque') {
        const navConn = (navigator as unknown as { connection?: { effectiveType?: string; rtt?: number } }).connection;
        const isConnSlow = navConn && (navConn.effectiveType === '2g' || navConn.effectiveType === 'slow-2g' || (navConn.rtt && navConn.rtt > 2200));

        if (elapsed > 2500 || isConnSlow) {
          return { status: 'slow', latency: elapsed };
        }
        return { status: 'online', latency: elapsed };
      } else {
        return { status: 'offline', latency: null };
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return { status: networkStatus, latency: pingStats.latencyMs };
      }
      return { status: 'offline', latency: null };
    }
  }, [networkStatus, pingStats.latencyMs]);

  const performCheck = useCallback(async (manual = false) => {
    if (manual) setIsChecking(true);
    const result = await checkConnectivity();
    if (manual) setIsChecking(false);

    setPingStats({ latencyMs: result.latency, lastChecked: new Date() });

    setNetworkStatus((current) => {
      if (current !== 'online' && result.status === 'online') {
        setJustReconnected(true);
        setIsMinimized(false);
        setIsDismissed(false);
        setShowGame(false);
        setTimeout(() => {
          setJustReconnected(false);
        }, 3200);
      }
      return result.status;
    });
  }, [checkConnectivity]);

  // Event Listeners for browser online/offline
  useEffect(() => {
    const handleOnline = () => {
      performCheck(true);
    };

    const handleOffline = () => {
      setNetworkStatus('offline');
      setIsDismissed(false);
      setIsMinimized(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount
    performCheck(false);

    const navConn = (navigator as unknown as { connection?: EventTarget & { effectiveType?: string; rtt?: number } }).connection;
    const handleConnChange = () => {
      performCheck(false);
    };

    if (navConn?.addEventListener) {
      navConn.addEventListener('change', handleConnChange);
    }

    const intervalTime = networkStatus === 'online' ? 25000 : 7000;
    const interval = setInterval(() => {
      performCheck(false);
    }, intervalTime);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (navConn?.removeEventListener) {
        navConn.removeEventListener('change', handleConnChange);
      }
      clearInterval(interval);
      if (pingAbortControllerRef.current) {
        pingAbortControllerRef.current.abort();
      }
    };
  }, [networkStatus, performCheck]);

  // Autoplay video safely on mount/visibility
  useEffect(() => {
    if (videoRef.current && (networkStatus === 'offline' || networkStatus === 'slow')) {
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback: muted video usually plays fine
      });
    }
  }, [networkStatus]);

  // If online and not just reconnected, render nothing
  if (networkStatus === 'online' && !justReconnected) {
    return null;
  }

  // If dismissed by user (only applicable for slow connection)
  if (isDismissed && networkStatus === 'slow' && !justReconnected) {
    return null;
  }

  // -------------------------------------------------------------
  // 1. RECONNECTED BANNER
  // -------------------------------------------------------------
  if (justReconnected) {
    return (
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] max-w-md w-[92%] sm:w-auto animate-bounce">
        <div className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl bg-emerald-600 text-white shadow-2xl border border-emerald-400/40 backdrop-blur-md">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-bold leading-tight">{labels.reconnectedTitle}</h4>
            <p className="text-xs text-emerald-100 mt-0.5">{labels.reconnectedDesc}</p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. MINIMIZED FLOATING PILL (Allows user to inspect loaded page)
  // -------------------------------------------------------------
  if (isMinimized) {
    return (
      <aside aria-label={labels.statusCheck} className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[9999] max-w-sm w-[92%] sm:w-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-full bg-slate-900/95 text-white shadow-2xl border border-slate-700/80 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-white flex items-center justify-center flex-shrink-0 border-2 border-red-500 shadow-sm">
              {!videoError ? (
                <video
                  src="/disconnect.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-125"
                  onError={() => setVideoError(true)}
                />
              ) : (
                <span className="text-red-500 font-bold text-xs">✕</span>
              )}
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 ring-1 ring-white animate-ping" />
            </div>
            <span className="text-xs font-semibold text-slate-200">
              {networkStatus === 'offline' ? labels.offlineModeBadge : labels.slowModeBadge}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => performCheck(true)}
              disabled={isChecking}
              aria-label={labels.retryBtn}
              className="p-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title={labels.retryBtn}
            >
              <svg className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setIsMinimized(false)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
            >
              {labels.expandBtn}
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // -------------------------------------------------------------
  // 3. SLOW CONNECTION BANNER (Non-blocking notification)
  // -------------------------------------------------------------
  if (networkStatus === 'slow') {
    return (
      <aside aria-label={labels.slowTitle} className="fixed top-20 left-1/2 -translate-x-1/2 z-[9990] w-[94%] max-w-xl">
        <div className="rounded-2xl bg-amber-500/95 dark:bg-amber-600/95 backdrop-blur-md text-white p-3.5 sm:p-4 shadow-xl border border-amber-400/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-white shadow-md flex-shrink-0 flex items-center justify-center border border-amber-300">
              <video
                src="/disconnect.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover scale-110"
              />
              <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold">{labels.slowTitle}</h4>
                {pingStats.latencyMs && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-amber-100">
                    {pingStats.latencyMs} {labels.ms}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-100 leading-snug mt-0.5">{labels.slowDesc}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => performCheck(true)}
              disabled={isChecking}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isChecking ? labels.checking : labels.retryBtn}</span>
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-white/80 hover:text-white rounded-lg transition"
              aria-label={labels.close}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // -------------------------------------------------------------
  // 4. FULL OFFLINE OVERLAY WITH ANIMATION (disconnect.mp4)
  // -------------------------------------------------------------
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-dialog-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-surface border border-line shadow-2xl p-6 sm:p-8 text-center overflow-hidden my-auto transition-all">
        {/* Glowing Decorative Background Waves */}
        <div className="absolute -top-28 -left-28 w-80 h-80 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -right-28 w-80 h-80 rounded-full bg-red-500/15 blur-3xl pointer-events-none" />

        {/* Top Header Bar inside dialog */}
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>{labels.offlineModeBadge}</span>
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="flex items-center gap-1 text-xs text-subtle hover:text-content px-2.5 py-1 rounded-lg hover:bg-surface-2 transition"
            title={labels.minimizeBtn}
          >
            <span>{labels.minimizeBtn}</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* CENTRAL HERO: disconnect.mp4 with Radar Ripple Waves */}
        <div className="relative mx-auto my-4 flex items-center justify-center">
          {/* Concentric Radar Pulsing Rings */}
          <div className="absolute w-56 h-56 rounded-full border-2 border-red-500/20 animate-ping pointer-events-none" style={{ animationDuration: '2.5s' }} />
          <div className="absolute w-44 h-44 rounded-full border border-blue-500/30 animate-pulse pointer-events-none" />
          <div className="absolute w-36 h-36 rounded-full bg-red-500/5 blur-sm pointer-events-none" />

          {/* Video Container Frame */}
          <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden bg-white shadow-2xl border-4 border-surface ring-4 ring-red-500/25 flex items-center justify-center group">
            <video
              ref={videoRef}
              src="/disconnect.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              onLoadedData={() => setVideoLoaded(true)}
              onError={() => setVideoError(true)}
              className={`w-full h-full object-cover scale-110 transition-all duration-700 group-hover:scale-125 ${
                videoLoaded ? 'opacity-100' : 'opacity-90'
              }`}
            />
            {/* Fallback in case browser blocks video or error */}
            {videoError && (
              <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-700">
                <svg className="w-16 h-16 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-2.829-2.829m0 0L3 21m2.828-2.828l2.829-2.829M8.464 8.464a5 5 0 017.072 0M3 3l18 18" />
                </svg>
              </div>
            )}
            {/* Subtle gloss reflection overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/40 pointer-events-none" />
          </div>
        </div>

        {/* Informative Text */}
        <h3 id="offline-dialog-title" className="text-xl sm:text-2xl font-extrabold text-content mt-3 tracking-tight">
          {labels.offlineTitle}
        </h3>
        <p className="text-sm text-muted max-w-md mx-auto mt-2 leading-relaxed">
          {labels.offlineDesc}
        </p>

        {/* Live Status Badge */}
        <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2 border border-line text-xs font-mono text-subtle">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>Wi-Fi / Mobil aloqa uzilgan</span>
          {pingStats.lastChecked && (
            <span className="text-[10px] opacity-70">
              • {pingStats.lastChecked.toLocaleTimeString()}
            </span>
          )}
        </div>

        <p className="text-[11px] text-subtle mt-2 italic">
          {labels.autoReconnectNotice}
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => performCheck(true)}
            disabled={isChecking}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-brand hover:bg-brand-hover active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-brand/25 transition disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{isChecking ? labels.checking : labels.retryBtn}</span>
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-surface-2 hover:bg-surface-3 text-content font-semibold text-sm border border-line transition"
          >
            {labels.minimizeBtn}
          </button>
        </div>

        {/* Easter Egg Feature: Offline Mini-Game */}
        <div className="mt-6 pt-5 border-t border-line">
          {!showGame ? (
            <button
              onClick={() => setShowGame(true)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-brand hover:text-brand-hover transition"
            >
              <span>{labels.playGameBtn}</span>
            </button>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-2 px-1">
                <span className="text-xs font-semibold text-content">Uyiz Runner 🏠</span>
                <button
                  onClick={() => setShowGame(false)}
                  className="text-xs text-subtle hover:text-content underline"
                >
                  {labels.hideGameBtn}
                </button>
              </div>
              <OfflineMiniGame />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Super lightweight, fun canvas runner mini-game for offline entertainment
 */
const OfflineMiniGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const gameStateRef = useRef({
    playerY: 100,
    velocity: 0,
    gravity: 0.6,
    jumpStrength: -9.5,
    isGrounded: true,
    obstacles: [] as { x: number; width: number; height: number }[],
    score: 0,
    isRunning: true,
  });

  const jump = useCallback(() => {
    const state = gameStateRef.current;
    if (gameOver) {
      state.playerY = 100;
      state.velocity = 0;
      state.obstacles = [{ x: 300, width: 18, height: 28 }];
      state.score = 0;
      state.isRunning = true;
      setScore(0);
      setGameOver(false);
      return;
    }
    if (state.isGrounded) {
      state.velocity = state.jumpStrength;
      state.isGrounded = false;
    }
  }, [gameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const groundY = 110;
    const state = gameStateRef.current;
    state.obstacles = [{ x: 320, width: 16, height: 28 }];
    state.isRunning = true;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    let animationFrameId: number;

    const loop = () => {
      if (!state.isRunning) return;

      state.velocity += state.gravity;
      state.playerY += state.velocity;
      if (state.playerY >= groundY - 20) {
        state.playerY = groundY - 20;
        state.velocity = 0;
        state.isGrounded = true;
      }

      for (let i = 0; i < state.obstacles.length; i++) {
        state.obstacles[i].x -= 3.2;
      }

      if (state.obstacles.length > 0 && state.obstacles[0].x < -20) {
        state.obstacles.shift();
        state.score += 1;
        setScore(state.score);
      }

      const lastObs = state.obstacles[state.obstacles.length - 1];
      if (!lastObs || lastObs.x < 180 + Math.random() * 80) {
        state.obstacles.push({
          x: 320,
          width: 14 + Math.random() * 8,
          height: 22 + Math.random() * 15,
        });
      }

      const playerBox = { x: 30, y: state.playerY, width: 20, height: 20 };
      for (const obs of state.obstacles) {
        const obsBox = { x: obs.x, y: groundY - obs.height, width: obs.width, height: obs.height };
        if (
          playerBox.x < obsBox.x + obsBox.width &&
          playerBox.x + playerBox.width > obsBox.x &&
          playerBox.y < obsBox.y + obsBox.height &&
          playerBox.y + playerBox.height > obsBox.y
        ) {
          state.isRunning = false;
          setGameOver(true);
          setHighScore((prev) => Math.max(prev, state.score));
          break;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Ground
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(canvas.width, groundY);
      ctx.stroke();

      // Draw Player House
      ctx.fillStyle = '#1447e6';
      ctx.beginPath();
      ctx.roundRect(playerBox.x, playerBox.y, playerBox.width, playerBox.height, 4);
      ctx.fill();

      // House roof
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(playerBox.x - 2, playerBox.y);
      ctx.lineTo(playerBox.x + playerBox.width / 2, playerBox.y - 8);
      ctx.lineTo(playerBox.x + playerBox.width + 2, playerBox.y);
      ctx.closePath();
      ctx.fill();

      // Draw Obstacles
      ctx.fillStyle = '#ef4444';
      for (const obs of state.obstacles) {
        ctx.beginPath();
        ctx.roundRect(obs.x, groundY - obs.height, obs.width, obs.height, 3);
        ctx.fill();
      }

      if (state.isRunning) {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, [jump]);

  return (
    <div
      onClick={jump}
      className="relative w-full max-w-xs mx-auto bg-surface-2 rounded-2xl p-2 border border-line cursor-pointer select-none overflow-hidden"
    >
      <div className="flex justify-between items-center px-2 py-1 text-[11px] font-mono text-muted">
        <span>Ball: {score}</span>
        <span>Rekord: {highScore}</span>
      </div>

      <canvas
        ref={canvasRef}
        width={300}
        height={130}
        className="w-full h-auto block rounded-lg bg-surface"
      />

      {gameOver && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center text-white rounded-2xl">
          <p className="text-xs font-bold">O'yin tugadi!</p>
          <span className="text-[10px] mt-1 text-slate-200">Qayta boshlash uchun bosing</span>
        </div>
      )}

      <div className="text-[10px] text-center text-subtle mt-1.5">
        Sakrash uchun ekranga yoki probelga bosing
      </div>
    </div>
  );
};

export default OfflineDetector;
