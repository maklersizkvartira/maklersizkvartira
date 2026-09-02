/**
 * Generates the sitemaps and robots.txt into dist/.
 *
 * The shipped `public/sitemap.xml` listed two URLs, one of which (`/search`)
 * had never existed. It is replaced by a sitemap index with two children,
 * split by how often they change:
 *
 *   sitemap-pages.xml     static, written here at build time — the home page,
 *                         every category, every region, every Tashkent
 *                         district, the guides and the help centre, each in
 *                         all three languages with hreflang alternates.
 *   sitemap-listings.xml  dynamic, served by the API and proxied onto this
 *                         domain by a Vercel rewrite, because listings appear
 *                         and expire between deploys and a build-time copy
 *                         would be stale the day after it shipped.
 *
 * Both live on uyiz.uz. A sitemap that lists URLs for a host it is not served
 * from is only honoured when both hosts are verified in Search Console, and
 * publishing canonical URLs from a *.up.railway.app subdomain is not a thing
 * to build on.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ENTRY = path.join(ROOT, '.prerender', 'entry-server.js');

/*
 * The origin, again.
 *
 * This script is plain Node and cannot import src/seo/config.ts, so the
 * default is duplicated here on purpose. It must match `RAW_SITE_URL` there
 * and the absolute URLs in index.html; if the canonical tags and the sitemap
 * ever disagree about the host, nothing in the build catches it — the audit
 * strips the host before comparing. Setting VITE_SITE_URL makes both
 * defaults moot, which is how it should be deployed.
 */
// The host that answers 200 — the Vercel Primary Domain, not merely the brand.
// A <loc> pointing at a URL that redirects is dropped as "Page with redirect".
// See the long note in src/seo/config.ts; the two defaults flip together.
const SITE_URL = (process.env.VITE_SITE_URL || 'https://uyiz.uz').replace(/\/+$/, '');

/** Private and duplicate surfaces. Also `noindex` in the page head itself: */
/* robots.txt only stops the crawl, and a URL linked from elsewhere can still
   be indexed without ever being fetched. */
