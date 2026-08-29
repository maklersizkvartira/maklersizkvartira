/**
 * Top bar and mobile drawer.
 *
 * The middle of the bar is NAVIGATION, not a search field. A `<form
 * role="search">` lived here for one release and the owner asked for it back
 * out: the catalogue owns search — its sticky bar carries the canonical box,
 * wired to the filter sheet and to the draft state the chips read — the home
 * page opens a search modal of its own, and a third box in the chrome only
 * gave the visitor two near-identical placeholders writing the same store key
 * and no way to reach the main pages without opening a menu first. What the
 * bar owes a visitor is a map of the site, so the four `PRIMARY_NAV` links
 * are back in it as real anchors, centred rather than crowded against the
 * wordmark, with the categories disclosure at the end of the same run.
 *
 * Below `lg` the bar is deliberately sparse — brand and the you/menu trigger,
 * nothing else. BottomNav already carries home, map, listings, post, chat,
 * favourites and profile in the thumb zone at those widths, and the drawer
 * behind that trigger holds the full navigation, the settings and the ten
 * categories. Duplicating any of it in a 64px band the thumb cannot reach
 * buys nothing.
 *
 * Two controls are held back to `xl` rather than shrunk, because 1024px is
 * the narrowest desktop and Russian is the longest of the three languages
 * ("Программа для студентов" alone is ~180px, and the post-a-listing CTA is
 * "Разместить объявление"):
 *
 *   - `HOME` appears at `xl`. It is the one link the bar can drop without
 *     losing a destination — the wordmark an inch to its left is the same
 *     link — and dropping it is what buys the student programme its row at
 *     1024px.
 *   - The favourites+chat capsule appears at `xl`. Both destinations are in
 *     the account menu at every width, so nothing becomes unreachable; the
 *     capsule's ~105px is what the section links need at 1024px.
 *
 * There is no `ICON_BUTTON` any more. Five controls used to wear the same
 * 12px-radius box — a white border at 20% over a white fill at 10% — at three
 * different widths on a 6px pitch, which is what made the bar read as one
 * striped band with nowhere for the eye to land. (The values are spelled out
 * rather than written as class names on purpose: Tailwind v4 scans this file
 * as raw text, so a dead utility quoted in a comment is a dead utility
 * shipped in the stylesheet.) Secondary icons are bare glyphs on the band —
 * no border, no resting fill — so the bar contains exactly two filled shapes:
 * the white CTA and the avatar. A border appears in one place only, around
 * the favourites+chat capsule, where it means "these two belong together"
 * instead of meaning nothing.
 *
 * The active-state collision went with it. One fill — white at 20% — used to
 * mean the current page, a hovered chip AND an open menu simultaneously.
 * `HEADER_OPEN` is now spent on an open menu and on nothing else, which is
 * why the current section is marked with an underline rather than a fill: a
 * fill there would put the bar straight back where it started.
 *
 * The bar's height lives in headerMetrics.ts, not here — App.tsx,
 * entry-server.tsx and ListingsPage.tsx all have to start below it, and three
 * hand-copied numbers is how they drifted 30px apart. Removing the field did
 * not change it: the field was 44px inside a 64px row.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
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
import { useReducedMotion } from '../../hooks/useReducedMotion';

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
   *
   * The desktop bar sets these aside: five glyphs beside five words in a
   * 64px band is the striped-stripe problem again, and the words are short
   * enough to carry themselves at that size.
   */
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
  authOnly?: boolean;
  /** Held back to `xl`; see the note at the top of this file. */
  wideOnly?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { view: 'HOME', labelKey: 'layout.nav.home', icon: Home, wideOnly: true },
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
 *
 * Ten is not an accident either: the browse panel lays them out two-up and
 * five-up, and both of those divide ten exactly. A column count that leaves
 * two cells of a four-wide row empty is the thing the owner objected to.
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
 * How long the browse panel takes to peel out of the bar, in one place.
 *
 * The number is shared by a Tailwind `duration-300` class and by the timer
 * that keeps the panel mounted through its exit, and the two have to agree:
 * a timer shorter than the transition tears the panel off screen mid-slide,
 * a longer one leaves an invisible element holding the tab order. Written as
 * a constant with `duration-300` spelled out literally in the class list,
 * because Tailwind v4 scans this file as text and would generate nothing at
 * all for `` `duration-${PANEL_MS}` ``.
 */
