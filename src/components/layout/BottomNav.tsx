/** Mobile tab bar. */

import React from 'react';
import { Heart, Home, Map, Plus, Search, User as UserIcon } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore, type ViewState } from '../../stores/useAppStore';

interface Tab {
  view: ViewState;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
}

const TABS: Tab[] = [
  { view: 'HOME', labelKey: 'layout.nav.home', icon: Home },
  { view: 'LISTINGS', labelKey: 'layout.nav.listings', icon: Search },
  { view: 'CREATE_LISTING', labelKey: 'layout.nav.createListing', icon: Plus, primary: true },
  { view: 'MAP', labelKey: 'layout.nav.map', icon: Map },
  { view: 'FAVORITES', labelKey: 'layout.nav.favorites', icon: Heart },
  { view: 'PROFILE', labelKey: 'layout.nav.profile', icon: UserIcon },
];

export const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const currentUser = useAppStore((state) => state.currentUser);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const favorites = useAppStore((state) => state.favoriteIds);

  const open = (tab: Tab) => {
    const needsAuth = tab.view === 'CREATE_LISTING' || tab.view === 'FAVORITES' || tab.view === 'PROFILE';
    if (needsAuth && !currentUser) {
      setShowAuth(true, tab.view === 'CREATE_LISTING' ? 'REGISTER' : 'LOGIN');
      return;
    }
    setCurrentView(tab.view);
  };

  return (
    <nav
      aria-label={t('common.a11y.menu')}
      className="pb-safe fixed inset-x-0 bottom-0 z-[80] border-t border-line bg-surface/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const active = currentView === tab.view;
          if (tab.primary) {
            return (
              // `flex-1` like every other tab, so all five columns are equal
              // and the third one is the true centre. Without it this item was
              // only as wide as its button while the others grew, which slid
              // the "+" off-centre to the left.
              <li key={tab.view} className="flex flex-1 items-center justify-center">
                <button
                  type="button"
                  onClick={() => open(tab)}
                  aria-label={t(tab.labelKey as never)}
                  className="-mt-5 flex h-13 w-13 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-brand transition-transform active:scale-95"
                >
                  <tab.icon className="h-6 w-6" aria-hidden="true" />
                </button>
              </li>
            );
          }
          return (
            <li key={tab.view} className="flex-1">
              <button
                type="button"
                onClick={() => open(tab)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex w-full flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors ${
                  active ? 'text-brand-text' : 'text-subtle hover:text-content'
                }`}
              >
                <span className="relative">
                  <tab.icon className="h-5 w-5" aria-hidden="true" />
                  {tab.view === 'FAVORITES' && favorites.size > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-black text-white">
                      {favorites.size}
                    </span>
                  )}
                </span>
                {t(tab.labelKey as never)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;
