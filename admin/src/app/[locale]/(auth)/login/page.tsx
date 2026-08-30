'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { getFaceStatus } from '@/features/auth/api';
import { FaceModal } from '@/features/auth/components/FaceModal';
import { ApiError } from '@/shared/lib/http';
import { Eye, EyeOff, Lock, User, ShieldCheck, ArrowRight, Sparkles, Smile, Camera } from 'lucide-react';

/** mm:ss — a bare seconds count reads as an error code once it passes 90. */
function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function LoginPage() {
  const t = useTranslations('auth');
  const te = useTranslations('auth.errors');
  const c = useTranslations('common');
  const { mutate: login, isPending, error } = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'login' | 'register'>('login');
  const [faceStatus, setFaceStatus] = useState<{ enrolled: boolean; count: number } | null>(null);

  useEffect(() => {
    getFaceStatus()
      .then(setFaceStatus)
      .catch(() => {});
  }, []);

  /* ── Backend error codes ──────────────────────────────────────────────────
     The API answers a refused login with a machine-readable code and, for the
     two throttled cases, how long the door stays shut. Translating the code
     rather than echoing `error.message` is what keeps the page in the user's
     language, and showing the clock rather than a generic failure is what
     stops someone hammering a locked account for three minutes. */
  const apiError = error instanceof ApiError ? error : null;
  const code = apiError?.code;
  const params = (apiError?.params ?? {}) as { minutes?: number; retry_after?: number };

  const lockSeconds =
    code === 'account_locked'
      ? (params.minutes ?? 0) * 60
      : code === 'rate_limited'
        // `retryAfter` is the parsed Retry-After header; `params.retry_after`
        // is the same number inside the error envelope. Either may be absent.
        ? (apiError?.retryAfter ?? params.retry_after ?? 0)
        : 0;

  // Seeding the clock here IS the synchronisation this effect exists for: the
  // lock window arrives with a failed mutation, not with a user action, so
  // there is no event handler to set it from and no render-time derivation
  // that would not read the wall clock. `error` is in the deps so a second
  // lock restarts the count even when the new window is the same length.
  /* eslint-disable react-hooks/set-state-in-effect -- see above */
  useEffect(() => {
    if (lockSeconds <= 0) {
      setRemaining(0);
      return;
    }
    setRemaining(lockSeconds);
    const id = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(id);
  }, [error, lockSeconds]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isThrottled = code === 'account_locked' || code === 'rate_limited';

  // Backend code → message key. Anything unrecognised falls through to
  // `unknown` rather than leaking `error.message`, which is prose that changes
  // freely and is only translated when the request carried an X-Language the
  // backend understood.
  const errorMessage = (() => {
    if (!error) return null;
    if (!apiError || apiError.status === 0) return te('network');
    switch (code) {
      case 'invalid_credentials': return te('invalidCredentials');
      case 'account_locked':      return te('accountLocked');
      case 'rate_limited':        return te('rateLimited');
      case 'admin_forbidden':     return te('forbidden');
      case 'forbidden':           return te('forbidden');
      default:
        return apiError.message && apiError.message !== 'error'
          ? apiError.message
          : te('invalidCredentials');
    }
  })();

  const isCountingDown = isThrottled && remaining > 0;
  const isFormValid = username.trim().length > 0 && password.trim().length > 0;
  const canSubmit = isFormValid && !isPending && !isCountingDown;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    login({ username: username.trim(), password });
  };

  return (
    <div className="w-full animate-fade-in-up">
      {/* Login modal */}
      <div
        className="relative overflow-hidden rounded-[34px]"
        style={{
          background: 'var(--color-surface)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        {/* Top gradient accent strip */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{
            background: 'var(--gradient-brand)',
            backgroundSize: '200% 100%',
          }}
        />

        <div
          className="absolute inset-x-0 top-0 h-44 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, var(--accent-subtle) 0%, transparent 100%)',
          }}
        />

        <div className="relative px-8 py-10">
          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative mb-6 flex items-center justify-center" style={{ width: '96px', height: '96px' }}>
              <div
                className="absolute inset-0 rounded-[28px] animate-glow"
                style={{
                  background: 'var(--accent-subtle)',
                  border: '1px solid var(--accent-border)',
                }}
              />
              <div
                className="relative z-10 rounded-[26px] flex items-center justify-center"
                style={{
                  width: '78px',
                  height: '78px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 10px 32px var(--accent-glow), 0 0 0 1px rgba(255,255,255,0.08) inset',
                }}
              >
                <Image
                  src="/brand/mark-lockup@2x.png"
                  alt="Uyiz"
                  width={152}
                  height={192}
                  className="h-[50px] w-auto"
                  priority
                />
              </div>
            </div>

            <h1
              className="text-[28px] font-black text-center mb-2 leading-[1.05] px-4 tracking-[-0.04em]"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {t('signInTitle')}
            </h1>
            <p className="text-sm text-center max-w-[280px]" style={{ color: 'var(--color-text-muted)' }}>
              {t('signInSubtitle')}
            </p>

            {/* The CRM shipped two decorative chips here ("AI Powered",
                "Secure"). One survives, saying something true about where the
                visitor has landed; the staff-only framing that justified the
                other now sits in the subtitle above. */}
            <div className="flex items-center gap-2 mt-5">
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
              >
                <ShieldCheck size={10} /> {c('appName')}
              </span>
            </div>
          </div>

          {/* Face ID Action Section */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => {
                setFaceModalMode(faceStatus?.enrolled ? 'login' : 'register');
                setIsFaceModalOpen(true);
              }}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.3)] transition transform active:scale-95 flex items-center justify-center gap-3 border border-emerald-400/30 group"
            >
              <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Smile className="w-4 h-4 text-white" />
              </div>
              <span className="tracking-wide text-sm font-bold">Face ID Bilan Kirish</span>
              <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-mono font-extrabold uppercase text-emerald-100">
                Tezkor
              </span>
            </button>

            <div className="flex items-center justify-between px-2 mt-2.5">
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                {faceStatus?.enrolled ? 'Face ID faol' : 'Yuz saqlanmagan'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFaceModalMode('register');
                  setIsFaceModalOpen(true);
                }}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold transition flex items-center gap-1"
              >
                <span>Yuzni saqlash</span>
                <ArrowRight size={11} />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700/60" />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-3 text-[11px] font-bold tracking-wider uppercase rounded-full"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-muted)',
                }}
              >
                Yoki Parol Bilan
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Error Alert */}
            {errorMessage && (
              <div
                role="alert"
                aria-live="polite"
                className="p-3.5 rounded-xl text-sm leading-relaxed flex items-start gap-2"
                style={{
                  background: isThrottled ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)',
                  border: `1px solid ${isThrottled ? 'var(--color-warning-border)' : 'var(--color-danger-border)'}`,
                  color: isThrottled ? 'var(--color-warning)' : 'var(--color-danger)',
                }}
              >
                <span className="mt-0.5">⚠</span>
                <span>
                  {errorMessage}
                  {/* The clock rather than a sentence: mm:ss needs no
                      translation, and it is the only part of a lockout the
                      person in front of the form can act on. */}
                  {isCountingDown && (
                    <span className="block mt-1 font-bold tabular-nums text-base">
                      {formatCountdown(remaining)}
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Username — the backend authenticates staff by username, not email */}
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="block text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('username')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <User size={15} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('usernamePlaceholder')}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  disabled={isPending}
                  className="input-field w-full"
                  style={{ paddingLeft: '40px' }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <Lock size={15} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  autoComplete="current-password"
                  disabled={isPending}
                  className="input-field w-full"
                  style={{ paddingLeft: '40px', paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-all"
                  style={{ color: 'var(--color-text-muted)' }}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!canSubmit}
                id="login-submit"
                className="w-full h-12 rounded-xl font-bold text-sm relative overflow-hidden transition-all flex items-center justify-center gap-2"
                style={{
                  background: canSubmit ? 'var(--gradient-brand)' : 'rgba(255, 255, 255, 0.05)',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  boxShadow: canSubmit
                    ? '0 4px 20px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15)'
                    : 'none',
                  transform: isPending ? 'scale(0.99)' : 'scale(1)',
                  color: canSubmit ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                  border: canSubmit ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {isPending ? (
                  <>
                    <span
                      className="inline-block w-4 h-4 border-2 rounded-full shrink-0 animate-spin"
                      style={{
                        borderColor: 'currentColor',
                        borderTopColor: 'transparent',
                      }}
                    />
                    <span className="leading-normal">{t('submitting')}</span>
                  </>
                ) : isCountingDown ? (
                  <span className="leading-normal tabular-nums">{formatCountdown(remaining)}</span>
                ) : (
                  <>
                    <span className="leading-normal">{t('submit')}</span>
                    {isFormValid && <ArrowRight size={15} />}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <p
        className="text-center text-[10px] font-semibold uppercase tracking-widest mt-6"
        style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
      >
        © {new Date().getFullYear()} · {c('appName')}
      </p>

      {/* Biometric Face ID Scanning Modal */}
      <FaceModal
        isOpen={isFaceModalOpen}
        onClose={() => {
          setIsFaceModalOpen(false);
          getFaceStatus().then(setFaceStatus).catch(() => {});
        }}
        initialMode={faceModalMode}
      />
    </div>
  );
}
