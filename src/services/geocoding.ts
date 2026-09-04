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
 *     carry, and it answers in Uzbek. Needs an API key: set
 *     `VITE_YANDEX_GEOCODER_API_KEY` (see `.env.example`). Without it every
 *     single lookup falls through to the fallback below, which is the largest
 *     single cause of a wrong district on this form.
 *  2. **Nominatim.** No key, so it always works, but its Uzbek district
 *     coverage is patchy and its usage policy caps everyone sharing an IP at
 *     one request per second. It is the fallback, not the plan — so it is
 *     spaced out, timed out, and its answer is never allowed to hold up the
 *     form.
 *
 * Whatever comes back is matched against `UZBEKISTAN_REGIONS` — the same list
 * the form's dropdowns are built from. A geocoder that returns a district
 * spelled differently is no use: the value has to be one the select can
 * actually hold, or the form silently keeps its old selection. The last step
 * of every lookup therefore checks that the district belongs to the region it
 * was returned with; a district from the wrong region renders as the
 * dropdown's em-dash placeholder and submits a mismatch.
 */

import { ALL_TASHKENT_METROS, UZBEKISTAN_REGIONS } from '../data/mockLocations';

export interface GeoMatch {
  region: string;
  district: string;
  /** Street, with a house number when one was found. Empty when unknown. */
  street: string;
}

/**
 * Rough centres, used when a geocoder gives coordinates but no district.
 *
 * Only ever consulted within a single region (see `nearestDistrict`), so the
 * list does not have to be complete — a region with no entry at all falls back
 * to its first district rather than borrowing a neighbouring province's.
 */
const DISTRICT_COORDINATES: Record<string, [number, number]> = {
  // Toshkent shahri
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
  // Toshkent viloyati. Without these the nearest centre to a coordinate in the
  // province was always a district of the city, which is a different region.
  'Chirchiq sh.': [41.4689, 69.5822],
  'Angren sh.': [41.0167, 70.1436],
  'Olmaliq sh.': [40.8442, 69.5983],
  "Yangiyo'l sh.": [41.1122, 69.0453],
  "Bo'stonliq": [41.5561, 69.7772],
  Zangiota: [41.2342, 69.1303],
  Qibray: [41.3856, 69.4511],
  Parkent: [41.2939, 69.6772],
  Pskent: [40.8981, 69.3542],
  "Oqqurg'on": [40.8442, 68.9728],
  Bekobod: [40.2206, 69.2694],
  Chinoz: [40.9375, 68.7658],
  // Regional centres elsewhere in the country.
  'Samarqand sh.': [39.6542, 66.9597],
  "Kattaqo'rg'on sh.": [39.8992, 66.2528],
  "Farg'ona sh.": [40.3842, 71.7843],
  'Andijon sh.': [40.7821, 72.3442],
  'Namangan sh.': [41.0011, 71.6683],
  'Buxoro sh.': [39.7747, 64.4286],
  'Qarshi sh.': [38.8606, 65.7891],
  'Termiz sh.': [37.2242, 67.2783],
  'Urganch sh.': [41.5504, 60.6317],
  'Navoiy sh.': [40.0844, 65.3792],
  'Zarafshon sh.': [41.5783, 64.2031],
  'Jizzax sh.': [40.1158, 67.8422],
  'Nukus sh.': [42.4619, 59.6166],
  'Guliston sh.': [40.4897, 68.7842],
  "Qoʻqon sh.": [40.5286, 70.9425],
  "Margʻilon sh.": [40.4711, 71.7242],
  'Xiva sh.': [41.3775, 60.3639],
  'Shahrisabz sh.': [39.0578, 66.8342],
  Denov: [38.2681, 67.8931],
  Urgut: [39.4022, 67.2431],
};

export const TASHKENT_CITY = 'Toshkent shahri';

