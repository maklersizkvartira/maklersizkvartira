'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ChevronDown, Search, Sun, Moon, LogOut, User, Palette, Shield } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useUIStore, type HeaderPosition } from '@/store/ui.store';
import { useRole } from '@/providers/role-provider';
import { useLogout } from '@/features/auth/hooks';
import { Avatar } from '@/shared/ui/Avatar';
import { useTheme, useLocale } from '@/providers';
import { useDockDrag } from './useDockDrag';
import { DockHint } from './DockHint';

const HEADER_POSITIONS = ['top', 'bottom'] as const satisfies readonly HeaderPosition[];

const ThemePalette = dynamic(
  () => import('@/features/dashboard/components/ThemePalette').then((mod) => mod.ThemePalette),
  { ssr: false },
);

const LOCALES = [
  { code: 'uz', label: '🇺🇿 O\'zbekcha' },
  { code: 'ru', label: '🇷🇺 Русский' },
  { code: 'en', label: '🇬🇧 English' },
] as const;

/**
 * Floating glass header. Press-and-hold anywhere on it to pick it up and dock
 * it at the top or bottom edge; the search pill opens the ⌘K command palette.
 */
export function Header() {
  const navT = useTranslations('nav');
  const tDock = useTranslations('dock');
  const tPalette = useTranslations('commandPalette');
  // Role labels live in the staff namespace, next to the screen that assigns
  // them, so this chip and the staff table can never disagree.
  const roleT = useTranslations('staff');
  const admin = useAuthStore((s) => s.admin);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const paletteOpen = useUIStore((s) => s.paletteOpen);
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const sidebarPosition = useUIStore((s) => s.sidebarPosition);
  const headerPosition = useUIStore((s) => s.headerPosition);
  const setHeaderPosition = useUIStore((s) => s.setHeaderPosition);
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const { role } = useRole();
  const logout = useLogout();

  const displayName = admin?.fullName || admin?.username || '—';
  const displayRole = role ? roleT(`role.${role}` as Parameters<typeof roleT>[0]) : '';
  const isSuperadmin = role === 'SUPERADMIN';

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const panelRef = useRef<HTMLElement | null>(null);
  const dock = useDockDrag<HeaderPosition>({
    axis: 'vertical',
    positions: HEADER_POSITIONS,
    current: headerPosition,
    onDrop: setHeaderPosition,
    panelRef,
    panelSize: 56,
    disabled: !isDesktop,
  });

  // When the header is docked at the bottom, its menus must open upward so
  // they don't fall off the bottom of the screen.
  const dropSide = headerPosition === 'bottom' ? 'bottom-full mb-3' : 'top-full mt-3';

  const [settling, setSettling] = useState(false);
  const prevHeaderPosRef = useRef(headerPosition);
  useEffect(() => {
    if (prevHeaderPosRef.current !== headerPosition) {
      prevHeaderPosRef.current = headerPosition;
      setSettling(true);
      const id = setTimeout(() => setSettling(false), 380);
      return () => clearTimeout(id);
    }
  }, [headerPosition]);

  const [userDropOpen, setUserDropOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <header
        ref={panelRef}
        data-tour="header"
        onPointerDown={dock.onPointerDown}
        style={{
          height: 'var(--header-height)',
          left: sidebarPosition === 'left' ? 'calc(var(--sidebar-width) + var(--shell-gutter))' : 'var(--shell-gutter)',
          right: sidebarPosition === 'right' ? 'calc(var(--sidebar-width) + var(--shell-gutter))' : 'var(--shell-gutter)',
          top: headerPosition === 'top' ? 'var(--shell-gutter)' : 'auto',
          bottom: headerPosition === 'bottom' ? 'var(--shell-gutter)' : 'auto',
          background: 'var(--shell-bg)',
          backdropFilter: 'var(--shell-glass-blur)',
          WebkitBackdropFilter: 'var(--shell-glass-blur)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: dock.armed || dock.dropping
            ? '0 32px 70px -18px rgba(2, 64, 105, 0.5), 0 0 0 2px var(--accent)'
            : dock.progress > 0.45 && !dock.armed
              ? `var(--shadow-sidebar), 0 0 0 ${Math.round((dock.progress - 0.45) / 0.55 * 4)}px rgba(var(--accent-rgb), ${((dock.progress - 0.45) / 0.55 * 0.5).toFixed(2)})`
              : 'var(--shadow-sidebar)',
        }}
        className={`fixed z-20 flex items-center px-4 sm:px-6 gap-1.5 sm:gap-4 transition-[left,right,top,bottom] duration-300 ${dock.armed || dock.dropping ? 'dock-armed' : ''} ${dock.progress > 0.45 && !dock.armed ? 'dock-charging' : ''} ${settling ? 'dock-settling' : ''}`}
      >
        {/* Mobile hamburger */}
        <div className="lg:hidden flex items-center shrink-0">
          <button onClick={toggleSidebar} className="icon-btn flex w-9 h-9" aria-label={navT('expand')}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect y="3" width="18" height="1.5" rx="0.75" fill="currentColor" />
              <rect y="8.25" width="14" height="1.5" rx="0.75" fill="currentColor" />
              <rect y="13.5" width="10" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* Center: Search — opens the ⌘K command palette */}
        <div className="flex-1 flex justify-center min-w-0">
          <div className="w-full max-w-md hidden sm:block">
            <div
              role="button"
              tabIndex={0}
              aria-label={tPalette('placeholder')}
              onClick={() => setCommandPaletteOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCommandPaletteOpen(true); } }}
              onMouseEnter={() => setSearchFocused(true)}
              onMouseLeave={() => setSearchFocused(false)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-200 cursor-pointer outline-none"
              style={{
                background: searchFocused ? 'var(--color-surface)' : 'var(--color-surface-2)',
                border: `1px solid ${searchFocused ? 'var(--accent)' : 'var(--color-border)'}`,
                boxShadow: searchFocused ? '0 0 0 3px var(--accent-subtle)' : 'none',
              }}
            >
              <Search size={15} style={{ color: searchFocused ? 'var(--accent)' : 'var(--color-text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                readOnly
                tabIndex={-1}
                placeholder={navT('searchPlaceholder')}
                className="flex-1 bg-transparent text-sm outline-none min-w-0 cursor-pointer placeholder-[var(--color-text-muted)] pointer-events-none"
                style={{ color: 'var(--color-text-primary)' }}
              />
              <kbd
                className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right side controls.
            min-w-0 (not shrink-0): below sm the search spacer collapses to 0,
            so this cluster is the only thing left to absorb a narrow header. */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Appearance / Theme Palette */}
          <button
            onClick={() => setPaletteOpen(!paletteOpen)}
            className={`icon-btn w-9 h-9 rounded-xl hidden md:flex ${paletteOpen ? 'icon-btn-active' : ''}`}
            title={navT('appearance')}
            aria-label={navT('appearance')}
          >
            <Palette size={17} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={(e) => toggleTheme(e)}
            className="icon-btn w-9 h-9 rounded-xl hidden md:flex"
            aria-label={navT('theme')}
          >
            <div style={{ transition: 'transform 0.3s', transform: theme === 'dark' ? 'rotate(20deg)' : 'rotate(0deg)' }}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </div>
          </button>

          {/* Divider */}
          <div style={{ width: '1px', height: '22px', background: 'var(--color-border)' }} className="mx-1 hidden sm:block" />

          {/* User dropdown */}
          <div ref={userRef} className="relative">
            <button
              id="user-menu"
              onClick={() => setUserDropOpen((o) => !o)}
              data-open={userDropOpen}
              className="flex items-center gap-2 rounded-xl p-1 pl-1.5 pr-2.5 transition-all"
              style={{
                border: `1.5px solid ${userDropOpen ? 'var(--accent)' : 'var(--color-border)'}`,
                background: userDropOpen ? 'var(--color-surface-2)' : 'transparent',
              }}
            >
              <Avatar name={displayName} size="sm" online />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                  {displayName}
                </p>
                {displayRole && (
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    {displayRole}
                  </p>
                )}
              </div>
              <ChevronDown
                size={12}
                style={{
                  color: 'var(--color-text-muted)',
                  transform: userDropOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {userDropOpen && (
              <div
                className={`absolute right-0 ${dropSide} w-60 rounded-xl p-1.5 z-50 animate-fade-in flex flex-col gap-0.5`}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-dropdown)',
                }}
              >
                {/* Profile info */}
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar name={displayName} size="md" online />
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {displayName}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {admin?.email ?? admin?.username}
                      </p>
                    </div>
                  </div>
                  {displayRole && (
                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        background: isSuperadmin ? 'var(--color-danger-bg)' : 'var(--accent-subtle)',
                        color: isSuperadmin ? 'var(--color-danger)' : 'var(--accent)',
                        border: `1px solid ${isSuperadmin ? 'var(--color-danger-border)' : 'var(--accent-border)'}`,
                      }}
                    >
                      <Shield size={9} /> {displayRole}
                    </div>
                  )}
                </div>

                {/* Profile link */}
                <Link href="/settings" onClick={() => setUserDropOpen(false)} className="menu-item">
                  <User size={15} /> {navT('profile')}
                </Link>

                {/* Language */}
                <div
                  style={{ borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: '6px 0', margin: '4px 0' }}
                  className="flex flex-col gap-0.5"
                >
                  <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {navT('language')}
                  </p>
                  {LOCALES.map(({ code, label }) => (
                    <button
                      key={code}
                      onClick={() => setLocale(code)}
                      className={`menu-item ${locale === code ? 'menu-item-active' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Logout */}
                <button
                  // The drawer must not outlive the session: the UI store is a
                  // module singleton that survives the navigation to /login, so
                  // an open drawer would still be covering the dashboard when
                  // the next sign-in mounts the shell again.
                  onClick={() => { setSidebarOpen(false); void logout(); }}
                  className="menu-item menu-item-danger"
                >
                  <LogOut size={15} /> {navT('signOut')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Press-and-hold pickup hint */}
      <DockHint progress={dock.progress} armed={dock.armed} dragging={dock.dragging} />

      {/* Drop-target zones (top + bottom) shown while dragging the header */}
      {dock.dragging && HEADER_POSITIONS.map((side) => (
        <div
          key={side}
          className={`dock-zone ${dock.preview === side ? 'dock-zone-active' : ''}`}
          style={{
            left: sidebarPosition === 'left' ? 'calc(var(--sidebar-width) + var(--shell-gutter))' : 'var(--shell-gutter)',
            right: sidebarPosition === 'right' ? 'calc(var(--sidebar-width) + var(--shell-gutter))' : 'var(--shell-gutter)',
            height: 'var(--header-height)',
            [side]: 'var(--shell-gutter)',
          }}
        >
          <span className="dock-zone-label">{tDock(side)}</span>
        </div>
      ))}

      {paletteOpen && <ThemePalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}
