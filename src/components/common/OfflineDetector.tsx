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
  const [isChecking, setIsChecking] = useState(false);
  const [pingStats, setPingStats] = useState<PingStats>({ latencyMs: null, lastChecked: null });
  const [justReconnected, setJustReconnected] = useState(false);
  const pingAbortControllerRef = useRef<AbortController | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const tNet = {
    uz: {
      offlineTitle: "Internet aloqasi uzildi",
      offlineDesc: "Wi-Fi yoki mobil internetni tekshiring",
      slowTitle: "Internet juda sust",
      slowDesc: "Sahifalar sekin yuklanishi mumkin",
      reconnectedTitle: "Aloqa tiklandi!",
      retryBtn: "Qayta tekshirish",
      checking: "...",
      ms: "ms",
    },
    ru: {
      offlineTitle: "Нет интернета",
      offlineDesc: "Проверьте Wi-Fi или мобильные данные",
      slowTitle: "Медленный интернет",
      slowDesc: "Страницы могут открываться дольше",
      reconnectedTitle: "Интернет восстановлен!",
      retryBtn: "Повторить",
      checking: "...",
      ms: "мс",
    },
    en: {
      offlineTitle: "No Internet Connection",
      offlineDesc: "Check your Wi-Fi or mobile network",
      slowTitle: "Slow Connection",
      slowDesc: "Pages may take longer to load",
      reconnectedTitle: "Back Online!",
      retryBtn: "Retry",
      checking: "...",
      ms: "ms",
    }
  };

  const currentLang = (language === 'ru' ? 'ru' : language === 'en' ? 'en' : 'uz') as 'uz' | 'ru' | 'en';
  const labels = tNet[currentLang] || tNet.uz;

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
        setIsDismissed(false);
        setTimeout(() => setJustReconnected(false), 3000);
      }
      return result.status;
    });
  }, [checkConnectivity]);

  useEffect(() => {
    const handleOnline = () => performCheck(true);
    const handleOffline = () => {
      setNetworkStatus('offline');
      setIsDismissed(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const timer = setTimeout(() => {
      performCheck(false);
    }, 1500);

    const interval = setInterval(() => {
      performCheck(false);
    }, networkStatus === 'online' ? 30000 : 7000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      if (pingAbortControllerRef.current) pingAbortControllerRef.current.abort();
    };
  }, [networkStatus, performCheck]);

  useEffect(() => {
    if (videoRef.current && (networkStatus === 'offline' || networkStatus === 'slow')) {
      videoRef.current.play().catch(() => {});
    }
  }, [networkStatus]);

  if (networkStatus === 'online' && !justReconnected) return null;
  if (isDismissed && !justReconnected) return null;

  // 1. Aloqa tiklanganda (Success Banner)
  if (justReconnected) {
    return (
      <aside aria-label="Tarmoq holati" className="fixed top-4 right-4 sm:top-5 sm:right-6 z-[9999] max-w-sm w-[90%] sm:w-auto animate-bounce">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white shadow-xl border border-emerald-400/40 backdrop-blur-md">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h4 className="text-xs font-bold leading-tight">{labels.reconnectedTitle}</h4>
          </div>
        </div>
      </aside>
    );
  }

  // 2. Internet yo'q (Offline) yoki Sekin (Slow) - Ixcham, saytni to'smaydigan nafis card
  const isOffline = networkStatus === 'offline';

  return (
    <aside
      aria-label="Tarmoq holati"
      className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-[9999] max-w-sm w-[94%] sm:w-auto pointer-events-auto"
    >
      <div
        className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all ${
          isOffline
            ? 'bg-slate-900/95 text-white border-red-500/40 shadow-red-500/10'
            : 'bg-amber-500/95 text-white border-amber-400/40 shadow-amber-500/10'
        }`}
      >
        {/* disconnect.mp4 video ikonkasi */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center flex-shrink-0 border-2 border-red-500/60 shadow-md">
            <video
              ref={videoRef}
              src="/disconnect.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover scale-125"
            />
            <span
              className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full ring-1 ring-white ${
                isOffline ? 'bg-red-500 animate-ping' : 'bg-amber-400'
              }`}
            />
          </div>

          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold truncate">
                {isOffline ? labels.offlineTitle : labels.slowTitle}
              </h4>
              {pingStats.latencyMs && !isOffline && (
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/20 text-amber-100">
                  {pingStats.latencyMs}{labels.ms}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 dark:text-slate-300 truncate mt-0.5">
              {isOffline ? labels.offlineDesc : labels.slowDesc}
            </p>
          </div>
        </div>

        {/* Tugmalar: Qayta tekshirish va Yopish */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => performCheck(true)}
            disabled={isChecking}
            title={labels.retryBtn}
            className="p-1.5 text-xs font-semibold rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`}
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
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition"
            aria-label="Yopish"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default OfflineDetector;
