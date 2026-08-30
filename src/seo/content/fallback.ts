/**
 * The pack used while a real one is in flight.
 *
 * It exists so that `copyFor` has a total answer and no caller needs a null
 * check. In practice it renders for at most a few frames — `main.tsx` awaits
 * the visitor's pack before the first render, and a language switch only
 * reaches here if the chunk is slow.
 *
 * Everything in it is deliberately generic. Guessing at a heading with the
 * wrong place name in it would be worse than a plain one, and it must stay
 * small: this is the one piece of copy that does live in the entry chunk.
 */

import type { CopyPack } from './types';

const brandName = 'Uyiz';
const tagline = 'O‘zbekistondagi uy-joy ijarasi platformasi';
const about =
  'O‘zbekistonda uy, kvartira va xona ijaraga berish va olish platformasi. '
  + 'E’lonlar hudud va narx bo‘yicha filtrlanadi.';

/** Byte-identical to `BRAND_SUFFIX` in ../meta.ts and to the real packs. */
const SUFFIX = ' | Uyiz.uz';

export const FALLBACK_COPY: CopyPack = {
  htmlLang: 'uz',
  ogLocale: 'uz_UZ',

  brand: { name: brandName, tagline, about },

  common: {
    breadcrumbHome: 'Bosh sahifa',
    allListings: 'Barcha e’lonlar',
    listingsIn: (place) => place,
    resultsCount: (count) => String(count),
    emptyTitle: '',
    emptyBody: '',
    faqHeading: '',
    exploreHeading: '',
    nearbyHeading: '',
    categoriesHeading: '',
    regionsHeading: '',
    districtsHeading: '',
    readMore: '',
    publishedOn: '',
    updatedOn: '',
    readingTime: (minutes) => String(minutes),
    blogHeading: '',
    blogIntro: '',
    helpHeading: '',
    helpIntro: '',
    notFoundTitle: '404',
    notFoundBody: '',
    notFoundCta: '',
  },

  categories: {},
  places: { regions: {}, districts: {} },

  placeWords: (name) => ({ name, short: name, inPlace: name }),

  home: {
    title: `${brandName} — ${tagline}`,
    description: about,
    h1: brandName,
    intro: [],
    faq: [],
  },

  catalog: {
    title: `${brandName} — ${tagline}`,
    description: about,
    h1: brandName,
    intro: [],
  },

  landing: {
    categoryTitle: (category) => `${category.label}${SUFFIX}`,
    categoryDescription: () => about,
    categoryH1: (category) => category.label,
    categoryIntro: () => [],
    regionTitle: (place) => `${place.name}${SUFFIX}`,
    regionDescription: () => about,
    regionH1: (place) => place.name,
    placeCategoryTitle: (place, category) => `${place.name} — ${category.label}${SUFFIX}`,
    placeCategoryDescription: () => about,
    placeCategoryH1: (place, category) => `${place.name} — ${category.label}`,
    placeIntro: () => [],
    placeFaq: () => [],
  },

  listing: {
    title: ({ title }) => title,
    description: ({ title }) => title,
    loadingTitle: `${brandName} — ijara e’lonlari${SUFFIX}`,
    notFoundTitle: `404${SUFFIX}`,
  },

  articles: [],
  help: [],
};

export default FALLBACK_COPY;
