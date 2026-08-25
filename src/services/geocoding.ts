/**
 * Turning coordinates into an address people recognise.
 *
 * The listing form fills its region, district and street from whatever the
 * phone's GPS reports, so the quality of that lookup is the difference
 * between "press the button and you're done" and "press the button and then
 * correct three fields".
 *
 * Two providers, in this order:
 *
 *  1. **Yandex.** Its Uzbek coverage is the reason this file exists — it
 *     knows mahalla and district names that OpenStreetMap simply does not
 *     carry, and it answers in Uzbek. Needs an API key.
 *  2. **Nominatim.** No key, so it always works, but its Uzbek district
 *     coverage is patchy and its usage policy caps everyone sharing an IP at
 *     one request per second. It is the fallback, not the plan.
 *
 * Whatever comes back is matched against `UZBEKISTAN_REGIONS` — the same list
 * the form's dropdowns are built from. A geocoder that returns a district
 * spelled differently is no use: the value has to be one the select can
 * actually hold, or the form silently keeps its old selection.
 */

import { UZBEKISTAN_REGIONS } from '../data/mockLocations';

export interface GeoMatch {
  region: string;
  district: string;
  /** Street, with a house number when one was found. Empty when unknown. */
  street: string;
}

/** Rough centres, used when a geocoder gives coordinates but no district. */
const DISTRICT_COORDINATES: Record<string, [number, number]> = {
  Chilonzor: [41.278, 69.208],
  Yunusobod: [41.365, 69.292],
  Mirobod: [41.3005, 69.274],
  Yakkasaroy: [41.289, 69.255],
  Sergeli: [41.225, 69.22],
  Uchtepa: [41.295, 69.175],
  Olmazor: [41.349, 69.208],
  Yashnobod: [41.29, 69.34],
  Shayxontohur: [41.32, 69.24],
  'Mirzo Ulugʻbek': [41.335, 69.33],
  Bektemir: [41.21, 69.33],
  Yangihayot: [41.2, 69.21],
  'Samarqand sh.': [39.6542, 66.9597],
  "Farg'ona sh.": [40.3842, 71.7843],
  'Andijon sh.': [40.7821, 72.3442],
  'Namangan sh.': [41.0011, 71.6683],
  'Buxoro sh.': [39.7747, 64.4286],
  'Qarshi sh.': [38.8606, 65.7891],
  'Termiz sh.': [37.2242, 67.2783],
  'Urganch sh.': [41.5504, 60.6317],
  'Navoiy sh.': [40.0844, 65.3792],
  'Jizzax sh.': [40.1158, 67.8422],
  'Nukus sh.': [42.4619, 59.6166],
  'Guliston sh.': [40.4897, 68.7842],
  'Chirchiq sh.': [41.4689, 69.5822],
  'Qoʻqon sh.': [40.5286, 70.9425],
  'Margʻilon sh.': [40.4711, 71.7242],
  'Xiva sh.': [41.3775, 60.3639],
  'Shahrisabz sh.': [39.0578, 66.8342],
  'Denov': [38.2681, 67.8931],
  'Urgut': [39.4022, 67.2431],
};

export const TASHKENT_CITY = 'Toshkent shahri';

/**
 * Fold a place name for comparison.
 *
 * Uzbek is written with several different apostrophes and people type
 * whichever their keyboard offers, so "Mirzo Ulug'bek", "Mirzo Ulugʻbek" and
 * "Mirzo Ulugbek" all have to compare equal. The administrative suffixes go
 * too: a geocoder says "Chilonzor tumani" where the form says "Chilonzor".
 */
