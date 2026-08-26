/**
 * Build-time rendering entry.
 *
 * Every static page is rendered here once per language and written to its own
 * `index.html`, so a crawler fetching `/toshkent/chilonzor/kvartira-ijaraga`
 * receives the heading, the prose, the FAQ and the whole navigation graph in
 * the HTTP response — not an empty `<div id="root">` and a promise that
 * JavaScript will fill it in later.
 *
 * It deliberately does NOT import `App.tsx`. Twelve of its thirteen views are
 * `React.lazy`, and `renderToStaticMarkup` is synchronous: a suspended lazy
 * component emits the loading spinner, so prerendering the real app would
 * produce a hundred identical pages that each say "Yuklanmoqda". Composing the
 * shell here from direct imports sidesteps that entirely.
 *
 * The client mounts with `createRoot`, not `hydrateRoot`, so React discards
 * this markup and re-renders on boot. That is the intended trade: no
 * hydration-mismatch class of bug, at the cost of one extra paint — and the
 * visitor sees real content during it instead of a spinner.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { I18nProvider } from './i18n';
import { ThemeProvider } from './theme/ThemeProvider';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { HomePage } from './components/home/HomePage';
import { ListingsPage } from './components/listings/ListingsPage';
import { SeoLandingPage } from './components/seo/SeoLandingPage';
import { BlogIndexPage, BlogPostPage, HelpPage } from './components/content/ArticlePages';
import StudentProgramPage from './components/student/StudentProgramPage';
import EcosystemPreviewPage from './components/ecosystem/EcosystemPreviewPage';
import { buildHead, type HeadTags } from './seo/meta';
import { registerCopy } from './seo/content';
import { UZ_COPY } from './seo/content/copy.uz';
import { RU_COPY } from './seo/content/copy.ru';
import { EN_COPY } from './seo/content/copy.en';
import { registerDictionary } from './i18n/dictionaries';
import { uz } from './i18n/locales/uz';
import { ru } from './i18n/locales/ru';
import { en } from './i18n/locales/en';
import { matchPath, type RouteMatch } from './seo/routes';
import { INDEXABLE_PAGES, STATIC_PAGES } from './seo/pages';
import { alternatePaths, localisedPath } from './router/language';
import { LANGUAGES, type Language } from './i18n/types';
import { DEFAULT_FILTERS, pinServerSnapshot, useAppStore } from './stores/useAppStore';
import type { ViewState } from './router/views';

export { LANGUAGES, STATIC_PAGES, INDEXABLE_PAGES, alternatePaths };

// The browser fetches these on demand; the build has no network and needs all
// three at once, so it hands them over directly.
//
// Both registries, not just the copy: the copy pack supplies a page's heading
// and prose, the dictionary supplies every label around it. Registering only
// the first shipped Russian pages wrapped in Uzbek navigation.
registerCopy('uz', UZ_COPY);
registerCopy('ru', RU_COPY);
registerCopy('en', EN_COPY);
registerDictionary('uz', uz);
registerDictionary('ru', ru);
registerDictionary('en', en);

/**
 * Views with a component worth rendering into the static HTML.
 *
 * A view that is not here still gets a fully-built `<head>` — title,
 * description, canonical, hreflang, JSON-LD — with an empty body. The map and
 * the account screens are in that group: one is a canvas, the others are
 * `noindex`, and neither contributes a word a crawler would read.
 */
const PRERENDERABLE: Partial<Record<ViewState, React.ComponentType>> = {
  HOME: HomePage,
  LISTINGS: ListingsPage,
  SEO_LANDING: SeoLandingPage,
  BLOG_INDEX: BlogIndexPage,
  BLOG_POST: BlogPostPage,
  HELP: HelpPage,
  // Both are static prose. Left out, they shipped as `index, follow` pages
  // with an empty body and a place in the sitemap — an invitation to crawl
  // nothing. The map stays out: its content is a canvas, not text.
  STUDENT_PROGRAM: StudentProgramPage,
  ECOSYSTEM_PREVIEW: EcosystemPreviewPage,
};

