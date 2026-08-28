'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { Moon, Palette, Sun } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { PublicSettings } from '@/shared/api/types';
import { useAuthStore } from '@/store/auth.store';
import { useRole } from '@/providers/role-provider';
import { useTheme, useLocale as useLocaleSwitcher } from '@/providers';
import { useLogout } from '@/features/auth/hooks';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Avatar } from '@/shared/ui/Avatar';

const ThemePalette = dynamic(
  () => import('@/features/dashboard/components/ThemePalette').then((mod) => mod.ThemePalette),
  { ssr: false },
);

/**
 * Panel and platform settings.
 *
 * There is no `PATCH /admin/auth/me` on this backend — a staff account is
 * edited by a SUPERADMIN through the staff routes, never by its owner — so the
 * account block below is read-only by contract, not by omission. The page this
 * one replaces shipped a "save profile" form against an endpoint that does not
 * exist.
 */

const LOCALES = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
] as const;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const c = useTranslations('common');
  // The on/off words for monetization live in the `dashboard` namespace, beside
  // the toggle that owns them, so the two screens can never disagree on what
  // "enabled" is called.
  const d = useTranslations('dashboard');
  const staffT = useTranslations('staff');

  const activeLocale = useLocale();
  const { setLocale } = useLocaleSwitcher();
  const { theme, toggleTheme } = useTheme();
  const { role } = useRole();
  const admin = useAuthStore((s) => s.admin);
  const logout = useLogout();

  const [paletteOpen, setPaletteOpen] = useState(false);

  const dateTimeFormat = useMemo(
    () => new Intl.DateTimeFormat(activeLocale, { dateStyle: 'medium', timeStyle: 'short' }),
    [activeLocale],
  );

  /** Public, unauthenticated, un-enveloped, snake_case — the one API outlier. */
  const monetization = useQuery({
    queryKey: ['public-settings'],
    queryFn: ({ signal }) =>
      http.raw.get<PublicSettings>(api.settings.publicRead, { signal, skipAuth: true }),
  });

  const monetizationOn = monetization.data?.is_monetization_enabled === true;

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Monetization ────────────────────────────────────────────────
            Read-only here on purpose. The toggle is a SUPERADMIN action and it
            lives on the dashboard, next to the counters it changes; two buttons
            for one switch is how the two screens drift apart. */}
        <section className="card p-5">
          <div className="flex items-center gap-2.5 mb-1.5">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {t('monetization')}
            </h2>
            {!monetization.isLoading && (
              <StatusPill
                status={monetizationOn ? 'ACTIVE' : 'ARCHIVED'}
                label={monetizationOn ? d('monetizationOn') : d('monetizationOff')}
              />
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('monetizationDescription')}
          </p>
        </section>

        {/* ── Appearance ─────────────────────────────────────────────────── */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            {t('appearance')}
          </h2>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Button
              variant="secondary"
              size="sm"
              icon={theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              onClick={(e) => toggleTheme(e)}
            >
              {t('theme')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Palette size={14} />}
              onClick={() => setPaletteOpen(true)}
            >
              {t('accent')}
            </Button>
          </div>

          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {[t('accent'), t('radius'), t('font'), t('wallpaper')].join(' · ')}
          </p>
        </section>

        {/* ── Language ───────────────────────────────────────────────────── */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            {t('language')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {LOCALES.map(({ code, label }) => (
              <Button
                key={code}
                size="sm"
                variant={activeLocale === code ? 'primary' : 'secondary'}
                onClick={() => setLocale(code)}
              >
                {label}
              </Button>
            ))}
          </div>
        </section>

        {/* ── Account ────────────────────────────────────────────────────── */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('account')}
          </h2>

          <div className="flex items-center gap-3 mb-4">
            <Avatar name={admin?.fullName || admin?.username} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {admin?.fullName || admin?.username || c('unknown')}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                {admin?.email ?? admin?.username ?? '—'}
                {role ? ` · ${staffT(`role.${role}` as Parameters<typeof staffT>[0])}` : ''}
              </p>
            </div>
          </div>

          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {staffT('columns.lastLogin')}:{' '}
            {admin?.lastLoginAt ? dateTimeFormat.format(new Date(admin.lastLoginAt)) : c('never')}
          </p>

          {/* Logout bumps the account's token_version server-side, which kills
              every access token it holds on every device — so this really is
              "sign out everywhere", not just "sign out here". */}
          <Button variant="danger" size="sm" onClick={() => void logout()}>
            {t('signOutAll')}
          </Button>
        </section>
      </div>

      {paletteOpen && <ThemePalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
