/** Mobile tab bar. */

import React from 'react';
import {
  Heart,
  Home,
  Plus,
  Search,
  User as UserIcon,
  Map as MapIcon,
  MessageSquare,
  BarChart3,
} from 'lucide-react';

import { useTranslation, type TranslationKey } from '../../i18n';
import { useAppStore, type ViewState } from '../../stores/useAppStore';
import { AppLink } from '../../router/AppLink';
import { REQUIRES_AUTH, authTabForView } from '../../router/views';
import { useIsAuthenticated, useRequireAuth } from '../../hooks/useRequireAuth';
import { canPublishListings } from '../../types/roles';

interface Tab {
  view: ViewState;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
}

const TABS: Tab[] = [
  { view: 'HOME', labelKey: 'layout.nav.home', icon: Home },
  { view: 'MAP', labelKey: 'layout.nav.map', icon: MapIcon },
  { view: 'LISTINGS', labelKey: 'layout.nav.listings', icon: Search },
  { view: 'CREATE_LISTING', labelKey: 'layout.nav.createListing', icon: Plus, primary: true },
  { view: 'CHAT', labelKey: 'layout.nav.chat', icon: MessageSquare },
  { view: 'FAVORITES', labelKey: 'layout.nav.favorites', icon: Heart },
  { view: 'PROFILE', labelKey: 'layout.nav.profile', icon: UserIcon },
];

/**
 * The owner's tab bar.
 *
 * Seven slots is already one more than a phone comfortably holds, so an
 * eighth is not available — an owner gets "my listings" in place of the map.
 * The map is a way to *find* somewhere to live, which is not what someone
 * with listings of their own opened the app to do; their own performance
 * numbers are. The map is still one tap away in the header and the footer.
 */
const OWNER_TABS: Tab[] = TABS.map((tab) =>
  tab.view === 'MAP'
    ? { view: 'MY_LISTINGS', labelKey: 'layout.nav.myListings', icon: BarChart3 }
    : tab,
);

export const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const currentUser = useAppStore((state) => state.currentUser);
  const favorites = useAppStore((state) => state.favoriteIds);
  const unreadChatCount = useAppStore((state) => state.unreadChatCount);

  const requireAuth = useRequireAuth();
  const authenticated = useIsAuthenticated();

  const tabs = canPublishListings(currentUser?.role) ? OWNER_TABS : TABS;

  /** True when tapping this tab should open the auth dialog instead. */
  const isGated = (tab: Tab) => REQUIRES_AUTH.has(tab.view) && !authenticated;

  // The gate itself lives in `useRequireAuth`, and the tab it opens on comes
  // from the same table App.tsx's route guard reads. Before that, this file
  // decided both for itself and disagreed with the header about which tab
  // "post a listing" should land on.
  const open = (tab: Tab) =>
    requireAuth(() => setCurrentView(tab.view), authTabForView(tab.view));

  return (
    <nav
      aria-label={t('common.a11y.menu')}
      // `pb-safe-plus`, not `pb-safe`: the bare utility is unlayered and so
      // *replaces* any Tailwind `pb-*` on the same element, and on a phone
      // with no home indicator it resolves to zero — which put the row's last
      // pixel on the screen's last pixel.
      className="pb-safe-plus px-safe fixed inset-x-0 bottom-0 z-[80] border-t border-line bg-surface/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const active = currentView === tab.view;
          if (tab.primary) {
            return (
              <li key={tab.view} className="flex flex-1 items-center justify-center">
                <button
                  type="button"
                  onClick={() => open(tab)}
                  aria-label={t(tab.labelKey)}
                  className="press -mt-5 flex h-14 w-14 touch-manipulation items-center justify-center rounded-2xl bg-brand text-on-brand shadow-brand"
                >
                  <tab.icon className="h-6 w-6" aria-hidden="true" />
                </button>
              </li>
            );
          }
          // Seven tabs now, so the icons carry the row on their own; the
          // label that used to sit under each one no longer fits a narrow
          // phone. `aria-label` is what keeps the tab named for a screen
          // reader once the visible text is gone.
          const className = `press relative flex h-full min-h-12 w-full touch-manipulation items-center justify-center py-3 transition-colors ${
            active ? 'text-brand-text' : 'text-subtle hover:text-content'
          }`;
          const badge =
            tab.view === 'FAVORITES'
              ? favorites.size
              : tab.view === 'CHAT'
                ? unreadChatCount
                : 0;
          const body = (
            <span className="relative">
              <tab.icon className="h-6 w-6" aria-hidden="true" />
              {badge > 0 && (
                // Capped at 9+ and set in `tabular-nums`, the same as the
                // header's: a two-digit count stretched this into a lozenge,
                // and the two navigation surfaces are on screen together
                // below `lg` showing the same two numbers.
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-black tabular-nums text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
          );

          return (
            <li key={tab.view} className="flex-1">
              {/* A gated tab opens the sign-in dialog rather than navigating,
                  so it stays a button — an anchor whose href never loads is
                  worse than no anchor at all. */}
              {isGated(tab) ? (
                <button
                  type="button"
                  onClick={() => open(tab)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={t(tab.labelKey)}
                  className={className}
                >
                  {body}
                </button>
              ) : (
                <AppLink
                  view={tab.view}
                  aria-current={active ? 'page' : undefined}
                  aria-label={t(tab.labelKey)}
                  className={className}
                >
                  {body}
                </AppLink>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;
