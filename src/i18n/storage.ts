/**
 * Language detection and persistence.
 *
 * Split out of the provider so the store can read the current language
 * without importing the React module — otherwise the store and the i18n
 * runtime import each other, and a cycle between the two modules that every
 * component depends on is a fragile place to have one.
 */

import { stripLanguagePrefix } from '../router/language';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './types';

export const LANGUAGE_STORAGE_KEY = 'maklersiz.language';

/**
 * The language the current URL renders in.
 *
 * Resolution order: the URL's language prefix, then an explicit stored choice,
 * then Uzbek. The browser's own preference is deliberately NOT consulted here.
 *
 * It has to answer exactly what the router will answer. When it did not — when
 * this returned the browser language while the router resolved an unprefixed
 * path to Uzbek — the two disagreed, and the app booted having loaded one
 * language's copy while rendering another's, which fell through to the
 * placeholder pack and put "Chilonzor — apartment" on the page.
 *
 * A first-time visitor whose browser asks for Russian is still served Russian:
 * `browserLanguage` below feeds a redirect to `/ru/…`, so the address and the
 * content agree instead of a Russian page claiming in its own canonical tag to
 * be the Uzbek one.
 */
export function detectInitialLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  try {
    const fromPath = stripLanguagePrefix(window.location.pathname);
    if (fromPath.explicit) return fromPath.language;
  } catch {
    /* malformed URL */
  }

  return storedLanguage() ?? DEFAULT_LANGUAGE;
}

/**
 * What this visitor would probably rather read, ignoring the URL.
 *
 * Used only to decide whether to move somebody to their language's address.
 * It never decides what a given URL renders.
 */
export function browserLanguage(): Language | null {
  if (typeof window === 'undefined') return null;

  try {
    // The previous build advertised `?lang=` alternates; those links still exist.
    const fromQuery = new URLSearchParams(window.location.search).get('lang');
    if (isLanguage(fromQuery)) return fromQuery;
  } catch {
    /* malformed URL */
  }

  // Guarded separately from `window`: a prerender or test that shims `window`
  // without shimming `navigator` would otherwise throw at module evaluation.
  if (typeof navigator === 'undefined') return null;
  for (const candidate of navigator.languages ?? [navigator.language]) {
    const base = candidate?.slice(0, 2).toLowerCase();
    if (isLanguage(base)) return base;
  }
  return null;
}

/** The language a returning visitor last chose, ignoring the current URL. */
export function storedLanguage(): Language | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function persistLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* ignore */
  }
}
