/**
 * Language detection and persistence.
 *
 * Split out of the provider so the store can read the current language
 * without importing the React module — otherwise the store and the i18n
 * runtime import each other, and a cycle between the two modules that every
 * component depends on is a fragile place to have one.
 */

import { DEFAULT_LANGUAGE, isLanguage, type Language } from './types';

export const LANGUAGE_STORAGE_KEY = 'maklersiz.language';

/**
 * Resolution order: an explicit stored choice, then `?lang=`, then the
 * browser's preferences, then Uzbek.
 */
export function detectInitialLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

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

  for (const candidate of navigator.languages ?? [navigator.language]) {
    const base = candidate?.slice(0, 2).toLowerCase();
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

export function persistLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* ignore */
  }
}
