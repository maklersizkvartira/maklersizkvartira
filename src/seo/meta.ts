/**
 * Everything that goes in a page's `<head>`, and the page copy that goes with it.
 *
 * One builder serves three consumers — the runtime head hook, the build-time
 * prerenderer and the SEO audit script — so a title can never differ between
 * the HTML Google fetches and the DOM Google renders. That divergence is the
 * classic way an SPA ends up looking like cloaking without anybody intending
 * it.
 */

import { copyFor } from './content';
import type {
  Article,
  CategoryWords,
  CopyPack,
  FaqEntry,
  HelpArticle,
} from './content/types';
import {
  DESCRIPTION_MAX,
  OG_IMAGE_PATH,
  SITE_NAME,
  SITE_URL,
  TITLE_MAX,
  absoluteUrl,
} from './config';
import * as ld from './jsonld';
import {
  BLOG_PATH,
  HELP_PATH,
  alternatePaths,
  listingPath,
  localisedPath,
  type RouteMatch,
} from './routes';
import { listingSlug } from './slugs';
import { LANGUAGES, type Language } from '../i18n/types';
import { VIEW_PATHS } from '../router/views';
import type { Listing } from '../types';

export interface HeadAlternate {
  hreflang: string;
  href: string;
}

export interface PageCopy {
  title: string;
  description: string;
  h1: string;
  intro: string[];
  faq: FaqEntry[];
  /** Breadcrumb trail, home first, current page last. */
  crumbs: ld.Crumb[];
}

export interface HeadTags extends PageCopy {
  canonicalPath: string;
  canonicalUrl: string;
  robots: string;
  ogType: 'website' | 'article' | 'product';
  ogImage: string;
  ogLocale: string;
  alternates: HeadAlternate[];
  /** Serialised `@graph`, ready to drop into a script tag. */
  jsonLd: string;
}

export interface HeadData {
  /** The loaded listing, on a detail page. */
  listing?: Listing | null;
  /** How many results the facet actually has. Undefined while loading. */
  resultCount?: number;
  /** A handful of results, for ItemList. */
  sample?: Listing[];
  /** Forces `noindex` regardless of what the route says. */
  noindex?: boolean;
  /** Formats a price for the meta description, in the viewer's locale. */
  formatPrice?: (value: number, currency?: 'UZS' | 'USD') => string;
}

