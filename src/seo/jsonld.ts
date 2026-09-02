/**
 * JSON-LD builders.
 *
 * Everything here describes something the page genuinely contains. There is
 * deliberately no `AggregateRating` and no `Review`: the platform collects
 * neither, and marking up a rating that does not exist is the fastest way to
 * lose rich results permanently and take a manual action with them.
 *
 * `@id`s are absolute and stable so the graph on one page can reference the
 * organisation defined on another instead of redefining it.
 */

import {
  CONTACT,
  COUNTRY,
  LOGO_PATH,
  OG_IMAGE_PATH,
  ORGANISATION_NAME,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from './config';
import type { FaqEntry } from './content/types';
import type { Listing } from '../types';

export type JsonLd = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

/**
 * Listing photos are stored as `data:` URIs, which no crawler can fetch.
 * Anything that is not an http(s) URL is dropped and the brand image stands in,
 * so a share card is never broken and `og:image` is never a 200KB string.
 */
export function crawlableImages(images: readonly string[] | undefined): string[] {
  return (images ?? []).filter((src) => /^https?:\/\//i.test(src));
}

export function shareImage(images?: readonly string[]): string {
  return crawlableImages(images)[0] ?? absoluteUrl(OG_IMAGE_PATH);
}

export function organisation(
  description: string,
  countryName: string = COUNTRY.name,
): JsonLd {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: ORGANISATION_NAME,
    // The domain form is what people actually type when they search for the
    // brand, and it is what every page title ends with. Declaring it as an
    // alternate name is how the entity and the query get connected; it is the
    // only alternate worth declaring, because the platform has one name.
    alternateName: 'Uyiz.uz',
    url: `${SITE_URL}/`,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(LOGO_PATH),
    },
    description,
    email: CONTACT.email,
    telephone: CONTACT.phones[0],
    // Localised: the Russian and English pages used to declare the Uzbek
    // spelling of the country, which is the one string on those pages that
    // was not in the page's own language.
    areaServed: { '@type': 'Country', name: countryName },
    sameAs: [CONTACT.telegram, CONTACT.instagram],
    contactPoint: CONTACT.phones.map((phone) => ({
      '@type': 'ContactPoint',
      telephone: phone,
      contactType: 'customer support',
      areaServed: COUNTRY.code,
      availableLanguage: ['uz', 'ru', 'en'],
    })),
  };
}

/**
 * The site itself.
 *
 * No `potentialAction`/`SearchAction`: it would have advertised a `?q=` search
 * endpoint the router strips on the way in, and Google retired the sitelinks
 * searchbox it fed. Describing a search that does not answer is worse than
 * describing none.
 *
 * No `inLanguage` either, and that is the whole reason this node can ship on
 * every page. `SITE_ID` is one identifier for one site; carrying a language on
 * it meant the uz, ru and en pages each asserted a different language for the
 * *same* `@id`, which is a contradiction rather than a translation. The
 * per-page language is already stated where it belongs — `<html lang>`, the
 * hreflang set, and `inLanguage` on the listing and article nodes.
 */
export function website(description: string): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    description,
    publisher: { '@id': ORG_ID },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbs(items: Crumb[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqPage(entries: FaqEntry[]): JsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  };
}

/** Maps the platform's property types onto the closest schema.org place. */
function residenceType(propertyType: string | undefined): string {
  switch (propertyType) {
    case 'HOUSE':
      return 'SingleFamilyResidence';
    case 'ROOM':
      return 'Room';
    case 'STUDIO':
    case 'DORMITORY':
    case 'APARTMENT':
    default:
      return 'Apartment';
  }
}

export interface ListingSchemaInput {
  listing: Listing;
  url: string;
  language: string;
  /** Localised name for the listing, usually its title. */
  name: string;
  description: string;
}

/**
 * A rental advert, described as the offer that it is.
 *
 * `businessFunction` is `LeaseOut` rather than `Sell`, because this platform
 * has no sale side at all — describing a monthly rent as a sale price would be
 * wrong in the data and misleading in a search result.
 */