/**
 * City or rural district — the half of a place name that is not its name.
 *
 * `null` means the name carried no marker at all, which is a question this
 * module cannot answer from the string: "Bekobod" alone is both a city and the
 * tuman around it.
 */
type PlaceKind = 'city' | 'tuman';

interface FoldedPlace {
  core: string;
  kind: PlaceKind | null;
}

/**
 * Fold a place name for comparison.
 *
 * Uzbek is written with several different apostrophes and people type
 * whichever their keyboard offers, so "Mirzo Ulug'bek", "Mirzo Ulugʻbek" and
 * "Mirzo Ulugbek" all have to compare equal. The administrative suffix comes
 * off the name — a geocoder says "Chilonzor tumani" where the form says
 * "Chilonzor" — but it is *kept*, as `kind`, rather than thrown away.
 *
 * Discarding it is what put a listing in the wrong place: the list holds both
 * 'Bekobod sh.' (the city) and 'Bekobod' (the tuman around it), so a needle
 * folded down to "bekobod" matches whichever of the two the loop reaches
 * first. The suffix is the entire difference between them, so it survives the
 * fold and is compared on both sides.
 */
function foldPlace(value: string): FoldedPlace {
  let kind: PlaceKind | null = null;

  const named = value
    .toLowerCase()
    .replace(/['‘’ʻʼ`´]/g, '')
    // The lookahead is "not another letter", not `\b`: the position between
    // the dot of `sh.` and the end of the string is *not* a word boundary, so
    // the abbreviated markers — the ones the form's own list uses — used to
    // survive the fold untouched while the spelled-out ones did not.
    .replace(
      /\s+(tumani|shahri|viloyati|rayoni|sh\.|t\.)(?![\p{L}\p{N}])/gu,
      (_match, marker: string) => {
        if (kind === null && (marker === 'shahri' || marker === 'sh.')) kind = 'city';
        else if (kind === null && marker !== 'viloyati') kind = 'tuman';
        return '';
      },
    );

  const core = named.replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return { core, kind };
}

/**
 * A bare name in the form's own list is a tuman: the cities in it all carry
 * ' sh.'. A bare name from a *geocoder* means nothing of the sort, which is
 * why the two sides are defaulted separately.
 */
function placeKey(place: FoldedPlace): string {
  return `${place.core}|${place.kind ?? 'tuman'}`;
}

/**
 * Centres keyed by name and kind.
 *
 * `mockLocations` is maintained separately and writes its apostrophes however
 * the source it was transcribed from did; looking centres up through the fold
 * means a district keeps its coordinates when someone normalises `'` to `ʻ`
 * over there. The kind is part of the key because 'Chirchiq sh.' and a
 * hypothetical 'Chirchiq' tuman are different points.
 */
const CENTRES_BY_PLACE = new Map<string, [number, number]>(
  Object.entries(DISTRICT_COORDINATES).map(([name, point]) => [
    placeKey(foldPlace(name)),
    point,
  ]),
);

/**
 * The same centres, kind ignored, first entry winning.
 *
 * A city and the tuman named after it are a few kilometres apart, so when the
 * exact kind is not in the table the other one is a far better answer than
 * nothing. Only `districtCentre` uses this; the nearest-centre search below
 * stays strict, because there the whole point is to tell candidates apart.
 */
const CENTRES_BY_CORE = new Map<string, [number, number]>();
for (const [name, point] of Object.entries(DISTRICT_COORDINATES)) {
  const { core } = foldPlace(name);
  if (!CENTRES_BY_CORE.has(core)) CENTRES_BY_CORE.set(core, point);
}

function districtsOf(region: string): string[] {
  return UZBEKISTAN_REGIONS.find((item) => item.name === region)?.districts ?? [];
}

/**
 * Fold a *region* name — apostrophes and punctuation only.
 *
 * `foldPlace` strips the administrative suffix, which is right for a district and
 * catastrophic for a region: "Toshkent shahri" and "Toshkent viloyati" both
 * reduce to "toshkent", so the first entry in the list won every comparison
 * and every coordinate in the province came back as the city. The suffix is
 * the entire difference between the two, so here it stays.
 */
function foldRegion(value: string): string {
  return value
    .toLowerCase()
    .replace(/['‘’ʻʼ`´]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchRegion(candidate: string): string | null {
  if (!candidate) return null;
  const needle = foldRegion(candidate);

  for (const region of UZBEKISTAN_REGIONS) {
    if (foldRegion(region.name) === needle) return region.name;
  }

  const byLength = [...UZBEKISTAN_REGIONS].sort(
    (a, b) => foldRegion(b.name).length - foldRegion(a.name).length,
  );

  // The geocoder said more than the region's name ("Toshkent viloyati,
  // Zangiota tumani"): the longest name that fits inside it is the most
  // specific one that is actually there.
  for (const region of byLength) {
    if (needle.includes(foldRegion(region.name))) return region.name;
  }

  // The geocoder said less ("Toshkent"): the shortest name it is a part of is
  // the least the answer can be stretched into.
  for (const region of [...byLength].reverse()) {
    if (foldRegion(region.name).includes(needle)) return region.name;
  }

  return null;
}

/**
 * A district name the region's dropdown can actually hold.
 *
 * Deliberately never searches outside `region`: the previous version fell back
 * to every district in the country when the region was unknown, which is how a
 * coordinate in Toshkent viloyati came back as "Sergeli" — a real district, of
 * a different region, that the select could not display.
 */
function matchDistrict(
  candidate: string,
  region: string,
  /**
   * What the *field* the candidate came from means, for a name that carries no
   * suffix of its own. A provider's "locality" or "town" is a city however it
   * is spelled; its "area" or "county" is the rural district around one.
   */
  hint: PlaceKind | null = null,
): string | null {
  if (!candidate) return null;
  const needle = foldPlace(candidate);
  // A candidate that folded away to nothing ("sh.", punctuation) would sail
  // through the substring pass below, where every name contains the empty
  // string, and come back as the region's first district.
  if (!needle.core) return null;
  const wanted = needle.kind ?? hint;
  const pool = districtsOf(region);

  // Exact before partial, so "Buxoro" cannot be answered with "Buxoro t."
  // while "Buxoro sh." is sitting in the same list.
  //
  // Same name, right kind first: 'Bekobod sh.' and 'Bekobod' are both in the
  // Toshkent-viloyati list, and a geocoder that said "Bekobod shahri" means
  // the city, not the ring of villages around it.
  if (wanted) {
    for (const district of pool) {
      const entry = foldPlace(district);
      if (entry.core === needle.core && (entry.kind ?? 'tuman') === wanted) return district;
    }
  }
  // Same name, kind unknown or unavailable. The plain entry wins over the
  // suffixed one: nothing in the needle asked for the city, and 'Bekobod' is
  // the answer a bare "Bekobod" has always been given.
  let suffixed: string | null = null;
  for (const district of pool) {
    const entry = foldPlace(district);
    if (entry.core !== needle.core) continue;
    if (entry.kind === null) return district;
    suffixed ??= district;
  }
  if (suffixed) return suffixed;

  for (const district of pool) {
    const { core } = foldPlace(district);
    if (needle.core.includes(core) || core.includes(needle.core)) return district;
  }
  return null;
}

/**
 * Nearest known centre *within one region*. The last resort, never better
 * than a guess — but a guess that at least belongs to the right province.
 *
 * A degree of longitude is not a degree of latitude. At 41°N it is about 0.75
 * of one, so an uncorrected `Math.hypot` over raw degrees stretches the
 * east-west axis by a third and systematically prefers whichever centre
 * happens to sit north or south of the point.
 */
function nearestDistrict(latitude: number, longitude: number, region: string): string {
  const pool = districtsOf(region);
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);

  let best = '';
  let closest = Infinity;
  for (const district of pool) {
    const centre = CENTRES_BY_PLACE.get(placeKey(foldPlace(district)));
    if (!centre) continue;
    const distance = Math.hypot(
      latitude - centre[0],
      (longitude - centre[1]) * longitudeScale,
    );
    if (distance < closest) {
      closest = distance;
      best = district;
    }
  }

  // No centre is known for any district of this region: the first entry is a
  // placeholder the owner can correct, which is still better than a value the
  // dropdown cannot render.
  return best || pool[0] || '';
}

/**
 * Force a provider's answer into a shape the form's two dropdowns can hold:
 * a known region, and a district that belongs to it.
 */
function reconcile(match: GeoMatch, latitude: number, longitude: number): GeoMatch {
  const region = districtsOf(match.region).length > 0 ? match.region : TASHKENT_CITY;
  const district =
    matchDistrict(match.district, region) ?? nearestDistrict(latitude, longitude, region);
  return { region, district, street: match.street };
}

/**
 * Abort a lookup that is taking too long.
 *
 * GPS is a convenience on this form. A geocoder that has stopped answering
 * must not leave the owner watching a spinner: the coordinates are already on
 * the listing by this point, and the address field is theirs to type.
 */
const LOOKUP_TIMEOUT_MS = 6000;

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
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

  const payload = (await fetchJson(url)) as {
    response?: {
      GeoObjectCollection?: { featureMember?: Array<{ GeoObject?: unknown }> };
    };
  } | null;

  const feature = payload?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject as
    | { metaDataProperty?: { GeocoderMetaData?: { Address?: { Components?: YandexComponent[] } } } }
    | undefined;
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

  // The kind each component *is*, for the names that arrive without a suffix:
  // `area` is the rural district, `locality` is the city inside it.
  const district =
    matchDistrict(pick('district'), region) ||
    matchDistrict(pick('area'), region, 'tuman') ||
    matchDistrict(pick('locality'), region, 'city') ||
    '';

  const road = pick('street');
  const house = pick('house');
  const street = road ? (house ? `${road}, ${house}` : road) : '';

  return { region, district, street };
}

// ---------------------------------------------------------------------------
// Nominatim
// ---------------------------------------------------------------------------
/**
 * Nominatim's usage policy is one request per second per IP, and an office or
 * a mobile carrier shares one. Two owners pressing the GPS button at the same
 * moment would otherwise earn the whole network a 429; this queues them
 * instead, and the timeout above still caps how long anyone waits.
 */
const NOMINATIM_MIN_GAP_MS = 1100;
let nominatimReadyAt = 0;

async function nominatimReverse(
  latitude: number,
  longitude: number,
): Promise<GeoMatch | null> {
  const wait = nominatimReadyAt - Date.now();
  nominatimReadyAt = Math.max(nominatimReadyAt, Date.now()) + NOMINATIM_MIN_GAP_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  const data = (await fetchJson(
    'https://nominatim.openstreetmap.org/reverse' +
      `?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=uz`,
  )) as { address?: Record<string, string> } | null;
  if (!data) return null;

  const address = data.address ?? {};

  const region =
    matchRegion(address.state || '') ||
    matchRegion(address.city || '') ||
    matchRegion(address.region || '') ||
    TASHKENT_CITY;

  // `county` is Nominatim's tuman and `town` its city, so a name that arrives
  // without a suffix is still read as the right one of the two.
  const district =
    matchDistrict(
      address.city_district || address.suburb || address.district || '',
      region,
    ) ||
    matchDistrict(address.county || '', region, 'tuman') ||
    matchDistrict(address.town || '', region, 'city') ||
    '';

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
 * district in it, with the street left blank for them to type.
 *
 * Repeated presses at the same spot reuse the answer: the coordinates are
 * rounded to about 30 metres before they become a cache key, which is finer
 * than the district this lookup exists to decide.
 */
const answers = new Map<string, Promise<GeoMatch>>();

function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

export function reverseGeocode(latitude: number, longitude: number): Promise<GeoMatch> {
  const key = cacheKey(latitude, longitude);
  const cached = answers.get(key);
  if (cached) return cached;

  const lookup = (async (): Promise<GeoMatch> => {
    for (const provider of [yandexReverse, nominatimReverse]) {
      try {
        const match = await provider(latitude, longitude);
        // A result with no district is worth keeping for its region and
        // street; `reconcile` fills the district in from the region's own list.
        if (match) return reconcile(match, latitude, longitude);
      } catch {
        /* offline, blocked, timed out or rate-limited — try the next one */
      }
    }

    return {
      region: TASHKENT_CITY,
      district: nearestDistrict(latitude, longitude, TASHKENT_CITY),
      street: '',
    };
  })();

  // A failed lookup is not cached as a failure: it resolves to the fallback
  // above, and re-pressing the button should get a real try at the network.
  answers.set(key, lookup);
  void lookup.then((result) => {
    if (!result.street) answers.delete(key);
  });

  return lookup;
}

/**
 * Approximate centre of a district, for a listing saved without GPS, or `null`
 * when this file has never heard of the district.
 *
 * `null` rather than a default point. The table covers Tashkent, the province
 * around it and the regional capitals — a hundred-odd districts are not in it,
 * and every one of them used to be answered with the centre of Tashkent. A
 * flat in G'ijduvon was then pinned on the map 450km from the building and
 * published to search engines at those coordinates, with nothing anywhere
 * saying the number was invented. No coordinate at all is a listing the map
 * knows it cannot place.
 */
export function districtCentre(district: string): [number, number] | null {
  const place = foldPlace(district);
  return CENTRES_BY_PLACE.get(placeKey(place)) ?? CENTRES_BY_CORE.get(place.core) ?? null;
}

// ---------------------------------------------------------------------------
// Nearest metro
// ---------------------------------------------------------------------------
/**
 * The metro station closest to a point, as Yandex names it.
 *
 * `kind=metro` is a reverse-geocode that answers with stations rather than
 * addresses, which is why this needs no coordinate table of its own: the app
 * carries metro stations as names only, so there is nothing here to measure a
 * distance against.
 *
 * The answer is matched against `ALL_TASHKENT_METROS` before it is returned.
 * Yandex writes "Chilonzor metro bekati" where the form's dropdown holds
 * "Chilonzor", and a value the select cannot hold is worse than none: the
 * field silently keeps whatever it had. An unmatched station therefore
 * resolves to `null` and the owner picks it themselves, which is the same
 * outcome as before this existed.
 */
export async function nearestMetro(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!YANDEX_GEOCODER_KEY) return null;

  const url =
    'https://geocode-maps.yandex.ru/1.x/' +
    `?apikey=${encodeURIComponent(YANDEX_GEOCODER_KEY)}` +
    `&geocode=${longitude},${latitude}` +
    '&kind=metro&format=json&lang=uz_UZ&results=1';

  const payload = (await fetchJson(url)) as {
    response?: {
      GeoObjectCollection?: { featureMember?: Array<{ GeoObject?: { name?: string } }> };
    };
  } | null;

  const raw = payload?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.name;
  if (!raw) return null;

  // Compared on letters and digits alone. The two spellings differ by
  // apostrophes, the word "metro", and the odd hyphen — none of which change
  // which station is meant.
  const normalise = (value: string) =>
    value
      .toLowerCase()
      .replace(/metro|bekati|stansiyasi|станция|метро/g, '')
      .replace(/[^a-z0-9\u0400-\u04FF]/g, '');

  const target = normalise(raw);
  if (!target) return null;
  return (
    ALL_TASHKENT_METROS.find((station) => {
      const known = normalise(station);
      return known === target || target.includes(known) || known.includes(target);
    }) ?? null
  );
}
