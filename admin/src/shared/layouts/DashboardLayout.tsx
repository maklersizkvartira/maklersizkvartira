'use client';

import { useState, useEffect, type ReactNode } from 'react';
// Locale-aware router: a session that expires under /ru must bounce to
// /ru/login, not drop the visitor into the default locale mid-task.
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useUIStore } from '@/store/ui.store';
import { useSession } from '@/features/auth/hooks';
import { Wordmark } from '@/shared/ui/Wordmark';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const c = useTranslations('common');
  const e = useTranslations('errors');
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const hydrateSidebar = useUIStore((s) => s.hydrateSidebar);

  // The refresh-cookie exchange and the /admin/auth/me call live in
  // useSession; this layout only decides what to paint for each outcome.
  const { status, retry } = useSession();

  /**
   * The theme palette is chrome state shared by two siblings — the header
   * renders the panel, and both the header and the sidebar offer the button.
   * It sits here, their nearest common parent, rather than in the UI store:
   * it is scoped to this shell and dies with it.
   */
  const [paletteOpen, setPaletteOpen] = useState(false);

  // The desktop rail's remembered width is read after mount, never during
  // render, so the server HTML and the first client pass cannot disagree.
  useEffect(() => {
    hydrateSidebar();
  }, [hydrateSidebar]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // 'unauthenticated' keeps the splash up while the redirect above runs —
  // flashing an empty shell on the way out is worse than a beat of loading.
  if (status !== 'authenticated') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[var(--color-surface)]">
        <div
          className="absolute inset-0 pointer-events-none opacity-80"
          style={{
            background:
              'radial-gradient(circle at 50% 40%, rgba(20,71,230,0.18) 0%, transparent 35%), radial-gradient(circle at 20% 20%, rgba(45,96,255,0.12) 0%, transparent 28%), radial-gradient(circle at 80% 80%, rgba(96,140,255,0.10) 0%, transparent 30%), var(--color-surface)',
          }}
        />

        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div
            className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(20,71,230,0.12) 0%, transparent 68%)',
              animation: 'pulse 3s ease-in-out infinite',
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--color-border)]"
            style={{
              animation: 'spin 14s linear infinite',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-in-up">
          <div className="relative flex items-center justify-center w-36 h-36">
            <div
              className="absolute inset-0 rounded-full border border-[var(--accent-border)]"
              style={{
                boxShadow: '0 0 40px rgba(20,71,230,0.08), inset 0 0 20px rgba(20,71,230,0.05)',
              }}
            />

            <div
              className="absolute inset-1 rounded-full border-2 border-transparent"
              style={{
                borderTopColor: 'var(--accent)',
                borderBottomColor: 'var(--accent)',
                opacity: 0.8,
                animation: 'spin 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
              }}
            />

            <div
              className="absolute inset-3 rounded-full border border-transparent"
              style={{
                borderLeftColor: 'var(--color-cyan-500)',
                borderRightColor: 'var(--color-cyan-500)',
                opacity: 0.6,
                animation: 'spin 2.2s linear infinite reverse',
              }}
            />

            <div
              className="absolute inset-5 rounded-full opacity-60"
              style={{
                background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />

            <div
              className="relative z-10 w-24 h-24 rounded-[28px] flex items-center justify-center border transition-all duration-500"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                borderColor: 'rgba(255,255,255,0.9)',
                boxShadow: '0 20px 40px rgba(20,71,230,0.12), 0 0 0 8px rgba(20,71,230,0.04), inset 0 -4px 8px rgba(0,0,0,0.04)',
                animation: 'pulse 3s ease-in-out infinite',
              }}
            >
              <Image
                src="/brand/mark-lockup@2x.png"
                alt="Uyiz"
                width={152}
                height={192}
                className="h-[66px] w-auto transition-transform duration-500 hover:scale-105"
                style={{
                  filter: 'drop-shadow(0 4px 10px rgba(20,71,230,0.15))',
                }}
                priority
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <h1 className="flex items-center">
              {/* The wordmark itself, not the name set in --font-heading: this
                  splash sat next to the mark and showed a different letterform
                  from the sidebar two pixels away. */}
              <Wordmark height={30} style={{ color: 'var(--color-text-primary)' }} />
              <span className="sr-only">Uyiz</span>
            </h1>

            {/* 'error' means the API never answered. There is nothing to wait
                for and nowhere to redirect to — /login bounces straight back
                here while the refresh cookie exists — so the splash turns into
                the one control that can get the admin out of it. */}
            {status === 'error' ? (
              <>
                <p
                  className="text-sm text-center max-w-[280px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {e('network')}
                </p>
                <button
                  onClick={retry}
                  className="px-4 h-10 text-sm font-semibold rounded-[var(--radius-md)] transition-all"
                  style={{
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {c('retry')}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.28em]"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Loading
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: 'var(--color-brand-500)',
                          animation: `bounce-dot 1s ease-in-out ${i * 0.16}s infinite`,
                          boxShadow: '0 0 12px var(--accent-glow)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div
                  className="mt-1 h-1.5 w-40 overflow-hidden rounded-full"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="h-full w-1/2 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, var(--color-brand-500), var(--color-cyan-500))',
                      animation: 'loading-bar 1.7s ease-in-out infinite',
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sidebar-shell"
      data-sidebar-collapsed={sidebarCollapsed}
      data-sidebar-mobile-open={sidebarOpen}
      style={{ minHeight: '100vh', background: 'var(--bg)' }}
    >
      <Sidebar paletteOpen={paletteOpen} onTogglePalette={() => setPaletteOpen((o) => !o)} />
      <Header
        paletteOpen={paletteOpen}
        onTogglePalette={() => setPaletteOpen((o) => !o)}
        onClosePalette={() => setPaletteOpen(false)}
      />
      <main
        style={{
          marginLeft: 'var(--sidebar-width)',
          paddingTop: 'var(--header-height)',
          minHeight: 'calc(100vh - var(--header-height))',
        }}
      >
        <div className="px-6 sm:px-10 lg:px-16 py-8 lg:py-12 max-w-[1600px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
