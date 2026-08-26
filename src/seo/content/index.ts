/**
 * The copy packs, one per language, loaded on demand.
 *
 * These are prose — place profiles, guides, the help centre — and they are
 * large. Statically importing all three put roughly a quarter of a megabyte of
 * Russian and English text in the entry chunk of every Uzbek visitor, which is
 * the same mistake the locale dictionaries used to make (see
 * `i18n/dictionaries.ts`), one layer up.
 *
 * `main.tsx` awaits the visitor's pack before the first render and
 * `I18nProvider` fetches the new one when somebody switches language, so
 * `copyFor` is only ever called with a pack already in hand. The build-time
 * prerenderer needs all three synchronously, in a Node process with no
 * network; it imports them directly and calls `registerCopy`.
 */

import { FALLBACK_COPY } from './fallback';
import type { CopyPack } from './types';
import { DEFAULT_LANGUAGE, type Language } from '../../i18n/types';

const loaders: Record<Language, () => Promise<CopyPack>> = {
  uz: () => import('./copy.uz').then((module) => module.UZ_COPY),
  ru: () => import('./copy.ru').then((module) => module.RU_COPY),
  en: () => import('./copy.en').then((module) => module.EN_COPY),
};

const packs: Partial<Record<Language, CopyPack>> = {};
let inFlight: Partial<Record<Language, Promise<CopyPack>>> = {};

/** Used by the prerenderer, which has every pack in memory already. */
export function registerCopy(language: Language, pack: CopyPack): void {
  packs[language] = pack;
}

export function isCopyLoaded(language: Language): boolean {
  return Boolean(packs[language]);
}

/**
 * The pack for a language.
 *
 * The fallback is a deliberately minimal pack rather than another language's:
 * it only has to survive the handful of milliseconds between a language
 * switch and its chunk arriving, and rendering the wrong language's prose for
 * that moment would be worse than rendering a plain one.
 */
export function copyFor(language: Language): CopyPack {
  const exact = packs[language];
  if (exact) return exact;
  // Any real pack beats the placeholder. A visitor mid-switch sees prose in
  // the wrong language for a frame; the placeholder would show them the raw
  // category key instead, which is what "Chilonzor — apartment" was.
  const loaded = packs[DEFAULT_LANGUAGE] ?? Object.values(packs)[0];
  return loaded ?? FALLBACK_COPY;
}

export function loadCopy(language: Language): Promise<CopyPack> {
  const ready = packs[language];
  if (ready) return Promise.resolve(ready);

  const pending = inFlight[language];
  if (pending) return pending;

  const promise = loaders[language]()
    .then((pack) => {
      packs[language] = pack;
      return pack;
    })
    .catch((error: unknown) => {
      // A failed chunk fetch must not poison later attempts or blank the page.
      inFlight = { ...inFlight, [language]: undefined };
      if (import.meta.env.DEV) console.warn(`[seo] failed to load copy "${language}"`, error);
      return copyFor(DEFAULT_LANGUAGE);
    });

  inFlight[language] = promise;
  return promise;
}

export type { CopyPack } from './types';
