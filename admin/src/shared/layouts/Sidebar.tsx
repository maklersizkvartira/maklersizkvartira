'use client';

import Image from 'next/image';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { Avatar } from '@/shared/ui/Avatar';
import { useTheme } from '@/providers';
import { useRole } from '@/providers/role-provider';
import { atLeast, ROUTE_MIN_ROLE } from '@/shared/lib/permissions';
import { useLogout } from '@/features/auth/hooks';

/* ─── Icons ──────────────────────────────────────────────────────────────────
   Inline rather than imported: at 17×17 / strokeWidth 1.8 the nav glyphs sit
   on the pixel grid exactly as drawn, and a nav that renders on every page
   should not wait on an icon package chunk. Only the glyphs the Uyiz nav
   and the sidebar chrome actually use live here. */
const Icons = {
  dashboard: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  listings: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-5h6v5" />
      <path d="M9 11h.01M15 11h.01" />
    </svg>
  ),
  reports: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 8 2a6 6 0 0 0 2.6-.6.5.5 0 0 1 .7.5v9.8a1 1 0 0 1-.4.8A6 6 0 0 1 16 15c-3 0-5-2-8-2a6 6 0 0 0-4 1.3" />
    </svg>
  ),
  topRequests: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" />
    </svg>
  ),
  verifications: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 11.5 11.2 13.8 15.4 9.4" />
    </svg>
  ),
  users: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  staff: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 1 0-16 0" />
      <path d="M16 11l1.5 1.5L20 10" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  audit: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
      <rect x="8" y="1.6" width="8" height="4.2" rx="1.2" />
      <polyline points="9 13 11 15 15 10.6" />
    </svg>
  ),
  security: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10.5" width="18" height="11" rx="2.2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  ai: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
      <path d="M10 3v3.5M14 3v3.5M10 17.5V21M14 17.5V21" />
      <path d="M3 10h3.5M3 14h3.5M17.5 10H21M17.5 14H21" />
    </svg>
  ),
  sms: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h8M8 13.5h5" />
    </svg>
  ),
  settings: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  sun: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  moon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  palette: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" stroke="none" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  shield: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" />
    </svg>
  ),
  sidebarClose: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <path d="M15 15l-3-3 3-3" />
    </svg>
  ),
  chevron: (active: boolean) => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: active ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
};

export interface NavItem {
  /** Doubles as the `nav.*` translation key — one string, no lookup table. */
  key: string;
  href: string;
  icon: React.ReactNode;
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

/** The Uyiz admin surface. Header's command palette reads the same list,
 *  so a route added here becomes searchable without a second registration. */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    items: [{ key: 'dashboard', href: '/dashboard', icon: Icons.dashboard }],
  },
  {
    key: 'moderation',
    items: [
      { key: 'listings', href: '/listings', icon: Icons.listings },
      { key: 'reports', href: '/reports', icon: Icons.reports },
      { key: 'topRequests', href: '/top-requests', icon: Icons.topRequests },
      { key: 'verifications', href: '/verifications', icon: Icons.verifications },
    ],
  },
  {
    key: 'people',
    items: [
      { key: 'users', href: '/users', icon: Icons.users },
      { key: 'staff', href: '/staff', icon: Icons.staff },
    ],
  },
  {
    key: 'system',
    items: [
      { key: 'audit', href: '/audit', icon: Icons.audit },
      { key: 'security', href: '/security', icon: Icons.security },
      { key: 'ai', href: '/ai', icon: Icons.ai },
      { key: 'sms', href: '/sms', icon: Icons.sms },
      { key: 'settings', href: '/settings', icon: Icons.settings },
    ],
  },
];

/** Fixed at five: the dock's 64px stride, its 0..256 drag clamp and the
 *  :nth-child(2..6) tap animations in globals.css all assume this length. */
const DOCK_ROUTES = ['/dashboard', '/listings', '/reports', '/users', '/settings'] as const;
const DOCK_STRIDE = 64;
const DOCK_MAX_DRAG = (DOCK_ROUTES.length - 1) * DOCK_STRIDE;

interface SidebarProps {
  /** Theme-palette visibility. It lives in DashboardLayout because the header
   *  owns the panel itself and both chrome pieces offer the toggle. */
  paletteOpen: boolean;
  onTogglePalette: () => void;
}

