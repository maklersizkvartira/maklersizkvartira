/**
 * Top bar and mobile drawer.
 *
 * The bar IS a search bar. On a rental marketplace the one thing every
 * visitor arrives wanting to do is look for somewhere to live, and the old
 * header answered that with a magnifier that navigated to the catalogue —
 * `layout.header.searchPlaceholder` had sat in all three dictionaries, unused
 * by anybody, since the day it was written. A real `<form role="search">`
 * with a real `<input>` now occupies the middle of the bar at every width
 * including 360px, which is also what fills the ~200px of dead blue the phone
 * used to get between its wordmark and its hamburger.
 *
 * Everything else is demoted, because BottomNav already carries navigation,
 * favourites, chat, profile and post-a-listing in the thumb zone. Below `lg`
 * the bar is exactly three objects — brand, search, you — and the drawer
 * holds the rest. At `lg+` the four nav links and the ten categories collapse
 * into one browse panel, language and appearance share one popover, and the
 * cluster ends with the only solid shape in the bar (the CTA) and the avatar.
 *
 * There is no `ICON_BUTTON` any more. Five controls used to wear the same
 * 12px-radius box — a white border at 20% over a white fill at 10% — at three
 * different widths on a 6px pitch, which is what made the bar read as one
 * striped band with nowhere for the eye to land. (The values are spelled out
 * rather than written as class names on purpose: Tailwind v4 scans this file
 * as raw text, so a dead utility quoted in a comment is a dead utility
 * shipped in the stylesheet.) Secondary icons are now bare glyphs on the
 * band — no border, no resting fill — so the bar contains exactly three
 * filled shapes: the translucent field, the white CTA, the avatar. A border
 * appears in one place only, around the favourites+chat capsule, where it now
 * means "these two belong together" instead of meaning nothing.
 *
 * The active-state collision went with it. One fill — white at 20% — used to
 * mean the current page, a hovered chip AND an open menu simultaneously.
 * Nothing in this file spends that value now; an open menu has its own, and
 * "current page" is stated inside the panels, where a fill can differ from a
 * hover by weight as well as colour.
 *
 * The bar's height lives in headerMetrics.ts, not here — App.tsx and
 * ListingsPage.tsx both have to start below it, and three hand-copied numbers
 * is how they drifted 30px apart.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  Gift,
  GraduationCap,
  Heart,
  Home,
  LayoutGrid,
  LogOut,
  Map as MapIcon,
  Menu,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';

import { useTranslation, type TranslationKey } from '../../i18n';
import {
  quickFilterState,
  useAppStore,
  type QuickFilterId,
  type ViewState,
} from '../../stores/useAppStore';
import { Logo } from '../brand/Logo';
import { Sheet } from '../ui/Sheet';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { HEADER_H } from './headerMetrics';
import { canPublishListings, roleLabelKey } from '../../types/roles';
import { AppLink } from '../../router/AppLink';
import { authTabForView } from '../../router/views';
import { useRequireAuth } from '../../hooks/useRequireAuth';

interface NavItem {
  view: ViewState;
  labelKey: TranslationKey;
  /**
   * The same glyph BottomNav gives this destination.
   *
   * The drawer and the tab bar are two views of one map, and a visitor who
   * learned the house icon at the bottom of the screen should not have to
   * read the word at the side of it. Where BottomNav has no tab — the student
   * programme — the icon is new but chosen in the same register.
   */
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
  authOnly?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { view: 'HOME', labelKey: 'layout.nav.home', icon: Home },
  { view: 'LISTINGS', labelKey: 'layout.nav.listings', icon: Search },
  { view: 'MAP', labelKey: 'layout.nav.map', icon: MapIcon },
  { view: 'STUDENT_PROGRAM', labelKey: 'layout.nav.studentProgram', icon: GraduationCap },
];

/**
 * `CHAT` is in this list now.
 *
 * BottomNav is `lg:hidden`, so a signed-in visitor on a laptop had no route
 * to their messages anywhere on the site — while App.tsx polled the unread
 * count every fifteen seconds and had nowhere to show it.
 */
const ACCOUNT_NAV: NavItem[] = [
  { view: 'PROFILE', labelKey: 'layout.nav.profile', icon: UserIcon, authOnly: true },
  { view: 'CHAT', labelKey: 'layout.nav.chat', icon: MessageSquare, authOnly: true },
  { view: 'MY_LISTINGS', labelKey: 'layout.nav.myListings', icon: BarChart3, ownerOnly: true },
  { view: 'FAVORITES', labelKey: 'layout.nav.favorites', icon: Heart, authOnly: true },
  { view: 'VERIFICATION', labelKey: 'layout.nav.verification', icon: ShieldCheck, authOnly: true },
  { view: 'REFERRAL', labelKey: 'layout.nav.referral', icon: Gift, authOnly: true },
];

