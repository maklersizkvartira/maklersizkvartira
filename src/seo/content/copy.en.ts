/**
 * English SEO copy — the same structure as the Uzbek pack, different prose.
 *
 * The English pages are read mostly by people who did not grow up here:
 * relocating professionals, exchange students, embassy and NGO staff. They
 * search in phrases like "apartment for rent Tashkent" and "rent a flat in
 * Uzbekistan", so the templates below say that once, plainly, and then spend
 * the rest of their words being useful. Repeating the same phrase in every
 * sentence is what keyword stuffing looks like, and it has been a ranking
 * liability for well over a decade.
 *
 * Nothing here claims a number the platform cannot prove. There is no listing
 * count anywhere, because the count comes from the API at runtime and a
 * hard-coded figure would be a lie the moment it was written.
 *
 * Place names keep their Latin-script Uzbek spelling — that is what a newcomer
 * reads on a street sign and on a map — with the single exception of Tashkent,
 * which nobody searching in English types any other way.
 */

import { EN_ARTICLES, EN_HELP } from './articles.en';
import { EN_DISTRICT_PROFILES, EN_REGION_PROFILES } from './places.en';
import type { CategoryWords, CopyPack, FaqEntry, PlaceProfile, PlaceWords } from './types';

const SUFFIX = ' | Uyiz.uz';

/** `Samarqand sh.` is how it is stored; `Samarqand` is how it reads here. */
export function displayPlaceName(name: string): string {
  if (name === 'Toshkent shahri') return 'Tashkent';
  if (name === 'Toshkent viloyati') return 'Tashkent Region';
  // The one region with an established English name of its own. Left as the
  // Uzbek string it was unreadable to the audience these pages are for, and
  // long enough on its own to push a title past what a result shows.
  if (name === 'Qoraqalpogʻiston Respublikasi') return 'Karakalpakstan';
  return name
    .replace(/\s+sh\.$/i, '')
    .replace(/\s+t\.$/i, ' District')
    .replace(/\s+viloyati$/i, ' Region');
}

/**
 * The part of a place name a headline should use.
 *
 * "Region" is dropped here but kept in `displayPlaceName`: a heading reads
 * better as "flats to rent in Samarqand" than "in Samarqand Region", and it is
 * also what somebody searching in English types. Tashkent Region keeps the
 * word, because without it the region and the city are the same string.
 */
function shortName(name: string): string {
  if (name === 'Toshkent viloyati') return 'Tashkent Region';
  return displayPlaceName(name)
    .replace(/\s+District$/i, '')
    .replace(/\s+Region$/i, '');
}

/**
 * English marks the locative with a preposition rather than a suffix, so this
 * is the whole of the inflection: `Chilonzor` -> `in Chilonzor`.
 */
function locative(short: string): string {
  return `in ${short}`;
}

function placeWords(name: string): PlaceWords {
  const short = shortName(name);
  return { name: displayPlaceName(name), short, inPlace: locative(short) };
}

