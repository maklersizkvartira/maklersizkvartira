/**
 * URL slugs for Uzbek place names.
 *
 * Every SEO landing page is addressed by a slug derived from the exact
 * region/district string a listing is filed under, so a URL can always be
 * turned back into an API filter without a second lookup table drifting out
 * of sync with `src/data/mockLocations.ts`.
 *
 * Uzbek Latin uses three different apostrophe characters for `oʻ`, `gʻ` and
 * the glottal stop, and the data file mixes them. They are all dropped rather
 * than transliterated: `Bo'stonliq` and `Boʻstonliq` must produce one slug,
 * and `bostonliq` is what people actually type.
 */

/** U+0027, U+2018, U+2019, U+02BB, U+02BC, U+0060, U+00B4. */
const APOSTROPHES = /['\u2018\u2019\u02bb\u02bc`\u00b4]/g;

/** `Samarqand sh.` and `Sirdaryo t.` are two different places. */
const ADMIN_SUFFIXES: Array<[RegExp, string]> = [
  [/\s+sh\.$/i, ' shahri'],
  [/\s+t\.$/i, ' tumani'],
  [/\s+tum\.$/i, ' tumani'],
];

/**
 * Region slugs are hand-picked rather than derived: `viloyati` in the URL
 * would cost a keyword slot on every regional page, and `toshkent` alone is
 * what the searches say.
 */
const REGION_SLUG_OVERRIDES: Record<string, string> = {
  'Toshkent shahri': 'toshkent',
  'Toshkent viloyati': 'toshkent-viloyati',
  'Qoraqalpogʻiston Respublikasi': 'qoraqalpogiston',
};

export function slugify(value: string): string {
  let text = value.trim();
  for (const [pattern, replacement] of ADMIN_SUFFIXES) {
    text = text.replace(pattern, replacement);
  }
  return text
    .normalize('NFD')
    // Strip combining marks so `ǵ` and `g` collapse together.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(APOSTROPHES, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function regionSlug(region: string): string {
  const override = REGION_SLUG_OVERRIDES[region];
  if (override) return override;
  return slugify(region.replace(/\s+viloyati$/i, ''));
}

export function districtSlug(district: string): string {
  return slugify(district);
}

/**
 * A listing URL carries a human-readable slug in front of the id.
 *
 * The id is the only part that is read back — the slug is decoration for the
 * user and for the search snippet — so an edited title never breaks a link.
 */
export function listingSlug(input: {
  title?: string | null;
  district?: string | null;
  rooms?: number | null;
}): string {
  const parts = [input.district ?? '', input.title ?? ''].filter(Boolean).join(' ');
  const base = slugify(parts).split('-').filter(Boolean).slice(0, 8).join('-');
  return base || 'elon';
}

/** UUIDs are the id format; anything else is a malformed link. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function listingIdFromSlug(segment: string): string | null {
  const match = segment.match(UUID);
  return match ? match[0].toLowerCase() : null;
}