interface HeaderCategory {
  /**
   * Names a delta in the store's `QUICK_FILTER_DELTAS`.
   *
   * The header used to carry its own `patch` literal per row, and it had
   * already drifted from the map the home page's cards and the catalogue's
   * chips both read: `qizlarga` here also set `search: 'qizlar'` and `center`
   * also set `region`. Two consequences, both live. The visitor got a
   * different result set for the same word depending on which of the three
   * places they tapped it; and because `activeQuickFilter` compares the whole
   * filter set, a header-launched search arrived on the catalogue with no chip
   * lit, so there was nothing on screen to say why the list was narrowed or
   * anything to press to widen it again.
   */
  id: Exclude<QuickFilterId, 'all'>;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  /** The category illustration from `public/img`, shared with the home cards. */
  image: string;
}

/**
 * The sections, in the header and on the home page both.
 *
 * The strings are `layout.categories.*` — the same keys the home page's
 * category cards read. Two copies of "Qizlarga" would be two things to
 * reword, and the one nobody remembered to reword is the one in the header.
 */
const CATEGORIES: HeaderCategory[] = [
  {
    id: 'roommate',
    titleKey: 'layout.categories.roommate.title',
    descriptionKey: 'layout.categories.roommate.description',
    image: '/img/sheriklika.webp',
  },
  {
    id: 'student',
    titleKey: 'layout.categories.student.title',
    descriptionKey: 'layout.categories.student.description',
    image: '/img/talaba.webp',
  },
  {
    id: 'family',
    titleKey: 'layout.categories.family.title',
    descriptionKey: 'layout.categories.family.description',
    image: '/img/oila.webp',
  },
  {
    id: 'qizlarga',
    titleKey: 'layout.categories.qizlarga.title',
    descriptionKey: 'layout.categories.qizlarga.description',
    image: '/img/qizlar.webp',
  },
  {
    id: 'komfort',
    titleKey: 'layout.categories.komfort.title',
    descriptionKey: 'layout.categories.komfort.description',
    image: '/img/qulay.webp',
  },
  {
    id: 'metro',
    titleKey: 'layout.categories.metro.title',
    descriptionKey: 'layout.categories.metro.description',
    image: '/img/metro.webp',
  },
  {
    id: 'center',
    titleKey: 'layout.categories.center.title',
    descriptionKey: 'layout.categories.center.description',
    image: '/img/markaz.webp',
  },
  {
    id: 'hovli',
    titleKey: 'layout.categories.hovli.title',
    descriptionKey: 'layout.categories.hovli.description',
    image: '/img/hovli.webp',
  },
  {
    id: 'budget',
    titleKey: 'layout.categories.budget.title',
    descriptionKey: 'layout.categories.budget.description',
    image: '/img/arzonroq.webp',
  },
  {
    id: 'premium',
    titleKey: 'layout.categories.premium.title',
    descriptionKey: 'layout.categories.premium.description',
    image: '/img/ishonchli.webp',
  },
];

/**
 * `search` is `max_length=120` server-side.
 *
 * ListingsPage holds its own copy of this number. Importing it from there
 * would be worse than duplicating it: this component is in the entry chunk
 * and that one is a page, so the import would drag a page module into every
 * first paint to fetch an integer. If the server limit moves, both move.
 */
const MAX_SEARCH_LENGTH = 120;

/**
 * The four recipes, and each one means something different.
 *
 * A shared constant here carries no padding, no type size, no weight and no
 * colour — only the properties every user of it agrees on. Two utilities for
 * one property on the same element have no defined precedence between them:
 * Tailwind emits its own rules in its own order, and the order they are
 * written in a `className` means nothing. So a caller that needs `px-3` gets
 * a constant that never said `px-4`, and the idle and open colours below are
 * a pair precisely so they can never both land on one element.
 *
 * (1) GLYPH — every secondary icon. No border, no resting fill; fill appears
 * on hover and while a menu is open. 44px and fully round, which is the
 * project's tap floor and the shape nothing else in the bar wears.
 */
const HEADER_GLYPH =
  'press grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full ' +
  'transition-colors hover:bg-white/12 hover:text-white ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80';

/** The same glyph with a word in it — the browse trigger and sign-in. */
const HEADER_GHOST_PILL =
  'press flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-full ' +
  'transition-colors hover:bg-white/12 hover:text-white ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80';

