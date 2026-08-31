'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { getFaceStatus, verifyCredentials, type FaceStatus } from '@/features/auth/api';
import { FaceModal } from '@/features/auth/components/FaceModal';
import { ApiError } from '@/shared/lib/http';
import { Eye, EyeOff, Lock, User, ShieldCheck, ArrowRight, Sparkles, Camera } from 'lucide-react';

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
  const { isPending, error } = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'login' | 'register'>('login');
  const [faceStatus, setFaceStatus] = useState<FaceStatus | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  useEffect(() => {
    if (lockSeconds <= 0) {
      setRemaining(0);
      return;
    }
    setRemaining(lockSeconds);
    const id = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(id);
  }, [error, lockSeconds]);

  const isThrottled = code === 'account_locked' || code === 'rate_limited';

  const errorMessage = (() => {
    if (authError) return authError;
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
  const isSubmitting = isPending || isValidating;
  const canSubmit = isFormValid && !isSubmitting && !isCountingDown;

  const cleanUsername = username.trim();
  const selectedAdmin = faceStatus?.admins?.find(
    (a) =>
      a.username.toLowerCase() === cleanUsername.toLowerCase() ||
      a.username.toLowerCase() === cleanUsername.toLowerCase().replace(/^@/, '')
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setAuthError(null);
    setIsValidating(true);

    try {
      // 1. Validate login and password directly in database first!
      const check = await verifyCredentials({
        username: cleanUsername,
        password,
      });

      // 2. Only if credentials match database, open Face ID scanner!
      if (check.hasFace) {
        setFaceModalMode('login');
      } else {
        setFaceModalMode('register');
      }
      setIsFaceModalOpen(true);
    } catch (err: unknown) {
      console.error('Credential verification error:', err);
      const errObj = err as { code?: string; message?: string };
      const rawCode = errObj.code || errObj.message || '';
      if (rawCode.includes('invalid_credentials')) {
        setAuthError('Login yoki parol noto\'g\'ri kiritildi.');
      } else if (rawCode.includes('account_locked')) {
        setAuthError('Ushbu hisob vaqtincha bloklangan.');
      } else if (rawCode.includes('network') || rawCode.includes('Failed to fetch')) {
        setAuthError('Serverga ulanib bo\'lmadi. Qaytadan urinib ko\'ring.');
      } else {
        setAuthError('Login yoki parol noto\'g\'ri kiritildi.');
      }
    } finally {
      setIsValidating(false);
    }
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
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-5 flex items-center justify-center" style={{ width: '90px', height: '90px' }}>
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
                  width: '74px',
                  height: '74px',
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
                  className="h-[46px] w-auto"
                  priority
                />
              </div>
            </div>

            <h1
              className="text-[26px] font-black text-center mb-1.5 leading-[1.05] px-4 tracking-[-0.04em]"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {t('signInTitle')}
            </h1>
            <p className="text-xs text-center max-w-[280px]" style={{ color: 'var(--color-text-muted)' }}>
              {t('signInSubtitle')}
            </p>

            <div className="flex items-center gap-2 mt-4">
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
              >
                <ShieldCheck size={10} /> {c('appName')} Admin
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
                  {isCountingDown && (
                    <span className="block mt-1 font-bold tabular-nums text-base">
                      {formatCountdown(remaining)}
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="username"
                  className="block text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {t('username')}
                </label>
                {selectedAdmin?.hasFace && (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <Sparkles size={10} /> Face ID mavjud
                  </span>
                )}
              </div>
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
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-all cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 space-y-2.5">
              <button
                type="submit"
                disabled={!canSubmit}
                id="login-submit"
                className="w-full h-12 rounded-xl font-bold text-sm relative overflow-hidden transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                {isSubmitting ? (
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
                    <Camera size={16} />
                    <span className="leading-normal">
                      {selectedAdmin?.hasFace
                        ? 'Yuzni Tasdiqlash & Kirish'
                        : 'Face ID O\'rnatish & Kirish'}
                    </span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center pt-1.5">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Face ID biometrik tasdiqlash majburiy</span>
                </span>
              </div>
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

      {/* Biometric Face ID Verification Modal */}
      <FaceModal
        isOpen={isFaceModalOpen}
        onClose={() => {
          setIsFaceModalOpen(false);
          getFaceStatus().then(setFaceStatus).catch(() => {});
        }}
        initialMode={faceModalMode}
        initialAdminUsername={cleanUsername || undefined}
        initialPassword={password || undefined}
      />
    </div>
  );
}
