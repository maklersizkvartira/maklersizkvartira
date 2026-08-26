/**
 * Language prefixes in the URL.
 *
 * Kept in its own module — importing nothing but the language vocabulary — so
 * that `i18n/storage` can read the prefix without pulling the route table, the
 * geography taxonomy and every place name in Uzbekistan into the module graph
 * of a file that only needs to answer "which language is this".
 *
 * Uzbek is the default and lives at the bare root; Russian and English live
 * under `/ru` and `/en`. The URL is the only source of truth for which
 * language a page is in: a stored preference may redirect a returning visitor
 * to their prefix, but it never changes what a given URL renders. Otherwise
 * `/toshkent` would show Russian to some visitors while its canonical and
 * hreflang tags insisted it was the Uzbek page.
 */

import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../i18n/types';

export const LANGUAGE_PREFIX: Record<Language, string> = {
  uz: '',
  ru: '/ru',
  en: '/en',
};

/** One canonical form: no trailing slash anywhere except the root. */
export function normalisePath(pathname: string): string {
  let path = pathname || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

export interface LanguageSplit {
  language: Language;
  /** The path with the prefix removed, always starting with `/`. */
  path: string;
  /** Whether the URL carried an explicit prefix. */
  explicit: boolean;
}

export function stripLanguagePrefix(pathname: string): LanguageSplit {
  const path = normalisePath(pathname);
  for (const language of LANGUAGES) {
    const prefix = LANGUAGE_PREFIX[language];
    if (!prefix) continue;
    if (path === prefix) return { language, path: '/', explicit: true };
    if (path.startsWith(`${prefix}/`)) {
      return { language, path: path.slice(prefix.length), explicit: true };
    }
  }
  return { language: DEFAULT_LANGUAGE, path, explicit: false };
}

/**
 * The address of `path` in `language`.
 *
 * Idempotent on purpose: an already-prefixed path is re-prefixed, not
 * double-prefixed. Paths reach this from several directions — the route table,
 * a breadcrumb, a link a component built by hand — and `/ru/ru/toshkent` is
 * the kind of bug that only shows up in one language.
 */
export function localisedPath(path: string, language: Language): string {
  const { path: bare } = stripLanguagePrefix(path);
  const prefix = LANGUAGE_PREFIX[language];
  if (!prefix) return bare;
  return bare === '/' ? prefix : `${prefix}${bare}`;
}

/** Every language's address for one route, for hreflang and the sitemap. */
export function alternatePaths(path: string): Record<Language, string> {
  return {
    uz: localisedPath(path, 'uz'),
    ru: localisedPath(path, 'ru'),
    en: localisedPath(path, 'en'),
  };
}
