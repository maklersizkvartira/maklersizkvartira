/**
 * Blog slugs, separated from the articles themselves.
 *
 * The router has to know whether `/blog/xyz` exists before it can decide
 * between rendering a post and rendering a 404, and it must be able to answer
 * that without pulling every article's body into the entry bundle.
 */

export const BLOG_SLUGS = [
  // Renamed from `maklersiz-uy-topish` in the Uyiz rebrand. The old path is
  // 308-redirected to this one, per language, in vercel.json — the slug is
  // also the join key with articles.{uz,ru,en}.ts and must match there.
  'uy-ijaraga-olish-qollanma',
  'ijara-shartnomasi-tekshirish',
  'toshkent-ijara-narxlari',
  'ijarada-firibgarlikdan-saqlanish',
  'talabalar-uchun-kvartira-tanlash',
  'uy-egasi-uchun-elon-yozish',
  'zakladka-va-depozit',
  'kvartirani-korish-checklist',
  'sherik-bilan-yashash',
  'kommunal-tolovlar',
] as const;

export type BlogSlug = (typeof BLOG_SLUGS)[number];
