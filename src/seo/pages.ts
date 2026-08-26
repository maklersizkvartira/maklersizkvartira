/**
 * Every page the build knows about before it talks to the database.
 *
 * The prerenderer, the sitemap generator and the internal-link blocks all read
 * this one list, so a page cannot exist in the sitemap without being
 * prerendered, or be linked to without being in the sitemap.
 *
 * Listing pages are deliberately absent: there are as many of those as there
 * are listings, they change hourly, and they come from `sitemap-listings.xml`
 * instead.
 */

import { BLOG_SLUGS } from './content/blogIndex';
import { HELP_SLUGS } from './content/helpIndex';
import {
  BLOG_PATH,
  HELP_PATH,
  blogPostPath,
  categoryPath,
  districtCategoryPath,
  districtPath,
  helpPath,
  regionCategoryPath,
  regionPath,
  type RouteMatch,
  matchPath,
} from './routes';
import { CATEGORIES, REGIONS } from './taxonomy';
import { VIEW_PATHS } from '../router/views';

export interface StaticPage {
  path: string;
  route: RouteMatch;
  /** Sitemap priority. Relative, and only meaningful against its siblings. */
  priority: number;
  changefreq: 'daily' | 'weekly' | 'monthly';
}

function page(path: string, priority: number, changefreq: StaticPage['changefreq']): StaticPage {
  return { path, route: matchPath(path), priority, changefreq };
}

/**
 * Built once at module load. Order matters only for readability of the
 * generated sitemap; crawlers do not read priority as a ranking instruction.
 */
export const STATIC_PAGES: readonly StaticPage[] = (() => {
  const pages: StaticPage[] = [
    page('/', 1.0, 'daily'),
    page(VIEW_PATHS.LISTINGS ?? '/elonlar', 0.9, 'daily'),
    page(VIEW_PATHS.MAP ?? '/xarita', 0.6, 'weekly'),
    page(VIEW_PATHS.STUDENT_PROGRAM ?? '/talabalar-dasturi', 0.5, 'monthly'),
  ];

  // The signed-in screens get a file too, even though none of them is
  // indexable. The host answers a request that matches no file with a real
  // 404 — which is the point, and is what stops every typo from returning the
  // home page at HTTP 200 — so `/profil` has to exist on disk or the app
  // breaks for anyone who bookmarks it. Each one ships a `noindex` head and
  // an empty body, and `INDEXABLE_PAGES` leaves it out of the sitemap.
  const covered = new Set(pages.map((item) => item.path));
  for (const path of Object.values(VIEW_PATHS)) {
    if (!path || covered.has(path)) continue;
    pages.push(page(path, 0.1, 'monthly'));
    covered.add(path);
  }

  for (const category of CATEGORIES) {
    pages.push(page(categoryPath(category), 0.9, 'daily'));
  }

  for (const region of REGIONS) {
    // Tashkent is where the inventory is; the rest are hubs that mostly link on.
    pages.push(page(regionPath(region), region.slug === 'toshkent' ? 0.9 : 0.6, 'weekly'));

    for (const category of CATEGORIES) {
      if (!category.regionPages) continue;
      pages.push(
        page(
          regionCategoryPath(region, category),
          region.slug === 'toshkent' ? 0.9 : 0.6,
          'daily',
        ),
      );
    }

    if (!region.expandsDistricts) continue;
    for (const district of region.districts) {
      pages.push(page(districtPath(district), 0.8, 'daily'));
      for (const category of CATEGORIES) {
        if (!category.districtPages) continue;
        pages.push(page(districtCategoryPath(district, category), 0.8, 'daily'));
      }
    }
  }

  pages.push(page(BLOG_PATH, 0.6, 'weekly'));
  for (const slug of BLOG_SLUGS) pages.push(page(blogPostPath(slug), 0.5, 'monthly'));

  pages.push(page(HELP_PATH, 0.4, 'monthly'));
  for (const slug of HELP_SLUGS) pages.push(page(helpPath(slug), 0.3, 'monthly'));

  return pages;
})();

/**
 * The subset a search engine is invited to index.
 *
 * A landing page can still turn itself into `noindex` at runtime once it finds
 * out it has nothing to show; this list is the URL-level filter only.
 */
export const INDEXABLE_PAGES: readonly StaticPage[] = STATIC_PAGES.filter(
  (item) => item.route.indexable,
);
