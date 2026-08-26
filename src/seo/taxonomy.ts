/**
 * The SEO surface: which facets get their own page, and what each one filters.
 *
 * Two rules govern what is in here, and both exist to keep the site out of
 * thin-content territory:
 *
 *  1. A facet only earns a page if a real person searches for it. There is no
 *     page for "3 xonali mebelli kvartira Bektemirda" because nobody types it
 *     and the platform has nothing to put on it.
 *  2. Geography expands where the inventory is. Tashkent's twelve districts
 *     each get pages; a district of Surxondaryo does not, because a page that
 *     would show an empty grid is worse than no page at all.
 *
 * Pages that turn out to be empty anyway are handled at runtime, not here:
 * the landing page switches them to `noindex` and the sitemap leaves them out.
 */

import { TASHKENT_METRO_LINES, UZBEKISTAN_REGIONS } from '../data/mockLocations';
import { districtSlug, regionSlug } from './slugs';

export type PropertyTypeCode = 'APARTMENT' | 'HOUSE' | 'ROOM' | 'STUDIO' | 'DORMITORY';

/** The subset of listing filters a URL is allowed to encode. */
export interface FacetFilters {
  propertyType?: PropertyTypeCode;
  rentalType?: 'FULL' | 'ROOMMATE';
  audience?: 'STUDENT' | 'FAMILY';
  maxPrice?: number;
  region?: string;
  district?: string;
}

export interface RentCategory {
  /** URL segment. Never collides with a region or district slug. */
  slug: string;
  /** Key into the SEO copy dictionaries. */
  key: string;
  filters: FacetFilters;
  /** Whether `/<region>/<category>` pages exist for this category. */
  regionPages: boolean;
  /** Whether `/<region>/<district>/<category>` pages exist. */
  districtPages: boolean;
}

export const CATEGORIES: readonly RentCategory[] = [
  {
    slug: 'kvartira-ijaraga',
    key: 'apartment',
    filters: { propertyType: 'APARTMENT' },
    regionPages: true,
    districtPages: true,
  },
  {
    slug: 'uy-ijaraga',
    key: 'house',
    filters: { propertyType: 'HOUSE' },
    regionPages: true,
    districtPages: true,
  },
  {
    slug: 'xona-ijaraga',
    key: 'room',
    filters: { propertyType: 'ROOM' },
    regionPages: false,
    districtPages: false,
  },
  {
    slug: 'studiya-ijaraga',
    key: 'studio',
    filters: { propertyType: 'STUDIO' },
    regionPages: false,
    districtPages: false,
  },
  {
    slug: 'sheriklikka-ijara',
    key: 'roommate',
    filters: { rentalType: 'ROOMMATE' },
    regionPages: false,
    districtPages: false,
  },
  {
    slug: 'talabalar-uchun-ijara',
    key: 'student',
    filters: { audience: 'STUDENT' },
    regionPages: false,
    districtPages: false,
  },
  {
    slug: 'oilalar-uchun-ijara',
    key: 'family',
    filters: { audience: 'FAMILY', rentalType: 'FULL' },
    regionPages: false,
    districtPages: false,
  },
  {
    slug: 'arzon-ijara',
    key: 'budget',
    filters: { maxPrice: 3_000_000 },
    regionPages: false,
    districtPages: false,
  },
] as const;

export const CATEGORY_BY_SLUG: ReadonlyMap<string, RentCategory> = new Map(
  CATEGORIES.map((category) => [category.slug, category]),
);

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------
export interface SeoDistrict {
  /** Exactly as stored on a listing, so it can go straight into a filter. */
  name: string;
  slug: string;
  regionName: string;
  regionSlug: string;
  /** Metro stations that serve the district, for the page's own copy. */
  metroStations: string[];
}

export interface SeoRegion {
  name: string;
  slug: string;
  districts: SeoDistrict[];
  /** Whether each district gets its own page. */
  expandsDistricts: boolean;
}

/** Only Tashkent city has the depth of inventory to carry district pages. */
const DISTRICT_PAGE_REGIONS = new Set(['Toshkent shahri']);

/**
 * Which district each metro station sits in.
 *
 * Hand-mapped rather than derived: the network data has no district field,
 * and "there is a metro at the end of your street" is the single most useful
 * thing a district page can say to somebody choosing where to rent.
 */
