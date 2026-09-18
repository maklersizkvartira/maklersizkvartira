'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Search, LogOut, Palette, Sun, Moon, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { useUIStore } from '@/store/ui.store';
import { useTheme } from '@/providers';
import { useRole } from '@/providers/role-provider';
import { atLeast, ROUTE_MIN_ROLE } from '@/shared/lib/permissions';
import { useLogout } from '@/features/auth/hooks';
import { Z_DIALOG } from '@/shared/ui/z-layers';
import { useMounted } from './useMounted';
import { NAV_GROUPS } from './Sidebar';

interface PaletteItem {
  id: string;
  label: string;
  group: string;
  icon: ReactNode;
  onSelect: () => void;
}

/**
 * ⌘K search / actions palette. It searches the same nav the sidebar renders —
 * role-gated by the same rule, so a moderator can never type their way to a
 * page that would 403 them — plus the three chrome actions (theme, appearance,
 * sign out).
 */
export function CommandPalette() {
  const t = useTranslations('commandPalette');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const { theme, toggleTheme } = useTheme();
  const { role } = useRole();
  const logout = useLogout();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevQuery, setPrevQuery] = useState('');
  const mounted = useMounted();

  // Reset the active selection whenever the search text changes — computed
  // during render (React's recommended alternative to an effect here) rather
  // than via a setState-on-every-keystroke effect.
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl/Cmd+K shortcut — works from anywhere in the dashboard.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the search box when the palette opens, paired with the scroll-lock/focus side effects below
    setQuery('');
    setActiveIndex(0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      clearTimeout(id);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];

    NAV_GROUPS.forEach((group) => {
      group.items.forEach((item) => {
        // A nav href with no ROUTE_MIN_ROLE entry is ungated on the server
        // too, so MODERATOR — the lowest staff rank — is the honest floor.
        if (!atLeast(role, ROUTE_MIN_ROLE[item.href] ?? 'MODERATOR')) return;
        list.push({
          id: `nav-${item.key}`,
          label: tNav(item.key as Parameters<typeof tNav>[0]),
          group: tNav(group.key as Parameters<typeof tNav>[0]),
          icon: item.icon,
          onSelect: () => router.push(item.href),
        });
      });
    });

    list.push({
      id: 'action-theme',
      label: theme === 'light' ? t('switch_to_dark') : t('switch_to_light'),
      group: t('actions_group'),
      icon: theme === 'light' ? <Moon size={16} /> : <Sun size={16} />,
      onSelect: () => toggleTheme(),
    });

    list.push({
      id: 'action-appearance',
      label: t('customize_appearance'),
      group: t('actions_group'),
      icon: <Palette size={16} />,
      onSelect: () => setPaletteOpen(true),
    });

    list.push({
      id: 'action-logout',
      label: tNav('signOut'),
      group: t('actions_group'),
      icon: <LogOut size={16} />,
      // The drawer must not outlive the session: the UI store is a module
      // singleton that survives the navigation to /login.
      onSelect: () => { setSidebarOpen(false); void logout(); },
    });

    return list;
  }, [role, theme, t, tNav, router, toggleTheme, setPaletteOpen, setSidebarOpen, logout]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return items;
    return items
      .filter((it) => it.label.toLocaleLowerCase().includes(q) || it.group.toLocaleLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.label.toLocaleLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.label.toLocaleLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts;
      });
  }, [items, query]);

  const runItem = (item: PaletteItem) => {
    item.onSelect();
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) runItem(item);
    }
  };

  if (!mounted || !open) return null;

  const groupedOrder: string[] = [];
  const grouped = new Map<string, PaletteItem[]>();
  filtered.forEach((it) => {
    if (!grouped.has(it.group)) {
      grouped.set(it.group, []);
      groupedOrder.push(it.group);
    }
    grouped.get(it.group)!.push(it);
  });

  let runningIndex = -1;

  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center pt-[12vh] px-4" style={{ zIndex: Z_DIALOG }}>
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'rgba(4, 22, 43, 0.66)', backdropFilter: 'blur(10px) saturate(120%)', WebkitBackdropFilter: 'blur(10px) saturate(120%)' }}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl flex flex-col overflow-hidden animate-scale-in"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-modal)',
          maxHeight: '70vh',
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-5 shrink-0" style={{ height: 56, borderBottom: '1px solid var(--color-border)' }}>
          <Search size={17} style={{ color: 'var(--color-text-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('placeholder')}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <kbd
            className="hidden sm:flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
            style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
          >
            ESC
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-xs font-medium py-10" style={{ color: 'var(--color-text-muted)' }}>
              {t('empty')}
            </p>
          ) : (
            groupedOrder.map((groupLabel) => (
              <div key={groupLabel} className="mb-1">
                <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {groupLabel}
                </p>
                {grouped.get(groupLabel)!.map((item) => {
                  runningIndex += 1;
                  const isActive = runningIndex === activeIndex;
                  const index = runningIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => runItem(item)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left text-sm font-medium transition-colors"
                      style={{
                        background: isActive ? 'var(--accent-subtle)' : 'transparent',
                        color: isActive ? 'var(--accent)' : 'var(--color-text-primary)',
                      }}
                    >
                      <span
                        className="flex items-center justify-center w-4 h-4 shrink-0"
                        style={{ color: isActive ? 'var(--accent)' : 'var(--color-text-muted)' }}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <CornerDownLeft size={13} className="ml-auto shrink-0" style={{ color: 'var(--accent)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="hidden sm:flex items-center gap-4 px-5 shrink-0 text-[10px] font-semibold"
          style={{ height: 38, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
        >
          <span className="flex items-center gap-1.5">
            <ArrowUp size={11} /><ArrowDown size={11} /> {t('hint_navigate')}
          </span>
          <span className="flex items-center gap-1.5">
            <CornerDownLeft size={11} /> {t('hint_select')}
          </span>
          <span className="flex items-center gap-1.5">ESC {t('hint_close')}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