const DISALLOWED = [
  // The sign-in flow. Thin content that would compete with the pages that
  // actually answer a search, and there is nothing on it for a crawler.
  '/login',
  '/register',
  '/forget-password',
  '/profil',
  '/saqlanganlar',
  '/mening-elonlarim',
  '/elon-berish',
  '/tasdiqlash',
  '/dostni-taklif-qilish',
  '/xabarlar',
  '/admin',
  '/api/',
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absolute(routePath) {
  return `${SITE_URL}${routePath === '/' ? '/' : routePath}`;
}

/** The API keeps at most this many `budget` ceilings per request. */
const MAX_BUDGET_CEILINGS = 8;

/**
 * The price ceilings this build actually has a page for.
 *
 * Read off the routes instead of written down, so `arzon-ijara` can move its
 * ceiling — or gain a sibling — without the number having to be remembered in
 * a second place. Normalised the way the API normalises it, so a ceiling we
 * ask about cannot be trimmed on arrival and come back looking like a zero.
 */
function budgetCeilings(pages) {
  const ceilings = new Set();
  for (const page of pages) {
    const maxPrice = page.route.filters?.maxPrice;
    if (typeof maxPrice === 'number' && maxPrice > 0) ceilings.add(maxPrice);
  }
  return [...ceilings].sort((a, b) => a - b).slice(0, MAX_BUDGET_CEILINGS);
}

/**
 * How many public listings each facet has, straight from the API.
 *
 * Best-effort by design: an unreachable API means every page goes in, which is
 * the same behaviour as before this check existed. Failing the build because a
 * count could not be fetched would be a worse outcome than a slightly generous
 * sitemap.
 */
async function fetchFacets(ceilings) {
  const apiUrl = process.env.VITE_API_URL;
  if (!apiUrl) {
    console.log('sitemap: VITE_API_URL is unset — including every page');
    return null;
  }
  try {
    const { origin } = new URL(apiUrl);
    const endpoint = new URL('/api/v1/meta/seo-facets', origin);
    // Budget counts are asked for by value and answered keyed by the same
    // value. Ceilings that are not asked about come back absent, which is why
    // `facetKey` refuses to build a budget key for one we skipped.
    for (const ceiling of ceilings) {
      endpoint.searchParams.append('budget', String(ceiling));
    }
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(15_000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    return body?.data ?? null;
  } catch (error) {
    console.warn(`sitemap: could not read facet counts (${error.message}) — including every page`);
    return null;
  }
}

/**
 * Where in the response the count for a page's filters lives.
 *
 * One key, because the axes are not independent questions.
 * `/toshkent/bektemir/uy-ijaraga` was submitted whenever Bektemir held any
 * listing at all and a house existed anywhere in the country, and then
 * rendered itself `noindex` because that *intersection* was empty — which
 * Search Console files as "Submitted URL marked noindex", an error rather
 * than a warning.
 *
 * Null means no count can answer: a page with no filters (home, catalogue,
 * blog, help — none of which is inventory-gated), or a budget ceiling this
 * build did not ask about.
 */
function facetKey(filters, ceilings) {
  const { region, district, propertyType, rentalType, audience, maxPrice } = filters;

  if (propertyType) {
    if (district) {
      return { field: 'districtPropertyTypes', key: `${district}|${propertyType}` };
    }
    if (region) return { field: 'regionPropertyTypes', key: `${region}|${propertyType}` };
    return { field: 'propertyTypes', key: propertyType };
  }
  // The derived categories are counted server-side through the same filter
  // predicates the pages themselves use, so `family` already carries its
  // `rentalType: 'FULL'` half and there is nothing left here to intersect.
  //
  // The two that now have geography are composited the same way the property
  // types are. Falling through to the national scalar for them would submit
  // /toshkent/bektemir/sheriklikka-ijara whenever one roommate listing existed
  // anywhere in the country — the same over-inclusion, on 120 more URLs.
  if (rentalType === 'ROOMMATE') {
    if (district) return { field: 'districtRoommate', key: district };
    if (region) return { field: 'regionRoommate', key: region };
    return { field: 'roommate' };
  }
  if (audience === 'FAMILY') return { field: 'family' };
  if (audience === 'STUDENT') return { field: 'student' };
  if (maxPrice) {
    // A ceiling this build did not ask about cannot be answered at all, which
    // is a different thing from "asked and the answer was zero".
    if (!ceilings.includes(maxPrice)) return null;
    if (district) return { field: 'districtBudget', key: `${district}|${maxPrice}` };
    if (region) return { field: 'regionBudget', key: `${region}|${maxPrice}` };
    return { field: 'budget', key: String(maxPrice) };
  }
  if (district) return { field: 'districts', key: district };
  if (region) return { field: 'regions', key: region };
  return null;
}

/**
 * The single number behind a page, or null when the response cannot answer.
 *
 * A key absent from a map that *is* present means zero — the API omits pairs
 * with no listings rather than sending them as `0`. A missing map means an
 * older API that predates that field, which is a different answer entirely:
 * the frontend and the backend deploy separately, so for a window after this
 * ships the build talks to a server that never heard of the composites.
 */
function facetCount(facets, { field, key }) {
  const value = facets[field];
  if (value === undefined || value === null) return null;
  if (key === undefined) return typeof value === 'number' ? value : null;
  return typeof value[key] === 'number' ? value[key] : 0;
}

/**
 * The pre-composite test, kept for exactly one reason: an API that does not
 * send the composite maps yet. It over-includes — that is the whole reason the
 * composites exist — but it still catches a region or a property type that is
 * empty everywhere, which is better than including every page blind.
 */
function hasInventoryByAxis(filters, facets) {
  const { region, district, propertyType, rentalType } = filters;

  if (district && !(facets.districts?.[district] > 0)) return false;
  if (region && !district && !(facets.regions?.[region] > 0)) return false;
  if (propertyType && !(facets.propertyTypes?.[propertyType] > 0)) return false;
  if (rentalType === 'ROOMMATE' && !(facets.roommate > 0)) return false;
  return true;
}

/**
 * Whether a generated page currently has anything to show.
 *
 * A page with an empty grid is thin content. It stays on the site — its links
 * still lead somewhere, and it fills up again as soon as an owner posts — but
 * there is no reason to invite a crawler to it, and the page marks itself
 * `noindex` at runtime for the same reason.
 */
function hasInventory(page, facets, ceilings) {
  // No counts at all — an unset VITE_API_URL or an unreachable API. Shipping a
  // near-empty sitemap because a fetch failed is far worse than a generous one.
  if (!facets) return true;

  const lookup = facetKey(page.route.filters, ceilings);
  const count = lookup ? facetCount(facets, lookup) : null;
  return count === null ? hasInventoryByAxis(page.route.filters, facets) : count > 0;
}

/** Which count emptied a page, for the build log. */
function pruneReason(filters, facets, ceilings) {
  const lookup = facetKey(filters, ceilings);
  if (!lookup || facets[lookup.field] === undefined || facets[lookup.field] === null) {
    return 'no listings on its region, district or property type';
  }
  return `${lookup.field}${lookup.key === undefined ? '' : `[${lookup.key}]`} is 0`;
}

function urlEntry({ loc, alternates, lastmod, changefreq, priority }) {
  const lines = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`];
  for (const alternate of alternates) {
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}"/>`,
    );
  }
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority !== undefined) lines.push(`    <priority>${priority.toFixed(1)}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
}

async function main() {
  if (!existsSync(ENTRY)) {
    throw new Error(
      `sitemap: ${path.relative(ROOT, ENTRY)} is missing. ` +
        'Run `vite build --ssr src/entry-server.tsx` first.',
    );
  }

  // The same bundle the prerenderer used, so the sitemap and the generated
  // files cannot disagree about a single address.
  const { INDEXABLE_PAGES, LANGUAGES, alternatePaths } = await import(
    pathToFileURL(ENTRY).href
  );

  // Build date, not content date: these pages are generated from copy that
  // changes when the code does.
  const lastmod = new Date().toISOString().slice(0, 10);

  const ceilings = budgetCeilings(INDEXABLE_PAGES);
  const facets = await fetchFacets(ceilings);
  const included = [];
  const pruned = [];
  for (const page of INDEXABLE_PAGES) {
    (hasInventory(page, facets, ceilings) ? included : pruned).push(page);
  }

  const entries = [];
  for (const page of included) {
    const paths = alternatePaths(page.path);

    const alternates = [
      ...LANGUAGES.map((code) => ({
        hreflang: code,
        href: absolute(paths[code]),
      })),
      { hreflang: 'x-default', href: absolute(paths.uz) },
    ];

    for (const code of LANGUAGES) {
      entries.push(
        urlEntry({
          loc: absolute(paths[code]),
          alternates,
          lastmod,
          changefreq: page.changefreq,
          // Translations sit slightly below the Uzbek original, which is the
          // primary market and the x-default.
          priority: code === 'uz' ? page.priority : Math.max(0.1, page.priority - 0.1),
        }),
      );
    }
  }

  const pagesXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  const indexXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <sitemap>',
    `    <loc>${SITE_URL}/sitemap-pages.xml</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    '  </sitemap>',
    '  <sitemap>',
    `    <loc>${SITE_URL}/sitemap-listings.xml</loc>`,
    '  </sitemap>',
    '</sitemapindex>',
    '',
  ].join('\n');

  const robotsTxt = [
    `# ${SITE_URL}`,
    '',
    'User-agent: *',
    'Allow: /',
    '',
    '# Signed-in surfaces and the API. Nothing here is useful in a search',
    '# result, and crawling it only spends crawl budget that the listing',
    '# pages need.',
    // Every private surface exists three times over — /profil, /ru/profil and
    // /en/profil are three different URLs and only the first was disallowed.
    // Derived from LANGUAGES rather than written out, so a fourth language
    // cannot quietly reopen them. /admin and /api/ are not language-prefixed.
    ...DISALLOWED.flatMap((rule) =>
      rule === '/api/' || rule === '/admin'
        ? [rule]
        : [rule, ...LANGUAGES.filter((code) => code !== 'uz').map((code) => `/${code}${rule}`)],
    ).map((rule) => `Disallow: ${rule}`),
    '',
    '# Filter and tracking parameters. The canonical page is the clean path;',
    '# these produce endless near-identical variants of it.',
    'Disallow: /*?view=',
    'Disallow: /*?listing=',
    'Disallow: /*?lang=',
    'Disallow: /*?utm_',
    '',
    '# Some crawlers hammer a listings site hard enough to matter. This is a',
    '# request, not a guarantee — Googlebot ignores it and is throttled in',
    '# Search Console instead.',
    'User-agent: AhrefsBot',
    'Crawl-delay: 10',
    '',
    'User-agent: SemrushBot',
    'Crawl-delay: 10',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');

  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, 'sitemap-pages.xml'), pagesXml, 'utf8');
  await writeFile(path.join(DIST, 'sitemap.xml'), indexXml, 'utf8');
  await writeFile(path.join(DIST, 'robots.txt'), robotsTxt, 'utf8');

  console.log(
    `sitemap: ${entries.length} URLs across ${LANGUAGES.length} languages ` +
      `(${included.length} pages), plus robots.txt`,
  );
  if (pruned.length > 0) {
    // Listed one by one, not just counted: a build that quietly drops thirty
    // pages from the sitemap looks identical to one that covered everything,
    // and the useful question is always *which* thirty. Composite pruning cuts
    // deeper than the old per-axis test did, so the first build after it lands
    // is expected to drop more pages — this is where you check that the ones it
    // dropped are the empty ones and not, say, all of Tashkent because a region
    // name drifted apart from what the listings store.
    console.log(
      `sitemap: left out ${pruned.length} of ${INDEXABLE_PAGES.length} page(s) with nothing to show:`,
    );
    for (const page of pruned) {
      console.log(`sitemap:   ${page.path} — ${pruneReason(page.route.filters, facets, ceilings)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
