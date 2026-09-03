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
import type { PropertyTypeCode } from '../taxonomy';

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
    placeBlurb:
      'An apartment is the commonest thing to rent in this part of the city, and three things '
      + 'move its price more than anything else: the number of rooms, the state of the '
      + 'decoration and how long it takes to reach the centre. Check the lift, the heating and '
      + 'the parking in person before you sign, even where the listing names them.',
    findTip: 'Narrow the list by number of rooms, price and floor.',
    priceTip:
      'Three things move an apartment’s rent more than anything else: the number of rooms, the '
      + 'state of the decoration and the distance to the centre.',
  },
  house: {
    noun: 'house',
    plural: 'houses',
    label: 'House rentals',
    headline: 'houses for rent',
    blurb: 'Houses with their own courtyard — more space and a private entrance.',
    placeBlurb:
      'A house means more space, a private entrance and usually somewhere to park. Settle the '
      + 'heating, the water and gas supply and what you may do with the courtyard before you '
      + 'sign — none of these questions comes up when you rent an apartment.',
    findTip:
      'For a house the floor area and the size of the plot matter more than the room count — '
      + 'start the filters there.',
    priceTip:
      'What a house costs follows the size of the plot, the kind of heating and how far out it '
      + 'is.',
  },
  room: {
    noun: 'room',
    plural: 'rooms',
    label: 'Room rentals',
    headline: 'rooms for rent',
    blurb: 'A private room in a shared apartment — the cheapest option and the quickest to find.',
    placeBlurb:
      'A room of your own is the cheapest way into this part of the city. The kitchen and the '
      + 'bathroom are shared, so who else lives there, how many of them there are and what the '
      + 'house rules say matter more than the size of the room itself.',
    findTip:
      'Filtering by number of rooms does nothing when you are after a single room: set the '
      + 'price and the area, and read the rest in the listing text.',
    priceTip:
      'A room costs markedly less than a whole apartment, because the kitchen and bathroom are '
      + 'shared.',
  },
  studio: {
    noun: 'studio',
    plural: 'studios',
    label: 'Studio rentals',
    headline: 'studios for rent',
    blurb: 'Sleeping area and kitchen in one room — for people living alone and young couples.',
    placeBlurb:
      'A studio puts the bed and the kitchen in one room, so what makes it liveable day to day '
      + 'is not the room count but the floor area, the ceiling height and which way the window '
      + 'faces.',
    findTip:
      'A studio has one room by definition, so filter on floor area and district rather than '
      + 'on the room count.',
    priceTip:
      'A studio usually costs less than a one-room apartment, though in the centre the two all '
      + 'but converge.',
  },
  roommate: {
    noun: 'shared rental',
    plural: 'shared rentals',
    label: 'Shared rentals',
    headline: 'shared rentals',
    blurb:
      'For people looking for someone to split the rent with. You can filter by gender.',
    placeBlurb:
      'In a share you are not renting the property but a place in it. The listing states the '
      + 'gender of the flatmates and how many places are free; how the rent and the bills get '
      + 'divided is worth settling in the first conversation.',
    findTip:
      'Shared listings state the flatmates’ gender and how many places are free — start there '
      + 'rather than with the room count.',
    priceTip:
      'In a share the rent and the bills are split between the flatmates, so the figures here '
      + 'sit below the price of a whole apartment.',
  },
  student: {
    noun: 'student rental',
    plural: 'student rentals',
    label: 'Student rentals',
    headline: 'student rentals',
    blurb:
      'Places near the universities, priced as a real alternative to halls — whole flats and '
      + 'shares alike.',
    placeBlurb:
      'For a student the measure that matters is the time it takes to get to a lecture. A '
      + 'place you can walk to, or reach without changing, usually beats a cheaper one further '
      + 'out once the fares and the lost sleep are counted.',
    findTip:
      'This section collects listings that name a university, places in the campus districts '
      + 'and shares — judge them by the distance to your faculty.',
    priceTip:
      'The cheapest option for a student is a share: you pay for a place in the flat rather '
      + 'than for the flat.',
  },
  family: {
    noun: 'family apartment',
    plural: 'family apartments',
    label: 'Family rentals',
    headline: 'family rentals',
    blurb: 'Two rooms or more, let on long terms.',
    placeBlurb:
      'Choosing a family home, the distance to a school, a nursery and a clinic is the second '
      + 'criterion after the price. These are long lets, so put the length of the agreement '
      + 'and the terms for raising the rent in writing at the start.',
    findTip:
      'This section holds places of two rooms and up, let whole — raise the room count in the '
      + 'filter to suit your family.',
    priceTip:
      'On a family let the monthly rent is only part of it: the bills and the school run count '
      + 'too.',
  },
  budget: {
    noun: 'budget rental',
    plural: 'budget options',
    label: 'Budget rentals',
    headline: 'budget rentals',
    blurb: 'Listings up to 3 million so‘m a month, sorted by price.',
    placeBlurb:
      'The cheap ones go quickly: whoever rings on the day it is posted usually gets there '
      + 'first. Beyond the rent itself, ask who pays the utilities — it changes the monthly '
      + 'figure appreciably.',
    findTip:
      'Everything in this section is up to 3 million so‘m a month; narrow the rest by district '
      + 'and room count.',
    priceTip:
      'The ceiling here is 3 million so‘m a month. The cheapest of them are usually further '
      + 'out and in shares.',
  },
};

