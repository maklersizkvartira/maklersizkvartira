'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { ApiError } from '@/shared/lib/http';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

/** mm:ss — format seconds into countdown clock */
function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function LoginPage() {
  const t = useTranslations('auth');
  const te = useTranslations('auth.errors');
  const c = useTranslations('common');

  const { mutate: doLogin, isPending: isLoggingIn, error: loginError } = useLogin();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ticked, setTicked] = useState(0);

  /* ── Error handling ─────────────────────────────────────────── */
  const apiError = loginError instanceof ApiError ? loginError : null;
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
  }, [loginError, lockSeconds]);

  const remaining = lockSeconds > 0 ? ticked : 0;
  const isThrottled = code === 'account_locked' || code === 'rate_limited';
  const cleanUsername = username.trim();

  const errorMessage = (() => {
    if (!loginError) return null;
    if (apiError && apiError.status === 0) return te('network');
    if (!apiError) return loginError.message || te('unknown');
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
  const canSubmit = isCredsValid && !isLoggingIn && !isCountingDown;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    doLogin({ username: cleanUsername, password });
  };

  return (
    <div className="w-full animate-fade-in-up">
      {/* Login modal card */}
      <div
        className="relative overflow-hidden rounded-[var(--radius-xl)]"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Top accent strip */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'var(--accent)' }} />

        <div className="relative px-8 py-10">
          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-7">
            <div
              className="relative mb-5 flex items-center justify-center rounded-[24px]"
              style={{
                width: '96px',
                height: '96px',
                background: 'var(--accent-subtle)',
                border: '1px solid var(--accent-border)',
              }}
            >
              <div
                className="relative z-10 rounded-[20px] flex items-center justify-center"
                style={{
                  width: '78px',
                  height: '78px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
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
              className="text-[28px] font-black text-center mb-1.5 leading-[1.1] px-4 tracking-[-0.04em]"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
            >
              {t('signInTitle')}
            </h1>
            <p
              className="text-sm text-center max-w-[300px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t('signInSubtitle')}
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
                <ShieldCheck size={10} />
                {c('appName')} Admin
              </span>
            </div>
          </div>

          {/* Login Form */}
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
                  disabled={isLoggingIn}
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
                  disabled={isLoggingIn}
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
                disabled={!canSubmit}
                id="login-submit"
                className="w-full h-12 rounded-xl font-bold text-sm relative overflow-hidden transition-all flex items-center justify-center gap-2 cursor-pointer"
                style={{
                  background: canSubmit ? 'var(--accent)' : 'var(--color-surface-3)',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  boxShadow: canSubmit ? '0 8px 20px -6px rgba(var(--accent-rgb), 0.45)' : 'none',
                  transform: isLoggingIn ? 'scale(0.99)' : 'scale(1)',
                  color: canSubmit ? '#ffffff' : 'var(--color-text-muted)',
                  border: canSubmit ? 'none' : '1px solid var(--color-border)',
                }}
              >
                {isLoggingIn ? (
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
                    <span className="leading-normal">{t('submit')}</span>
                    <ArrowRight size={15} />
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
    </div>
  );
}