export function realEstateListing({
  listing,
  url,
  language,
  name,
  description,
}: ListingSchemaInput): JsonLd {
  const images = crawlableImages(listing.images);
  const hasGeo =
    typeof listing.latitude === 'number' && typeof listing.longitude === 'number';

  const streetAddress = (listing.address ?? '').trim();

  // Identified, so `offers.itemOffered` can point at it. Without an `@id` the
  // Offer describes a price attached to nothing in particular, and the
  // accommodation and the thing being let read as two unrelated entities.
  const accommodation: JsonLd = {
    '@type': residenceType(listing.propertyType),
    '@id': `${url}#accommodation`,
    name,
    ...(listing.rooms ? { numberOfRooms: listing.rooms } : {}),
    ...(listing.area
      ? { floorSize: { '@type': 'QuantitativeValue', value: listing.area, unitCode: 'MTK' } }
      : {}),
    address: {
      '@type': 'PostalAddress',
      addressCountry: COUNTRY.code,
      ...(listing.region ? { addressRegion: listing.region } : {}),
      ...(listing.district ? { addressLocality: listing.district } : {}),
      ...(streetAddress ? { streetAddress } : {}),
    },
    ...(hasGeo
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: listing.latitude,
            longitude: listing.longitude,
          },
        }
      : {}),
    ...(images.length ? { photo: images } : {}),
  };

  return {
    '@type': 'RealEstateListing',
    '@id': `${url}#listing`,
    url,
    name,
    description,
    inLanguage: language,
    ...(listing.createdAt ? { datePosted: listing.createdAt } : {}),
    ...(images.length ? { image: images } : {}),
    isPartOf: { '@id': SITE_ID },
    provider: { '@id': ORG_ID },
    mainEntity: accommodation,
    offers: {
      '@type': 'Offer',
      url,
      itemOffered: { '@id': `${url}#accommodation` },
      price: listing.price,
      priceCurrency: listing.currency || 'UZS',
      businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
      availability: 'https://schema.org/InStock',
      // Unconditional. This is a monthly rent whatever it is denominated in,
      // and the currency was never the thing that made it periodic: gating on
      // UZS published every dollar-priced flat as a flat $400 — a price to buy
      // a property, not to rent one for a month.
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: listing.price,
        priceCurrency: listing.currency || 'UZS',
        unitCode: 'MON',
      },
    },
  };
}

export interface ItemListEntry {
  name: string;
  url: string;
}

export function itemList(name: string, entries: ItemListEntry[]): JsonLd {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      url: entry.url,
    })),
  };
}

export interface ArticleSchemaInput {
  headline: string;
  description: string;
  url: string;
  language: string;
  publishedAt: string;
  updatedAt: string;
}

export function blogPosting(input: ArticleSchemaInput): JsonLd {
  return {
    '@type': 'BlogPosting',
    '@id': `${input.url}#article`,
    headline: input.headline.slice(0, 110),
    description: input.description,
    url: input.url,
    inLanguage: input.language,
    datePublished: input.publishedAt,
    dateModified: input.updatedAt,
    image: absoluteUrl(OG_IMAGE_PATH),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
    isPartOf: { '@id': SITE_ID },
  };
}

export function collectionPage(input: {
  name: string;
  description: string;
  url: string;
  language: string;
}): JsonLd {
  return {
    '@type': 'CollectionPage',
    '@id': `${input.url}#page`,
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: input.language,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
  };
}

/** Wraps the page's nodes into one `@graph`, which is one script tag instead of six. */
export function graph(nodes: JsonLd[]): string {
  return JSON.stringify(
    { '@context': 'https://schema.org', '@graph': nodes },
    // Drop undefined values rather than emitting `null`, which some validators
    // treat as an explicit "this property has no value".
    (_key, value) => (value === undefined || value === null ? undefined : value),
  );
}
