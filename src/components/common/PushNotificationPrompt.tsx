import React, { useState, useEffect } from 'react';
import { Bell, X, Sparkles, Check } from 'lucide-react';
import { notificationService } from '../../services/notificationService';

export const PushNotificationPrompt: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only check in browser
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    // If permission already granted or denied, don't show prompt
    if (Notification.permission !== 'default') {
      return;
    }

    // Check if user recently dismissed (within 48 hours)
    try {
      const dismissedAt = localStorage.getItem('uyiz_push_prompt_dismissed');
      if (dismissedAt) {
        const diffHours = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60);
        if (diffHours < 48) {
          return;
        }
      }
    } catch {}

    // Polite delay: wait 6 seconds after page load before showing
    const timer = setTimeout(() => {
      setVisible(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem('uyiz_push_prompt_dismissed', Date.now().toString());
    } catch {}
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const ok = await notificationService.requestPermissionAndSubscribe();
      if (ok) {
        setSubscribed(true);
        setTimeout(() => {
          setVisible(false);
        }, 2500);
      } else {
        handleDismiss();
      }
    } catch {
      handleDismiss();
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:max-w-sm z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="relative overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-100 dark:border-slate-800 shadow-2xl rounded-2xl p-4 text-slate-800 dark:text-slate-100">
        {/* Glow effect */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition"
          aria-label="Yopish"
        >
          <X className="w-4 h-4" />
        </button>

        {subscribed ? (
          <div className="flex items-center gap-3 py-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Rahmat! Bildirishnomalar yoqildi
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Yangi arzon eʼlonlar haqida sizga xabar yuborib turamiz.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full" />
              </div>
              <div className="pr-5">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Yangi arzon uylarni oʻtkazib yubormang!
                  </h4>
                  <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Saytga kirmagan paytingizda ham metro va arzon kvartiralar haqida xabar berib turamiz.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={loading}
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                {loading ? 'Ulanmoqda...' : 'Xabardor boʻlish'}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-xl transition"
              >
                Keyinroq
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
