/**
 * The internal link graph.
 *
 * Programmatic pages only work if they are reachable. A hundred district
 * pages that only the sitemap knows about are a hundred orphans: crawled
 * slowly if at all, and given no context by the pages around them.
 *
 * Every landing page therefore links sideways to its siblings, up to its
 * parent and down to its children, which is also the navigation a person
 * actually wants — having read about Chilonzor, the next question is either
 * "what about houses there" or "what about Yunusobod".
 */

import { copyFor } from './content';
import {
  categoryPath,
  districtCategoryPath,
  districtPath,
  regionCategoryPath,
  regionPath,
  type RouteMatch,
} from './routes';
import { CATEGORIES, REGIONS, TASHKENT, type SeoRegion } from './taxonomy';
import type { Language } from '../i18n/types';

export interface SeoLink {
  label: string;
  path: string;
}

export interface LinkGroup {
  heading: string;
  links: SeoLink[];
}

/** Regions worth surfacing above the fold. The rest live on the home hub. */
const PROMINENT_REGIONS = [
  'toshkent',
  'samarqand',
  'buxoro',
  'fargona',
  'andijon',
  'namangan',
  'toshkent-viloyati',
  'xorazm',
];

function byProminence(regions: readonly SeoRegion[]): SeoRegion[] {
  const rank = new Map(PROMINENT_REGIONS.map((slug, index) => [slug, index]));
  return [...regions].sort(
    (a, b) => (rank.get(a.slug) ?? 99) - (rank.get(b.slug) ?? 99),
  );
}

export function relatedLinks(route: RouteMatch, language: Language): LinkGroup[] {
  const copy = copyFor(language);
  const groups: LinkGroup[] = [];

  const categoryLabel = (key: string) => copy.categories[key]?.label ?? key;
  const shortPlace = (name: string) => copy.placeWords(name, 'region').short;

  const allCategories = (build: (slug: string) => string, skipKey?: string): SeoLink[] =>
    CATEGORIES.filter((category) => category.key !== skipKey).map((category) => ({
      label: categoryLabel(category.key),
      path: build(category.slug),
    }));

  switch (route.kind) {
    case 'CATEGORY': {
      const category = route.category!;
      if (category.regionPages) {
        groups.push({
          heading: copy.common.regionsHeading,
          links: byProminence(REGIONS).map((region) => ({
            label: shortPlace(region.name),
            path: regionCategoryPath(region, category),
          })),
        });
        groups.push({
          heading: copy.common.districtsHeading,
          links: TASHKENT.districts
            .filter(() => category.districtPages)
            .map((district) => ({
              label: shortPlace(district.name),
              path: districtCategoryPath(district, category),
            })),
        });
      }
      groups.push({
        heading: copy.common.categoriesHeading,
        links: allCategories((slug) => `/${slug}`, category.key),
      });
      break;
    }

    case 'REGION': {
      const region = route.region!;
      groups.push({
        heading: copy.common.categoriesHeading,
        links: CATEGORIES.filter((category) => category.regionPages).map((category) => ({
          label: categoryLabel(category.key),
          path: regionCategoryPath(region, category),
        })),
      });
      if (region.expandsDistricts) {
        groups.push({
          heading: copy.common.districtsHeading,
          links: region.districts.map((district) => ({
            label: shortPlace(district.name),
            path: districtPath(district),
          })),
        });
      }
      groups.push({
        heading: copy.common.regionsHeading,
        links: byProminence(REGIONS)
          .filter((item) => item.slug !== region.slug)
          .map((item) => ({ label: shortPlace(item.name), path: regionPath(item) })),
      });
      break;
    }

    case 'REGION_CATEGORY': {
      const region = route.region!;
      const category = route.category!;
      if (region.expandsDistricts && category.districtPages) {
        groups.push({
          heading: copy.common.districtsHeading,
          links: region.districts.map((district) => ({
            label: shortPlace(district.name),
            path: districtCategoryPath(district, category),
          })),
        });
      }
      groups.push({
        heading: copy.common.categoriesHeading,
        links: CATEGORIES.filter(
          (item) => item.regionPages && item.key !== category.key,
        ).map((item) => ({
          label: categoryLabel(item.key),
          path: regionCategoryPath(region, item),
        })),
      });
      groups.push({
        heading: copy.common.regionsHeading,
        links: byProminence(REGIONS)
          .filter((item) => item.slug !== region.slug)
          .map((item) => ({
            label: shortPlace(item.name),
            path: regionCategoryPath(item, category),
          })),
      });
      break;
    }

    case 'DISTRICT': {
      const region = route.region!;
      const district = route.district!;
      groups.push({
        heading: copy.common.categoriesHeading,
        links: CATEGORIES.filter((category) => category.districtPages).map((category) => ({
          label: categoryLabel(category.key),
          path: districtCategoryPath(district, category),
        })),
      });
      groups.push({
        heading: copy.common.nearbyHeading,
        links: region.districts
          .filter((item) => item.slug !== district.slug)
          .map((item) => ({ label: shortPlace(item.name), path: districtPath(item) })),
      });
      break;
    }

    case 'DISTRICT_CATEGORY': {
      const region = route.region!;
      const district = route.district!;
      const category = route.category!;
      groups.push({
        heading: copy.common.nearbyHeading,
        links: region.districts
          .filter((item) => item.slug !== district.slug)
          .map((item) => ({
            label: shortPlace(item.name),
            path: districtCategoryPath(item, category),
          })),
      });
      groups.push({
        heading: copy.common.categoriesHeading,
        links: CATEGORIES.filter(
          (item) => item.districtPages && item.key !== category.key,
        ).map((item) => ({
          label: categoryLabel(item.key),
          path: districtCategoryPath(district, item),
        })),
      });
      break;
    }

    default:
      break;
  }

  return groups.filter((group) => group.links.length > 0);
}

/**
 * The link block the home page and the footer carry.
 *
 * This is what stops the whole geography tree from being three clicks deep:
 * every category and every prominent region is one click from the root, and
 * every district is two.
 */
export function hubLinks(language: Language): LinkGroup[] {
  const copy = copyFor(language);
  return [
    {
      heading: copy.common.categoriesHeading,
      links: CATEGORIES.map((category) => ({
        label: copy.categories[category.key]?.label ?? category.key,
        path: categoryPath(category),
      })),
    },
    {
      heading: copy.common.districtsHeading,
      links: TASHKENT.districts.map((district) => ({
        label: copy.placeWords(district.name, 'district').short,
        path: districtPath(district),
      })),
    },
    {
      heading: copy.common.regionsHeading,
      links: byProminence(REGIONS).map((region) => ({
        label: copy.placeWords(region.name, 'region').short,
        path: regionPath(region),
      })),
    },
  ];
}