/**
 * The noun a listing's own head is built from.
 *
 * Four of the five codes have a landing page and take their word from
 * `CATEGORIES`; DORMITORY has neither, so it is named here rather than left to
 * fall through a lookup to the raw enum value.
 */
const TYPE_NOUNS: Record<PropertyTypeCode, string> = {
  APARTMENT: CATEGORIES.apartment.noun,
  HOUSE: CATEGORIES.house.noun,
  ROOM: CATEGORIES.room.noun,
  STUDIO: CATEGORIES.studio.noun,
  DORMITORY: 'dormitory place',
  LAND: 'land plot',
  COMMERCIAL: 'commercial property',
};

/**
 * A room count is meaningless on the three types that have one room by
 * definition: "1-room room" is noise, not information.
 */
const TYPES_WITH_ROOMS: ReadonlySet<PropertyTypeCode> = new Set<PropertyTypeCode>([
  'APARTMENT',
  'HOUSE',
]);

/** Titles beyond this are truncated in a result, so the head has to fit first. */
const LISTING_TITLE_MAX = 65;

/**
 * Appends the landlord's own title to the controlled head, but only as far as
 * the budget goes — the head is the part that has to survive truncation.
 */
function withOwnTitle(head: string, title: string): string {
  if (!head) return title.slice(0, LISTING_TITLE_MAX);
  const room = LISTING_TITLE_MAX - head.length - 3;
  // Under a few words the fragment says nothing and only eats the budget.
  if (room < 14) return head;
  if (title.length <= room) return `${head} — ${title}`;
  const cut = title.slice(0, room - 1);
  const space = cut.lastIndexOf(' ');
  return `${head} — ${cut.slice(0, space > 10 ? space : cut.length).trimEnd()}…`;
}

/**
 * The sentence every landing page's opening paragraph closes on.
 *
 * It says how the marketplace works — the two sides settle the terms between
 * themselves — and deliberately says nothing about who is on the other side.
 * Owners and agencies both post here.
 *
 * It used to open with "the phone number is on the listing itself". The API
 * strips `owner.phone` from every payload a stranger receives, so for the
 * visitor arriving from a search result that was a promise the page does not
 * keep.
 */
