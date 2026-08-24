/**
 * Saved listings page.
 *
 * Uzbek strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const favorites = {
  page: {
    title: 'Saralanganlar',
    subtitle: 'Yurakcha bosilgan e’lonlar shu yerda saqlanadi',
    count: '{count} ta e’lon',
    browse: 'E’lonlarga o‘tish',
  },

  empty: {
    title: 'Saralangan e’lonlar yo‘q',
    body: 'E’lonni ko‘rayotganda yurakcha tugmasini bosing — u shu sahifada saqlanadi.',
    cta: 'E’lonlarni ko‘rish',
  },

  guest: {
    title: 'Saralanganlarni ko‘rish uchun kiring',
    body: 'Hisobingizga kirsangiz, saralangan e’lonlar barcha qurilmalaringizda saqlanadi.',
    cta: 'Kirish',
  },

  error: {
    title: 'Saralanganlarni yuklab bo‘lmadi',
  },
} as const;
