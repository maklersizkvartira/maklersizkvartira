/**
 * Path <-> route resolution.
 *
 * One function turns a URL into everything the app needs to render it (which
 * view, which filters, which copy, whether Google may index it), and one
 * function turns a route back into its canonical path. Keeping both here is
 * what stops the canonical tag, the sitemap and the internal links from ever
 * disagreeing about what a page's address is.
 *
 * Resolution is deliberately ordered — categories before regions before
 * districts — and `findSlugCollisions()` in the taxonomy proves that order can
 * never be ambiguous.
 */

import { BLOG_SLUGS } from './content/blogIndex';
import { HELP_SLUGS } from './content/helpIndex';
import { listingIdFromSlug } from './slugs';
import {
  CATEGORY_BY_SLUG,
  DISTRICT_BY_PATH,
  REGION_BY_SLUG,
  type FacetFilters,
  type RentCategory,
  type SeoDistrict,
  type SeoRegion,
} from './taxonomy';
import {
  LEGACY_VIEW_QUERY,
  PATH_TO_VIEW,
  PRIVATE_VIEWS,
  VIEW_PATHS,
  type ViewState,
} from '../router/views';
import {
  alternatePaths,
  localisedPath,
  normalisePath,
  stripLanguagePrefix,
} from '../router/language';
import type { Language } from '../i18n/types';

export {
  LANGUAGE_PREFIX,
  alternatePaths,
  localisedPath,
  normalisePath,
  stripLanguagePrefix,
} from '../router/language';

export type RouteKind =
  | 'HOME'
  | 'CATALOG'
  | 'CATEGORY'
  | 'REGION'
  | 'REGION_CATEGORY'
  | 'DISTRICT'
  | 'DISTRICT_CATEGORY'
  | 'LISTING'
  | 'BLOG_INDEX'
  | 'BLOG_POST'
  | 'HELP'
  | 'APP'
  | 'NOT_FOUND';

export interface RouteMatch {
  kind: RouteKind;
  /** The canonical path for this route — never a trailing slash, never a query. */
  path: string;
  view: ViewState;
  /** Filters the landing page applies when it loads listings. */
  filters: FacetFilters;
  category?: RentCategory;
  region?: SeoRegion;
  district?: SeoDistrict;
  listingId?: string;
  /** Blog or help article slug. */
  slug?: string;
  /**
   * Whether the page may be indexed as far as the URL alone can tell. A
   * landing page that turns out to have no listings downgrades itself to
   * `noindex` once the data arrives.
   */
  indexable: boolean;
}

const HOME: RouteMatch = {
  kind: 'HOME',
  path: '/',
  view: 'HOME',
  filters: {},
  indexable: true,
};

export const BLOG_PATH = '/blog';
export const HELP_PATH = '/yordam';
export const LISTING_PATH_PREFIX = '/e';

export function notFound(path = '/404'): RouteMatch {
  return { kind: 'NOT_FOUND', path, view: 'NOT_FOUND', filters: {}, indexable: false };
}

// ---------------------------------------------------------------------------
// Path building
// ---------------------------------------------------------------------------
export function categoryPath(category: RentCategory): string {
  return `/${category.slug}`;
}

export function regionPath(region: SeoRegion): string {
  return `/${region.slug}`;
}

export function regionCategoryPath(region: SeoRegion, category: RentCategory): string {
  return `/${region.slug}/${category.slug}`;
}

export function districtPath(district: SeoDistrict): string {
  return `/${district.regionSlug}/${district.slug}`;
}

export function districtCategoryPath(
  district: SeoDistrict,
  category: RentCategory,
): string {
  return `/${district.regionSlug}/${district.slug}/${category.slug}`;
}

export function listingPath(input: {
  id: string;
  slug?: string;
}): string {
  const prefix = input.slug ? `${input.slug}-` : '';
  return `${LISTING_PATH_PREFIX}/${prefix}${input.id}`;
}

export function blogPostPath(slug: string): string {
  return `${BLOG_PATH}/${slug}`;
}

export function helpPath(slug: string): string {
  return `${HELP_PATH}/${slug}`;
}

/** The path a plain view lives at. Falls back to the catalogue. */
export function viewPath(view: ViewState, listingId?: string | null): string {
  if (view === 'LISTING_DETAIL') {
    return listingId ? listingPath({ id: listingId }) : VIEW_PATHS.LISTINGS ?? '/elonlar';
  }
  return VIEW_PATHS[view] ?? '/';
}

