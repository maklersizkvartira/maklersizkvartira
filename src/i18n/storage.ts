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
 * Resolution order: the URL's language prefix, then an explicit stored choice,
 * then the legacy `?lang=`, then the browser's preferences, then Uzbek.
 *
 * The prefix has to come first. `/ru/toshkent` declares itself the Russian
 * page in its canonical and hreflang tags, so if a returning Uzbek-preferring
 * visitor were served Uzbek at that address the page would contradict its own
 * metadata — and hreflang stops working the moment it does.
 */
export function detectInitialLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  try {
    const fromPath = stripLanguagePrefix(window.location.pathname);
    if (fromPath.explicit) return fromPath.language;
  } catch {
    /* malformed URL */
  }

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    /* private mode / storage disabled */
  }

  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (isLanguage(fromUrl)) return fromUrl;
  } catch {
    /* malformed URL */
  }

  // Guarded separately from `window`: a prerender or test that shims `window`
  // without shimming `navigator` would otherwise throw here, at module
  // evaluation time, before anything has had a chance to render.
  if (typeof navigator !== 'undefined') {
    for (const candidate of navigator.languages ?? [navigator.language]) {
      const base = candidate?.slice(0, 2).toLowerCase();
      if (isLanguage(base)) return base;
    }
  }
  return DEFAULT_LANGUAGE;
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
