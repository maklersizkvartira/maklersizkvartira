'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/routing';
import { ChevronDown, Search, Sun, Moon, LogOut, User, Palette, CornerDownLeft } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { useRole } from '@/providers/role-provider';
import { atLeast, ROUTE_MIN_ROLE } from '@/shared/lib/permissions';
import { useLogout } from '@/features/auth/hooks';
import { Avatar } from '@/shared/ui/Avatar';
import { useTheme, useLocale } from '@/providers';
import { NAV_GROUPS } from './Sidebar';

const ThemePalette = dynamic(
  () => import('@/features/dashboard/components/ThemePalette').then((mod) => mod.ThemePalette),
  { ssr: false },
);

const LOCALES = [
  { code: 'uz', label: '🇺🇿 O\'zbekcha' },
  { code: 'ru', label: '🇷🇺 Русский' },
  { code: 'en', label: '🇬🇧 English' },
] as const;

interface HeaderProps {
  /** Owned by DashboardLayout so the sidebar's palette button toggles the
   *  same panel this header renders. */
  paletteOpen: boolean;
  onTogglePalette: () => void;
  onClosePalette: () => void;
}

export function Header({ paletteOpen, onTogglePalette, onClosePalette }: HeaderProps) {
  const navT = useTranslations('nav');
  // Role labels live in the staff namespace, next to the screen that assigns
  // them, so this chip and the staff table can never disagree.
  const roleT = useTranslations('staff');
  const admin = useAuthStore((s) => s.admin);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const { role } = useRole();
  const logout = useLogout();

  const [userDropOpen, setUserDropOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const displayName = admin?.fullName || admin?.username || '—';
  const displayRole = role ? roleT(`role.${role}` as Parameters<typeof roleT>[0]) : '';

  /* ── Command palette ───────────────────────────────────────────────────────
     The search box used to be an inert input. It now searches the same nav the
     sidebar renders — role-gated by the same rule, so a moderator can never
     type their way to a page that would 403 them. */
  const routes = useMemo(
    () =>
      NAV_GROUPS.flatMap((group) =>
        group.items
          .filter((item) => atLeast(role, ROUTE_MIN_ROLE[item.href] ?? 'MODERATOR'))
          .map((item) => ({
            href: item.href,
            label: navT(item.key as Parameters<typeof navT>[0]),
            group: navT(group.key as Parameters<typeof navT>[0]),
          })),
      ),
    [role, navT],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return routes;
    return routes.filter(
      (r) => r.label.toLocaleLowerCase().includes(q) || r.href.includes(q),
    );
  }, [routes, query]);

  const paletteVisible = searchFocused && matches.length > 0;

  // ⌘K / Ctrl-K focuses the box — the kbd hint next to it has always promised
  // this shortcut, so make it true rather than removing the hint.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserDropOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (href: string) => {
    setQuery('');
    setSearchFocused(false);
    inputRef.current?.blur();
    router.push(href);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchFocused(false);
      inputRef.current?.blur();
      return;
    }
    if (!paletteVisible) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = matches[highlight] ?? matches[0];
      if (target) go(target.href);
    }
  };

  return (
    <>
      <header
        style={{
          height: 'var(--header-height)',
          left: 'var(--sidebar-width)',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          boxShadow: '0 1px 0 var(--color-border)',
        }}
        className="fixed top-0 right-0 z-20 flex items-center px-3 sm:px-5 gap-1.5 sm:gap-4 transition-all"
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

        {/* Center: Search / command palette */}
        <div className="flex-1 flex justify-center min-w-0">
          <div ref={searchRef} className="w-full max-w-md hidden sm:block relative">
            <div
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-200"
              style={{
                background: searchFocused ? 'var(--color-surface)' : 'var(--color-surface-2)',
                border: `1px solid ${searchFocused ? 'var(--accent)' : 'var(--color-border)'}`,
                boxShadow: searchFocused ? '0 0 0 3px var(--accent-subtle)' : 'none',
              }}
            >
              <Search size={15} style={{ color: searchFocused ? 'var(--accent)' : 'var(--color-text-muted)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={paletteVisible}
                aria-controls="nav-command-palette"
                placeholder={navT('searchPlaceholder')}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  // A new query means a new result list; keeping the old
                  // offset would leave Enter pointing at an unrelated page.
                  setHighlight(0);
                }}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                className="flex-1 bg-transparent text-sm outline-none min-w-0"
                style={{ color: 'var(--color-text-primary)' }}
              />
              <kbd
                className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  letterSpacing: '0.04em',
                }}
              >
                ⌘K
              </kbd>
            </div>

            {paletteVisible && (
              <div
                id="nav-command-palette"
                role="listbox"
                className="absolute left-0 right-0 top-full mt-2 rounded-xl py-1.5 z-50 animate-fade-in max-h-[60vh] overflow-y-auto"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-dropdown)',
                }}
              >
                {matches.map((match, i) => (
                  <button
                    key={match.href}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      // mousedown, not click: blur would tear the list down first
                      e.preventDefault();
                      go(match.href);
                    }}
                    className={`menu-item justify-between ${i === highlight ? 'menu-item-active' : ''}`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{match.label}</span>
                      <span className="text-[10px] uppercase tracking-wider shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                        {match.group}
                      </span>
                    </span>
                    {i === highlight && <CornerDownLeft size={12} className="shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Appearance / Theme Palette */}
          <button
            onClick={onTogglePalette}
            className={`icon-btn w-9 h-9 hidden md:flex ${paletteOpen ? 'icon-btn-active' : ''}`}
            title={navT('appearance')}
            aria-label={navT('appearance')}
          >
            <Palette size={17} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={(e) => toggleTheme(e)}
            className="icon-btn w-9 h-9 hidden md:flex"
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
              className="surface-trigger flex items-center gap-2 rounded-xl p-1 pl-1.5 pr-2.5"
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
                className="absolute right-0 top-full mt-2 w-60 rounded-xl py-1.5 z-50 animate-fade-in"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-dropdown)',
                }}
              >
                {/* Profile info */}
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-3">
                    <Avatar name={displayName} size="md" online />
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {displayName}
                      </p>
                      {displayRole && (
                        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{displayRole}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile link */}
                <Link href="/settings" onClick={() => setUserDropOpen(false)} className="menu-item">
                  <User size={15} /> {navT('profile')}
                </Link>

                {/* Language */}
                <div style={{ borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: '6px 0', margin: '4px 0' }}>
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
                  onClick={() => void logout()}
                  className="menu-item menu-item-danger"
                >
                  <LogOut size={15} /> {navT('signOut')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {paletteOpen && <ThemePalette onClose={onClosePalette} />}
    </>
  );
}
