/**
 * Application shell.
 *
 * Routing is a view switch driven by the URL. The store holds the resolved
 * route; the address bar is a projection of it, written by `setCurrentView`
 * and `navigate`, and read back on mount and on every `popstate`. That last
 * part is what makes Back and Forward work — the previous build pushed history
 * entries it never consumed, so the URL and the rendered view drifted apart
 * the first time anybody pressed Back.
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
import { isAutomatedAgent } from './services/crawler';
import { trackPageView } from './services/analytics';
import { MetaApi } from './services/listingsApi';
import { useSeoHead } from './seo/useSeoHead';
import { REQUIRES_AUTH, authTabForView } from './router/views';
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
const SeoLandingPage = lazy(() => import('./components/seo/SeoLandingPage'));

const ArticlePages = () => import('./components/content/ArticlePages');
const BlogIndexPage = lazy(() =>
  ArticlePages().then((module) => ({ default: module.BlogIndexPage })),
);
const BlogPostPage = lazy(() =>
  ArticlePages().then((module) => ({ default: module.BlogPostPage })),
);
const HelpPage = lazy(() => ArticlePages().then((module) => ({ default: module.HelpPage })));
const NotFoundPage = lazy(() =>
  ArticlePages().then((module) => ({ default: module.NotFoundPage })),
);

/**
 * Views that write their own `<head>`, because it depends on data they load —
 * a listing's title, or whether a facet turned out to be empty. Everything
 * else is described well enough by its route alone.
 */
const SELF_TITLING: ReadonlySet<ViewState> = new Set<ViewState>([
  'LISTING_DETAIL',
  'SEO_LANDING',
  'BLOG_INDEX',
  'BLOG_POST',
  'HELP',
  'NOT_FOUND',
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
    case 'SEO_LANDING':
      return <SeoLandingPage />;
    case 'BLOG_INDEX':
      return <BlogIndexPage />;
    case 'BLOG_POST':
      return <BlogPostPage />;
    case 'HELP':
      return <HelpPage />;
    // An unknown path is a 404, not the listings page. Answering every bad
    // link with real content is what produces soft-404s in Search Console and
    // hides broken links from everyone.
    case 'NOT_FOUND':
    default:
      return <NotFoundPage />;
  }
}

export const App: React.FC = () => {
  const currentView = useAppStore((state) => state.currentView);
  const route = useAppStore((state) => state.route);
  const language = useAppStore((state) => state.language);
  const adoptLocation = useAppStore((state) => state.adoptLocation);
  const initAuth = useAppStore((state) => state.initAuth);
  const authReady = useAppStore((state) => state.authReady);
  const currentUser = useAppStore((state) => state.currentUser);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
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

    return () => setSessionExpiredHandler(null);
  }, [initAuth, pushToast]);

  // -- URL <-> view --------------------------------------------------------
  useEffect(() => {
    adoptLocation(window.location.pathname, window.location.search);

    const onPopState = () => {
      adoptLocation(window.location.pathname, window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [adoptLocation]);

  // -- Analytics -----------------------------------------------------------
  const reportedPath = React.useRef<string | null>(null);

  useEffect(() => {
    if (isAutomatedAgent()) return;
    // `adoptLocation` canonicalises the address on mount — a legacy link or a
    // language redirect changes `route.path` a moment after the first render —
    // so without this every deep-linked visit was counted twice.
    const path = window.location.pathname || '/';
    if (reportedPath.current === path) return;
    reportedPath.current = path;
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
    // The same navigation, reported to GA4 — which is switched off entirely
    // unless a measurement id is configured.
    trackPageView(window.location.pathname || '/', document.title);
  }, [route.path]);

  // Views that load their own data describe themselves; the rest are fully
  // described by the route, so the shell writes their head here.
  useSeoHead(route, language, {}, !SELF_TITLING.has(currentView));

  /**
   * The route-level half of the sign-in guard.
   *
   * `authReady` matters: until the refresh token has been checked there is no
   * user *yet*, and treating that moment as "signed out" flashed the dialog
   * at people who were already signed in.
   */
  const guarded = authReady && REQUIRES_AUTH.has(currentView) && !currentUser;

  useEffect(() => {
    if (guarded) setShowAuth(true, authTabForView(currentView));
  }, [guarded, currentView, setShowAuth]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-content">
      <Header />
      <GlobalAINotification />

      {/*
        The padding clears the fixed header, whose height is fixed in
        Header.tsx: a 56px bar (64px at sm), a 28px trust strip and the two
        1px borders — 86px, 94px at sm. Change one and change the other; they
        are the same measurement written in two files.

        `id` is the skip link's target, so a keyboard visitor can jump the
        whole header in one press.
      */}
      <main id="main-content" className="flex-1 pt-[86px] sm:pt-[94px]">
        {!authReady ? (
          <Loading />
        ) : (
          // A guarded view renders the home page rather than a dead end: the
          // dialog is already open over it, and signing in swaps the real
          // page in underneath at the same URL, with no second navigation.
          <Suspense fallback={<Loading />}>{renderView(guarded ? 'HOME' : currentView)}</Suspense>
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
