'use client';

import Image from 'next/image';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { Avatar } from '@/shared/ui/Avatar';
import { useEscapeToClose } from '@/shared/ui/escape-layer';
import { Wordmark } from '@/shared/ui/Wordmark';
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
  analytics: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v16.5A1.5 1.5 0 0 0 4.5 21H21" />
      <path d="M7 15.5V12" />
      <path d="M11.5 15.5V8" />
      <path d="M16 15.5v-5" />
      <path d="M20.5 15.5V5.5" />
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
  support: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  ),
  /* A speech bubble with a spark in it — the live AI desk. Deliberately not
     the `sms` bubble and not the `ai` chip: all three sit in the same rail and
     a moderator picks this one out by the spark. */
  chat: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 11.6a8.2 8.2 0 0 1-11.8 7.4L3.5 20.5l1.5-4.6a8.2 8.2 0 1 1 15.5-4.3z" />
      <path d="M12 7.9l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" />
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
  push: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <circle cx="18.5" cy="5.5" r="2.5" fill="currentColor" />
    </svg>
  ),
  settings: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  game: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <path d="M6 12h4m-2-2v4" />
      <circle cx="15.5" cy="11.5" r=".7" fill="currentColor" />
      <circle cx="18" cy="13.5" r=".7" fill="currentColor" />
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

/**
 * The Uyiz admin surface, grouped by what a page IS rather than by the order
 * the pages happened to be built in. Header's command palette reads the same
 * list, so a route added here becomes searchable without a second
 * registration.
 *
 * Five things were meant to be five groups — Overview, Moderation, People,
 * Services and System — and there are four here because `nav.services` does
 * not exist in the message catalogues and those three files belong to another
 * stage. Rather than hardcode one language's word for it, AI and SMS sit at
 * the HEAD of `system`, adjacent and ahead of the housekeeping pages, so they
 * still read as the pair of outside services they are. Splitting them into
 * their own group later is three lines here and one key in each of uz/ru/en.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    items: [
      { key: 'dashboard', href: '/dashboard', icon: Icons.dashboard },
      { key: 'analytics', href: '/analytics', icon: Icons.analytics },
      { key: 'game', href: '/game', icon: Icons.game },
    ],
  },
  {
    // The three queues first, in the order the dashboard's triage card counts
    // them, so the rail and the hero agree about what is waiting.
    key: 'moderation',
    items: [
      { key: 'listings', href: '/listings', icon: Icons.listings },
      { key: 'reports', href: '/reports', icon: Icons.reports },
      { key: 'verifications', href: '/verifications', icon: Icons.verifications },
      { key: 'topRequests', href: '/top-requests', icon: Icons.topRequests },
      { key: 'support', href: '/support', icon: Icons.support },
      // Beside `support` and not down in `system` with `/ai`: it is the same
      // desk work on a different channel, and an operator taking a
      // conversation over reaches for it from the same part of the rail.
      { key: 'chat', href: '/chat', icon: Icons.chat },
      { key: 'push', href: '/push', icon: Icons.push },
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
      // The two paid services first — see the note above about the group they
      // would have had to themselves.
      { key: 'ai', href: '/ai', icon: Icons.ai },
      { key: 'sms', href: '/sms', icon: Icons.sms },
      { key: 'audit', href: '/audit', icon: Icons.audit },
      { key: 'security', href: '/security', icon: Icons.security },
      { key: 'settings', href: '/settings', icon: Icons.settings },
    ],
  },
];

/**
 * Fixed at five: the dock's 64px stride, its 0..256 drag clamp and the
 * :nth-child(2..6) tap animations in globals.css all assume this length.
 *
 * So the five have to earn their slot, and the test is what a MODERATOR — the
 * rank that works from a phone all day — actually reaches for. Home, then the
 * three queues the dashboard's hero counts and a moderator is here to empty,
 * then the user lookup most of those decisions end in.
 *
 * /verifications took /settings' place. Settings is a page you open once a
 * quarter and it is already reachable twice from the drawer — the footer
 * toolbar and the user menu — while verifications, one of the three queues on
 * the dashboard, had no thumb position at all. /analytics is deliberately not
 * here either: it is somewhere you go on purpose, not somewhere you jump to
 * between decisions.
 */