// ---------------------------------------------------------------------------
// Route building
// ---------------------------------------------------------------------------
function categoryRoute(category: RentCategory): RouteMatch {
  return {
    kind: 'CATEGORY',
    path: categoryPath(category),
    view: 'SEO_LANDING',
    filters: { ...category.filters },
    category,
    indexable: true,
  };
}

function regionRoute(region: SeoRegion): RouteMatch {
  return {
    kind: 'REGION',
    path: regionPath(region),
    view: 'SEO_LANDING',
    filters: { region: region.name },
    region,
    indexable: true,
  };
}

function regionCategoryRoute(region: SeoRegion, category: RentCategory): RouteMatch {
  return {
    kind: 'REGION_CATEGORY',
    path: regionCategoryPath(region, category),
    view: 'SEO_LANDING',
    filters: { ...category.filters, region: region.name },
    region,
    category,
    indexable: true,
  };
}

function districtRoute(region: SeoRegion, district: SeoDistrict): RouteMatch {
  return {
    kind: 'DISTRICT',
    path: districtPath(district),
    view: 'SEO_LANDING',
    filters: { region: region.name, district: district.name },
    region,
    district,
    indexable: true,
  };
}

function districtCategoryRoute(
  region: SeoRegion,
  district: SeoDistrict,
  category: RentCategory,
): RouteMatch {
  return {
    kind: 'DISTRICT_CATEGORY',
    path: districtCategoryPath(district, category),
    view: 'SEO_LANDING',
    filters: { ...category.filters, region: region.name, district: district.name },
    region,
    district,
    category,
    indexable: true,
  };
}

export function routeForView(view: ViewState, listingId?: string | null): RouteMatch {
  if (view === 'LISTING_DETAIL' && listingId) {
    return {
      kind: 'LISTING',
      path: listingPath({ id: listingId }),
      view: 'LISTING_DETAIL',
      filters: {},
      listingId,
      indexable: true,
    };
  }
  if (view === 'HOME') return HOME;
  return {
    kind: view === 'LISTINGS' ? 'CATALOG' : 'APP',
    path: viewPath(view, listingId),
    view,
    filters: {},
    // MAP is public but not indexable. The map is drawn by a client-side
    // library, so the prerenderer emits a body of exactly zero characters for
    // /xarita, /ru/xarita and /en/xarita while the head says `index, follow`
    // and the sitemap lists all three: three blank pages offered to Google as
    // content. It stays OUT of PRIVATE_VIEWS on purpose — that set is mirrored
    // into robots.txt as Disallow lines, and a URL a crawler is forbidden to
    // fetch is a URL whose noindex is never read, which is the one way to make
    // a blank page harder to remove rather than easier.
    indexable: !PRIVATE_VIEWS.has(view) && view !== 'MAP',
  };
}

/** The canonical route for a listing, once its data is known. */
export function routeForListing(id: string, slug?: string): RouteMatch {
  return {
    kind: 'LISTING',
    path: listingPath({ id, slug }),
    view: 'LISTING_DETAIL',
    filters: {},
    listingId: id,
    indexable: true,
  };
}

// ---------------------------------------------------------------------------
// Path parsing
// ---------------------------------------------------------------------------
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment).toLowerCase();
  } catch {
    return segment.toLowerCase();
  }
}

/**
 * Reads a URL from the previous build.
 *
 * Those links are in Telegram messages, in browser histories and quite
 * possibly in Google's index already, so they resolve to the new route rather
 * than to a 404 — and `matchUrl` reports that a redirect is owed.
 */
function matchLegacyQuery(search: string): RouteMatch | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }

  const listingId = params.get('listing') ?? params.get('id');
  if (listingId) return routeForListing(listingId);

  const view = params.get('view');
  if (view && LEGACY_VIEW_QUERY[view]) return routeForView(LEGACY_VIEW_QUERY[view]);

  return null;
}

export interface UrlMatch {
  route: RouteMatch;
  language: Language;
  /** True when the language came from the URL rather than from the default. */
  languageFromUrl: boolean;
  /**
   * Set when the address the visitor arrived at is not the canonical one, so
   * the router can replace it in history instead of leaving a duplicate URL
   * in the address bar (and in Google's index).
   */
  redirectTo?: string;
}