const PANEL_MS = 300;

/**
 * Room below the panel for its own shadow.
 *
 * The wrapper is `overflow-hidden` — that clip is what makes the panel look
 * like it is coming out from behind the bar's bottom edge — and a clip tight
 * to the panel's box would cut off the `shadow-raised` that lifts it away
 * from the page. So the wrapper is padded by this much and the animated
 * max-height carries the same amount, leaving a transparent strip the shadow
 * can fall into. The strip is `pointer-events-none`; the panel inside it
 * takes its clicks back.
 */
const PANEL_SHADOW_ROOM = 40;

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

/**
 * (2) SECTION LINK — the four `PRIMARY_NAV` destinations in the middle.
 *
 * `min-w-0` and a `truncate`d label are a pressure valve, not a layout. The
 * row fits every one of the three languages at 1024px with room to spare, but
 * the widths above are estimates of text nobody has measured on the visitor's
 * actual font stack; if one of them is wrong the longest label loses its tail
 * instead of the row overflowing and the avatar being clipped off the right
 * edge by the `overflow-x: hidden` on <body>.
 */
const HEADER_NAV_LINK =
  'press relative flex min-h-11 min-w-0 touch-manipulation items-center rounded-full px-2.5 ' +
  'text-[13px] transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80';

/** Resting. One idle colour for the whole run, so nothing is odd one out. */
const HEADER_IDLE = 'text-white/80';

/** The fill an open menu takes — and the only thing in the bar that takes it. */
const HEADER_OPEN = 'bg-white/18 text-white';

/**
 * (3) HAIRLINE GROUP — the only bordered treatment in the bar.
 *
 * The rule this encodes: the border and the fill live ONCE, on the container,
 * and never on a member. That is the whole difference between five bordered
 * boxes and one object holding two glyphs, and it is what stopped the bar
 * reading as a stripe. Do not re-add a ring to a button inside one.
 */
const HEADER_CAPSULE =
  'flex items-center gap-0.5 rounded-full p-0.5 ring-1 ring-inset ring-white/15';

/**
 * (4) HAIRLINE FIELD — the ten categories, in the panel and in the drawer.
 *
 * The owner's complaint about the old panel was that it read as a pile of
 * loose parts: ten bordered cards, each with its own edge, floating on a
 * shared background with gutters between them. This is the same ten rows as
 * one object. The list paints `bg-line` and the CELLS paint `bg-surface`, so
 * the only thing that shows through the 1px gaps is the divider colour — a
 * table's rules, drawn without a border on anything. The cells sit on the
 * same surface as the panel around them, so the eye reads a single field
 * divided up, not ten tiles set down.
 *
 * `p-px` closes the outer edge with the same hairline, which is why no member
 * carries a border of its own. Adding one back puts the gutters back.
 */
const HEADER_FIELD = 'grid gap-px overflow-hidden rounded-2xl bg-line p-px';

/** A cell of that field. The fill is here, not on the `<li>`, so hover covers it. */
const HEADER_FIELD_CELL =
  'press flex w-full touch-manipulation items-center bg-surface transition-colors hover:bg-surface-2';

/** The house eyebrow, above every section of every panel this file opens. */
const EYEBROW = 'text-[11px] font-black uppercase tracking-wider text-subtle';

type HeaderMenu = 'browse' | 'settings' | 'account';

