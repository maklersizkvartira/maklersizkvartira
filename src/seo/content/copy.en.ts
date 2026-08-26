/**
 * English SEO copy — the same structure as the Uzbek pack, different prose.
 *
 * The English pages are read mostly by people who did not grow up here:
 * relocating professionals, exchange students, embassy and NGO staff. They
 * search in phrases like "rent apartment Tashkent no agent" and "apartment for
 * rent from owner Uzbekistan", so the templates below say that once, plainly,
 * and then spend the rest of their words being useful. Repeating "no agent" in
 * every sentence is what keyword stuffing looks like, and it has been a ranking
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

const SUFFIX = ' | Maklersizuy.uz';

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
    headline: 'apartments for rent with no agent',
    blurb:
      'Self-contained apartments in multi-storey buildings — for a family, a couple or someone '
      + 'living alone.',
  },
  house: {
    noun: 'house',
    plural: 'houses',
    label: 'House rentals',
    headline: 'houses for rent with no agent',
    blurb: 'Houses with their own courtyard — more space and a private entrance.',
  },
  room: {
    noun: 'room',
    plural: 'rooms',
    label: 'Room rentals',
    headline: 'rooms for rent with no agent',
    blurb: 'A private room in a shared apartment — the cheapest option and the quickest to find.',
  },
  studio: {
    noun: 'studio',
    plural: 'studios',
    label: 'Studio rentals',
    headline: 'studios for rent with no agent',
    blurb: 'Sleeping area and kitchen in one room — for people living alone and young couples.',
  },
  roommate: {
    noun: 'shared rental',
    plural: 'shared rentals',
    label: 'Shared rentals',
    headline: 'shared rentals with no agent',
    blurb:
      'For people looking for someone to split the rent with. You can filter by gender.',
  },
  student: {
    noun: 'student rental',
    plural: 'student rentals',
    label: 'Student rentals',
    headline: 'student rentals with no agent',
    blurb:
      'Places near the universities, priced as a real alternative to halls — whole flats and '
      + 'shares alike.',
  },
  family: {
    noun: 'family apartment',
    plural: 'family apartments',
    label: 'Family rentals',
    headline: 'family rentals with no agent',
    blurb: 'Two rooms or more, let on long terms.',
  },
  budget: {
    noun: 'budget rental',
    plural: 'budget options',
    label: 'Budget rentals',
    headline: 'budget rentals with no agent',
    blurb: 'Listings up to 3 million so‘m a month, sorted by price.',
  },
};

const NO_BROKER_LINE =
  'Every listing here is posted by the owner of the property, and the owner is who you speak '
  + 'to. There is no agent’s fee and no commission.';

function placeIntro(
  place: PlaceWords,
  category: CategoryWords | null,
  profile: PlaceProfile | null,
  metroStations: string[],
): string[] {
  const what = category ? category.plural : 'apartments and houses';
  const paragraphs: string[] = [
    `${capitalize(what)} to rent ${place.inPlace}, straight from the owner. ${NO_BROKER_LINE}`,
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
    'Every listing is checked automatically before it goes live: duplicated photographs, '
      + 'agent-style wording and prices that do not fit the market are flagged. Anything that '
      + 'still looks wrong to you can be reported with a single tap.',
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
      q: `How do I find ${indefinite(what)} ${what} ${place.inPlace} without an agent?`,
      a:
        'Every listing on this page was posted by the owner of the property. Open the one you '
        + 'like, reveal the phone number and call the owner directly. Nobody stands in between '
        + 'and there is no percentage to pay.',
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
        'No. The platform is free for tenants and for owners alike. If anyone asks you for money '
        + '"for the website", that person is an agent — report the listing.',
    },
    {
      q: 'How can I tell a listing is genuine?',
      a:
        'Each listing shows the owner’s trust rating and how far they have been verified. '
        + 'Listings where the passport and the ownership document have been checked carry a '
        + 'badge. Never transfer money before you have seen the property.',
    },
  ];
}

export const EN_COPY: CopyPack = {
  htmlLang: 'en',
  ogLocale: 'en_US',

  brand: {
    name: 'Maklersiz Uy',
    tagline: 'Straight from the owner, 0% commission',
    about:
      'Maklersiz Uy is a platform for renting homes and apartments in Uzbekistan directly from '
      + 'their owners, with no agent in between. Every listing is checked automatically and no '
      + 'commission is charged.',
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
    title: `Apartments and houses for rent, no agent${SUFFIX}`,
    description:
      'Rent straight from the owner, with no agent. Verified listings for apartments, houses and '
      + 'rooms across Uzbekistan. 0% commission.',
    h1: 'Apartments and houses to rent, directly from the owner',
    intro: [
      'Maklersiz Uy connects owners and tenants directly. The owner posts the listing, you see '
        + 'the phone number, and the two of you agree the terms between yourselves — with no '
        + 'middleman and no percentage in between.',
      'Apartments, houses with a courtyard, studios, single rooms and flatshares are all in one '
        + 'place. Filter by district, metro station, distance to a university and price to find '
        + 'the one that actually fits.',
      'Every listing is checked automatically before it is published: duplicated photographs, '
        + 'agent-style wording and prices that do not fit the market are flagged. Owners can '
        + 'verify their passport and ownership document to raise their trust rating.',
    ],
    faq: [
      {
        q: 'What does renting with no agent actually mean?',
        a:
          'The listing is posted by the owner of the property and you deal with them directly. '
          + 'Because there is no middleman, you do not pay a fee that often equals a month’s '
          + 'rent, and your questions about the property get answered by the person who knows.',
      },
      {
        q: 'Does the site cost anything to use?',
        a:
          'No. Searching, viewing listings, revealing a phone number and posting a listing are '
          + 'all free. Anyone who asks you for a service fee is an agent and should be reported.',
      },
      {
        q: 'Can agents post listings here?',
        a:
          'They try. That is why the text and photographs of every listing are analysed '
          + 'automatically and why owners can verify their passport and ownership document. '
          + 'Users flag anything suspicious with one tap and a moderator reviews it.',
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
          + 'the photographs, the price and the address, the listing goes through the check and '
          + 'is published. That is free as well.',
      },
    ],
  },

  catalog: {
    title: `All rental listings — no agent${SUFFIX}`,
    description:
      'Every no-agent rental listing across Uzbekistan. Filter by district, price, number of '
      + 'rooms and metro station.',
    h1: 'All rental listings',
    intro: [
      'Every active listing on the platform is here. Use the filters to set the district, the '
        + 'price range, the number of rooms and the features you need.',
    ],
  },

  landing: {
    categoryTitle: (category) => `${capitalize(category.headline)}${SUFFIX}`,
    categoryDescription: (category) =>
      `${category.blurb} Straight from the owner, with no commission. `
      + `Verified listings across Uzbekistan.`,
    categoryH1: (category) => capitalize(category.headline),
    categoryIntro: (category) => [
      `${category.blurb} ${NO_BROKER_LINE}`,
      'The list below updates in real time. Pick an area or sort by price and you will find the '
        + 'right one faster.',
    ],

    regionTitle: (place) => `Rent with no agent ${place.inPlace}${SUFFIX}`,
    regionDescription: (place) =>
      `Apartments, houses and rooms to rent ${place.inPlace}, straight from their owners. `
      + `No agent, 0% commission.`,
    regionH1: (place) => `Property to rent ${place.inPlace}, with no agent`,

    placeCategoryTitle: (place, category) =>
      `${capitalize(category.headline)} ${place.inPlace}${SUFFIX}`,
    placeCategoryDescription: (place, category) =>
      `${capitalize(category.plural)} available to rent ${place.inPlace}. `
      + `Straight from the owner — no agent and no commission.`,
    placeCategoryH1: (place, category) => `${capitalize(category.headline)} ${place.inPlace}`,

    placeIntro,
    placeFaq,
  },

  views: {
    map: {
      title: `Rentals without agents on the map${SUFFIX}`,
      description:
        'See the flats and houses on offer on a map: which street, how far to the metro. '
        + 'All of them straight from the owner, with no commission.',
    },
    studentProgram: {
      title: `Student housing programme${SUFFIX}`,
      description:
        'Housing near the university at dormitory-comparable prices, plus roommate '
        + 'matching. Separate terms for students, no agents involved.',
    },
    ecosystem: {
      title: `The Maklersiz Uy ecosystem — what we are building${SUFFIX}`,
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
      return `${bits.join(' · ')}. ${title}. Rented directly from the owner, with no agent.`.slice(
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
