/**
 * Blog slugs, separated from the articles themselves.
 *
 * The router has to know whether `/blog/xyz` exists before it can decide
 * between rendering a post and rendering a 404, and it must be able to answer
 * that without pulling every article's body into the entry bundle.
 */

export const BLOG_SLUGS = [
  'maklersiz-uy-topish',
  'ijara-shartnomasi-tekshirish',
  'toshkent-ijara-narxlari',
  'ijarada-firibgarlikdan-saqlanish',
  'talabalar-uchun-kvartira-tanlash',
  'uy-egasi-uchun-elon-yozish',
] as const;

export type BlogSlug = (typeof BLOG_SLUGS)[number];