export const Header: React.FC = () => {
  const { t, language } = useTranslation();
  const currentUser = useAppStore((state) => state.currentUser);
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const setFilters = useAppStore((state) => state.setFilters);
  const logout = useAppStore((state) => state.logout);
  const favorites = useAppStore((state) => state.favoriteIds);
  const unreadChatCount = useAppStore((state) => state.unreadChatCount);

  const requireAuth = useRequireAuth();
  const reducedMotion = useReducedMotion();

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

  const browseTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);

  const browseOpen = openMenu === 'browse';

  /**
   * Three pieces of state for one panel, because a panel that animates OUT
   * cannot be a plain `{open && …}`.
   *
   * `browseMounted` is "in the DOM": it turns on with the menu and turns off
   * one transition later, which is the only way the closing half of the
   * animation has anything to run on. `browseExpanded` is the flag the
   * transition classes read — it is deliberately switched a frame AFTER the
   * mount, because a browser interpolates between two rendered values and an
   * element born at its final height simply appears there. `browseHeight` is
   * the measured height that `max-height` animates to; a hard-coded ceiling
   * would finish the wipe early and then spend the rest of the duration
   * animating nothing, which is exactly the "bir daniga" pop the owner was
   * objecting to.
   */
  const [browseMounted, setBrowseMounted] = useState(false);
  const [browseExpanded, setBrowseExpanded] = useState(false);
  const [browseHeight, setBrowseHeight] = useState(0);
  const browsePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (browseOpen) {
      setBrowseMounted(true);
      return;
    }
    setBrowseExpanded(false);
    // Under `prefers-reduced-motion` index.css has already clamped every
    // transition to 0.01ms, so there is nothing left to wait for — and
    // waiting anyway would leave a fully-visible panel sitting on the page
    // for a third of a second after it was dismissed.
    const timer = window.setTimeout(() => setBrowseMounted(false), reducedMotion ? 0 : PANEL_MS);
    return () => window.clearTimeout(timer);
  }, [browseOpen, reducedMotion]);

  /**
   * Measure, then expand on the next frame.
   *
   * `browseOpen` is in the dependency list as well as `browseMounted` so that
   * closing and re-opening inside one transition re-expands: on that path the
   * element never unmounts, so `browseMounted` does not change and an effect
   * keyed only on it would never run again — the panel would stay collapsed
   * with the menu flagged open.
   *
   * `language` is here for the same reason: the panel's height depends on how
   * many lines its labels take, and Russian is not Uzbek.
   */
  useEffect(() => {
    if (!browseOpen || !browseMounted) return;
    const measure = () => setBrowseHeight(browsePanelRef.current?.offsetHeight ?? 0);
    measure();
    const frame = requestAnimationFrame(() => setBrowseExpanded(true));
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [browseOpen, browseMounted, language]);

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
   * `panel` is the browse dropdown, wide enough to set the illustration, the
   * name and a description on one line; `tiles` is the drawer, where the
   * widest cell a 360px phone can give is ~134px and a horizontal row would
   * leave the name about 78 pixels — half of "Yuqori ishonchli". So the
   * drawer stacks its cell instead and hands the label the whole width.
   *
   * What they share is the field: one surface, hairline rules, no gutters and
   * no border on any member (see `HEADER_FIELD`). The drawer's ten bordered
   * cards had the same pile-of-parts problem the panel did, and mobile is
   * where most of this product is used.
   *
   * Two columns and five, never three or four: ten divides evenly into both,
   * so no row ever ends half-empty.
   */
  const renderCategories = (variant: 'panel' | 'tiles') => (
    <ul
      aria-label={t('layout.categories.label')}
      className={`${HEADER_FIELD} ${variant === 'panel' ? 'grid-cols-2 xl:grid-cols-5' : 'grid-cols-2'}`}
    >
      {CATEGORIES.map((category) => (
        // The `<li>` is a flex container purely so its single child stretches
        // to the row's height; a short cell would otherwise leave a stripe of
        // the list's divider colour showing under it.
        <li key={category.id} className="flex">
          <button
            type="button"
            onClick={() => openCategory(category.id)}
            className={`${HEADER_FIELD_CELL} ${
              variant === 'panel'
                ? 'min-h-14 gap-2.5 px-3 py-2 text-left'
                : 'min-h-11 flex-col justify-center gap-1 px-2 py-2.5 text-center'
            }`}
          >
            <img
              src={category.image}
              alt=""
              aria-hidden="true"
              width={variant === 'panel' ? 36 : 32}
              height={variant === 'panel' ? 36 : 32}
              loading="lazy"
              decoding="async"
              className={`shrink-0 select-none object-contain ${
                variant === 'panel' ? 'h-9 w-9' : 'h-8 w-8'
              }`}
            />
            <span className={variant === 'panel' ? 'min-w-0 flex-1' : 'w-full min-w-0'}>
              <span
                className={`block truncate font-bold text-content ${
                  variant === 'panel' ? 'text-[13px]' : 'text-[11px]'
                }`}
              >
                {t(category.titleKey)}
              </span>
              {/* One line, clipped — not the two-line clamp this used to run.
                  A row whose height depends on how long its own sentence is
                  makes the grid ragged, and a ragged grid is the thing that
                  stopped these ten reading as one list. */}
              {variant === 'panel' && (
                <span className="block truncate text-[11px] leading-snug text-muted">
                  {t(category.descriptionKey)}
                </span>
              )}
            </span>
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
        <p className={`${EYEBROW} mb-2`}>{t('common.language.label')}</p>
        <LanguageSwitcher inline />
      </div>
      <div>
        <p className={`${EYEBROW} mb-2`}>{t('common.theme.label')}</p>
        <ThemeToggle compact={false} />
      </div>
    </div>
  );

  const drawerSection = (titleKey: TranslationKey, children: React.ReactNode) => (
    <section className="pt-5">
      <h3 className={`${EYEBROW} mb-2`}>{t(titleKey)}</h3>
      {children}
    </section>
  );

  /** One section link in the middle of the bar. */
  const barNavLink = (item: NavItem) => {
    const active = currentView === item.view;
    return (
      <AppLink
        key={item.view}
        view={item.view}
        onNavigate={closeMenus}
        aria-current={active ? 'page' : undefined}
        className={`${HEADER_NAV_LINK} ${item.wideOnly ? 'hidden xl:flex' : ''} ${
          active ? 'font-black text-white' : `font-bold ${HEADER_IDLE} hover:bg-white/12 hover:text-white`
        }`}
      >
        <span className="truncate">{t(item.labelKey)}</span>
        {/* The current section is underlined, not filled. `HEADER_OPEN` is
            the bar's one fill and it means "this menu is open"; spending it
            here as well is precisely the collision the redesign removed. The
            rule is outside the truncating span because `truncate` clips
            everything that overflows the label's box, including this. */}
        {active && (
          <span
            className="absolute inset-x-2.5 bottom-1.5 h-0.5 rounded-full bg-white"
            aria-hidden="true"
          />
        )}
      </AppLink>
    );
  };

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
              app icon is what a native app shows anyway. The full lockup waits
              for `xl` now rather than `sm`, because between 1024 and 1279 the
              ~25px it costs is the difference between the section links
              fitting and the row overflowing. `-ml-1` pulls the hover circle's
              optical edge back onto the gutter line. */}
          <AppLink
            view="HOME"
            onNavigate={closeMenus}
            aria-label={t('common.brand.name')}
            className="press -ml-1 flex min-h-11 shrink-0 items-center rounded-full px-1 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <span className="min-[390px]:hidden">
              <Logo size="sm" markOnly />
            </span>
            <span className="hidden min-[390px]:block xl:hidden">
              <Logo size="sm" inverted />
            </span>
            <span className="hidden xl:block">
              <Logo size="md" inverted />
            </span>
          </AppLink>

          {/* 2 — the main pages, in the middle of the bar.
              `flex-1` rather than a fixed width: the group centres itself in
              whatever is left between the wordmark and the cluster, which is
              what stops it hugging the logo. Below `lg` it is not rendered at
              all and the cluster's `ml-auto` takes over, leaving the phone
              exactly two objects. */}
          <nav
            aria-label={t('layout.header.browseSections')}
            className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex"
          >
            {PRIMARY_NAV.map(barNavLink)}

            {/* The ten categories are one press behind this, and the panel it
                opens is anchored to the bar rather than to the button. The
                label waits for `xl` for the same width reason as the wordmark;
                the grid glyph and the chevron say "this opens something" on
                their own. */}
            <button
              type="button"
              ref={browseTriggerRef}
              data-header-menu
              onClick={() => toggleMenu('browse')}
              aria-haspopup="true"
              aria-expanded={browseOpen}
              aria-controls="header-browse"
              className={`${HEADER_GHOST_PILL} px-2.5 text-[13px] font-bold ${
                browseOpen ? HEADER_OPEN : HEADER_IDLE
              }`}
            >
              <LayoutGrid className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="hidden xl:inline">{t('layout.categories.label')}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-out ${
                  browseOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </nav>

          {/* 3-6 — the cluster. Two pitches only: 2px inside the capsule,
              12px between everything else. The old bar ran six children at a
              flat 6px with no divider and no grouping anywhere. `ml-auto`
              only does anything below `lg`, where the nav that would otherwise
              absorb the free space is not rendered. */}
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {/* 3 — "your stuff". The one bordered object in the bar. It
                renders only for a signed-in visitor — a heart that opens a
                login dialog is a control that blocks the person pressing it —
                and only at `xl`: below that it is the account menu's job, and
                below `lg` both of these are BottomNav tabs. */}
            {currentUser && (
              <div className={`hidden ${HEADER_CAPSULE} xl:flex`}>
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

            {/* 4 — language and appearance behind one glyph. The two-letter
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

            {/* 5 — the money action, and the only fully-filled shape in the
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

            {/* 6 — account. A circle when signed in, a borderless word when
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

            {/* The trailing control below `lg`, and the only one there besides
                the brand. Showing the face inside the menu trigger is also
                what closes the 640-1023px identity hole: the old account
                button was `lg:inline-flex`, so a signed-in visitor on a tablet
                saw no avatar, no name and no route to their profile anywhere
                in the bar. The label finally flips to "close" when the drawer
                is open — the key has existed and gone unused since it was
                written. */}
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

        {/* 2a — the browse panel, and the animation the owner asked for.
            It has to look like it is peeling out from behind the bar's own
            bottom edge, not appearing there. Three things do that, all on
            these two elements and none of them in index.css, which belongs to
            another part of the app:

              - the outer element is `overflow-hidden` with an animated
                `max-height`, so at rest the panel is a zero-height slot under
                the bar and the reveal is a wipe downward, clipped by the
                header's edge for the whole of it;
              - the inner panel starts 16px higher and transparent and settles
                into place as the slot opens, which is what makes the surface
                look like it is being drawn out rather than uncovered;
              - both run 300ms on `ease-out`, and the panel stays mounted for
                the same 300ms after the menu closes so the exit is the
                entrance in reverse instead of a disappearance.

            The height is measured rather than guessed — see the state block
            at the top of the component. `prefers-reduced-motion` is honoured
            twice over: index.css clamps the two transitions to nothing, and
            the translate is dropped here so the panel does not jump 16px. */}
        {browseMounted && (
          <div
            id="header-browse"
            data-header-menu
            className="pointer-events-none absolute inset-x-0 top-full hidden overflow-hidden pb-10 transition-[max-height] duration-300 ease-out lg:block"
            style={{ maxHeight: browseExpanded ? browseHeight + PANEL_SHADOW_ROOM : 0 }}
          >
            <div className="gutter-safe mx-auto max-w-7xl">
              <div
                ref={browsePanelRef}
                className={`pointer-events-auto rounded-b-3xl border-x border-b border-line bg-surface px-4 pb-4 pt-3 text-content shadow-raised transition duration-300 ease-out ${
                  browseExpanded || reducedMotion
                    ? 'translate-y-0 opacity-100'
                    : '-translate-y-4 opacity-0'
                }`}
              >
                {/* One header line, and the panel's only other control sits on
                    the end of it rather than on a row of its own underneath —
                    a single button alone on a line is exactly the "1 ta oʻzi 1
                    ta qatorni egallab" shape the owner objected to. */}
                <div className="flex items-center justify-between gap-3 pb-2.5">
                  <p className={`${EYEBROW} min-w-0 truncate`}>
                    {t('layout.categories.chooseSection')}
                  </p>
                  <AppLink
                    view="LISTINGS"
                    onNavigate={closeMenus}
                    className="press flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-brand-text transition-colors hover:bg-brand-soft"
                  >
                    {t('home.categories.viewAll')}
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </AppLink>
                </div>

                {renderCategories('panel')}
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