/** Resting. One idle colour for the whole run, so nothing is odd one out. */
const HEADER_IDLE = 'text-white/80';

/** The fill an open menu takes — and the only thing in the bar that takes it. */
const HEADER_OPEN = 'bg-white/18 text-white';

/**
 * (2) HAIRLINE GROUP — the only bordered treatment in the bar.
 *
 * The rule this encodes: the border and the fill live ONCE, on the container,
 * and never on a member. That is the whole difference between five bordered
 * boxes and one object holding two glyphs, and it is what stopped the bar
 * reading as a stripe. Do not re-add a ring to a button inside one.
 */
const HEADER_CAPSULE =
  'flex items-center gap-0.5 rounded-full p-0.5 ring-1 ring-inset ring-white/15';

/**
 * The two controls inside the search field.
 *
 * 36px visually so they sit inside a 44px pill without crowding it, with an
 * `::after` overlay expanding the hit area back out to 48px — that is how the
 * project's 44px floor survives a control that has to look smaller than it is.
 */
const HEADER_IN_FIELD_BUTTON =
  "press relative grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full text-white/75 " +
  "transition-colors hover:bg-white/15 hover:text-white after:absolute after:-inset-[6px] after:content-[''] " +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80';

/** The house eyebrow, above every section of every panel this file opens. */
const EYEBROW = 'mb-2 text-[11px] font-black uppercase tracking-wider text-subtle';

type HeaderMenu = 'browse' | 'settings' | 'account';

