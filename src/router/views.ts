/**
 * The view vocabulary, and the path each view lives at.
 *
 * This module deliberately imports nothing from the store or the router: both
 * of those need the vocabulary, and a cycle between the three files that every
 * component transitively depends on is not a good place to find out about
 * module initialisation order.
 *
 * Paths are Uzbek, because the URL is a ranking signal and a trust signal —
 * `maklersizuy.uz/toshkent/chilonzor/kvartira-ijaraga` says what the page is
 * before anybody has clicked it, and `/?view=listings` says nothing at all.
 */

export type ViewState =
  | 'HOME'
  | 'LISTINGS'
  | 'MAP'
  | 'LISTING_DETAIL'
  | 'VERIFICATION'
  | 'CREATE_LISTING'
  | 'MY_LISTINGS'
  | 'PROFILE'
  | 'CHAT'
  | 'REFERRAL'
  | 'STUDENT_PROGRAM'
  | 'ECOSYSTEM_PREVIEW'
  | 'FAVORITES'
  /** A geography/category landing page built for search. */
  | 'SEO_LANDING'
  | 'BLOG_INDEX'
  | 'BLOG_POST'
  | 'HELP'
  | 'NOT_FOUND';

/**
 * Where each single-instance view lives.
 *
 * `LISTING_DETAIL` and the content views are absent because their paths carry
 * a parameter; they are built by `pathFor` instead.
 */
export const VIEW_PATHS: Partial<Record<ViewState, string>> = {
  HOME: '/',
  LISTINGS: '/elonlar',
  MAP: '/xarita',
  FAVORITES: '/saqlanganlar',
  PROFILE: '/profil',
  MY_LISTINGS: '/mening-elonlarim',
  CREATE_LISTING: '/elon-berish',
  VERIFICATION: '/tasdiqlash',
  REFERRAL: '/dostni-taklif-qilish',
  STUDENT_PROGRAM: '/talabalar-dasturi',
  ECOSYSTEM_PREVIEW: '/ekotizim',
  CHAT: '/xabarlar',
};

export const PATH_TO_VIEW: ReadonlyMap<string, ViewState> = new Map(
  Object.entries(VIEW_PATHS).map(([view, path]) => [path, view as ViewState]),
);

/**
 * Views behind a sign-in, or otherwise useless to a search engine.
 *
 * These are `noindex` in the page head *and* disallowed in robots.txt. Both,
 * because robots.txt only stops the crawl — a URL that is linked from
 * elsewhere can still be indexed without ever being fetched.
 */
export const PRIVATE_VIEWS: ReadonlySet<ViewState> = new Set<ViewState>([
  'FAVORITES',
  'PROFILE',
  'MY_LISTINGS',
  'CREATE_LISTING',
  'VERIFICATION',
  'REFERRAL',
  'CHAT',
]);

/**
 * Views that require an account; a guest is sent to the auth dialog instead.
 *
 * This set is the *only* place the rule lives. The guard used to be repeated
 * in every button that could reach one of these screens — the bottom nav, the
 * header, the listings page and the create-listing page each had their own
 * copy, opening a different tab from the next one — and typing the address
 * straight into the bar walked past all four. App.tsx reads this set once, so
 * a link, a button and a pasted URL now all end at the same dialog.
 */
export const REQUIRES_AUTH: ReadonlySet<ViewState> = new Set<ViewState>([
  'CREATE_LISTING',
  'MY_LISTINGS',
  'PROFILE',
  'FAVORITES',
  'VERIFICATION',
  'REFERRAL',
  'CHAT',
]);

/**
 * Which tab of the auth dialog a guarded view should open on.
 *
 * Posting a first listing is a signup, not a sign-in: whoever presses it has
 * usually never had an account, and the REGISTER tab opens on the role
 * question — the funnel a new owner needs. Every other guarded view belongs
 * to an account that already exists, so it asks them to sign in.
 */
export function authTabForView(view: ViewState): 'LOGIN' | 'REGISTER' {
  return view === 'CREATE_LISTING' ? 'REGISTER' : 'LOGIN';
}

/** The query-string vocabulary of the previous build, kept working. */
export const LEGACY_VIEW_QUERY: Record<string, ViewState> = {
  listings: 'LISTINGS',
  map: 'MAP',
  favorites: 'FAVORITES',
  profile: 'PROFILE',
  my_listings: 'MY_LISTINGS',
  create_listing: 'CREATE_LISTING',
  verification: 'VERIFICATION',
  referral: 'REFERRAL',
  student_program: 'STUDENT_PROGRAM',
  ecosystem_preview: 'ECOSYSTEM_PREVIEW',
  chat: 'CHAT',
};
