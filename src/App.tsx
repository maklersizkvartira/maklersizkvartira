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

import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { HEADER_CLEARANCE } from './components/layout/headerMetrics';
import { Toaster } from './components/layout/Toaster';
import { WelcomeCelebration } from './components/auth/WelcomeCelebration';
import { ListingsPage } from './components/listings/ListingsPage';
import { AiMascot } from './components/common/AiMascot';
import { GlobalAINotification } from './components/common/GlobalAINotification';
import { useTranslation } from './i18n';
import { sessionStore } from './lib/storage';
import { setSessionExpiredHandler } from './services/http';
import { isAutomatedAgent } from './services/crawler';
import { trackPageView } from './services/analytics';
import { MetaApi } from './services/listingsApi';
import { useSeoHead } from './seo/useSeoHead';
import { AUTH_VIEWS, REQUIRES_AUTH, authTabForView } from './router/views';
import { useAppStore, type ViewState } from './stores/useAppStore';

/** Per-tab analytics id, and the key it lived under before the brand changed. */
const SESSION_KEY = 'uyiz.session';
const LEGACY_SESSION_KEY = 'maklersiz.session';

const AuthPage = lazy(() => import('./components/auth/AuthPage'));
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
 * Views that fill the screen on their own — no header, no footer, no tab bar.
 *
 * The auth screens are the whole of it. They are a task with one way forward
 * and one way out, and every other piece of navigation on the page is a way
 * to abandon it half-finished; on a phone the header and the tab bar also
 * cost the two strips of screen the keyboard leaves you.
 */
const CHROMELESS: ReadonlySet<ViewState> = new Set<ViewState>([
  'LOGIN',
  'REGISTER',
  'FORGOT_PASSWORD',
]);

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

declare global {
  interface Window {
    /** Set in index.html: the fallback that clears the entry overlay if the
     *  bundle never runs. Cleared here once the app can do it properly. */
    __appBootTimer?: ReturnType<typeof setTimeout>;
  }
}

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
    case 'LOGIN':
    case 'REGISTER':
    case 'FORGOT_PASSWORD':
      return <AuthPage />;
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
  const loadFxRate = useAppStore((state) => state.loadFxRate);
  const authReady = useAppStore((state) => state.authReady);
  const currentUser = useAppStore((state) => state.currentUser);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const welcomeName = useAppStore((state) => state.welcomeName);
  const dismissWelcome = useAppStore((state) => state.dismissWelcome);
  const pushToast = useAppStore((state) => state.pushToast);

  const fetchUnreadChatCount = useAppStore((state) => state.fetchUnreadChatCount);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  // Once per load, and not awaited by anything. Prices render against the
  // placeholder rate until this answers, which is a fraction of a second and
  // never blocks a page.
  useEffect(() => {
    void loadFxRate();
  }, [loadFxRate]);

  /**
   * Clear the entry overlay painted by index.html.
   *
   * Tied to `authReady` rather than to mount, because that is the moment this
   * component stops rendering its own spinner and starts rendering the page —
   * removing it earlier would put the overlay's exit exactly where the flash
   * it exists to hide used to be.
   */
  useEffect(() => {
    if (!authReady) return;
    clearTimeout(window.__appBootTimer);
    const boot = document.getElementById('app-boot');
    if (!boot) return;
    // Faded rather than cut, so the page arrives instead of appearing.
    boot.style.transition = 'opacity 200ms ease';
    boot.style.opacity = '0';
    const done = setTimeout(() => boot.remove(), 220);
    return () => clearTimeout(done);
  }, [authReady]);

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
      let sessionId = sessionStore.read(SESSION_KEY, LEGACY_SESSION_KEY);
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStore.write(SESSION_KEY, sessionId);
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
   * Whether this route owns the whole screen.
   *
   * Read from `currentView` rather than from anything derived: a guarded view
   * renders the loading state below and never reaches `renderView`, so there
   * is no second "which view is really on screen" to disagree with.
   */
  const bare = CHROMELESS.has(currentView);

  /**
   * What the transition wrapper is keyed on — the view, except that the three
   * auth routes share one key.
   *
   * They are three addresses over one task, and keying them separately made
   * React unmount the whole flow on every switch between them. That took the
   * form with it: the phone number typed on the sign-in screen was gone by the
   * registration screen, the in-flight-request guard could not see the change
   * it was written for, and a reply arriving after the switch wrote into an
   * instance that no longer existed. They are also the one group of views
   * where a fade between them would be wrong: nobody crossed a page boundary.
   */
  const viewKey = AUTH_VIEWS.has(currentView) ? 'AUTH' : currentView;

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
  const renderedView = React.useRef<string | null>(null);
  const hasNavigated = React.useRef(false);
  if (authReady) {
    if (renderedView.current === null) {
      renderedView.current = viewKey;
    } else if (renderedView.current !== viewKey) {
      renderedView.current = viewKey;
      hasNavigated.current = true;
    }
  }

  return (
    <div
      // `100dvh` on the chromeless routes, `100vh` everywhere else. On iOS
      // Safari with the URL bar showing, `min-h-screen` makes the document
      // taller than the visual viewport by the height of that bar — invisible
      // on a page that scrolls anyway, and the one thing you notice on a
      // centred sign-in form, which then is not centred and drifts as the bar
      // hides.
      className={`flex flex-col bg-canvas text-content ${
        bare ? 'min-h-[100dvh]' : 'min-h-screen'
      }`}
    >
      {!bare && <Header />}

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
      {/*
        `HEADER_CLEARANCE` is a complete literal class string, never built by
        concatenation: Tailwind v4 scans source text, so a class assembled at
        runtime generates no CSS and the header silently overlaps the page.
      */}
      <main id="main-content" className={bare ? 'flex-1' : `flex-1 ${HEADER_CLEARANCE}`}>
        {/*
          Inside <main>, not above it.

          This is `relative z-50` in normal flow at y=0, and the header is
          `fixed` at z-90 — so an owner's flagged-listing alert rendered
          underneath the blue bar and was partly or wholly invisible. Here it
          inherits the same clearance as every other thing on the page.
        */}
        {!bare && <GlobalAINotification />}

        {!authReady || guarded ? (
          <Loading />
        ) : (
          /*
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
          <div key={viewKey} className={hasNavigated.current ? 'view-enter' : undefined}>
            <Suspense fallback={<Loading />}>{renderView(currentView)}</Suspense>
          </div>
        )}
      </main>

      {currentView !== 'CHAT' && !bare && <Footer />}
      {!bare && <BottomNav />}
      {currentView !== 'CHAT' && !bare && <AiMascot />}
      {/*
        Rendered from the shell, not from the page that earned it. The sign-in
        page navigates away the instant the session is adopted, so a welcome
        owned by that page was unmounted before it had been read — and with it
        the timer the handoff was waiting on.
      */}
      {welcomeName && <WelcomeCelebration name={welcomeName} onDone={dismissWelcome} />}
      <Toaster />
    </div>
  );
};

export default App;