function clamp(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : max - 1).trimEnd()}…`;
}

/**
 * The brand tail every title ends with.
 *
 * It is duplicated, by necessity, as `const SUFFIX` in each of the three copy
 * packs — they build their titles before this module sees them. The two must
 * stay byte-identical or `fitTitle` below stops recognising the brand and
 * trims nothing. Nothing else in the codebase may write this string inline.
 */
const BRAND_SUFFIX = ' | Uyiz.uz';

/**
 * Keeps a title inside what a result actually shows.
 *
 * Beyond roughly sixty characters Google truncates, and what it truncates is
 * the end — which in a title like "Qoraqalpogʻistonda uy va kvartira ijarasi
 * | Uyiz.uz" is the half that says what the page is. The brand is the part
 * worth losing, so it goes first; a title still over the limit after that is
 * left whole rather than cut mid-word, because a clipped word reads worse in
 * a result than a long phrase does.
 */
function fitTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= TITLE_MAX) return clean;
  if (clean.endsWith(BRAND_SUFFIX)) {
    return clean.slice(0, -BRAND_SUFFIX.length).trimEnd();
  }
  return clean;
}

/**
 * A category's words, with a total fallback.
 *
 * `copyFor` can briefly answer with the minimal pack while a language chunk is
 * in flight, and that pack has no categories in it. Indexing straight into the
 * record would then hand `undefined` to a template that reads `.label`.
 */
function categoryWords(copy: CopyPack, key: string): CategoryWords {
  return (
    copy.categories[key] ?? {
      noun: key,
      plural: key,
      label: key,
      headline: key,
      blurb: '',
    }
  );
}

function articleFor(language: Language, slug: string): Article | undefined {
  return copyFor(language).articles.find((item) => item.slug === slug);
}

function helpFor(language: Language, slug: string): HelpArticle | undefined {
  return copyFor(language).help.find((item) => item.slug === slug);
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------
/**
 * Every page's copy passes through one length gate on the way out.
 *
 * Doing it here rather than in each of the three language packs means a
 * translator writing a Russian description cannot accidentally ship a
 * two-hundred-character one, and the rule is written down once.
 */
export function buildPageCopy(
  route: RouteMatch,
  language: Language,
  data: HeadData = {},
): PageCopy {
  const page = rawPageCopy(route, language, data);
  return {
    ...page,
    title: fitTitle(page.title),
    description: clamp(page.description),
  };
}

function rawPageCopy(
  route: RouteMatch,
  language: Language,
  data: HeadData = {},
): PageCopy {
  const copy = copyFor(language);
  // Crumb paths stay language-neutral. `AppLink` localises them for the DOM
  // and `buildHead` localises them for the JSON-LD, so prefixing here would
  // produce `/ru/ru/toshkent` in one place and the right thing in the other.
  const home: ld.Crumb = { name: copy.common.breadcrumbHome, path: '/' };
  const crumb = (name: string, path: string): ld.Crumb => ({ name, path });

  switch (route.kind) {
    case 'HOME':
      return {
        title: copy.home.title,
        description: copy.home.description,
        h1: copy.home.h1,
        intro: copy.home.intro,
        faq: copy.home.faq,
        crumbs: [],
      };

    case 'CATALOG':
      return {
        title: copy.catalog.title,
        description: copy.catalog.description,
        h1: copy.catalog.h1,
        intro: copy.catalog.intro,
        faq: [],
        crumbs: [home, crumb(copy.common.allListings, route.path)],
      };

    case 'CATEGORY': {
      const category = categoryWords(copy, route.category!.key);
      return {
        title: copy.landing.categoryTitle(category),
        description: copy.landing.categoryDescription(category),
        h1: copy.landing.categoryH1(category),
        intro: copy.landing.categoryIntro(category),
        // A category page is about a kind of home, not a place, so the FAQ
        // asks about the country. It used to be handed the brand name here,
        // and asked how to find a flat "in Uyiz".
        faq: copy.landing.placeFaq(
          copy.country ?? { name: '', short: '', inPlace: copy.brand.name },
          category,
        ),
        crumbs: [home, crumb(category.label, route.path)],
      };
    }

    case 'REGION': {
      const place = copy.placeWords(route.region!.name, 'region');
      const profile = copy.places.regions[route.region!.slug] ?? null;
      return {
        title: copy.landing.regionTitle(place),
        description: copy.landing.regionDescription(place),
        h1: copy.landing.regionH1(place),
        intro: copy.landing.placeIntro(place, null, profile, []),
        faq: copy.landing.placeFaq(place, null),
        crumbs: [home, crumb(place.short, route.path)],
      };
    }

    case 'REGION_CATEGORY': {
      const place = copy.placeWords(route.region!.name, 'region');
      const category = categoryWords(copy, route.category!.key);
      const profile = copy.places.regions[route.region!.slug] ?? null;
      return {
        title: copy.landing.placeCategoryTitle(place, category),
        description: copy.landing.placeCategoryDescription(place, category),
        h1: copy.landing.placeCategoryH1(place, category),
        intro: copy.landing.placeIntro(place, category, profile, []),
        faq: copy.landing.placeFaq(place, category),
        crumbs: [
          home,
          crumb(place.short, `/${route.region!.slug}`),
          crumb(category.label, route.path),
        ],
      };
    }

    case 'DISTRICT': {
      const place = copy.placeWords(route.district!.name, 'district');
      const region = copy.placeWords(route.region!.name, 'region');
      const profile = copy.places.districts[route.district!.slug] ?? null;
      return {
        title: copy.landing.regionTitle(place),
        description: copy.landing.regionDescription(place),
        h1: copy.landing.regionH1(place),
        intro: copy.landing.placeIntro(
          place,
          null,
          profile,
          route.district!.metroStations,
        ),
        faq: copy.landing.placeFaq(place, null),
        crumbs: [
          home,
          crumb(region.short, `/${route.region!.slug}`),
          crumb(place.short, route.path),
        ],
      };
    }

    case 'DISTRICT_CATEGORY': {
      const place = copy.placeWords(route.district!.name, 'district');
      const region = copy.placeWords(route.region!.name, 'region');
      const category = categoryWords(copy, route.category!.key);
      const profile = copy.places.districts[route.district!.slug] ?? null;
      return {
        title: copy.landing.placeCategoryTitle(place, category),
        description: copy.landing.placeCategoryDescription(place, category),
        h1: copy.landing.placeCategoryH1(place, category),
        intro: copy.landing.placeIntro(
          place,
          category,
          profile,
          route.district!.metroStations,
        ),
        faq: copy.landing.placeFaq(place, category),
        crumbs: [
          home,
          crumb(region.short, `/${route.region!.slug}`),
          crumb(place.short, `/${route.region!.slug}/${route.district!.slug}`),
          crumb(category.label, route.path),
        ],
      };
    }

    case 'LISTING': {
      const listing = data.listing;
      if (!listing) {
        return {
          title: copy.listing.loadingTitle,
          // Distinct from the brand blurb on purpose: this is the shell every
          // listing URL is served from before its data arrives, and it must
          // not look like a copy of any other page.
          description: `${copy.common.allListings} — ${copy.brand.tagline}. ${copy.brand.about}`,
          h1: '',
          intro: [],
          faq: [],
          crumbs: [home, crumb(copy.common.allListings, VIEW_PATHS.LISTINGS ?? '/elonlar')],
        };
      }
      const price = data.formatPrice
        ? data.formatPrice(listing.price, listing.currency)
        : `${listing.price} ${listing.currency}`;
      return {
        title: copy.listing.title({
          title: listing.title,
          district: listing.district,
          rooms: listing.rooms,
        }),
        description: copy.listing.description({
          title: listing.title,
          district: listing.district,
          rooms: listing.rooms,
          area: listing.area,
          price,
        }),
        h1: listing.title,
        intro: [],
        faq: [],
        crumbs: [
          home,
          crumb(copy.common.allListings, VIEW_PATHS.LISTINGS ?? '/elonlar'),
          crumb(listing.title, route.path),
        ],
      };
    }

    case 'BLOG_INDEX':
      return {
        title: `${copy.common.blogHeading}${BRAND_SUFFIX}`,
        description: clamp(copy.common.blogIntro),
        h1: copy.common.blogHeading,
        intro: [copy.common.blogIntro],
        faq: [],
        crumbs: [home, crumb(copy.common.blogHeading, BLOG_PATH)],
      };

    case 'BLOG_POST': {
      const article = articleFor(language, route.slug ?? '');
      if (!article) break;
      return {
        title: `${article.title}${BRAND_SUFFIX}`,
        description: clamp(article.summary),
        h1: article.h1,
        intro: [article.intro],
        faq: article.faq,
        crumbs: [
          home,
          crumb(copy.common.blogHeading, BLOG_PATH),
          crumb(article.title, route.path),
        ],
      };
    }

    case 'HELP': {
      if (!route.slug) {
        return {
          title: `${copy.common.helpHeading}${BRAND_SUFFIX}`,
          description: clamp(copy.common.helpIntro),
          h1: copy.common.helpHeading,
          intro: [copy.common.helpIntro],
          faq: [],
          crumbs: [home, crumb(copy.common.helpHeading, HELP_PATH)],
        };
      }
      const article = helpFor(language, route.slug);
      if (!article) break;
      return {
        title: `${article.title}${BRAND_SUFFIX}`,
        description: clamp(article.summary),
        h1: article.h1,
        intro: [article.intro],
        faq: [],
        crumbs: [
          home,
          crumb(copy.common.helpHeading, HELP_PATH),
          crumb(article.title, route.path),
        ],
      };
    }

    case 'APP': {
      // The three public app screens. Without their own copy they fell into
      // the default branch and shared one brand title between them, which is
      // three pages competing to be the one Google keeps.
      const view =
        route.view === 'MAP'
          ? copy.views?.map
          : route.view === 'STUDENT_PROGRAM'
            ? copy.views?.studentProgram
            : route.view === 'ECOSYSTEM_PREVIEW'
              ? copy.views?.ecosystem
              : undefined;
      if (!view) break;
      return {
        title: view.title,
        description: view.description,
        h1: '',
        intro: [],
        faq: [],
        crumbs: [home, crumb(view.title.split(' | ')[0], route.path)],
      };
    }

    case 'NOT_FOUND':
      return {
        title: `${copy.common.notFoundTitle}${BRAND_SUFFIX}`,
        description: clamp(copy.common.notFoundBody),
        h1: copy.common.notFoundTitle,
        intro: [copy.common.notFoundBody],
        faq: [],
        crumbs: [home],
      };

    default:
      break;
  }

  // Private app views: a real title so the browser tab is not "Uyiz" on
  // every screen, but no descriptive copy — they are noindex anyway.
  return {
    title: `${copy.brand.name} — ${copy.brand.tagline}`,
    description: clamp(copy.brand.about),
    h1: '',
    intro: [],
    faq: [],
    crumbs: [home],
  };
}

// ---------------------------------------------------------------------------
// Head
// ---------------------------------------------------------------------------
export function buildHead(
  route: RouteMatch,
  language: Language,
  data: HeadData = {},
): HeadTags {
  const copy = copyFor(language);
  const page = buildPageCopy(route, language, data);
  const canonicalPath = localisedPath(route.path, language);
  const canonicalUrl = absoluteUrl(canonicalPath);
  const paths = alternatePaths(route.path);

  // An indexable page that turned out to have nothing on it is worse than no
  // page at all, so it takes itself out of the index while staying crawlable.
  const emptyFacet =
    route.view === 'SEO_LANDING' && data.resultCount === 0;
  const indexable = route.indexable && !data.noindex && !emptyFacet;
  const robots = indexable
    ? 'index, follow, max-image-preview:large, max-snippet:-1'
    : 'noindex, follow';

  const alternates: HeadAlternate[] = indexable
    ? [
        ...LANGUAGES.map((code) => ({
          hreflang: code,
          href: absoluteUrl(paths[code]),
        })),
        { hreflang: 'x-default', href: absoluteUrl(paths.uz) },
      ]
    : [];

  const nodes: ld.JsonLd[] = [];
  let ogType: HeadTags['ogType'] = 'website';
  let ogImage = absoluteUrl(OG_IMAGE_PATH);

  // The publisher/provider nodes are referenced by `@id` from the listing,
  // article and collection nodes below. A reference that resolves to nothing
  // on the page it appears on is a dangling one, so the organisation ships
  // with every page rather than only with the home page.
  nodes.push(ld.organisation(copy.brand.about));
  if (route.kind === 'HOME') {
    nodes.push(ld.website(copy.brand.about, language));
  }

  if (page.crumbs.length > 1) {
    nodes.push(
      ld.breadcrumbs(
        page.crumbs.map((item) => ({
          name: item.name,
          path: localisedPath(item.path, language),
        })),
      ),
    );
  }

  if (route.kind === 'LISTING' && data.listing) {
    ogType = 'product';
    ogImage = ld.shareImage(data.listing.images);
    nodes.push(
      ld.realEstateListing({
        listing: data.listing,
        url: canonicalUrl,
        language,
        name: data.listing.title,
        description: page.description,
      }),
    );
  } else if (route.kind === 'BLOG_POST') {
    const article = articleFor(language, route.slug ?? '');
    if (article) {
      ogType = 'article';
      nodes.push(
        ld.blogPosting({
          headline: article.title,
          description: article.summary,
          url: canonicalUrl,
          language,
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
        }),
      );
    }
  } else if (route.view === 'SEO_LANDING' || route.kind === 'CATALOG') {
    nodes.push(
      ld.collectionPage({
        name: page.h1,
        description: page.description,
        url: canonicalUrl,
        language,
      }),
    );
    const sample = (data.sample ?? []).slice(0, 10);
    if (sample.length > 0) {
      nodes.push(
        ld.itemList(
          page.h1,
          sample.map((listing) => ({
            name: listing.title,
            // The canonical form, slug and all — the slug-less variant
            // redirects, and a sitemap-grade reference should not.
            url: absoluteUrl(
              localisedPath(
                listingPath({ id: listing.id, slug: listingSlug(listing) }),
                language,
              ),
            ),
          })),
        ),
      );
    }
  }

  if (page.faq.length > 0 && indexable) nodes.push(ld.faqPage(page.faq));

  return {
    ...page,
    canonicalPath,
    canonicalUrl,
    robots,
    ogType,
    ogImage,
    ogLocale: copy.ogLocale,
    alternates,
    jsonLd: nodes.length > 0 ? ld.graph(nodes) : '',
  };
}

export { SITE_NAME, SITE_URL };
