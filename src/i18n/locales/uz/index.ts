/**
 * Uzbek — the source of truth.
 *
 * `Dictionary` widens the literal string types of this object to `string`
 * while keeping its key structure, so a translation is checked on its SHAPE
 * (every key present, none extra) rather than being required to repeat the
 * Uzbek text verbatim.
 */
import { account } from './account';
import { assistant } from './assistant';
import { auth } from './auth';
import { chat } from './chat';
import { common } from './common';
import { ecosystem } from './ecosystem';
import { favorites } from './favorites';
import { growth } from './growth';
import { home } from './home';
import { layout } from './layout';
import { listings } from './listings';
import { map } from './map';
import { owner } from './owner';
import { student } from './student';
import { verification } from './verification';

export const uz = {
  common,
  layout,
  auth,
  listings,
  home,
  map,
  owner,
  account,
  verification,
  chat,
  assistant,
  favorites,
  growth,
  student,
  ecosystem,
} as const;

/** Recursively replaces literal string types with `string`. */
type Widen<T> = T extends string
  ? string
  : { -readonly [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof uz>;

/** The literal-typed shape, used to derive autocompletable key paths. */
export type UzDictionary = typeof uz;

export default uz;
