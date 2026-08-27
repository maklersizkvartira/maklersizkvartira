/**
 * Keeps the document head in step with the route.
 *
 * The prerenderer writes the same tags into the static HTML from the same
 * `buildHead` call, so the head a crawler fetches and the head it renders are
 * identical by construction. Any drift between the two reads as cloaking, and
 * this is the mechanism that makes drift impossible.
 *
 * Tags this module owns are stamped `data-seo`, and every one of them is
 * removed before the new set is written. Without that, navigating from a
 * listing to a landing page would leave the listing's `hreflang` links and its
 * JSON-LD behind, and the page would describe two different things at once.
 */

import { useEffect } from 'react';

import { SITE_NAME } from './config';
import { buildHead, type HeadData, type HeadTags } from './meta';
import { useSeoCopy } from './useSeoCopy';
import type { RouteMatch } from './routes';
import type { Language } from '../i18n/types';

const OWNED = 'data-seo';

function upsertMeta(selector: string, attrs: Record<string, string>): void {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(OWNED, '');
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
}

function upsertLink(rel: string, href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    element.setAttribute(OWNED, '');
    document.head.appendChild(element);
  }
  element.href = href;
}

/** Removes the repeated tags, which cannot be updated in place. */
function clearRepeated(): void {
  document.head
    .querySelectorAll('link[rel="alternate"][hreflang], script[type="application/ld+json"]')
    .forEach((node) => node.remove());
}

export function applyHead(head: HeadTags, language: Language): void {
  if (typeof document === 'undefined') return;

  document.title = head.title;
  document.documentElement.lang = language;

  upsertMeta('meta[name="description"]', { name: 'description', content: head.description });
  upsertMeta('meta[name="robots"]', { name: 'robots', content: head.robots });
  upsertLink('canonical', head.canonicalUrl);

  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: head.ogType });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: head.title });
  upsertMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: head.description,
  });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: head.canonicalUrl });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: head.ogImage });
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: head.ogLocale });
  upsertMeta('meta[property="og:site_name"]', {
    property: 'og:site_name',
    content: SITE_NAME,
  });

  upsertMeta('meta[name="twitter:card"]', {
    name: 'twitter:card',
    content: 'summary_large_image',
  });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: head.title });
  upsertMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: head.description,
  });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: head.ogImage });

  clearRepeated();

  for (const alternate of head.alternates) {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = alternate.hreflang;
    link.href = alternate.href;
    link.setAttribute(OWNED, '');
    document.head.appendChild(link);
  }

  if (head.jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute(OWNED, '');
    script.textContent = head.jsonLd;
    document.head.appendChild(script);
  }
}

/**
 * Applies the head for a route. `data` is what the page has learned since it
 * mounted — the loaded listing, or how many results a facet turned out to
 * have — so the head is written twice: once optimistically, once for real.
 *
 * `enabled` exists because effects run child-first: the shell's call would
 * otherwise land *after* the page's and overwrite a listing's real title with
 * the shell's generic one. The shell passes `false` for any view that
 * describes itself.
 */
export function useSeoHead(
  route: RouteMatch,
  language: Language,
  data: HeadData = {},
  enabled = true,
): void {
  const { listing, resultCount, noindex } = data;
  // Identity, not the array: `sample` is rebuilt on every render, so
  // depending on it directly would rewrite the head forever, and leaving it
  // out let a landing page keep the ItemList from its first fetch.
  const sampleKey = (data.sample ?? []).map((item) => item.id).join(',');
  // Subscribing to the pack is what makes the head correct itself once a
  // lazily-loaded language arrives, rather than keeping the fallback title.
  const copy = useSeoCopy(language);

  useEffect(() => {
    if (!enabled) return;
    applyHead(buildHead(route, language, data), language);
    // `data` is spread into the deps by its meaningful fields; including the
    // object itself would re-run on every render, because callers build it
    // inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, language, copy, listing, resultCount, sampleKey, noindex, enabled]);
}
