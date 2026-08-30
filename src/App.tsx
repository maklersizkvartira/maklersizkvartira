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
import { HEADER_CLEARANCE } from './components/layout/headerMetrics';
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

  /**
   * The view actually on screen.
   *
   * A guarded view renders the home page rather than a dead end (see the
   * `<main>` below), and this is the one expression that says so — it is both
   * what `renderView` is handed and what the transition wrapper is keyed on,
   * so signing in and having the real page swap in underneath the dialog is a
   * transition rather than a jump cut.
   */
  const activeView: ViewState = guarded ? 'HOME' : currentView;

  /**
   * Has the visitor navigated yet?
   *
   * The first screen of a visit must not animate. `scripts/prerender.mjs`
   * ships real HTML for the entry URL, so fading that in would put a quarter
   * of a second of blank page in front of content the browser had already
   * painted — a first-paint cost, for nothing.
   *
   * Written during render rather than from an effect, and that is the point:
   * the flag has to be true on the very frame the new view mounts, because a
   * class added a render later would paint one frame of the finished page
   * before the animation pulled it back to transparent. Both writes are
   * idempotent — the ref only ever tracks the last view rendered, and the flag
   * only ever goes from false to true — so StrictMode's double render and a
   * render thrown away by a suspended lazy chunk both land on the same result.
   *
   * The `authReady` gate is what makes "the first screen" mean the first
   * screen and not the first *value*. The store boots at `HOME` and the URL is
   * adopted from an effect, so on any deep link — which is every one of the
   * 346 prerendered pages, and so most arrivals from search — the view changes
   * once on mount, from the placeholder to the page that was asked for. Seeded
   * unconditionally, the ref caught that swap and called it a navigation: the
   * entry screen faded in over content the browser had already painted, which
   * is the one thing this block exists to prevent. Nothing renders inside the
   * wrapper until `authReady`, so nothing before it can be a navigation away
   * from anything.
   */
  const renderedView = React.useRef<ViewState | null>(null);
  const hasNavigated = React.useRef(false);
  if (authReady) {
    if (renderedView.current === null) {
      renderedView.current = activeView;
    } else if (renderedView.current !== activeView) {
      renderedView.current = activeView;
      hasNavigated.current = true;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-content">
      <Header />

      {/*
        The padding clears the fixed header. The number is not written here —
        it is `HEADER_CLEARANCE` in headerMetrics.ts, which Header.tsx's own
        height comes from too. It used to be a literal in this file and a
        second literal in ListingsPage.tsx and a third in Header.tsx, and the
        comment that stood here described a 28px trust strip the markup had
        stopped containing, with 86/94px totals that had been wrong for as
        long as the strip was gone.

        `id` is the skip link's target, so a keyboard visitor can jump the
        whole header in one press.
      */}
      <main id="main-content" className={`flex-1 ${HEADER_CLEARANCE}`}>
        {/*
          Inside <main>, not above it.

          This is `relative z-50` in normal flow at y=0, and the header is
          `fixed` at z-90 — so an owner's flagged-listing alert rendered
          underneath the blue bar and was partly or wholly invisible. Here it
          inherits the same clearance as every other thing on the page.
        */}
        <GlobalAINotification />

        {!authReady ? (
          <Loading />
        ) : (
          /*
            A guarded view renders the home page rather than a dead end: the
            dialog is already open over it, and signing in swaps the real page
            in underneath at the same URL, with no second navigation.

            The key is what turns a navigation from a cut into a movement.
            React tears the old view down and mounts the next one with
            `.view-enter` already on it — a 240ms fade and settle described in
            index.css — and the wrapper deliberately sits OUTSIDE `<Suspense>`.
            Inside it, a code-split view that has not arrived yet swaps the
            fallback in and the content back out, and each of those swaps would
            re-run the animation: every lazy view would transition twice. Out
            here the wrapper mounts once per navigation and stays put while the
            chunk resolves underneath it.

            Nothing waits on the animation. The new view mounts and is
            interactive on the frame it is asked for; only the wrapper's
            opacity and twelve pixels of horizontal offset move, and the
            outgoing view leaves with the frame rather than being held on
            screen to fade out.
          */
          <div key={activeView} className={hasNavigated.current ? 'view-enter' : undefined}>
            <Suspense fallback={<Loading />}>{renderView(activeView)}</Suspense>
          </div>
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