export function Sidebar({ paletteOpen, onTogglePalette }: SidebarProps) {
  const t = useTranslations('nav');
  // Role labels live in the staff namespace, next to the screen that assigns
  // them, so the sidebar chip and the staff table can never disagree.
  const roleT = useTranslations('staff');
  const pathname = usePathname();
  const router = useRouter();
  const admin = useAuthStore((s) => s.admin);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const { theme, toggleTheme } = useTheme();
  const { role } = useRole();
  const logout = useLogout();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  // ── Apple Glass Dock Drag State ──
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<number | null>(null);
  /** Where the thumb was flicked to, tagged with the route it was flicked
   *  FROM. Tagging it is what retires the optimistic position: once the
   *  pathname changes the tag no longer matches and the real index takes over,
   *  with no effect needed to clear it. */
  const [pending, setPending] = useState<{ index: number; from: string } | null>(null);
  const startXRef = useRef(0);
  const startIndexRef = useRef(0);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // Filter first, then render: a group whose every item is above the current
  // role must not leave an orphaned heading or a trailing divider behind.
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    // A nav href with no ROUTE_MIN_ROLE entry is ungated on the server too,
    // so MODERATOR — the lowest staff rank — is the honest floor for it.
    items: group.items.filter((item) => atLeast(role, ROUTE_MIN_ROLE[item.href] ?? 'MODERATOR')),
  })).filter((group) => group.items.length > 0);

  const dockActiveIndex = Math.max(0, DOCK_ROUTES.findIndex(isCurrent));

  const currentIndex = pending && pending.from === pathname ? pending.index : dockActiveIndex;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    startXRef.current = e.clientX;
    startIndexRef.current = dockActiveIndex;
    setDragPos(dockActiveIndex * DOCK_STRIDE);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const delta = e.clientX - startXRef.current;
    let newPos = startIndexRef.current * DOCK_STRIDE + delta;
    if (newPos < 0) newPos = 0;
    if (newPos > DOCK_MAX_DRAG) newPos = DOCK_MAX_DRAG;
    setDragPos(newPos);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (dragPos !== null) {
      const targetIndex = Math.round(dragPos / DOCK_STRIDE);
      setDragPos(null);
      setPending({ index: targetIndex, from: pathname });
      if (targetIndex !== dockActiveIndex) {
        router.push(DOCK_ROUTES[targetIndex] ?? DOCK_ROUTES[0]);
      }
    }
  };

  const displayName = admin?.fullName || admin?.username || '—';
  // Was hardcoded 'Superuser' / 'Admin', which labelled every moderator "Admin".
  const displayRole = role ? roleT(`role.${role}` as Parameters<typeof roleT>[0]) : '';
  const isSuperadmin = role === 'SUPERADMIN';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const roleChipStyle = {
    background: isSuperadmin ? 'var(--color-danger-bg)' : 'var(--accent-subtle)',
    color: isSuperadmin ? 'var(--color-danger)' : 'var(--accent)',
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className="sidebar-panel fixed left-0 top-0 bottom-0 z-40 flex flex-col overflow-visible transition-transform duration-300 ease-in-out"
        data-sidebar-collapsed={sidebarCollapsed}
        style={{
          width: sidebarCollapsed ? '80px' : '260px',
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sidebar)',
        }}
      >
        {/* Header */}
        <div
          className={`flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} shrink-0 transition-all duration-300`}
          style={{ height: 'var(--header-height)', borderBottom: '1px solid var(--color-border)' }}
        >
          <div
            onClick={() => sidebarCollapsed && setSidebarCollapsed(false)}
            title={sidebarCollapsed ? t('expand') : ''}
            className={`w-10 h-10 flex-center rounded-[14px] shrink-0 transition-transform duration-300 hover:scale-105 ${sidebarCollapsed ? 'cursor-pointer' : ''}`}
            style={{
              background: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05) inset',
            }}
          >
            <Image src="/brand/mark-128.png" alt="Uyiz" width={28} height={28} className="object-contain" priority />
          </div>

          {!sidebarCollapsed && (
            <div className="sidebar-brand-copy min-w-0 flex-1 animate-fade-in">
              <p className="font-bold text-[15px] leading-tight truncate" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em', fontFamily: 'var(--font-heading)' }}>
                Uyiz
              </p>
              {/* Left untranslated on purpose: this line is the second half of
                  the wordmark lockup, not prose — the same treatment the mark
                  had before the rebrand. */}
              <p className="text-[9px] uppercase tracking-[0.28em] font-semibold truncate" style={{ color: 'var(--color-text-muted)' }}>
                ADMIN
              </p>
            </div>
          )}

          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              title={t('collapse')}
              className="icon-btn hidden lg:flex w-9 h-9 shrink-0"
            >
              {Icons.sidebarClose}
            </button>
          )}

          <button
            onClick={() => setSidebarOpen(false)}
            title={t('collapse')}
            className="icon-btn flex ml-auto w-8 h-8 lg:hidden"
          >
            {Icons.sidebarClose}
          </button>
        </div>

        {/* Navigation — a link the current role cannot open is never drawn, so
            nobody discovers a page by clicking it into a 403. */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {visibleGroups.map((group, gIdx) => {
            return (
              <div key={group.key}>
                <p className="nav-group-label">{t(group.key as Parameters<typeof t>[0])}</p>

                {group.items.map(({ key, href, icon }) => {
                  const isActive = isCurrent(href);
                  return (
                    <Link
                      key={key}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={`nav-item ${isActive ? 'nav-item-active' : ''} group relative`}
                    >
                      <span style={{ color: isActive ? 'var(--accent)' : 'var(--color-text-muted)', display: 'flex', flexShrink: 0 }}>
                        {icon}
                      </span>
                      <span
                        className="sidebar-nav-label"
                        style={{ color: isActive ? 'var(--accent)' : 'var(--color-text-primary)', fontWeight: isActive ? 600 : 450 }}
                      >
                        {t(key as Parameters<typeof t>[0])}
                      </span>
                      {/* Floating tooltip in collapsed mode */}
                      {sidebarCollapsed && (
                        <div className="absolute left-[54px] rounded-lg px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)] shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 z-50 whitespace-nowrap">
                          {t(key as Parameters<typeof t>[0])}
                        </div>
                      )}
                    </Link>
                  );
                })}

                {gIdx < visibleGroups.length - 1 && <div className="nav-section-divider" />}
              </div>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto border-t border-[var(--color-border)] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.06))] py-2 space-y-2">
          {/* Toolbar & User Area */}
          <div className="px-3 space-y-2">
            {/* The Capsule Toolbar */}
            <div className={`sidebar-footer-toolbar flex ${sidebarCollapsed ? 'flex-col w-11 p-1 mx-auto rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-inner gap-1' : 'items-center justify-center gap-0.5 px-1 pb-1'} transition-all duration-300`}>
              <button
                onClick={toggleTheme}
                title={t('theme')}
                className="icon-btn flex group relative w-9 h-9 rounded-full"
              >
                {theme === 'light' ? Icons.moon : Icons.sun}
                {sidebarCollapsed && (
                  <div className="absolute left-[48px] rounded-lg px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-primary)] shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 z-50 whitespace-nowrap">
                    {t('theme')}
                  </div>
                )}
              </button>

              <button
                onClick={onTogglePalette}
                title={t('appearance')}
                className={`icon-btn flex group relative w-9 h-9 rounded-full ${paletteOpen ? 'icon-btn-active' : ''}`}
              >
                {Icons.palette}
                {sidebarCollapsed && (
                  <div className="absolute left-[48px] rounded-lg px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-primary)] shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 z-50 whitespace-nowrap">
                    {t('appearance')}
                  </div>
                )}
              </button>

              <Link
                href="/settings"
                onClick={() => setSidebarOpen(false)}
                title={t('settings')}
                className="icon-btn flex group relative w-9 h-9 rounded-full"
              >
                {Icons.settings}
                {sidebarCollapsed && (
                  <div className="absolute left-[48px] rounded-lg px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-primary)] shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 z-50 whitespace-nowrap">
                    {t('settings')}
                  </div>
                )}
              </Link>
            </div>

            {/* User Profile */}
            <div ref={userRef} className="relative">
              {userMenuOpen && (
                <div
                  className={`absolute bottom-full ${sidebarCollapsed ? 'left-12 w-60 mb-1' : 'left-0 right-0 mb-2'} rounded-[var(--radius-lg)] py-1.5 z-50 animate-scale-in`}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-dropdown)',
                  }}
                >
                  <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-2.5 mb-1">
                      <Avatar name={displayName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{displayName}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{admin?.email ?? displayRole}</p>
                      </div>
                    </div>
                    {role && (
                      <div
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1"
                        style={{
                          ...roleChipStyle,
                          border: `1px solid ${isSuperadmin ? 'var(--color-danger-border)' : 'var(--accent-border)'}`,
                        }}
                      >
                        {isSuperadmin && Icons.shield}
                        {displayRole}
                      </div>
                    )}
                  </div>

                  <Link
                    href="/settings"
                    onClick={() => { setUserMenuOpen(false); setSidebarOpen(false); }}
                    className="menu-item py-2.5 px-3"
                  >
                    {Icons.settings} {t('settings')}
                  </Link>

                  <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 0' }} />

                  <button
                    onClick={() => void logout()}
                    className="menu-item menu-item-danger py-2.5 px-3"
                  >
                    {Icons.logout} {t('signOut')}
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  if (sidebarCollapsed) {
                    setSidebarCollapsed(false);
                    setUserMenuOpen(true);
                  } else {
                    setUserMenuOpen((o) => !o);
                  }
                }}
                data-open={userMenuOpen}
                className="sidebar-user-trigger surface-trigger w-full flex items-center gap-3 px-3 py-3 rounded-[var(--radius-xl)] group relative"
                style={{ boxShadow: '0 10px 24px rgba(0,0,0,0.14)' }}
              >
                <Avatar name={displayName} size="sm" />
                <div className="sidebar-footer-copy flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>{displayName}</p>
                    {role && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0" style={roleChipStyle}>
                        {displayRole}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>{admin?.email ?? admin?.username}</p>
                </div>
                <span className="sidebar-footer-copy" style={{ color: 'var(--color-text-muted)' }}>
                  {Icons.chevron(userMenuOpen)}
                </span>
                {/* Tooltip for User Profile */}
                {sidebarCollapsed && (
                  <div className="absolute left-[54px] rounded-lg px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)] shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 z-50 whitespace-nowrap">
                    {displayName} ({t('settings')} / {t('signOut')})
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Apple VisionOS Liquid Glass Mobile Dock ── */}
      <div className="apple-glass-dock-wrapper" data-hidden={sidebarOpen}>
        <div className="apple-glass-dock">
          {/* 3D Crystal Glass Sliding Thumb */}
          <div
            className="apple-glass-thumb"
            style={{
              transform: `translateX(${dragPos !== null ? dragPos : currentIndex * DOCK_STRIDE}px)`,
              transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          <Link href="/dashboard" className="apple-glass-item" aria-label={t('dashboard')} data-active={currentIndex === 0}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.25 8.25a.75.75 0 1 1-1.06 1.06l-.72-.72V20.25a1.75 1.75 0 0 1-1.75 1.75h-3.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 1-.75.75h-3.5a1.75 1.75 0 0 1-1.75-1.75V12.43l-.72.72a.75.75 0 1 1-1.06-1.06l8.25-8.25Z" />
            </svg>
          </Link>

          <Link href="/listings" className="apple-glass-item" aria-label={t('listings')} data-active={currentIndex === 1}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V7.5L12 3l7 4.5V21" />
              <path d="M9.5 21v-5h5v5" />
            </svg>
          </Link>

          <Link href="/reports" className="apple-glass-item" aria-label={t('reports')} data-active={currentIndex === 2}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 22V3.4" />
              <path d="M4.5 4.2A6 6 0 0 1 8 3c3 0 5 2 8 2a6 6 0 0 0 2.6-.6.5.5 0 0 1 .7.5v9.3a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-3.5 1.2" />
            </svg>
          </Link>

          <Link href="/users" className="apple-glass-item" aria-label={t('users')} data-active={currentIndex === 3}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
            </svg>
          </Link>

          <Link href="/settings" className="apple-glass-item" aria-label={t('settings')} data-active={currentIndex === 4}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </div>
    </>
  );
}