export function matchUrl(pathname: string, search = ''): UrlMatch {
  const { language, path, explicit } = stripLanguagePrefix(pathname);

  // Legacy `/?view=…` and `/?listing=…` links resolve, then get replaced.
  if (path === '/' && search) {
    const legacy = matchLegacyQuery(search);
    if (legacy) {
      return {
        route: legacy,
        language,
        languageFromUrl: explicit,
        redirectTo: localisedPath(legacy.path, language),
      };
    }
  }

  const route = matchPath(path);
  const canonical = localisedPath(route.path, language);
  const arrived = normalisePath(pathname);

  return {
    route,
    language,
    languageFromUrl: explicit,
    redirectTo:
      route.kind !== 'NOT_FOUND' && (canonical !== arrived || search)
        ? canonical
        : undefined,
  };
}

export function matchPath(pathname: string): RouteMatch {
  const path = normalisePath(pathname);
  if (path === '/') return HOME;

  const segments = path.slice(1).split('/').map(decodeSegment);

  // -- One segment --------------------------------------------------------
  if (segments.length === 1) {
    const [first] = segments;

    const view = PATH_TO_VIEW.get(`/${first}`);
    if (view) return routeForView(view);

    const category = CATEGORY_BY_SLUG.get(first);
    if (category) return categoryRoute(category);

    const region = REGION_BY_SLUG.get(first);
    if (region) return regionRoute(region);

    if (`/${first}` === BLOG_PATH) {
      return {
        kind: 'BLOG_INDEX',
        path: BLOG_PATH,
        view: 'BLOG_INDEX',
        filters: {},
        indexable: true,
      };
    }

    if (`/${first}` === HELP_PATH) {
      return {
        kind: 'HELP',
        path: HELP_PATH,
        view: 'HELP',
        filters: {},
        slug: '',
        indexable: true,
      };
    }

    return notFound(path);
  }

  // -- Two segments -------------------------------------------------------
  if (segments.length === 2) {
    const [first, second] = segments;

    if (`/${first}` === LISTING_PATH_PREFIX) {
      const id = listingIdFromSlug(second);
      if (!id) return notFound(path);
      // The address is kept exactly as requested, slug and all. The canonical
      // form needs the listing's title, which only the detail page has once it
      // has loaded — it replaces the URL and the canonical tag together, so
      // `/e/<uuid>` and `/e/chilonzor-2-xonali-<uuid>` converge on one URL
      // rather than becoming two copies of the same page.
      return {
        kind: 'LISTING',
        path: `${LISTING_PATH_PREFIX}/${second}`,
        view: 'LISTING_DETAIL',
        filters: {},
        listingId: id,
        indexable: true,
      };
    }

    if (`/${first}` === BLOG_PATH) {
      return (BLOG_SLUGS as readonly string[]).includes(second)
        ? {
            kind: 'BLOG_POST',
            path: blogPostPath(second),
            view: 'BLOG_POST',
            filters: {},
            slug: second,
            indexable: true,
          }
        : notFound(path);
    }

    if (`/${first}` === HELP_PATH) {
      return (HELP_SLUGS as readonly string[]).includes(second)
        ? {
            kind: 'HELP',
            path: helpPath(second),
            view: 'HELP',
            filters: {},
            slug: second,
            indexable: true,
          }
        : notFound(path);
    }

    const region = REGION_BY_SLUG.get(first);
    if (!region) return notFound(path);

    const category = CATEGORY_BY_SLUG.get(second);
    if (category) {
      return category.regionPages ? regionCategoryRoute(region, category) : notFound(path);
    }

    const district = DISTRICT_BY_PATH.get(`${first}/${second}`);
    if (district) return districtRoute(region, district);

    return notFound(path);
  }

  // -- Three segments -----------------------------------------------------
  if (segments.length === 3) {
    const [first, second, third] = segments;
    const region = REGION_BY_SLUG.get(first);
    const district = DISTRICT_BY_PATH.get(`${first}/${second}`);
    const category = CATEGORY_BY_SLUG.get(third);
    if (region && district && category && category.districtPages) {
      return districtCategoryRoute(region, district, category);
    }
    return notFound(path);
  }

  return notFound(path);
}