const DOCK_ROUTES = ['/dashboard', '/listings', '/reports', '/verifications', '/users'] as const;
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

  /** `sidebarCollapsed` is a per-device localStorage flag, but the collapsed
   *  treatment is desktop-only: every rule that makes 80px readable — hiding
   *  the brand copy, the nav labels and the group headings, re-centring the
   *  nav items — lives inside `@media (min-width: 1024px)` in globals.css. An
   *  iPad that collapsed the rail in landscape and then rotated used to open
   *  the mobile drawer at 80px with all the 260px-designed labels still in it.
   *  Nothing resets the flag on resize, so the width has to ask where it is.
   *  Read after mount, never during render, so the server HTML and the first
   *  client pass agree — the same rule the remembered width itself follows. */
  const [isDesktop, setIsDesktop] = useState(false);
  /** Whether the query above has actually been read yet. `isDesktop` starts
   *  false for the SSR pass, and `inert` below must not believe that: it would
   *  render a DESKTOP sidebar inert for the first client paint, where it is
   *  fully visible and every nav link would silently do nothing. */
  const [mqReady, setMqReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      setIsDesktop(mq.matches);
      setMqReady(true);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const railCollapsed = sidebarCollapsed && isDesktop;

  /** The drawer only exists below 1024px: from there up globals.css pins the
   *  panel open and the backdrop is `lg:hidden`. Everything modal about it —
   *  the scroll lock, Escape, `inert` — has to ask where it is first. */
  const drawerOpen = sidebarOpen && !isDesktop;

  /**
   * Off-canvas is not hidden.
   *
   * The closed drawer is moved out of sight by `transform` alone, so its
   * fifteen nav links, the three icon buttons, both close buttons and the user
   * trigger stayed focusable and in the accessibility tree: a Tab from the
   * header walked ~20 invisible stops before reaching the page, with no visible
   * focus ring, and Enter navigated somewhere the admin could not see. `inert`
   * removes both at once — `aria-hidden` alone would leave every control
   * tabbable but unannounceable, which is worse than the bug.
   */
  const drawerInert = mqReady && !isDesktop && !sidebarOpen;

  /**
   * Leaving the shell must close the drawer.
   *
   * Nothing else resets it: the UI store is a module singleton that survives a
   * client-side navigation, so a drawer left open at sign-out was still open
   * when the next sign-in mounted this shell again — the dashboard behind a
   * full-screen backdrop and the dock animated away. The per-link handlers
   * below stay: tapping the item for the route you are already on produces no
   * pathname change, and this effect would never fire for it.
   */
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  /** While the drawer is over the page, the page holds still — a flick on the
   *  backdrop used to scroll the queue underneath it. The previous overflow is
   *  restored rather than cleared, so a Modal opened on top of the drawer is
   *  not unlocked when the drawer closes. */
  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  // Escape backs out of the drawer, through the shared stack so a dialog
  // raised over it takes the press first.
  useEscapeToClose(drawerOpen, () => setSidebarOpen(false));

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

  /** -1 on the ten routes the dock does not cover (/analytics, /support,
   *  /chat, /top-requests, /ai, /sms, /audit, /security, /settings, /staff).
   *  It used to be clamped to 0 right here, which handed `data-active` to the
   *  Dashboard item on those pages — and `.apple-glass-item[data-active="true"]`
   *  sets `pointer-events: none`, so the one dock button that could take a
   *  moderator home was dead on ten of fifteen screens. */
  const rawIndex = DOCK_ROUTES.findIndex(isCurrent);

  /** The flicked-to slot wins until the pathname catches up; still -1 off-dock,
   *  where no item should claim to be active. */
  const activeIndex = pending && pending.from === pathname ? pending.index : rawIndex;

  /** The thumb is a resting position, not a claim about the current page, so it
   *  — and only it — keeps the clamp: off-dock it parks over the first slot. */
  const thumbIndex = Math.max(0, activeIndex);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    startXRef.current = e.clientX;
    startIndexRef.current = thumbIndex;
    setDragPos(thumbIndex * DOCK_STRIDE);
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
      // Compared against the unclamped index on purpose: off-dock `rawIndex` is
      // -1, so a flick into slot 0 still pushes /dashboard, while on /dashboard
      // itself it is 0 and the redundant same-route push is still swallowed.
      if (targetIndex !== rawIndex) {
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
        inert={drawerInert}
        style={{
          width: railCollapsed ? '80px' : '260px',
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sidebar)',
        }}
      >
        {/* Header */}
        <div
          className={`flex items-center ${railCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} shrink-0 transition-all duration-300`}
          style={{ height: 'var(--header-height)', borderBottom: '1px solid var(--color-border)' }}
        >
          <div
            onClick={() => railCollapsed && setSidebarCollapsed(false)}
            title={railCollapsed ? t('expand') : ''}
            className={`w-10 h-10 flex-center rounded-[14px] shrink-0 transition-transform duration-300 hover:scale-105 ${railCollapsed ? 'cursor-pointer' : ''}`}
            style={{
              background: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05) inset',
            }}
          >
            <Image src="/brand/mark-lockup@2x.png" alt="Uyiz" width={152} height={192} className="h-7 w-auto" priority />
          </div>

          {!railCollapsed && (
            <div className="sidebar-brand-copy min-w-0 flex-1 animate-fade-in">
              <Wordmark height={17} style={{ color: 'var(--color-text-primary)' }} />
              {/* Left untranslated on purpose: this line is the second half of
                  the wordmark lockup, not prose — the same treatment the mark
                  had before the rebrand. */}
              <p className="text-[9px] uppercase tracking-[0.28em] font-semibold truncate" style={{ color: 'var(--color-text-muted)' }}>
                ADMIN
              </p>
            </div>
          )}

          {!railCollapsed && (
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
                      {railCollapsed && (
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
            <div className={`sidebar-footer-toolbar flex ${railCollapsed ? 'flex-col w-11 p-1 mx-auto rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-inner gap-1' : 'items-center justify-center gap-0.5 px-1 pb-1'} transition-all duration-300`}>
              <button
                onClick={toggleTheme}
                title={t('theme')}
                className="icon-btn flex group relative w-9 h-9 rounded-full"
              >
                {theme === 'light' ? Icons.moon : Icons.sun}
                {railCollapsed && (
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
                {railCollapsed && (
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
                {railCollapsed && (
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
                  className={`absolute bottom-full ${railCollapsed ? 'left-12 w-60 mb-1' : 'left-0 right-0 mb-2'} rounded-[var(--radius-lg)] py-1.5 z-50 animate-scale-in`}
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
                    // Closed here rather than left to the pathname effect: the
                    // drawer must never be open when the shell remounts after
                    // the next sign-in, and clearing it on mount instead would
                    // paint one frame of open drawer and then slide it out.
                    onClick={() => { setSidebarOpen(false); void logout(); }}
                    className="menu-item menu-item-danger py-2.5 px-3"
                  >
                    {Icons.logout} {t('signOut')}
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  if (railCollapsed) {
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
                {railCollapsed && (
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
      {/* The mirror of `drawerInert`: with the drawer open the dock is pushed
          off the bottom edge by a transform, so without this its five links
          stay tabbable and announced from behind the backdrop. */}
      <div className="apple-glass-dock-wrapper" data-hidden={sidebarOpen} inert={drawerOpen}>
        <div className="apple-glass-dock">
          {/* 3D Crystal Glass Sliding Thumb */}
          <div
            className="apple-glass-thumb"
            style={{
              transform: `translateX(${dragPos !== null ? dragPos : thumbIndex * DOCK_STRIDE}px)`,
              transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          <Link href="/dashboard" className="apple-glass-item" aria-label={t('dashboard')} data-active={activeIndex === 0}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.25 8.25a.75.75 0 1 1-1.06 1.06l-.72-.72V20.25a1.75 1.75 0 0 1-1.75 1.75h-3.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 1-.75.75h-3.5a1.75 1.75 0 0 1-1.75-1.75V12.43l-.72.72a.75.75 0 1 1-1.06-1.06l8.25-8.25Z" />
            </svg>
          </Link>

          <Link href="/listings" className="apple-glass-item" aria-label={t('listings')} data-active={activeIndex === 1}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V7.5L12 3l7 4.5V21" />
              <path d="M9.5 21v-5h5v5" />
            </svg>
          </Link>

          <Link href="/reports" className="apple-glass-item" aria-label={t('reports')} data-active={activeIndex === 2}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 22V3.4" />
              <path d="M4.5 4.2A6 6 0 0 1 8 3c3 0 5 2 8 2a6 6 0 0 0 2.6-.6.5.5 0 0 1 .7.5v9.3a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-3.5 1.2" />
            </svg>
          </Link>

          {/* Slot 3 was Settings. A shield with a tick, matching the rail's
              verifications glyph one weight heavier, so the same page is the
              same picture in both navs. */}
          <Link href="/verifications" className="apple-glass-item" aria-label={t('verifications')} data-active={activeIndex === 3}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21.5c5-2.4 7.5-5.9 7.5-10.5V5.2L12 2.5 4.5 5.2v5.8c0 4.6 2.5 8.1 7.5 10.5z" />
              <polyline points="8.9 11.6 11.2 13.9 15.2 9.6" />
            </svg>
          </Link>

          <Link href="/users" className="apple-glass-item" aria-label={t('users')} data-active={activeIndex === 4}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
            </svg>
          </Link>
        </div>
      </div>
    </>
  );
}
