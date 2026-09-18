'use client';

import { useEffect, type ReactNode } from 'react';
// Locale-aware router: a session that expires under /ru must bounce to
// /ru/login, not drop the visitor into the default locale mid-task.
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useUIStore } from '@/store/ui.store';
import { useSession } from '@/features/auth/hooks';
import { BrandLoader } from '@/shared/ui/BrandLoader';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { SidebarMoveCoach } from './SidebarMoveCoach';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const c = useTranslations('common');
  const e = useTranslations('errors');
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarPosition = useUIStore((s) => s.sidebarPosition);
  const headerPosition = useUIStore((s) => s.headerPosition);
  const setSidebarPosition = useUIStore((s) => s.setSidebarPosition);
  const setHeaderPosition = useUIStore((s) => s.setHeaderPosition);
  const hydrateSidebar = useUIStore((s) => s.hydrateSidebar);

  // The refresh-cookie exchange and the /admin/auth/me call live in
  // useSession; this layout only decides what to paint for each outcome.
  const { status, retry } = useSession();

  // The desktop rail's remembered width and the drag-to-dock placement of the
  // sidebar/header are read after mount, never during render, so the server
  // HTML and the first client pass cannot disagree.
  useEffect(() => {
    hydrateSidebar();
    try {
      const savedSidebar = localStorage.getItem('sidebar-position');
      if (savedSidebar === 'left' || savedSidebar === 'right') setSidebarPosition(savedSidebar);
      const savedHeader = localStorage.getItem('header-position');
      if (savedHeader === 'top' || savedHeader === 'bottom') setHeaderPosition(savedHeader);
    } catch {
      // Private mode, or storage disabled: default placement.
    }
  }, [hydrateSidebar, setSidebarPosition, setHeaderPosition]);

  // `?reauth=1`, not a bare /login.
  //
  // We only reach here once the session has genuinely been refused, which
  // means the refresh cookie in the browser is stale — and the middleware
  // redirects /login to /dashboard for as long as that cookie exists. A bare
  // /login therefore bounced straight back here and the shell sat on its own
  // splash. `reauth` is the branch in the middleware that deletes the cookie
  // and then renders the form.
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?reauth=1');
  }, [status, router]);

  // 'unauthenticated' keeps the splash up while the redirect above runs —
  // flashing an empty shell on the way out is worse than a beat of loading.
  //
  // 'error' means the API never answered. There is nothing to wait for and
  // nowhere to redirect to — /login bounces straight back here while the
  // refresh cookie exists — so the splash turns into the one control that can
  // get the admin out of it.
  if (status !== 'authenticated') {
    return (
      <BrandLoader
        message={status === 'error' ? e('network') : undefined}
        action={
          status === 'error' ? (
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
          ) : undefined
        }
      />
    );
  }

  return (
    <div
      className="sidebar-shell"
      data-sidebar-collapsed={sidebarCollapsed}
      data-sidebar-mobile-open={sidebarOpen}
      style={{ minHeight: '100vh', background: 'var(--bg)' }}
    >
      <Sidebar />
      <Header />
      <CommandPalette />
      <SidebarMoveCoach />
      <main
        style={{
          // Edges are kept in exact lockstep with the header's insets so the
          // header's box and the page content line up on the same left/right
          // rails, with a single consistent gutter all around.
          marginLeft: sidebarPosition === 'left' ? 'calc(var(--sidebar-width) + var(--shell-gutter))' : 'var(--shell-gutter)',
          marginRight: sidebarPosition === 'right' ? 'calc(var(--sidebar-width) + var(--shell-gutter))' : 'var(--shell-gutter)',
          paddingTop: headerPosition === 'top' ? 'calc(var(--header-height) + var(--shell-gutter) * 2)' : 'var(--shell-gutter)',
          // --dock-clearance keeps the last row clear of the floating mobile
          // dock; it resolves to 0px on desktop, where no dock is rendered.
          paddingBottom: headerPosition === 'bottom'
            ? 'calc(var(--header-height) + var(--shell-gutter) * 2 + var(--dock-clearance))'
            : 'calc(var(--shell-gutter) + var(--dock-clearance))',
          minHeight: '100vh',
          background: 'var(--bg)',
          transition: 'margin-left 0.35s cubic-bezier(0.16,1,0.3,1), margin-right 0.35s cubic-bezier(0.16,1,0.3,1), padding-top 0.35s cubic-bezier(0.16,1,0.3,1), padding-bottom 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* The content sits on the same left/right rails as the header bar;
            the small horizontal padding only keeps cards off the very edge
            of a phone screen. */}
        <div className="px-4 lg:px-6 py-5 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
