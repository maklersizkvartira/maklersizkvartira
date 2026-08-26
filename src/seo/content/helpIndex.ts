/**
 * Help-centre slugs. Split from the article bodies for the same reason as
 * `blogIndex` — the router needs the list, not the prose.
 *
 * The empty slug is the hub at `/yordam` itself.
 */

export const HELP_SLUGS = [
  'savol-javob',
  'xavfsizlik',
  'foydalanish-shartlari',
  'maxfiylik-siyosati',
] as const;

export type HelpSlug = (typeof HELP_SLUGS)[number];
