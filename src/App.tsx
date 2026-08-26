/**
 * Application shell.
 *
 * Routing is a view switch rather than a router: the app is a single-surface
 * product and the previous build already worked this way. Deep links are read
 * from the query string on mount and written back on navigation.
 *
 * Every view except the listings grid is code-split, so the initial bundle
 * carries only what the first screen needs.
 */

import React, { Suspense, lazy, useEffect } from 'react';

import { AuthDialog } from './components/auth/AuthDialog';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { Toaster } from './components/layout/Toaster';
import { ListingsPage } from './components/listings/ListingsPage';
import { ShieldMascot } from './components/common/ShieldMascot';
import { GlobalAINotification } from './components/common/GlobalAINotification';
import { useTranslation } from './i18n';
import { setSessionExpiredHandler } from './services/http';
import { MetaApi } from './services/listingsApi';
import { useAppStore, type ViewState } from './stores/useAppStore';

const HomePage = lazy(() => import('./components/home/HomePage'));
const ListingDetailPage = lazy(() => import('./components/listing/ListingDetailPage'));
const MapView = lazy(() => import('./components/map/MapView'));
const FavoritesPage = lazy(() => import('./components/favorites/FavoritesPage'));
const ProfilePage = lazy(() => import('./components/profile/ProfilePage'));
const MyListingsPage = lazy(() => import('./components/owner/MyListingsPage'));
const CreateListingPage = lazy(() => import('./components/owner/CreateListingPage'));
const VerificationPage = lazy(() => import('./components/verification/VerificationPage'));
const ReferralPage = lazy(() => import('./components/growth/ReferralPage'));
const StudentProgramPage = lazy(() => import('./components/student/StudentProgramPage'));
const EcosystemPreviewPage = lazy(() => import('./components/ecosystem/EcosystemPreviewPage'));
const ChatPage = lazy(() => import('./components/chat/ChatPage'));

const VIEW_FROM_QUERY: Record<string, ViewState> = {
  listings: 'LISTINGS',
  map: 'MAP',
  favorites: 'FAVORITES',
  profile: 'PROFILE',
  my_listings: 'MY_LISTINGS',
  create_listing: 'CREATE_LISTING',
  verification: 'VERIFICATION',
  referral: 'REFERRAL',
  student_program: 'STUDENT_PROGRAM',
  ecosystem_preview: 'ECOSYSTEM_PREVIEW',
  chat: 'CHAT',
};

/** Views that require an account; a guest is sent to the auth dialog instead. */
const REQUIRES_AUTH: ReadonlySet<ViewState> = new Set<ViewState>([
  'CREATE_LISTING',
  'MY_LISTINGS',
  'PROFILE',
  'FAVORITES',
  'VERIFICATION',
  'REFERRAL',
  'CHAT',
]);

const Loading: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status">
      <div className="flex flex-col items-center gap-3">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
          aria-hidden="true"
        />
        <p className="text-xs font-bold text-muted">{t('common.state.loading')}</p>
      </div>
    </div>
  );
};

const SignInPrompt: React.FC = () => {
  const { t } = useTranslation();
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-black text-content">{t('auth.guard.title')}</h1>
      <p className="mt-2 text-sm text-muted">{t('auth.guard.body')}</p>
      <button
        type="button"
        onClick={() => setShowAuth(true, 'LOGIN')}
        className="mt-5 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-on-brand shadow-brand"
      >
        {t('auth.guard.cta')}
      </button>
    </div>
  );
};

function renderView(view: ViewState): React.ReactNode {
  switch (view) {
    case 'HOME':
      return <HomePage />;
    case 'LISTINGS':
      return <ListingsPage />;
    case 'LISTING_DETAIL':
      return <ListingDetailPage />;
    case 'MAP':
      return <MapView />;
    case 'FAVORITES':
      return <FavoritesPage />;
    case 'PROFILE':
      return <ProfilePage />;
    case 'MY_LISTINGS':
      return <MyListingsPage />;
    case 'CREATE_LISTING':
      return <CreateListingPage />;
    case 'VERIFICATION':
      return <VerificationPage />;
    case 'REFERRAL':
      return <ReferralPage />;
    case 'STUDENT_PROGRAM':
      return <StudentProgramPage />;
    case 'ECOSYSTEM_PREVIEW':
      return <EcosystemPreviewPage />;
    case 'CHAT':
      return <ChatPage />;
    default:
      return <ListingsPage />;
  }
}

export const App: React.FC = () => {
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const initAuth = useAppStore((state) => state.initAuth);
  const authReady = useAppStore((state) => state.authReady);
  const currentUser = useAppStore((state) => state.currentUser);
  const pushToast = useAppStore((state) => state.pushToast);

  const fetchUnreadChatCount = useAppStore((state) => state.fetchUnreadChatCount);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (currentUser) {
      intervalId = setInterval(() => {
        if (useAppStore.getState().currentView !== 'CHAT') {
          void fetchUnreadChatCount();
        }
      }, 15000); // Poll every 15 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentUser, fetchUnreadChatCount]);

  useEffect(() => {
    // A rejected refresh signs the user out and says so, instead of leaving
    // the UI in a half-authenticated state.
    setSessionExpiredHandler(() => {
      useAppStore.setState({ currentUser: null, favorites: [], favoriteIds: new Set() });
      pushToast('layout.toast.sessionExpired', 'warning');
    });

    try {
      const params = new URLSearchParams(window.location.search);
      const listingId = params.get('listing') ?? params.get('id');
      const view = params.get('view');
      if (listingId) {
        setCurrentView('LISTING_DETAIL', listingId);
      } else if (view && VIEW_FROM_QUERY[view]) {
        setCurrentView(VIEW_FROM_QUERY[view]);
      }
    } catch {
      /* malformed URL */
    }

    // Anonymous page-view counter for the admin dashboard.
    try {
      let sessionId = sessionStorage.getItem('maklersiz.session');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem('maklersiz.session', sessionId);
      }
      void MetaApi.track(sessionId, window.location.pathname || '/', document.referrer);
    } catch {
      /* storage unavailable */
    }

    return () => setSessionExpiredHandler(null);
  }, [initAuth, setCurrentView, pushToast]);

  const guarded = REQUIRES_AUTH.has(currentView) && !currentUser;

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-content">
      <Header />
      <GlobalAINotification />

      <main className="flex-1 pb-20 pt-[76px] sm:pt-[86px] lg:pb-0">
        {!authReady ? (
          <Loading />
        ) : guarded ? (
          <SignInPrompt />
        ) : (
          <Suspense fallback={<Loading />}>{renderView(currentView)}</Suspense>
        )}
      </main>

      {currentView !== 'CHAT' && <Footer />}
      <BottomNav />
      {currentView !== 'CHAT' && <ShieldMascot />}
      <AuthDialog />
      <Toaster />
    </div>
  );
};

export default App;
