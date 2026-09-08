'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

type NetworkHealth = 'online' | 'slow' | 'offline';

export const OfflineDetector: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkHealth>('online');
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [pingStats, setPingStats] = useState<{ latencyMs: number | null }>({ latencyMs: null });
  const pingAbortControllerRef = useRef<AbortController | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
      const response = await fetch(`/brand/favicon.ico?_net_check=${Date.now()}`, {
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

    setPingStats({ latencyMs: result.latency });

    setNetworkStatus((current) => {
      if (current !== 'online' && result.status === 'online') {
        setJustReconnected(true);
        setIsMinimized(false);
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
      setIsMinimized(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const timer = setTimeout(() => {
      performCheck(false);
    }, 1000);

    const interval = setInterval(() => performCheck(false), networkStatus === 'online' ? 30000 : 8000);

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
  if (isDismissed && networkStatus === 'slow' && !justReconnected) return null;

  if (justReconnected) {
    return (
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] max-w-md w-[92%] sm:w-auto animate-bounce">
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-600 text-white shadow-2xl border border-emerald-400/40">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <h4 className="text-sm font-bold">Aloqa qayta tiklandi!</h4>
            <p className="text-xs text-emerald-100">Internet muvaffaqiyatli ulandi.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999]">
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/90 text-white shadow-2xl border border-slate-700 backdrop-blur-md">
          <div className="relative w-7 h-7 rounded-full overflow-hidden bg-white flex-shrink-0 border border-red-500">
            <video src="/disconnect.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover" />
          </div>
          <span className="text-xs font-medium text-slate-200">
            {networkStatus === 'offline' ? 'Oflayn rejim' : 'Sust aloqa'}
          </span>
          <button
            onClick={() => performCheck(true)}
            disabled={isChecking}
            className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800"
          >
            {isChecking ? '...' : 'Tekshirish'}
          </button>
          <button
            onClick={() => setIsMinimized(false)}
            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            Kengaytirish
          </button>
        </div>
      </div>
    );
  }

  if (networkStatus === 'slow') {
    return (
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] w-[94%] max-w-lg">
        <div className="rounded-2xl bg-amber-500/95 text-white p-3.5 shadow-xl border border-amber-400/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white flex-shrink-0">
              <video src="/disconnect.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Internet aloqasi sust</h4>
              <p className="text-xs text-amber-100">Boshqaruv paneli sekin ishlashi mumkin.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => performCheck(true)}
              disabled={isChecking}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white"
            >
              {isChecking ? '...' : 'Tekshirish'}
            </button>
            <button onClick={() => setIsDismissed(true)} className="p-1 text-white/80 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 text-center text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>Oflayn rejim</span>
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800"
          >
            Yig&lsquo;ish
          </button>
        </div>

        <div className="relative mx-auto my-4 flex items-center justify-center">
          <div className="absolute w-52 h-52 rounded-full border border-red-500/20 animate-ping pointer-events-none" />
          <div className="absolute w-40 h-40 rounded-full border border-blue-500/30 animate-pulse pointer-events-none" />
          <div className="relative w-40 h-40 rounded-full overflow-hidden bg-white shadow-2xl border-4 border-slate-800 ring-4 ring-red-500/25 flex items-center justify-center">
            <video
              ref={videoRef}
              src="/disconnect.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover scale-110"
            />
          </div>
        </div>

        <h3 className="text-xl font-bold mt-3">Internet bilan aloqa uzildi</h3>
        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-2">
          Qurilmangiz internetga ulanmagan. Iltimos, tarmoqni tekshiring.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => performCheck(true)}
            disabled={isChecking}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-lg text-white disabled:opacity-50 transition"
          >
            {isChecking ? 'Tekshirilmoqda...' : 'Qayta tekshirish'}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
          >
            Oflayn qolish
          </button>
        </div>
      </div>
    </div>
  );
};
export default OfflineDetector;
