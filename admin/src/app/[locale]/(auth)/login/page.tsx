'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { verifyCredentials } from '@/features/auth/api';
import { ApiError } from '@/shared/lib/http';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  Clock,
  AlertCircle,
} from 'lucide-react';

/** mm:ss — format seconds into countdown clock */
function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

type AuthStep = 'CREDENTIALS' | '2FA';

export default function LoginPage() {
  const t = useTranslations('auth');
  const te = useTranslations('auth.errors');
  const c = useTranslations('common');

  const { mutate: doLogin, isPending: isLoggingIn, error: loginError } = useLogin();

  const [step, setStep] = useState<AuthStep>('CREDENTIALS');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Credentials verification state
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);
  const [credsError, setCredsError] = useState<ApiError | Error | null>(null);
  const [ticked, setTicked] = useState(0);

  // 2FA state
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorTimer, setTwoFactorTimer] = useState(60);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [isResending2FA, setIsResending2FA] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);

  /* ── Credential error handling ─────────────────────────────────────────── */
  const activeError = credsError || loginError;
  const apiError = activeError instanceof ApiError ? activeError : null;
  const code = apiError?.code;
  const params = (apiError?.params ?? {}) as { minutes?: number; retry_after?: number };

  const lockSeconds =
    code === 'account_locked'
      ? (params.minutes ?? 0) * 60
      : code === 'rate_limited'
        ? (apiError?.retryAfter ?? params.retry_after ?? 0)
        : 0;

  useEffect(() => {
    if (lockSeconds <= 0) return;
    let deadline = 0;
    const id = setInterval(() => {
      if (!deadline) deadline = Date.now() + lockSeconds * 1000;
      setTicked(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [activeError, lockSeconds]);

  // 2FA Countdown timer (60 seconds)
  useEffect(() => {
    if (step !== '2FA' || twoFactorTimer <= 0) return;
    const interval = setInterval(() => {
      setTwoFactorTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, twoFactorTimer]);

  // Focus code input when transitioning to 2FA
  useEffect(() => {
    if (step === '2FA') {
      setTimeout(() => codeInputRef.current?.focus(), 150);
    }
  }, [step]);

  const remaining = lockSeconds > 0 ? ticked : 0;
  const isThrottled = code === 'account_locked' || code === 'rate_limited';
  const cleanUsername = username.trim();

  const errorMessage = (() => {
    if (!activeError) return null;
    if (!apiError || apiError.status === 0) return te('network');
    switch (code) {
      case 'invalid_credentials':
        return te('invalidCredentials');
      case 'account_locked':
        return te('accountLocked');
      case 'rate_limited':
        return te('rateLimited');
      case 'admin_forbidden':
        return te('forbidden');
      case 'forbidden':
        return te('forbidden');
      case 'session_not_stored':
        return te('sessionNotStored');
      default:
        return apiError.message && apiError.message !== 'error'
          ? apiError.message
          : te('invalidCredentials');
    }
  })();

  const isCountingDown = isThrottled && remaining > 0;
  const isCredsValid = cleanUsername.length > 0 && password.trim().length > 0;
  // isLoggingIn belongs here since step 1 can now sign in directly (see the 2FA skip below).
  const canSubmitCreds = isCredsValid && !isCheckingCredentials && !isCountingDown && !isLoggingIn;

  /* ── Step 1: Submit Credentials & Send 2FA ────────────────────────────── */
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitCreds) return;

    setIsCheckingCredentials(true);
    setCredsError(null);

    try {
      // 1. Verify credentials against the backend
      const check = await verifyCredentials({ username: cleanUsername, password });
      if (!check.valid) {
        throw new Error(te('invalidCredentials'));
      }

      // 2. Request 2FA code to be generated and sent via Telegram bot
      const sendRes = await fetch('/api/auth/2fa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername }),
      });
      const sendData = (await sendRes.json().catch(() => ({}))) as {
        ok?: boolean;
        sentToTelegram?: boolean;
        twoFactorRequired?: boolean;
        error?: string;
      };

      if (!sendData.ok) {
        throw new Error(sendData.error || '2FA kodini yuborishda xatolik yuz berdi');
      }

      // 2. Move to 2FA step (strictly required for admin authentication)
      setStep('2FA');
      setTwoFactorCode('');
      setTwoFactorError(null);
      setTwoFactorTimer(60);
    } catch (err: unknown) {
      if (err instanceof ApiError || err instanceof Error) {
        setCredsError(err);
      } else {
        setCredsError(new Error(String(err)));
      }
    } finally {
      setIsCheckingCredentials(false);
    }
  };

  /* ── Resend 2FA Code ──────────────────────────────────────────────────── */
  const handleResend2FA = async () => {
    if (isResending2FA || twoFactorTimer > 0) return;
    setIsResending2FA(true);
    setTwoFactorError(null);

    try {
      const res = await fetch('/api/auth/2fa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sentToTelegram?: boolean;
        twoFactorRequired?: boolean;
        error?: string;
      };

      if (!data.ok) {
        setTwoFactorError(data.error || 'Kodni qayta jo‘natishda xatolik yuz berdi');
      } else {
        setTwoFactorTimer(60);
        setTwoFactorCode('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTwoFactorError(msg);
    } finally {
      setIsResending2FA(false);
      codeInputRef.current?.focus();
    }
  };

  /* ── Step 2: Verify 2FA & Complete Sign-in ─────────────────────────────── */
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFactorCode.trim().length !== 6 || isVerifying2FA || isLoggingIn) return;

    setIsVerifying2FA(true);
    setTwoFactorError(null);

    try {
      const verifyRes = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, code: twoFactorCode.trim() }),
      });

      const verifyData = (await verifyRes.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!verifyData.ok) {
        setTwoFactorError(verifyData.message || 'Kiritilgan kod noto‘g‘ri yoki muddati o‘tgan.');
        setIsVerifying2FA(false);
        return;
      }

      // 2FA Verified! Now execute real login to retrieve tokens and enter dashboard
      doLogin({ username: cleanUsername, password });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTwoFactorError(msg);
      setIsVerifying2FA(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep('CREDENTIALS');
    setTwoFactorCode('');
    setTwoFactorError(null);
  };

  return (
    <div className="w-full animate-fade-in-up">
      {/* Login modal card */}
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
          <div className="flex flex-col items-center mb-7">
            <div
              className="relative mb-5 flex items-center justify-center"
              style={{ width: '90px', height: '90px' }}
            >
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
                {step === '2FA' ? (
                  <KeyRound className="h-9 w-9 text-brand animate-pulse" />
                ) : (
                  <Image
                    src="/brand/mark-lockup@2x.png"
                    alt="Uyiz"
                    width={152}
                    height={192}
                    className="h-[46px] w-auto"
                    priority
                  />
                )}
              </div>
            </div>

            <h1
              className="text-[24px] font-black text-center mb-1.5 leading-[1.1] px-4 tracking-[-0.03em]"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {step === '2FA' ? t('twoFactorTitle') : t('signInTitle')}
            </h1>
            <p
              className="text-xs text-center max-w-[300px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {step === '2FA' ? t('twoFactorSubtitle') : t('signInSubtitle')}
            </p>

            <div className="flex items-center gap-2 mt-3">
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold"
                style={{
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border)',
                }}
              >
                {step === '2FA' ? <KeyRound size={10} /> : <ShieldCheck size={10} />}
                {c('appName')} {step === '2FA' ? '2FA Xavfsizlik' : 'Admin'}
              </span>
            </div>
          </div>

          {/* STEP 1: Login & Password */}
          {step === 'CREDENTIALS' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4" noValidate>
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
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
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
                    disabled={isCheckingCredentials}
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
                    disabled={isCheckingCredentials}
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
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!canSubmitCreds}
                  id="login-submit"
                  className="w-full h-12 rounded-xl font-bold text-sm relative overflow-hidden transition-all flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    background: canSubmitCreds ? 'var(--gradient-brand)' : 'rgba(255, 255, 255, 0.05)',
                    cursor: canSubmitCreds ? 'pointer' : 'not-allowed',
                    boxShadow: canSubmitCreds
                      ? '0 4px 20px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15)'
                      : 'none',
                    transform: isCheckingCredentials ? 'scale(0.99)' : 'scale(1)',
                    color: canSubmitCreds ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                    border: canSubmitCreds ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {isCheckingCredentials || isLoggingIn ? (
                    <>
                      <span
                        className="inline-block w-4 h-4 border-2 rounded-full shrink-0 animate-spin"
                        style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
                      />
                      <span className="leading-normal">{t('submitting')}</span>
                    </>
                  ) : isCountingDown ? (
                    <span className="leading-normal tabular-nums">{formatCountdown(remaining)}</span>
                  ) : (
                    <>
                      <span className="leading-normal">{t('continue')}</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: 2FA Verification */}
          {step === '2FA' && (
            <form onSubmit={handle2FASubmit} className="space-y-4" noValidate>
              {/* 2FA Error Alert */}
              {twoFactorError && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="p-3.5 rounded-xl text-sm leading-relaxed flex items-start gap-2"
                  style={{
                    background: 'var(--color-danger-bg)',
                    border: '1px solid var(--color-danger-border)',
                    color: 'var(--color-danger)',
                  }}
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{twoFactorError}</span>
                </div>
              )}

              {/* 6-Digit Code Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="two-factor-code"
                    className="block text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {t('code')}
                  </label>
                  <span
                    className="flex items-center gap-1 text-xs font-semibold tabular-nums"
                    style={{
                      color: twoFactorTimer > 0 ? 'var(--accent)' : 'var(--color-danger)',
                    }}
                  >
                    <Clock size={12} />
                    {twoFactorTimer > 0 ? formatCountdown(twoFactorTimer) : t('codeExpired')}
                  </span>
                </div>

                <div className="relative">
                  <input
                    ref={codeInputRef}
                    id="two-factor-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTwoFactorCode(val);
                      if (twoFactorError) setTwoFactorError(null);
                    }}
                    placeholder="••••••"
                    disabled={isVerifying2FA || isLoggingIn}
                    className="input-field w-full text-center font-mono text-2xl font-black tracking-[0.4em]"
                    style={{
                      letterSpacing: '0.4em',
                      height: '56px',
                    }}
                  />
                </div>
              </div>

              {/* Resend button if 1 minute expired */}
              <div className="flex justify-between items-center pt-1">
                {twoFactorTimer <= 0 ? (
                  <button
                    type="button"
                    onClick={handleResend2FA}
                    disabled={isResending2FA}
                    className="flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    <RefreshCw size={12} className={isResending2FA ? 'animate-spin' : ''} />
                    {isResending2FA ? t('sendingCode') : t('resendCode')}
                  </button>
                ) : (
                  <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    Yangi kod {twoFactorTimer}s dan keyin so‘ralishi mumkin
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  disabled={twoFactorCode.trim().length !== 6 || isVerifying2FA || isLoggingIn}
                  id="two-factor-submit"
                  className="w-full h-12 rounded-xl font-bold text-sm relative overflow-hidden transition-all flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    background:
                      twoFactorCode.trim().length === 6 && !isVerifying2FA && !isLoggingIn
                        ? 'var(--gradient-brand)'
                        : 'rgba(255, 255, 255, 0.05)',
                    cursor:
                      twoFactorCode.trim().length === 6 && !isVerifying2FA && !isLoggingIn
                        ? 'pointer'
                        : 'not-allowed',
                    boxShadow:
                      twoFactorCode.trim().length === 6
                        ? '0 4px 20px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15)'
                        : 'none',
                    transform: isVerifying2FA || isLoggingIn ? 'scale(0.99)' : 'scale(1)',
                    color: twoFactorCode.trim().length === 6 ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                    border: twoFactorCode.trim().length === 6 ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {isVerifying2FA || isLoggingIn ? (
                    <>
                      <span
                        className="inline-block w-4 h-4 border-2 rounded-full shrink-0 animate-spin"
                        style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
                      />
                      <span className="leading-normal">{t('verifyingCode')}</span>
                    </>
                  ) : (
                    <>
                      <span className="leading-normal">{t('verifyAndLogin')}</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  disabled={isVerifying2FA || isLoggingIn}
                  className="w-full h-10 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:bg-surface-hover"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <ArrowLeft size={13} />
                  <span>{t('backToLogin')}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <p
        className="text-center text-[10px] font-semibold uppercase tracking-widest mt-6"
        style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
      >
        © {new Date().getFullYear()} · {c('appName')}
      </p>
    </div>
  );
}