export interface RenderedPage {
  /** The path this file is written to, language prefix included. */
  path: string;
  language: Language;
  head: HeadTags;
  /** Markup for the inside of `<div id="root">`; may be empty. */
  html: string;
  /** Set when the component threw and only the head could be produced. */
  error?: string;
}

function seedStore(route: RouteMatch, language: Language): void {
  useAppStore.setState({
    language,
    route,
    currentView: route.view,
    selectedListingId: route.listingId ?? null,
    // Without this the shell renders its loading spinner instead of the page.
    authReady: true,
    currentUser: null,

    // The store is a module singleton and `renderAll` drives 334 pages
    // through it in one process, so every slice a prerendered component reads
    // has to be reset here or it leaks from the previous page.
    //
    // `listingsLoading` is true rather than false on purpose: with an empty
    // list and nothing in flight, the catalogue renders its "there are no
    // listings" state, and the static HTML would tell a crawler the site has
    // nothing on it. Skeletons say "loading", which is what is actually true.
    listings: [],
    featured: [],
    myListings: [],
    favorites: [],
    favoriteIds: new Set<string>(),
    totalCount: 0,
    page: 1,
    listingsLoading: true,
    listingsError: null,
    filters: { ...DEFAULT_FILTERS },
    showAuth: false,
    activeConversationId: null,
    unreadChatCount: 0,
  });
}

export function renderPage(path: string, language: Language): RenderedPage {
  const route = matchPath(path);
  const head = buildHead(route, language);
  const Page = PRERENDERABLE[route.view];
  const localised = localisedPath(path, language);

  if (!Page) return { path: localised, language, head, html: '' };

  seedStore(route, language);
  pinServerSnapshot();

  try {
    const html = renderToStaticMarkup(
      <ThemeProvider>
        <I18nProvider>
          <div className="flex min-h-screen flex-col bg-canvas text-content">
            <Header />
            {/* Same padding as the live shell, so the fixed header appearing
                on hydration does not shove the prerendered content down the
                page — that shift would be a CLS penalty on every entry. */}
            <main className="flex-1 pb-20 pt-[76px] sm:pt-[86px] lg:pb-0">
              <Page />
            </main>
            <Footer />
          </div>
        </I18nProvider>
      </ThemeProvider>,
    );
    return { path: localised, language, head, html };
  } catch (error) {
    // One page failing to render must not fail the build: the head is the
    // half that matters most, and it was built before the component ran.
    return {
      path: localised,
      language,
      head,
      html: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * The shell served for a listing URL.
 *
 * Listing pages cannot be prerendered — there are as many as there are
 * listings and they change hourly — so `/e/<slug>-<uuid>` is rewritten to this
 * file and the app fills it in. What matters is what the shell does NOT say:
 * it carries no canonical and no hreflang, so Google treats the requested URL
 * as canonical instead of consolidating every listing onto whatever address
 * the shell happened to claim. The detail page writes the real head, including
 * its canonical, as soon as the listing loads.
 */
export function renderListingShell(language: Language): RenderedPage {
  const route = matchPath('/e/00000000-0000-0000-0000-000000000000');
  const head = buildHead(route, language);
  return {
    path: localisedPath('/e', language),
    language,
    head: { ...head, canonicalUrl: '', alternates: [], jsonLd: '' },
    html: '',
  };
}

/** The document the host serves, with a 404 status, for an unknown path. */
export function renderNotFound(language: Language): RenderedPage {
  const route = matchPath('/__not-found__');
  const head = buildHead(route, language);
  return {
    path: localisedPath('/404', language),
    language,
    // No canonical and no og:url: this one document answers every unknown
    // address, and the sentinel path it was built from is not one of them.
    head: { ...head, canonicalUrl: '', alternates: [], jsonLd: '' },
    html: '',
  };
}

/** Every static page, in every language, plus the two special shells. */
export function renderAll(): RenderedPage[] {
  const pages: RenderedPage[] = [];
  for (const language of LANGUAGES) {
    for (const page of STATIC_PAGES) {
      pages.push(renderPage(page.path, language));
    }
    pages.push(renderListingShell(language));
  }
  // One 404 document, in the default language: the host picks it by filename
  // and has no way to know which language the visitor wanted.
  pages.push({ ...renderNotFound('uz'), path: '/404' });
  return pages;
}