function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/['‘’ʻʼ`´]/g, '')
    .replace(/\s+(tumani|shahri|viloyati|rayoni|sh\.|t\.)\b/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim();
}

function matchRegion(candidate: string): string | null {
  if (!candidate) return null;
  const needle = fold(candidate);
  for (const region of UZBEKISTAN_REGIONS) {
    const core = fold(region.name);
    if (needle === core || needle.includes(core) || core.includes(needle)) {
      return region.name;
    }
  }
  return null;
}

function matchDistrict(candidate: string, region: string): string | null {
  if (!candidate) return null;
  const needle = fold(candidate);
  const data = UZBEKISTAN_REGIONS.find((item) => item.name === region);
  const pools = data ? [data.districts] : UZBEKISTAN_REGIONS.map((item) => item.districts);
  for (const pool of pools) {
    for (const district of pool) {
      const core = fold(district);
      if (needle === core || needle.includes(core) || core.includes(needle)) {
        return district;
      }
    }
  }
  return null;
}

/** Nearest known centre. The last resort, never better than a guess. */
function nearestDistrict(latitude: number, longitude: number): string {
  let best = '';
  let closest = Infinity;
  for (const [name, [lat, lng]] of Object.entries(DISTRICT_COORDINATES)) {
    const distance = Math.hypot(latitude - lat, longitude - lng);
    if (distance < closest) {
      closest = distance;
      best = name;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Yandex
// ---------------------------------------------------------------------------
const YANDEX_GEOCODER_KEY =
  import.meta.env.VITE_YANDEX_GEOCODER_API_KEY ||
  import.meta.env.VITE_YANDEX_MAPS_API_KEY ||
  '';

export const hasYandexGeocoder = Boolean(YANDEX_GEOCODER_KEY);

interface YandexComponent {
  kind: string;
  name: string;
}

async function yandexReverse(latitude: number, longitude: number): Promise<GeoMatch | null> {
  if (!YANDEX_GEOCODER_KEY) return null;

  // Yandex takes longitude first. Getting this backwards puts every listing in
  // the wrong hemisphere and the API answers cheerfully, so it is worth
  // stating plainly.
  const url =
    'https://geocode-maps.yandex.ru/1.x/' +
    `?apikey=${encodeURIComponent(YANDEX_GEOCODER_KEY)}` +
    `&geocode=${longitude},${latitude}` +
    '&format=json&lang=uz_UZ&results=1';

  const response = await fetch(url);
  if (!response.ok) return null;

  const payload = await response.json();
  const feature =
    payload?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  if (!feature) return null;

  const components: YandexComponent[] =
    feature?.metaDataProperty?.GeocoderMetaData?.Address?.Components ?? [];

  const pick = (kind: string) =>
    components.find((item) => item.kind === kind)?.name ?? '';

  const region =
    matchRegion(pick('province')) ||
    matchRegion(pick('locality')) ||
    matchRegion(pick('area')) ||
    TASHKENT_CITY;

  const district =
    matchDistrict(pick('district'), region) ||
    matchDistrict(pick('area'), region) ||
    matchDistrict(pick('locality'), region) ||
    '';

  const road = pick('street');
  const house = pick('house');
  const street = road ? (house ? `${road}, ${house}` : road) : '';

  return { region, district, street };
}

// ---------------------------------------------------------------------------
// Nominatim
// ---------------------------------------------------------------------------
async function nominatimReverse(
  latitude: number,
  longitude: number,
): Promise<GeoMatch | null> {
  const response = await fetch(
    'https://nominatim.openstreetmap.org/reverse' +
      `?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=uz`,
  );
  if (!response.ok) return null;

  const data: { address?: Record<string, string> } = await response.json();
  const address = data.address ?? {};

  const region =
    matchRegion(address.state || '') ||
    matchRegion(address.city || '') ||
    matchRegion(address.region || '') ||
    TASHKENT_CITY;

  const district =
    matchDistrict(
      address.city_district || address.suburb || address.district || address.county || address.town || '',
      region,
    ) || '';

  const road = address.road || address.street || address.neighbourhood || address.suburb || '';
  const street = road ? (address.house_number ? `${road}, ${address.house_number}` : road) : '';

  return { region, district, street };
}

// ---------------------------------------------------------------------------
/**
 * Best-effort reverse geocode. Never throws.
 *
 * GPS is a convenience on this form, not a requirement, so a provider being
 * down or rate-limited must leave the owner with a working form rather than
 * an error. The worst case still returns a usable region and the nearest
 * district, with the street left blank for them to type.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeoMatch> {
  for (const provider of [yandexReverse, nominatimReverse]) {
    try {
      const match = await provider(latitude, longitude);
      // A result with no district is worth keeping for its region and street,
      // but the district still gets filled in below.
      if (match) {
        return {
          ...match,
          district: match.district || nearestDistrict(latitude, longitude),
        };
      }
    } catch {
      /* offline, blocked or rate-limited — try the next one */
    }
  }

  return {
    region: TASHKENT_CITY,
    district: nearestDistrict(latitude, longitude),
    street: '',
  };
}

/** Approximate centre of a district, for a listing saved without GPS. */
export function districtCentre(district: string): [number, number] {
  return DISTRICT_COORDINATES[district] ?? [41.311, 69.279];
}
