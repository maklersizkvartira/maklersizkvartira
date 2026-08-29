/**
 * Top bar and mobile drawer.
 *
 * The bar has one order, left to right, and it does not change with the
 * viewport — logo, navigation, then the actions in a fixed sequence: search,
 * language, theme, post-a-listing, account. Things drop out of it as the
 * screen narrows, but nothing ever moves past anything else, so the icon a
 * thumb learned on a phone is in the same relative place on a laptop.
 *
 * Its height is a number other files depend on: 56px of bar (64 at `sm`), a
 * 28px trust strip, and the two 1px borders — 86px, 94px at `sm`. `<main>` in
 * App.tsx clears exactly that. Change one and change the other.
 *
 * The drawer used to be a bespoke portal, which is why it had no focus trap,
 * no Escape handler and no safe-area padding. It is a `<Sheet side="right">`
 * now and inherits all three.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  Plus,
  Search,
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
import { canPublishListings, roleLabelKey } from '../../types/roles';
import { AppLink } from '../../router/AppLink';
import { authTabForView } from '../../router/views';
import { useRequireAuth } from '../../hooks/useRequireAuth';

interface NavItem {
  view: ViewState;
  labelKey: TranslationKey;
  ownerOnly?: boolean;
  authOnly?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { view: 'HOME', labelKey: 'layout.nav.home' },
  { view: 'LISTINGS', labelKey: 'layout.nav.listings' },
  { view: 'MAP', labelKey: 'layout.nav.map' },
  { view: 'STUDENT_PROGRAM', labelKey: 'layout.nav.studentProgram' },
];

const ACCOUNT_NAV: NavItem[] = [
  { view: 'PROFILE', labelKey: 'layout.nav.profile', authOnly: true },
  { view: 'MY_LISTINGS', labelKey: 'layout.nav.myListings', ownerOnly: true },
  { view: 'FAVORITES', labelKey: 'layout.nav.favorites', authOnly: true },
  { view: 'VERIFICATION', labelKey: 'layout.nav.verification', authOnly: true },
  { view: 'REFERRAL', labelKey: 'layout.nav.referral', authOnly: true },
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

/** Every icon-only control in the bar, so none of them is under a thumb. */
const ICON_BUTTON =
  'press flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl ' +
  'border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 hover:text-white sm:h-11 sm:w-11';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const currentUser = useAppStore((state) => state.currentUser);
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const setFilters = useAppStore((state) => state.setFilters);
  const logout = useAppStore((state) => state.logout);
  const favorites = useAppStore((state) => state.favoriteIds);

  const requireAuth = useRequireAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);

  // The drawer's own scroll lock, focus trap and Escape handling belong to
  // <Sheet>; only the desktop dropdown needs dismissing by hand.
  useEffect(() => {
    if (!categoriesOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!categoriesRef.current?.contains(event.target as Node)) setCategoriesOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCategoriesOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [categoriesOpen]);

  const closeMenus = () => {
    setDrawerOpen(false);
    setCategoriesOpen(false);
  };

  const go = (view: ViewState) => {
    setCurrentView(view);
    closeMenus();
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

  const categoryList = (
    <ul className="grid gap-1 sm:grid-cols-2">
      {CATEGORIES.map((category) => (
        <li key={category.id}>
          <button
            type="button"
            onClick={() => openCategory(category.id)}
            className="press flex w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          >
            <img
              src={category.image}
              alt=""
              aria-hidden="true"
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
              className="h-12 w-12 shrink-0 select-none object-contain"
            />
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
          </button>
        </li>
      ))}
    </ul>
  );

  const drawerSection = (titleKey: TranslationKey, children: React.ReactNode) => (
    <section className="pt-5">
      <h3 className="mb-2 text-[11px] font-black uppercase tracking-wider text-subtle">
        {t(titleKey)}
      </h3>
      {children}
    </section>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[90] border-b border-white/10 bg-band text-white backdrop-blur">
        {/* Visible only once it has focus: the first Tab on any page offers to
            jump the whole bar instead of walking through fifteen controls. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-10 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-band"
        >
          {t('layout.header.skipToContent')}
        </a>

        <div className="gutter-safe mx-auto flex h-14 max-w-7xl items-center gap-1.5 sm:h-16">
          <AppLink
            view="HOME"
            onNavigate={closeMenus}
            className="press flex shrink-0 items-center gap-2"
            aria-label={t('common.brand.name')}
          >
            <span className="hidden sm:block">
              <Logo size="md" inverted />
            </span>
            <span className="sm:hidden">
              <Logo size="sm" inverted />
            </span>
          </AppLink>

          <nav
            aria-label={t('common.a11y.menu')}
            className="ml-1 hidden items-center gap-1 lg:flex"
          >
            {PRIMARY_NAV.map((item) => (
              <AppLink
                key={item.view}
                view={item.view}
                onNavigate={closeMenus}
                aria-current={currentView === item.view ? 'page' : undefined}
                className={`press flex min-h-11 items-center rounded-xl px-3 text-sm font-bold transition-colors ${
                  currentView === item.view
                    ? 'bg-white/20 text-white shadow-xs'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {t(item.labelKey)}
              </AppLink>
            ))}

            <div className="relative" ref={categoriesRef}>
              <button
                type="button"
                onClick={() => setCategoriesOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={categoriesOpen}
                className={`press flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold transition-colors ${
                  categoriesOpen
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {t('layout.categories.label')}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${categoriesOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {categoriesOpen && (
                <div
                  role="menu"
                  aria-label={t('layout.categories.label')}
                  className="animate-fade-in absolute left-0 top-full mt-2 w-[34rem] rounded-2xl border border-line bg-surface p-2 shadow-raised text-content"
                >
                  <p className="px-3 pb-1 pt-2 text-[11px] font-black uppercase tracking-wider text-subtle">
                    {t('layout.categories.chooseSection')}
                  </p>
                  {categoryList}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <AppLink
              view="LISTINGS"
              onNavigate={closeMenus}
              aria-label={t('layout.header.searchAria')}
              className={ICON_BUTTON}
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </AppLink>

            <AppLink
              view="FAVORITES"
              onNavigate={closeMenus}
              aria-label={t('layout.nav.favorites')}
              className={`${ICON_BUTTON} relative hidden sm:flex`}
            >
              <Heart className="h-5 w-5" aria-hidden="true" />
              {favorites.size > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white">
                  {favorites.size}
                </span>
              )}
            </AppLink>

            <div className="hidden sm:block">
              <LanguageSwitcher inverted />
            </div>
            <div className="hidden sm:block">
              <ThemeToggle inverted />
            </div>

            <button
              type="button"
              onClick={postListing}
              className="press hidden min-h-11 touch-manipulation items-center gap-1.5 rounded-xl bg-white text-band px-3.5 text-xs font-black shadow-md transition-all hover:bg-white/90 active:scale-95 sm:inline-flex"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('layout.header.createListingCta')}
            </button>

            {currentUser ? (
              <button
                type="button"
                onClick={() => go('PROFILE')}
                aria-label={t('layout.nav.profile')}
                className="press hidden min-h-11 touch-manipulation items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2 text-white hover:bg-white/20 lg:inline-flex"
              >
                {avatar('h-7 w-7')}
                <span className="max-w-24 truncate text-xs font-bold text-white">
                  {currentUser.name.split(' ')[0]}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuth(true, 'LOGIN')}
                className="press hidden min-h-11 touch-manipulation items-center rounded-xl border border-white/20 bg-white/10 px-3.5 text-xs font-bold text-white transition-colors hover:bg-white/20 lg:inline-flex"
              >
                {t('common.action.signIn')}
              </button>
            )}

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('layout.header.openMenu')}
              aria-expanded={drawerOpen}
              className={`${ICON_BUTTON} lg:hidden`}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
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
        <div className="divide-y divide-line">
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
              <button
                type="button"
                onClick={postListing}
                className="press flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand shadow-brand"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('layout.nav.createListing')}
              </button>
              {[...PRIMARY_NAV, ...ACCOUNT_NAV].filter(visible).map((item) => {
                const active = currentView === item.view;
                return (
                  <AppLink
                    key={item.view}
                    view={item.view}
                    onNavigate={closeMenus}
                    aria-current={active ? 'page' : undefined}
                    className={`press flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-xl px-4 text-sm font-bold transition-colors ${
                      active
                        ? 'bg-brand-soft text-brand-text'
                        : 'text-muted hover:bg-surface-2 hover:text-content'
                    }`}
                  >
                    {t(item.labelKey)}
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" />}
                  </AppLink>
                );
              })}
            </nav>,
          )}

          {drawerSection('layout.header.drawerCategories', categoryList)}

          {drawerSection(
            'layout.header.drawerSettings',
            <div className="space-y-3 pb-2">
              <ThemeToggle compact={false} />
              <LanguageSwitcher />
            </div>,
          )}
        </div>
      </Sheet>
    </>
  );
};

export default Header;
