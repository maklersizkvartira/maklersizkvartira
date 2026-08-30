/**
 * Writes a real HTML file for every static page, in every language.
 *
 * Before this step the site answered every URL on the domain with the same
 * empty shell: one title, one description, one canonical pointing at the home
 * page, and zero indexable words. A crawler had to execute JavaScript to see
 * anything at all, and even then every page claimed to be a copy of "/".
 *
 * Runs after both Vite builds:
 *   vite build                              -> dist/         (the client)
 *   vite build --ssr src/entry-server.tsx   -> .prerender/   (the renderer)
 *   node scripts/prerender.mjs              -> dist/**\/index.html
 *
 * The head and the body both come from the same modules the running app uses,
 * so the static HTML and the hydrated DOM cannot describe different pages.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ENTRY = path.join(ROOT, '.prerender', 'entry-server.js');

const HEAD_START = '<!--seo-head-start-->';
const HEAD_END = '<!--seo-head-end-->';
const BODY_START = '<!--seo-body-start-->';
const BODY_END = '<!--seo-body-end-->';
const PRECONNECT = '<!--seo-preconnect-->';

/** Minimal HTML-attribute escaping. Titles and descriptions are prose. */
function attr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * JSON-LD goes in a script element, so the only sequence that can break out
 * of it is a literal `</`. Escaping the slash keeps the JSON valid and the
 * document unbreakable.
 */
function jsonLdSafe(value) {
  return value.replace(/</g, '\\u003c');
}

function renderHead(head, language, siteName) {
  const lines = [
    `<title>${attr(head.title)}</title>`,
    `<meta name="description" content="${attr(head.description)}" />`,
    `<meta name="robots" content="${attr(head.robots)}" />`,
  ];

  // The listing shell deliberately declares no canonical: the URL that was
  // requested is the canonical one, and one shell serving thousands of
  // listings must not claim they are all copies of a single address.
  if (head.canonicalUrl) {
    lines.push(`<link rel="canonical" href="${attr(head.canonicalUrl)}" />`);
  }

  for (const alternate of head.alternates) {
    lines.push(
      `<link rel="alternate" hreflang="${attr(alternate.hreflang)}" href="${attr(alternate.href)}" />`,
    );
  }

  lines.push(
    `<meta property="og:type" content="${attr(head.ogType)}" />`,
    `<meta property="og:site_name" content="${attr(siteName)}" />`,
    `<meta property="og:locale" content="${attr(head.ogLocale)}" />`,
    `<meta property="og:title" content="${attr(head.title)}" />`,
    `<meta property="og:description" content="${attr(head.description)}" />`,
    ...(head.canonicalUrl
      ? [`<meta property="og:url" content="${attr(head.canonicalUrl)}" />`]
      : []),
    `<meta property="og:image" content="${attr(head.ogImage)}" />`,
    // Only for the brand card, whose size is known. A listing photo's
    // dimensions are not, and a wrong width is worse than none: unfurlers
    // trust it and crop to it.
    ...(head.ogImage.endsWith('/brand/og-image.png')
      ? [
          `<meta property="og:image:width" content="1200" />`,
          `<meta property="og:image:height" content="630" />`,
        ]
      : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${attr(head.title)}" />`,
    `<meta name="twitter:description" content="${attr(head.description)}" />`,
    `<meta name="twitter:image" content="${attr(head.ogImage)}" />`,
  );

  if (head.jsonLd) {
    lines.push(
      `<script type="application/ld+json">${jsonLdSafe(head.jsonLd)}</script>`,
    );
  }

  return lines.map((line) => `    ${line}`).join('\n');
}

/**
 * A warm connection to the API host, worth roughly a round trip on the very
 * first data request. The origin is only known from the build environment, so
 * it is injected here rather than hard-coded in index.html.
 */
function renderPreconnect() {
  const apiUrl = process.env.VITE_API_URL || '';
  if (!apiUrl) return '';
  try {
    const { origin } = new URL(apiUrl);
    if (origin === 'null') return '';
    return `<link rel="preconnect" href="${attr(origin)}" crossorigin />\n    <link rel="dns-prefetch" href="${attr(origin)}" />`;
  } catch {
    return '';
  }
}

/**
 * The brand name as index.html already spells it, as a last resort.
 *
 * Throwing instead would fail a deploy over a tag that no human ever reads;
 * a missing name would ship an empty og:site_name, which unfurlers show as a
 * blank line. Neither is better than reading the value that is right there.
 */
function templateSiteName(template) {
  const match = template.match(/<meta property="og:site_name" content="([^"]*)"/i);
  return match ? match[1] : '';
}

function replaceBetween(source, start, end, replacement) {
  const from = source.indexOf(start);
  const to = source.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`prerender: markers ${start} / ${end} not found in dist/index.html`);
  }
  return source.slice(0, from + start.length) + replacement + source.slice(to);
}

/** `/` -> `dist/index.html`, `/ru/toshkent` -> `dist/ru/toshkent/index.html`. */
function outputPath(routePath) {
  if (routePath === '/') return path.join(DIST, 'index.html');
  // The host looks up `404.html` by that exact name to answer an unmatched
  // request with a real 404 status, so this one is not a directory.
  if (routePath === '/404') return path.join(DIST, '404.html');
  return path.join(DIST, routePath.replace(/^\//, ''), 'index.html');
}

async function main() {
  if (!existsSync(ENTRY)) {
    throw new Error(
      `prerender: ${path.relative(ROOT, ENTRY)} is missing. ` +
        'Run `vite build --ssr src/entry-server.tsx` first.',
    );
  }

  const templatePath = path.join(DIST, 'index.html');
  const template = await readFile(templatePath, 'utf8');
  const preconnect = renderPreconnect();

  const { renderAll, SITE_NAME } = await import(pathToFileURL(ENTRY).href);
  const pages = renderAll();

  // og:site_name is the one head tag this script writes on its own, and it
  // used to be a literal. A literal here is how the served HTML ends up
  // naming a brand the running app no longer uses: nothing renders it, so
  // nobody sees the drift except a crawler and every link unfurler.
  //
  // The SSR bundle re-exports SITE_NAME from src/seo/config.ts when
  // entry-server.tsx exposes it; until it does, the value is read back out of
  // the un-prerendered template, whose own head is the same brand.
  const siteName = SITE_NAME ?? templateSiteName(template);

  let written = 0;
  const failures = [];

  for (const page of pages) {
    if (page.error) failures.push(`${page.path}: ${page.error}`);

    let html = template;
    html = replaceBetween(
      html,
      HEAD_START,
      HEAD_END,
      `\n${renderHead(page.head, page.language, siteName)}\n    `,
    );
    html = replaceBetween(html, BODY_START, BODY_END, page.html);
    if (preconnect) html = html.replace(PRECONNECT, preconnect);
    // The served `lang` has to match the page, not the template's default:
    // a Russian page announcing `lang="uz"` is what makes hreflang inert.
    html = html.replace('<html lang="uz">', `<html lang="${page.language}">`);

    const file = outputPath(page.path);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html, 'utf8');
    written += 1;
  }

  console.log(`prerender: wrote ${written} pages`);
  const empty = pages.filter((page) => !page.html).length;
  if (empty > 0) {
    console.log(`prerender: ${empty} of them are head-only (no renderable component)`);
  }
  if (failures.length > 0) {
    // Loud, but not fatal: the head is still correct, and one broken component
    // should not stop a deploy that fixes ninety-nine other pages.
    console.warn(`prerender: ${failures.length} pages failed to render their body`);
    for (const failure of failures.slice(0, 10)) console.warn(`  - ${failure}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
