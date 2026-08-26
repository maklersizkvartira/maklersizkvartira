/**
 * Top bar and mobile drawer.
 *
 * The previous header set `pointer-events-none` on its root and re-enabled it
 * only on the top bar, which left the entire mobile drawer — navigation and
 * sign-out included — unclickable. The drawer is now rendered in a portal,
 * outside the header's stacking context, so that class of bug cannot recur.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Heart,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore, type ViewState } from '../../stores/useAppStore';
import { Logo } from '../brand/Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { canPublishListings, roleLabelKey } from '../../types/roles';

interface NavItem {
  view: ViewState;
  labelKey: string;
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

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const currentUser = useAppStore((state) => state.currentUser);
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const logout = useAppStore((state) => state.logout);
  const favorites = useAppStore((state) => state.favoriteIds);

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const go = (view: ViewState) => {
    setCurrentView(view);
    setDrawerOpen(false);
  };

  const visible = (item: NavItem) => {
    if (item.ownerOnly) return canPublishListings(currentUser?.role);
    if (item.authOnly) return Boolean(currentUser);
    return true;
  };

  const drawer = drawerOpen
    ? createPortal(
        <div className="fixed inset-0 z-[110] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={t('common.a11y.menu')}
            className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col overflow-y-auto border-l border-line bg-surface shadow-raised"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t('layout.header.closeMenu')}
                className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-content"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {currentUser ? (
              <div className="border-b border-line px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft-2 text-brand-text">
                    {currentUser.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-6 w-6" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-content">
                      {currentUser.name}
                    </p>
                    <p className="text-xs text-muted">
                      {t(roleLabelKey(currentUser.role))}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-b border-line px-4 py-4">
                <p className="text-sm font-black text-content">
                  {t('layout.sidebar.guestTitle')}
                </p>
                <p className="mt-1 text-xs text-muted">{t('layout.sidebar.guestSubtitle')}</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowAuth(true, 'LOGIN');
                    setDrawerOpen(false);
                  }}
                  className="mt-3 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-on-brand shadow-brand"
                >
                  {t('layout.header.loginOrRegister')}
                </button>
              </div>
            )}

            <nav className="flex-1 px-2 py-3">
              {[...PRIMARY_NAV, ...ACCOUNT_NAV].filter(visible).map((item) => (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => go(item.view)}
                  aria-current={currentView === item.view ? 'page' : undefined}
                  className={`w-full rounded-xl px-3 py-3 text-left text-sm font-bold transition-colors ${
                    currentView === item.view
                      ? 'bg-brand-soft text-brand-text'
                      : 'text-muted hover:bg-surface-2 hover:text-content'
                  }`}
                >
                  {t(item.labelKey as never)}
                </button>
              ))}
            </nav>

            <div className="space-y-3 border-t border-line px-4 py-4">
              <ThemeToggle compact={false} />
              <LanguageSwitcher />
              {currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    void logout();
                    setDrawerOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 px-4 py-3 text-sm font-bold text-danger transition-colors hover:bg-danger-soft"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {t('common.action.signOut')}
                </button>
              )}
            </div>
          </aside>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[90] border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <button
            type="button"
            onClick={() => go('HOME')}
            className="flex shrink-0 items-center gap-2"
            aria-label={t('common.brand.name')}
          >
            {/* The name is rendered at every width. It used to be the mark
                alone below sm, to leave room for the actions — but every one
                of those is itself hidden below sm except the menu button, so
                the room was never needed and the brand simply went missing on
                phones.

                The wrappers own the display utility; passing `hidden` into
                Logo would collide with its own `inline-flex`. */}
            <span className="hidden sm:block">
              <Logo size="md" />
            </span>
            <span className="sm:hidden">
              <Logo size="sm" />
            </span>
          </button>

          <nav className="ml-2 hidden items-center gap-1 lg:flex">
            {PRIMARY_NAV.map((item) => (
              <button
                key={item.view}
                type="button"
                onClick={() => go(item.view)}
                aria-current={currentView === item.view ? 'page' : undefined}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                  currentView === item.view
                    ? 'bg-brand-soft text-brand-text'
                    : 'text-muted hover:bg-surface-2 hover:text-content'
                }`}
              >
                {t(item.labelKey as never)}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => go('FAVORITES')}
              aria-label={t('layout.nav.favorites')}
              className="relative hidden rounded-xl border border-line bg-surface p-2 text-muted transition-colors hover:border-brand hover:text-content sm:block"
            >
              <Heart className="h-4 w-4" aria-hidden="true" />
              {favorites.size > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white">
                  {favorites.size}
                </span>
              )}
            </button>

            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            <button
              type="button"
              onClick={() =>
                currentUser ? go('CREATE_LISTING') : setShowAuth(true, 'REGISTER')
              }
              className="flex items-center gap-1 sm:gap-1.5 rounded-xl bg-brand px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold text-on-brand shadow-brand transition-colors hover:bg-brand-hover"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              {t('layout.header.createListingCta')}
            </button>

            {currentUser ? (
              <button
                type="button"
                onClick={() => go('PROFILE')}
                className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-1.5 lg:inline-flex"
              >
                <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-brand-soft-2 text-brand-text">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <span className="max-w-24 truncate text-xs font-bold text-content">
                  {currentUser.name.split(' ')[0]}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuth(true, 'LOGIN')}
                className="hidden rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold text-content transition-colors hover:border-brand lg:inline-block"
              >
                {t('common.action.signIn')}
              </button>
            )}

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('layout.header.openMenu')}
              aria-expanded={drawerOpen}
              className="rounded-xl border border-line bg-surface p-2 text-muted transition-colors hover:text-content lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 border-t border-line bg-brand-soft py-1.5 text-[11px] font-bold text-brand-text">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.brand.shortTagline')}
        </div>
      </header>

      {drawer}
    </>
  );
};

export default Header;