export const Header: React.FC = () => {
  const { t, language } = useTranslation();
  const currentUser = useAppStore((state) => state.currentUser);
  const currentView = useAppStore((state) => state.currentView);
  const searchInHeader = currentView !== 'LISTINGS';
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const setFilters = useAppStore((state) => state.setFilters);
  const logout = useAppStore((state) => state.logout);
  const favorites = useAppStore((state) => state.favoriteIds);
  const unreadChatCount = useAppStore((state) => state.unreadChatCount);
  const committedSearch = useAppStore((state) => state.filters.search);

  const requireAuth = useRequireAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  /**
   * One value, not three booleans.
   *
   * Three independent flags could not express "opening this one closes that
   * one", so the account panel and the categories panel could be on screen
   * together, overlapping, each waiting for its own outside click.
   */
  const [openMenu, setOpenMenu] = useState<HeaderMenu | null>(null);
  const [elevated, setElevated] = useState(false);
  const [query, setQuery] = useState(committedSearch);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const browseTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);

  /**
   * The field mirrors the store, so a category tile, a catalogue chip or a
   * pasted URL is reflected back in the bar rather than leaving it stale.
   */
  useEffect(() => {
    setQuery(committedSearch);
  }, [committedSearch]);

  /**
   * One dismiss handler for all three popovers.
   *
   * The panels do not live inside their triggers — the browse panel is a
   * sibling of the whole row so it can align to the bar's own grid rather
   * than hang off a button 380px in — so "did the click land inside the open
   * menu" is a `closest()` question, not a ref-contains one. Escape also
   * returns focus to the trigger; the two hand-copied versions of this effect
   * it replaces dropped focus at the top of the document instead.
   */
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('[data-header-menu]')) return;
      setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenMenu(null);
      const trigger =
        openMenu === 'browse'
          ? browseTriggerRef
          : openMenu === 'settings'
            ? settingsTriggerRef
            : accountTriggerRef;
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  /**
   * Elevation on scroll rather than a permanent edge.
   *
   * At rest the bar has a transparent border and no shadow, so on the home
   * page it melts into the hero — both surfaces are `bg-band`, and a shadow
   * falling on blue reads as a smudge rather than an edge. Once the page has
   * moved it grows a hairline and a blue-black shadow, which is the only
   * thing that separates it from white content scrolling underneath. The
   * border is 1px in BOTH states so the 65px outer height never shifts.
   *
   * `{ passive: true }` and one rAF per burst; state is written only when the
   * boolean actually flips, so a scroll is not sixty renders.
   */
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const next = window.scrollY > 4;
      setElevated((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const closeMenus = () => {
    setDrawerOpen(false);
    setOpenMenu(null);
  };

  const toggleMenu = (menu: HeaderMenu) =>
    setOpenMenu((current) => (current === menu ? null : menu));

  const go = (view: ViewState) => {
    setCurrentView(view);
    closeMenus();
  };

  /**
   * A header submit patches `search` and nothing else, deliberately.
   *
   * The store treats a patch whose only key is `search` as a real search —
   * that is the `search_submit` branch in `setFilters` — and because it is a
   * patch rather than a whole filter set it leaves an active quick filter
   * alone, which `activeQuickFilter` carries the query across for. Committing
   * a `quickFilterState` here instead would silently widen the visitor's
   * result set every time they pressed Enter.
   *
   * No debounce: the bar commits on submit only. ListingsPage keeps its own
   * debounced box, and two debouncers racing over one store field is how a
   * caret ends up yanked mid-word.
   */
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ search: query.trim() });
    setCurrentView('LISTINGS');
    closeMenus();
    // Dismisses the on-screen keyboard as the catalogue arrives; without it
    // the results render behind it and the visitor has to tap away first.
    searchInputRef.current?.blur();
  };

  const clearSearch = () => {
    setQuery('');
    searchInputRef.current?.focus();
  };

  /**
   * A category commits a whole filter set in one call — the store's delta over
   * the defaults — because reset-then-patch fires two list requests.
   */
  const openCategory = (id: HeaderCategory['id']) => {
    setFilters(quickFilterState(id));
    setCurrentView('LISTINGS');
    closeMenus();
  };

  /**
   * The menus close first, unconditionally.
   *
   * `useRequireAuth` runs the action only when there is a user, so closing
   * inside it left a signed-out visitor with the drawer sitting on top of the
   * auth dialog it had just opened — and the drawer is the higher of the two.
   */
  const postListing = () => {
    closeMenus();
    requireAuth(() => setCurrentView('CREATE_LISTING'), authTabForView('CREATE_LISTING'));
  };

  const visible = (item: NavItem) => {
    if (item.ownerOnly) return canPublishListings(currentUser?.role);
    if (item.authOnly) return Boolean(currentUser);
    return true;
  };

  const countFor = (view: ViewState) => {
    if (view === 'FAVORITES') return favorites.size;
    if (view === 'CHAT') return unreadChatCount;
    return 0;
  };

  /** Capped so the badge stays a circle: "12" turns it into a lozenge. */
  const badgeText = (count: number) => (count > 9 ? '9+' : String(count));

  /**
   * The overlap badge, for a 44px glyph that has no room for a flowed one.
   *
   * It sits INSIDE the glyph. The old one was offset `-right-1 -top-1`, which
   * pushed a red dot out into the 6px gap and left it two pixels from the
   * neighbouring control's border. The `ring-band` punch-out is exact because
   * the capsule it sits in has no fill of its own.
   */
  const overlapBadge = (count: number) => (
    <span className="absolute -top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black tabular-nums text-white ring-2 ring-band">
      {badgeText(count)}
    </span>
  );

  /** Wherever a row has width, the badge flows to its trailing edge instead. */
  const flowedBadge = (count: number) => (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-black tabular-nums text-white">
      {badgeText(count)}
    </span>
  );

  const avatar = (size: string) => (
    <span
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft-2 text-brand-text`}
    >
      {currentUser?.avatar ? (
        <img src={currentUser.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        <UserIcon className="h-4 w-4" aria-hidden="true" />
      )}
    </span>
  );

  /** One row, shared by the drawer's quick links and the account panel. */
  const navRow = (item: NavItem) => {
    const active = currentView === item.view;
    const count = countFor(item.view);
    return (
      <AppLink
        key={item.view}
        view={item.view}
        onNavigate={closeMenus}
        aria-current={active ? 'page' : undefined}
        className={`press flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors ${
          active
            ? 'bg-brand-soft text-brand-text'
            : 'text-muted hover:bg-surface-2 hover:text-content'
        }`}
      >
        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{t(item.labelKey)}</span>
        {count > 0 && flowedBadge(count)}
      </AppLink>
    );
  };

  /**
   * The ten categories, in two densities from one definition.
   *
   * `panel` is the wide browse dropdown, which has the width for a
   * description; `tiles` is the drawer, where ten two-line illustrated rows
   * pushed the settings section — the thing a first-time visitor most often
   * opens the drawer for — most of a screen below the fold.
   */
  const renderCategories = (variant: 'panel' | 'tiles') => (
    <ul className={variant === 'tiles' ? 'grid grid-cols-2 gap-2' : 'grid gap-1 sm:grid-cols-2 lg:grid-cols-3'}>
      {CATEGORIES.map((category) => (
        <li key={category.id}>
          <button
            type="button"
            onClick={() => openCategory(category.id)}
            className={
              variant === 'tiles'
                ? 'press flex min-h-11 w-full touch-manipulation flex-col items-center gap-1 rounded-xl border border-line bg-surface-2 px-2 py-2.5 text-center transition-colors hover:bg-surface-3'
                : 'press flex w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2'
            }
          >
            <img
              src={category.image}
              alt=""
              aria-hidden="true"
              width={variant === 'tiles' ? 32 : 44}
              height={variant === 'tiles' ? 32 : 44}
              loading="lazy"
              decoding="async"
              className={`shrink-0 select-none object-contain ${
                variant === 'tiles' ? 'h-8 w-8' : 'h-11 w-11'
              }`}
            />
            {variant === 'tiles' ? (
              <span className="w-full truncate text-[11px] font-bold text-content">
                {t(category.titleKey)}
              </span>
            ) : (
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-content">
                  {t(category.titleKey)}
                </span>
                {/* Two lines, like the home page's tiles: half of these
                    descriptions are longer than the ~186px a cell of this
                    dropdown leaves for an 11px line — in Uzbek as much as in
                    Russian — and a single truncated line cut them mid-word. */}
                <span className="line-clamp-2 text-[11px] leading-snug text-muted">
                  {t(category.descriptionKey)}
                </span>
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );

  /**
   * Language and appearance, in one block used by the popover and the drawer.
   *
   * Two radiogroups, no nested menus. These are preferences somebody sets
   * roughly once, and the old bar gave each of them a chip the same size and
   * weight as favourites and the money action.
   */
  const settingsBlock = (
    <div className="space-y-4">
      <div>
        <p className={EYEBROW}>{t('common.language.label')}</p>
        <LanguageSwitcher inline />
      </div>
      <div>
        <p className={EYEBROW}>{t('common.theme.label')}</p>
        <ThemeToggle compact={false} />
      </div>
    </div>
  );

  const drawerSection = (titleKey: TranslationKey, children: React.ReactNode) => (
    <section className="pt-5">
      <h3 className={EYEBROW}>{t(titleKey)}</h3>
      {children}
    </section>
  );

  const browseOpen = openMenu === 'browse';

  return (
    <>
      <header
        id="site-header"
        className={`fixed inset-x-0 top-0 z-[90] border-b bg-band text-white transition-[border-color,box-shadow] duration-200 ${
          elevated
            ? 'border-white/12 shadow-[0_8px_24px_-14px_rgb(2_8_38_/_0.95)]'
            : 'border-transparent'
        }`}
      >
        {/* Visible only once it has focus: the first Tab on any page offers to
            jump the whole bar instead of walking through fifteen controls.
            Centred rather than pinned to `top-2`, which let a 44px chip
            overhang the bottom of the bar by four pixels. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-1/2 focus:z-20 focus:inline-flex focus:min-h-11 focus:-translate-y-1/2 focus:items-center focus:rounded-full focus:bg-white focus:px-4 focus:text-sm focus:font-bold focus:text-band"
        >
          {t('layout.header.skipToContent')}
        </a>

        <div className={`gutter-safe mx-auto flex ${HEADER_H} max-w-7xl items-center gap-2 sm:gap-3`}>
          {/* 1 — brand. Below 390px only the mark survives: 118px of white
              wordmark is the most expensive thing on a 328px row, and a bare
              app icon is what a native app shows anyway. `-ml-1` pulls the
              hover circle's optical edge back onto the gutter line. */}
          <AppLink
            view="HOME"
            onNavigate={closeMenus}
            aria-label={t('common.brand.name')}
            className="press -ml-1 flex min-h-11 shrink-0 items-center rounded-full px-1 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <span className="min-[390px]:hidden">
              <Logo size="sm" markOnly />
            </span>
            <span className="hidden min-[390px]:block sm:hidden">
              <Logo size="sm" inverted />
            </span>
            <span className="hidden sm:block">
              <Logo size="md" inverted />
            </span>
          </AppLink>

          {/* 2 — browse. The four nav links and the ten categories are both
              behind this one control. HOME is the logo, E'LONLAR is the field
              beside it, XARITA is the button inside that field — and all four
              are still real `<a href>` links one click deep. At `lg` it is
              icon and chevron only; the label arrives at `xl`, which is the
              ~120px the field needs at 1024px. */}
          <button
            type="button"
            ref={browseTriggerRef}
            data-header-menu
            onClick={() => toggleMenu('browse')}
            aria-haspopup="true"
            aria-expanded={browseOpen}
            aria-controls="header-browse"
            className={`${HEADER_GHOST_PILL} hidden px-3 text-sm font-bold lg:flex xl:px-4 ${
              browseOpen ? HEADER_OPEN : HEADER_IDLE
            }`}
          >
            <LayoutGrid className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="hidden xl:inline">{t('layout.categories.label')}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${browseOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {/* 3 — the search form, at every breakpoint including 360px.

              Except on the catalogue, which owns search itself: its sticky bar
              carries the canonical box, wired to the filter sheet and to the
              draft state the chips read. Rendering this one there put two
              fields with near-identical placeholders sixty pixels apart, both
              writing the same store key. The spacer keeps the row's geometry —
              without it the browse trigger and the right-hand cluster collapse
              together and the bar visibly reflows on every navigation. */}
          {searchInHeader ? (
          <form role="search" onSubmit={submitSearch} className="min-w-0 flex-1 lg:max-w-2xl">
            <div className="flex h-11 w-full items-center gap-2 rounded-full bg-white/14 pl-3.5 pr-1.5 ring-1 ring-inset ring-white/22 transition-colors focus-within:bg-white/22 focus-within:ring-2 focus-within:ring-white/70 sm:h-12 sm:pl-4">
              <Search className="h-5 w-5 shrink-0 text-white/70" aria-hidden="true" />
              {/* `text-base` is load-bearing and must never be shrunk: iOS
                  Safari zooms the viewport for any field under 16px and never
                  zooms back, which inside a `fixed` bar is unrecoverable.
                  `<TextInput>` is deliberately not reused — its
                  `bg-surface-2 border-line` skin belongs on a white page. */}
              <input
                ref={searchInputRef}
                type="search"
                name="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                maxLength={MAX_SEARCH_LENGTH}
                placeholder={t('layout.header.searchPlaceholder')}
                aria-label={t('layout.header.searchAria')}
                // `self-stretch` is a tap-target fix, not cosmetics. The pill
                // is 44px (48 at `sm`) but an `<input>` centred in it is only
                // as tall as its own line box — about 24px — so the top and
                // bottom ~10px of the visible field belonged to the wrapper
                // and a tap there focused nothing. Stretching the control to
                // the row's height is what makes the thing you can see and
                // the thing you can press the same object.
                className="header-search-input min-w-0 flex-1 self-stretch touch-manipulation bg-transparent text-base font-medium text-white outline-none placeholder:text-white/60"
              />

              {query.length > 0 && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label={t('common.action.clear')}
                  className={HEADER_IN_FIELD_BUTTON}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}

              {/* The map lives in BottomNav below `sm`, and 360px has no room
                  for a second control in the field. */}
              <span className="hidden h-6 w-px shrink-0 bg-white/25 sm:block" aria-hidden="true" />
              <button
                type="button"
                onClick={() => go('MAP')}
                aria-label={t('layout.header.mapSearchAria')}
                title={t('layout.header.mapSearchAria')}
                className={`${HEADER_IN_FIELD_BUTTON} hidden sm:grid`}
              >
                <MapIcon className="h-5 w-5" aria-hidden="true" />
              </button>

              {/* Enter already submits; this is the control a screen reader
                  and a switch user need to reach the same action. */}
              <button type="submit" className="sr-only">
                {t('common.action.search')}
              </button>
            </div>
          </form>
          ) : (
            <div className="min-w-0 flex-1" aria-hidden="true" />
          )}

          {/* 4-7 — the cluster. Two pitches only: 2px inside the capsule,
              12px between everything else. The old bar ran six children at a
              flat 6px with no divider and no grouping anywhere. */}
          <div className="flex shrink-0 items-center gap-3">
            {/* 4 — "your stuff". The one bordered object in the bar, and it
                renders only for a signed-in visitor: a heart that opens a
                login dialog is a control that blocks the person pressing it.
                Below `lg` both of these are BottomNav tabs. */}
            {currentUser && (
              <div className={`hidden ${HEADER_CAPSULE} lg:flex`}>
                <AppLink
                  view="FAVORITES"
                  onNavigate={closeMenus}
                  aria-label={t('layout.header.savedCount', { count: favorites.size })}
                  className={`${HEADER_GLYPH} ${HEADER_IDLE} relative`}
                >
                  <Heart className="h-5 w-5" aria-hidden="true" />
                  {favorites.size > 0 && overlapBadge(favorites.size)}
                </AppLink>
                <AppLink
                  view="CHAT"
                  onNavigate={closeMenus}
                  aria-label={t('layout.nav.chat')}
                  className={`${HEADER_GLYPH} ${HEADER_IDLE} relative`}
                >
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                  {unreadChatCount > 0 && overlapBadge(unreadChatCount)}
                </AppLink>
              </div>
            )}

            {/* 5 — language and appearance behind one glyph. The two-letter
                code is the icon: strictly more informative than a globe, and
                the same 44px circle as everything else in the run rather than
                the odd-width chip the old globe-plus-code chip was. */}
            <div className="relative hidden lg:block">
              <button
                type="button"
                ref={settingsTriggerRef}
                data-header-menu
                onClick={() => toggleMenu('settings')}
                aria-haspopup="true"
                aria-expanded={openMenu === 'settings'}
                aria-label={t('layout.header.settingsAria')}
                title={t('layout.header.settingsAria')}
                className={`${HEADER_GLYPH} ${
                  openMenu === 'settings' ? HEADER_OPEN : HEADER_IDLE
                }`}
              >
                <span className="text-[13px] font-black uppercase tracking-tight" aria-hidden="true">
                  {language}
                </span>
              </button>

              {openMenu === 'settings' && (
                <div
                  data-header-menu
                  className="animate-fade-in absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-4 text-content shadow-raised"
                >
                  {settingsBlock}
                </div>
              )}
            </div>

            {/* 6 — the money action, and the only fully-filled shape in the
                bar. Solid white on saturated blue needs no shadow to sit
                forward; the old `shadow-md` was a black shadow on dark blue
                and only muddied the edge. Not rendered below `lg` because
                BottomNav's raised FAB is the same action under the thumb. */}
            <button
              type="button"
              onClick={postListing}
              className="press hidden min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-band transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-band lg:inline-flex"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t('layout.header.createListingCta')}
            </button>

            {/* 7 — account. A circle when signed in, a borderless word when
                not: "E'lon berish" and "Kirish" used to be the same rectangle
                at the same radius, height, padding and size, differing only
                in fill — a filled/ghost pair, which is exactly the wrong
                thing to say about a money action and an authentication link.
                Three different shapes cannot be read as a set. */}
            {currentUser ? (
              <div className="relative hidden lg:block">
                <button
                  type="button"
                  ref={accountTriggerRef}
                  data-header-menu
                  onClick={() => toggleMenu('account')}
                  aria-haspopup="true"
                  aria-expanded={openMenu === 'account'}
                  aria-label={t('layout.header.accountAria')}
                  className={`press h-11 w-11 shrink-0 touch-manipulation rounded-full ring-1 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    openMenu === 'account' ? 'ring-white' : 'ring-white/30 hover:ring-white/60'
                  }`}
                >
                  {avatar('h-11 w-11')}
                </button>

                {openMenu === 'account' && (
                  <div
                    data-header-menu
                    className="animate-fade-in absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 text-content shadow-raised"
                  >
                    <div className="flex items-center gap-3 px-2 pb-3 pt-1">
                      {avatar('h-10 w-10')}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-content">
                          {currentUser.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {t(roleLabelKey(currentUser.role))}
                        </p>
                      </div>
                    </div>

                    {/* Sections divided by hairlines rather than by gaps, so
                        the panel stays one object. */}
                    <nav
                      aria-label={t('layout.header.accountAria')}
                      className="space-y-0.5 border-t border-line pt-2"
                    >
                      {ACCOUNT_NAV.filter(visible).map(navRow)}
                    </nav>

                    <div className="mt-2 border-t border-line pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          void logout();
                          closeMenus();
                        }}
                        className="press flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-xl px-3 text-sm font-bold text-danger transition-colors hover:bg-danger-soft"
                      >
                        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {t('common.action.signOut')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuth(true, 'LOGIN')}
                className={`${HEADER_GHOST_PILL} ${HEADER_IDLE} hidden px-3 text-[13px] font-semibold lg:flex`}
              >
                {t('common.action.signIn')}
              </button>
            )}

            {/* The trailing control below `lg`. Showing the face inside the
                menu trigger is also what closes the 640-1023px identity hole:
                the old account button was `lg:inline-flex`, so a signed-in
                visitor on a tablet saw no avatar, no name and no route to
                their profile anywhere in the bar. The label finally flips to
                "close" when the drawer is open — the key has existed and gone
                unused since it was written. */}
            <button
              type="button"
              // A toggle, because the markup already claims to be one:
              // `aria-expanded` and the label both flip when the drawer is
              // open, and a control that announces "close" and then opens
              // again is worse than one that never offered to close.
              onClick={() => {
                setOpenMenu(null);
                setDrawerOpen((open) => !open);
              }}
              aria-controls="header-drawer"
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? t('layout.header.closeMenu') : t('layout.header.openMenu')}
              className={
                currentUser
                  ? 'press -mr-1 flex h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-full pl-1 pr-2.5 ring-1 ring-inset ring-white/18 transition-colors hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 lg:hidden'
                  : `${HEADER_GLYPH} ${HEADER_IDLE} -mr-2 lg:hidden`
              }
            >
              {currentUser && avatar('h-8 w-8')}
              <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* 2a — the browse panel, anchored to the header's own `max-w-7xl`
            grid rather than hanging off a trigger 380px into the bar, so it
            lines up with the logo on the left and the avatar on the right.
            The old `role="menu"` wrapping a `<ul>` of `<li>`s whose buttons
            carried no `role="menuitem"` is gone: this is a plain container
            holding a real `<nav>` and a labelled group, which needs no roving
            tabindex to be correct. */}
        {browseOpen && (
          <div
            id="header-browse"
            data-header-menu
            className="animate-fade-in absolute inset-x-0 top-full hidden lg:block"
          >
            <div className="gutter-safe mx-auto max-w-7xl">
              <div className="rounded-b-3xl border-x border-b border-line bg-surface p-4 text-content shadow-raised">
                <nav aria-label={t('layout.header.browseSections')}>
                  <p className={EYEBROW}>{t('layout.header.browseSections')}</p>
                  <div className="flex flex-wrap gap-2">
                    {PRIMARY_NAV.map((item) => {
                      const active = currentView === item.view;
                      return (
                        <AppLink
                          key={item.view}
                          view={item.view}
                          onNavigate={closeMenus}
                          aria-current={active ? 'page' : undefined}
                          // Both the weight and the fill change with state.
                          // The bar's old active link differed from a hover
                          // by a `shadow-xs` nobody could see on blue.
                          className={`press flex min-h-11 items-center gap-2 rounded-full px-4 text-sm transition-colors ${
                            active
                              ? 'bg-brand-soft font-black text-brand-text'
                              : 'bg-surface-2 font-bold text-muted hover:text-content'
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {t(item.labelKey)}
                        </AppLink>
                      );
                    })}
                  </div>
                </nav>

                <div
                  role="group"
                  aria-label={t('layout.categories.label')}
                  className="mt-4 border-t border-line pt-4"
                >
                  <p className={EYEBROW}>{t('layout.categories.chooseSection')}</p>
                  {renderCategories('panel')}
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      <Sheet
        open={drawerOpen}
        onClose={closeMenus}
        side="right"
        title={t('layout.header.menuTitle')}
        description={t('layout.header.menuSubtitle')}
        footer={
          currentUser ? (
            <button
              type="button"
              onClick={() => {
                void logout();
                closeMenus();
              }}
              className="press flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-danger/30 text-sm font-bold text-danger transition-colors hover:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {t('common.action.signOut')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowAuth(true, 'LOGIN');
                closeMenus();
              }}
              className="press min-h-11 w-full touch-manipulation rounded-xl bg-brand text-sm font-bold text-on-brand shadow-brand"
            >
              {t('layout.header.loginOrRegister')}
            </button>
          )
        }
      >
        <div id="header-drawer" className="divide-y divide-line">
          {currentUser ? (
            <div className="flex items-center gap-3 pb-4">
              {avatar('h-12 w-12')}
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-content">{currentUser.name}</p>
                <p className="text-xs text-muted">{t(roleLabelKey(currentUser.role))}</p>
              </div>
            </div>
          ) : (
            <div className="pb-4">
              <p className="text-sm font-black text-content">
                {t('layout.sidebar.guestTitle')}
              </p>
              <p className="mt-1 text-xs text-muted">{t('layout.sidebar.guestSubtitle')}</p>
            </div>
          )}

          {drawerSection(
            'layout.header.drawerQuickLinks',
            <nav className="space-y-1">
              {/* One `bg-brand` element in this sheet at a time. Signed out,
                  the footer's sign-in button is the primary and this drops to
                  an ordinary row; signed in, the footer is a danger outline
                  and the CTA can have the fill back. Two filled brand buttons
                  competing for the same role is what the drawer used to do. */}
              <button
                type="button"
                onClick={postListing}
                className={
                  currentUser
                    ? 'press flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-xl bg-brand px-3 text-sm font-bold text-on-brand shadow-brand'
                    : 'press flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-xl px-3 text-sm font-bold text-muted transition-colors hover:bg-surface-2 hover:text-content'
                }
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('layout.nav.createListing')}
              </button>
              {[...PRIMARY_NAV, ...ACCOUNT_NAV].filter(visible).map(navRow)}
            </nav>,
          )}

          {/* Settings above categories. On a 390px screen the ten category
              tiles used to put the language switch below the fold, and
              switching language is the single most likely reason a first-time
              visitor opens this drawer at all — the bar no longer carries a
              language control below `lg`. */}
          {drawerSection('layout.header.drawerSettings', <div className="pb-1">{settingsBlock}</div>)}

          {drawerSection('layout.header.drawerCategories', renderCategories('tiles'))}
        </div>
      </Sheet>
    </>
  );
};

export default Header;
