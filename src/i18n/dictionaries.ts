/**
 * Which dictionary is in memory, and how to get the others.
 *
 * All three locales used to be statically imported, so every visitor
 * downloaded and parsed the Russian and English dictionaries in the entry
 * chunk before the first pixel — including the overwhelming majority who read
 * the site in Uzbek and would never see either.
 *
 * Uzbek stays static: it is the default, the fallback for a missing key, and
 * the type source for `TranslationKey`, so it has to be there synchronously.
 * The other two are fetched on demand — before the first render for a visitor
 * whose language is already known (see `main.tsx`), and in the background when
 * somebody switches. Until one arrives, `dictionaryFor` answers with Uzbek,
 * which is the same fallback `translate` already used for a missing key.
 */

import { uz, type Dictionary } from './locales/uz';
import { DEFAULT_LANGUAGE, type Language } from './types';

const loaders: Record<Language, () => Promise<Dictionary>> = {
  uz: async () => uz,
  ru: () => import('./locales/ru').then((module) => module.ru),
  en: () => import('./locales/en').then((module) => module.en),
};

const loaded: Partial<Record<Language, Dictionary>> = { uz };

export function isDictionaryLoaded(language: Language): boolean {
  return Boolean(loaded[language]);
}

/**
 * Used by the build-time prerenderer, which has every dictionary in memory and
 * no way to await a dynamic import inside a synchronous render.
 *
 * Without it the renderer registered the SEO copy packs but not these, so the
 * headings on a Russian page were Russian while every label that goes through
 * `t()` — the navigation, the footer, the buttons — fell back to Uzbek. Two
 * hundred static pages shipped in two languages at once.
 */
export function registerDictionary(language: Language, dictionary: Dictionary): void {
  loaded[language] = dictionary;
}

export function dictionaryFor(language: Language): Dictionary {
  return loaded[language] ?? loaded[DEFAULT_LANGUAGE] ?? uz;
}

let inFlight: Partial<Record<Language, Promise<Dictionary>>> = {};

export function loadDictionary(language: Language): Promise<Dictionary> {
  const ready = loaded[language];
  if (ready) return Promise.resolve(ready);

  const pending = inFlight[language];
  if (pending) return pending;

  const promise = loaders[language]()
    .then((dictionary) => {
      loaded[language] = dictionary;
      return dictionary;
    })
    .catch((error: unknown) => {
      // A failed chunk fetch must not poison later attempts, and must not
      // leave the UI blank: Uzbek is a usable answer, and the next switch
      // retries.
      inFlight = { ...inFlight, [language]: undefined };
      if (import.meta.env.DEV) console.warn(`[i18n] failed to load "${language}"`, error);
      return uz;
    });

  inFlight[language] = promise;
  return promise;
}