/** Sentence case for a phrase that is stored lower-case for use mid-sentence. */
function capitalize(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

const CATEGORIES: Record<string, CategoryWords> = {
  apartment: {
    noun: 'apartment',
    plural: 'apartments',
    label: 'Apartment rentals',
    headline: 'apartments for rent',
    blurb:
      'Self-contained apartments in multi-storey buildings — for a family, a couple or someone '
      + 'living alone.',
  },
  house: {
    noun: 'house',
    plural: 'houses',
    label: 'House rentals',
    headline: 'houses for rent',
    blurb: 'Houses with their own courtyard — more space and a private entrance.',
  },
  room: {
    noun: 'room',
    plural: 'rooms',
    label: 'Room rentals',
    headline: 'rooms for rent',
    blurb: 'A private room in a shared apartment — the cheapest option and the quickest to find.',
  },
  studio: {
    noun: 'studio',
    plural: 'studios',
    label: 'Studio rentals',
    headline: 'studios for rent',
    blurb: 'Sleeping area and kitchen in one room — for people living alone and young couples.',
  },
  roommate: {
    noun: 'shared rental',
    plural: 'shared rentals',
    label: 'Shared rentals',
    headline: 'shared rentals',
    blurb:
      'For people looking for someone to split the rent with. You can filter by gender.',
  },
  student: {
    noun: 'student rental',
    plural: 'student rentals',
    label: 'Student rentals',
    headline: 'student rentals',
    blurb:
      'Places near the universities, priced as a real alternative to halls — whole flats and '
      + 'shares alike.',
  },
  family: {
    noun: 'family apartment',
    plural: 'family apartments',
    label: 'Family rentals',
    headline: 'family rentals',
    blurb: 'Two rooms or more, let on long terms.',
  },
  budget: {
    noun: 'budget rental',
    plural: 'budget options',
    label: 'Budget rentals',
    headline: 'budget rentals',
    blurb: 'Listings up to 3 million so‘m a month, sorted by price.',
  },
};

/**
 * The sentence every landing page's opening paragraph closes on.
 *
 * It says how the marketplace works — the number is in the advert, the two
 * sides talk to each other — and deliberately says nothing about who is on
 * the other side. Owners and agencies both post here.
 */
const MARKETPLACE_LINE =
  'The phone number is on the listing itself, so you deal with whoever posted it '
  + 'directly.';

function placeIntro(
  place: PlaceWords,
  category: CategoryWords | null,
  profile: PlaceProfile | null,
  metroStations: string[],
): string[] {
  const what = category ? category.plural : 'apartments and houses';
  const paragraphs: string[] = [
    `${capitalize(what)} to rent ${place.inPlace}, in one list. ${MARKETPLACE_LINE}`,
  ];

  if (profile?.about) paragraphs.push(profile.about);

  if (metroStations.length > 0) {
    const list = metroStations.slice(0, 5).join(', ');
    paragraphs.push(
      `If you travel by metro: ${place.short} is served by the ${list} stations. `
        + 'Where a listing states how many minutes it is on foot to the station, you can filter '
        + 'on that as well.',
    );
  }

  paragraphs.push(
    'Every listing carries a trust rating. It drops when someone reports the listing and a '
      + 'moderator upholds the report, and reporting one takes a single tap.',
  );

  return paragraphs;
}

/** `an apartment`, `a house` — the indefinite article the noun needs. */
function indefinite(noun: string): string {
  return /^[aeiou]/i.test(noun) ? 'an' : 'a';
}

function placeFaq(place: PlaceWords, category: CategoryWords | null): FaqEntry[] {
  const what = category ? category.noun : 'place';
  return [
    {
      q: `How do I find ${indefinite(what)} ${what} ${place.inPlace}?`,
      a:
        'Narrow the list above by price, number of rooms and area, open the one you like and '
        + 'reveal the phone number. The call goes straight to whoever posted the listing.',
    },
    {
      q: `What does renting ${place.inPlace} cost?`,
      a:
        'The rent varies sharply with the number of rooms, the condition of the property and '
        + 'exactly where it is, which is why we do not publish an average figure. Sort the list '
        + 'above by price instead — that shows you what people are actually asking today.',
    },
    {
      q: 'Is there a commission or a service fee?',
      a:
        'No. The platform is free to search, to browse and to post on. Whatever you agree is '
        + 'settled directly between you and whoever posted the listing.',
    },
    {
      q: 'How can I tell a listing is genuine?',
      a:
        'Each listing shows the poster’s trust rating and how far they have been verified. '
        + 'Listings where the passport and the ownership document have been checked carry a '
        + 'badge. Never transfer money before you have seen the property.',
    },
  ];
}

export const EN_COPY: CopyPack = {
  htmlLang: 'en',
  ogLocale: 'en_US',

  brand: {
    name: 'Uyiz',
    tagline: 'Rental listings across Uzbekistan',
    about:
      'Uyiz is a listings platform for renting apartments, houses and rooms in Uzbekistan. '
      + 'Listings filter by region, price and number of rooms.',
  },

  common: {
    breadcrumbHome: 'Home',
    allListings: 'All listings',
    listingsIn: (place) => `Listings — ${place}`,
    resultsCount: (count) => {
      if (count === 0) return 'No listings yet';
      return count === 1 ? '1 listing found' : `${count} listings found`;
    },
    emptyTitle: 'Nothing listed here yet',
    emptyBody:
      'Have a look at the nearby sections, or come back a little later — new listings are added '
      + 'every day.',
    faqHeading: 'Frequently asked questions',
    exploreHeading: 'Keep looking',
    nearbyHeading: 'Nearby districts',
    categoriesHeading: 'Categories',
    regionsHeading: 'By region',
    districtsHeading: 'By district',
    readMore: 'Read the full guide',
    publishedOn: 'Published',
    updatedOn: 'Updated',
    readingTime: (minutes) => `${minutes} min read`,
    blogHeading: 'Guides to renting',
    blogIntro:
      'Practical articles on choosing a place, signing a contract and staying clear of fraud. '
      + 'All of it written for the market in Uzbekistan.',
    helpHeading: 'Help centre',
    helpIntro:
      'How the platform works, the safety rules, the terms of use and the privacy policy.',
    notFoundTitle: 'This page does not exist',
    notFoundBody:
      'The address may have been mistyped, or the listing may have been taken down. Carry on '
      + 'from one of the sections below.',
    notFoundCta: 'Back to all listings',
  },

  categories: CATEGORIES,

  places: {
    regions: EN_REGION_PROFILES,
    districts: EN_DISTRICT_PROFILES,
  },

  placeWords: (name) => placeWords(name),
  country: { name: 'Uzbekistan', short: 'Uzbekistan', inPlace: 'in Uzbekistan' },

  home: {
    title: `Apartments and houses for rent in Uzbekistan${SUFFIX}`,
    description:
      'Uyiz lists apartments, houses and rooms to rent across Uzbekistan. Filter by district, '
      + 'price, number of rooms and metro station.',
    h1: 'Apartments and houses to rent in Uzbekistan',
    intro: [
      'Uyiz is a rental listings platform for Uzbekistan. Owners and agencies both post here, '
        + 'the phone number is on the listing, and the terms are agreed between the two of you.',
      'Apartments, houses with a courtyard, studios, single rooms and flatshares are all in one '
        + 'place. Filter by district, metro station, distance to a university and price to find '
        + 'the one that actually fits.',
      'Every listing carries a trust rating, and it drops when a moderator upholds a report '
        + 'against that listing. Whoever posts can verify their passport and ownership document '
        + 'to earn a badge.',
    ],
    faq: [
      {
        q: 'What is Uyiz?',
        a:
          'Uyiz is a platform that collects adverts for apartments, houses and rooms to rent '
          + 'across Uzbekistan. You open a listing, reveal the phone number, and settle the '
          + 'terms directly with whoever posted it.',
      },
      {
        q: 'Does the site cost anything to use?',
        a:
          'No. Searching, viewing listings, revealing a phone number and posting a listing are '
          + 'all free. Anyone who asks you for money on the platform’s behalf is breaking the '
          + 'rules and should be reported.',
      },
      {
        q: 'Who can post a listing?',
        a:
          'Owners and agencies alike. Each listing shows who posted it and how far they have '
          + 'been verified, so you know who you are calling before you call.',
      },
      {
        q: 'Which cities does it cover?',
        a:
          'The platform is open across every region of Uzbekistan. Tashkent carries the most '
          + 'listings, followed by Samarqand, Buxoro and the cities of the Fargʻona Valley.',
      },
      {
        q: 'I own a property — how do I post a listing?',
        a:
          'Register, confirm your phone number and press "Post a listing". Once you have added '
          + 'at least one photograph, the price and the address, the listing is published '
          + 'straight away. That is free as well.',
      },
    ],
  },

  catalog: {
    title: `All rental listings in Uzbekistan${SUFFIX}`,
    description:
      'Every active rental listing in Uzbekistan: apartments, houses, rooms and studios. '
      + 'Filter by district, price, rooms and metro station.',
    h1: 'All rental listings',
    intro: [
      'Every active listing on the platform is here. Use the filters to set the district, the '
        + 'price range, the number of rooms and the features you need.',
    ],
  },

  landing: {
    // A category page names no place, so the country carries the search intent
    // instead: "Apartments for rent" on its own is too thin to rank.
    categoryTitle: (category) =>
      `${capitalize(category.headline)} in Uzbekistan${SUFFIX}`,
    categoryDescription: (category) =>
      `${category.blurb} Listings across Uzbekistan, filtered by price and area.`,
    categoryH1: (category) => capitalize(category.headline),
    categoryIntro: (category) => [
      `${category.blurb} ${MARKETPLACE_LINE}`,
      'The list below updates in real time. Pick an area or sort by price and you will find the '
        + 'right one faster.',
    ],

    regionTitle: (place) => `Homes to rent ${place.inPlace}${SUFFIX}`,
    regionDescription: (place) =>
      `Apartments, houses and rooms to rent ${place.inPlace}. Filter by price, number of `
      + `rooms, metro station and the features you need.`,
    regionH1: (place) => `Property to rent ${place.inPlace}`,

    placeCategoryTitle: (place, category) =>
      `${capitalize(category.headline)} ${place.inPlace}${SUFFIX}`,
    placeCategoryDescription: (place, category) =>
      `${capitalize(category.plural)} available to rent ${place.inPlace}. Filter by price, `
      + `rooms and metro station, then contact whoever posted the listing.`,
    placeCategoryH1: (place, category) => `${capitalize(category.headline)} ${place.inPlace}`,

    placeIntro,
    placeFaq,
  },

  views: {
    map: {
      title: `Rentals on the map${SUFFIX}`,
      description:
        'See the flats and houses on offer on a map: which street each one is on, and how '
        + 'far it is from there to the nearest metro station.',
    },
    studentProgram: {
      title: `Student housing programme${SUFFIX}`,
      description:
        'Housing near the university at dormitory-comparable prices, plus roommate '
        + 'matching. Separate terms and filters for students.',
    },
    ecosystem: {
      title: `The Uyiz ecosystem — what we are building${SUFFIX}`,
      description:
        'What comes next for the platform: verification, contracts, payments and owner '
        + 'tools. What already works, and what is still on the way.',
    },
  },
  listing: {
    title: ({ title, district, rooms }) => {
      const bits = [
        rooms ? `${rooms}-room` : '',
        district ? displayPlaceName(district) : '',
      ].filter(Boolean);
      const prefix = bits.length ? `${bits.join(', ')} — ` : '';
      return `${prefix}${title}`.slice(0, 65);
    },
    description: ({ title, district, rooms, area, price }) => {
      const bits = [
        rooms ? `${rooms}-room` : null,
        area ? `${area} m²` : null,
        district ? displayPlaceName(district) : null,
        price,
      ].filter(Boolean);
      return `${bits.join(' · ')}. ${title}. Uyiz — rental listings.`.slice(
        0,
        300,
      );
    },
    loadingTitle: `Loading the listing${SUFFIX}`,
    notFoundTitle: `Listing not found${SUFFIX}`,
  },

  articles: EN_ARTICLES,
  help: EN_HELP,
};

export default EN_COPY;