const METRO_BY_DISTRICT: Record<string, readonly string[]> = {
  Chilonzor: ['Chilonzor', 'Mirzo Ulugbek', 'Novza', 'Milliy Bog', 'Xalqlar Dostligi'],
  Yunusobod: ['Yunusobod', 'Bodomzor', 'Minor', 'Shahriston', 'Turkiston', 'Abdulla Qodiriy'],
  Mirobod: ['Oybek', 'Toshkent (Vokzal)', 'Kosmonavtlar', 'Ming Orik', 'Amir Temur Xiyoboni'],
  'Mirzo Ulugʻbek': ['Buyuk Ipak Yoli', 'Pushkin', 'Hamid Olimjon', 'Yunus Rajabiy'],
  Olmazor: ['Olmazor', 'Choshtepa', 'Chorsu'],
  Yakkasaroy: ['Paxtakor', 'Mustaqillik Maydoni', 'Milliy Bog'],
  Sergeli: ['Sergeli', 'Qipchoq', 'Otkir', 'Qiyot (9-bekat)'],
  Shayxontohur: ['Chorsu', 'Gafur Gulom', 'Alisher Navoiy', 'Tinchlik', 'Beruniy'],
  Yashnobod: ['Mashinasozlar', 'Dostlik (Chkalov)', 'Yashnobod (2-bekat)', 'Tuzel (3-bekat)'],
  Uchtepa: ['Beruniy', 'Tinchlik', 'Chorsu'],
  Bektemir: ['Qoyliq (7-bekat)', 'Matonat (8-bekat)'],
  Yangihayot: ['Rohat (5-bekat)', 'Yangiobod (6-bekat)', 'Olmos (4-bekat)'],
};

export const REGIONS: readonly SeoRegion[] = UZBEKISTAN_REGIONS.map((region) => {
  const slug = regionSlug(region.name);
  const expandsDistricts = DISTRICT_PAGE_REGIONS.has(region.name);
  return {
    name: region.name,
    slug,
    expandsDistricts,
    districts: region.districts.map((district) => ({
      name: district,
      slug: districtSlug(district),
      regionName: region.name,
      regionSlug: slug,
      metroStations: [...(METRO_BY_DISTRICT[district] ?? [])],
    })),
  };
});

export const REGION_BY_SLUG: ReadonlyMap<string, SeoRegion> = new Map(
  REGIONS.map((region) => [region.slug, region]),
);

/** Districts that have a page of their own, keyed by `<region>/<district>`. */
export const DISTRICT_BY_PATH: ReadonlyMap<string, SeoDistrict> = new Map(
  REGIONS.filter((region) => region.expandsDistricts).flatMap((region) =>
    region.districts.map(
      (district) => [`${region.slug}/${district.slug}`, district] as const,
    ),
  ),
);

const TASHKENT_REGION = REGIONS.find((region) => region.slug === 'toshkent');
if (!TASHKENT_REGION) {
  throw new Error('taxonomy: Toshkent shahri is missing from UZBEKISTAN_REGIONS');
}
export const TASHKENT: SeoRegion = TASHKENT_REGION;

export const ALL_METRO_STATIONS: readonly string[] = Array.from(
  new Set(TASHKENT_METRO_LINES.flatMap((line) => line.stations)),
).sort();

/**
 * Guards the one collision that would silently break routing: a district
 * whose slug is also a category slug makes `/toshkent/<x>` ambiguous.
 * The SEO audit script fails the build on a non-empty result.
 */
export function findSlugCollisions(): string[] {
  const categorySlugs = new Set(CATEGORIES.map((category) => category.slug));
  const collisions: string[] = [];
  const regionSlugs = new Set<string>();

  for (const region of REGIONS) {
    if (categorySlugs.has(region.slug)) {
      collisions.push(`region "${region.name}" collides with a category slug`);
    }
    if (regionSlugs.has(region.slug)) {
      collisions.push(`region slug "${region.slug}" is duplicated`);
    }
    regionSlugs.add(region.slug);

    const seen = new Set<string>();
    for (const district of region.districts) {
      if (categorySlugs.has(district.slug)) {
        collisions.push(`district "${district.name}" collides with a category slug`);
      }
      if (seen.has(district.slug)) {
        collisions.push(`district slug "${district.slug}" is duplicated in ${region.name}`);
      }
      seen.add(district.slug);
    }
  }
  return collisions;
}