const MARKETPLACE_LINE =
  'The terms are settled directly between you and whoever posted the listing.';

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

  // What makes /en/toshkent/chilonzor/uy-ijaraga a different page from
  // /en/toshkent/chilonzor: the profile of the place below is the same on
  // both, so without this the two differ by a couple of words in one sentence.
  if (category) paragraphs.push(category.placeBlurb);

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
  // The first two answers are where a category page earns its keep: the
  // generic "filter by price and rooms" is wrong advice on half of them, and
  // the useful half of a price answer is what moves the price *here*.
  const findTip =
    category?.findTip ?? 'Narrow the list above by price, number of rooms and area.';
  const priceTip =
    category?.priceTip
    ?? 'The rent varies sharply with the number of rooms, the condition of the property and '
      + 'exactly where it is.';
  return [
    {
      q: `How do I find ${indefinite(what)} ${what} ${place.inPlace}?`,
      a:
        `${findTip} Then open the one you like and contact whoever posted it — the platform `
        + 'takes no part in the agreement itself.',
    },
    {
      q: `What does renting ${place.inPlace} cost?`,
      a:
        `${priceTip} Which is why we do not publish an average figure — sort the list above by `
        + 'price instead, and you see what people are actually asking today.',
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
    // The filter list this used to end on is what every rival snippet says,
    // so it gave a searcher no reason to pick this result. What the platform
    // has and they mostly do not is that it costs nothing to use.
    categoryDescription: (category) =>
      `${category.blurb} Listings across Uzbekistan; free to search and to post.`,
    categoryH1: (category) => capitalize(category.headline),
    categoryIntro: (category) => [
      `${category.blurb} ${MARKETPLACE_LINE}`,
      'The list below updates in real time. Pick an area or sort by price and you will find the '
        + 'right one faster.',
    ],

    regionTitle: (place) => `Homes to rent ${place.inPlace}${SUFFIX}`,
    // The metro clause is kept rather than dropped: it is true and worth
    // reading on the Tashkent pages. It is only false on the thirteen regions
    // with no metro at all, which is what `hasMetro` decides.
    regionDescription: (place, hasMetro) =>
      `Apartments, houses and rooms to rent ${place.inPlace}. `
      + (hasMetro ? 'Filter by metro station too. ' : '')
      + 'Free to search and free to post a listing.',
    regionH1: (place) => `Property to rent ${place.inPlace}`,

    placeCategoryTitle: (place, category) =>
      `${capitalize(category.headline)} ${place.inPlace}${SUFFIX}`,
    placeCategoryDescription: (place, category, hasMetro) =>
      `${capitalize(category.plural)} available to rent ${place.inPlace}. `
      + (hasMetro ? 'Filter by metro station too. ' : '')
      + 'Free to search and free to post a listing.',
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
      // This described proximity to a university, which is what
      // /en/talabalar-uchun-ijara already says — two indexable pages agreeing
      // for their first sixty characters. This one describes the programme
      // itself. It promises no student discount and no special terms: nothing
      // in the API grants either, and the "student bonus" chip on the page has
      // no rule behind it yet.
      description:
        'Pick your university and the programme gathers the listings in that campus’s district '
        + 'into one list — whole flats and shares alike. Signing up is free.',
    },
    login: {
      title: `Sign in${SUFFIX}`,
      description: 'Sign in to your Uyiz account with your phone number and password.',
    },
    register: {
      title: `Create an account${SUFFIX}`,
      description:
        'Sign up free in a minute — as an owner, a real-estate agent, or '
        + 'someone looking for a place.',
    },
    forgotPassword: {
      title: `Reset your password${SUFFIX}`,
      description: 'We send an SMS code to your number and you choose a new password.',
    },
    ecosystem: {
      title: `The Uyiz ecosystem — what we are building${SUFFIX}`,
      description:
        'What comes next for the platform: verification, contracts, payments and owner '
        + 'tools. What already works, and what is still on the way.',
    },
  },
  listing: {
    // The landlord's own title is whatever they typed, so the search-legible
    // part is built here instead — from the type, the room count and the
    // place — and their words are appended only as far as the budget goes.
    title: ({ title, district, rooms, propertyType }) => {
      const kind = propertyType ? TYPE_NOUNS[propertyType] : '';
      const countable = !propertyType || TYPES_WITH_ROOMS.has(propertyType);
      const head = [
        rooms && countable ? `${rooms}-room` : '',
        kind,
        kind ? 'to rent' : '',
        district ? locative(shortName(district)) : '',
      ]
        .filter(Boolean)
        .join(' ');
      return withOwnTitle(capitalize(head), title);
    },
    description: ({ title, district, rooms, area, price, propertyType }) => {
      const kind = propertyType ? TYPE_NOUNS[propertyType] : null;
      const countable = !propertyType || TYPES_WITH_ROOMS.has(propertyType);
      const bits = [
        rooms && countable ? `${rooms}-room${kind ? ` ${kind}` : ''}` : kind,
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
