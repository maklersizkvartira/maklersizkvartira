/**
 * English translations.
 *
 * Typed as `Dictionary` so the compiler rejects a missing, renamed or
 * extra key against the Uzbek source of truth.
 */
import type { Dictionary } from '../uz';

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

export const en: Dictionary = {
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
};

export default en;
