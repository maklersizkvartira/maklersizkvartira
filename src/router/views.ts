/**
 * The view vocabulary, and the path each view lives at.
 *
 * This module deliberately imports nothing from the store or the router: both
 * of those need the vocabulary, and a cycle between the three files that every
 * component transitively depends on is not a good place to find out about
 * module initialisation order.
 *
 * Paths are Uzbek, because the URL is a ranking signal and a trust signal —
 * `uyiz.uz/toshkent/chilonzor/kvartira-ijaraga` says what the page is
 * before anybody has clicked it, and `/?view=listings` says nothing at all.
 */

export type ViewState =
  | 'HOME'
  /**
   * The three auth screens.
   *
   * They are routes, not a dialog. Signing in used to happen in a modal over
   * whatever page you were on, which meant the flow had no address of its
   * own: it could not be linked to, Android's Back button dismissed the page
   * underneath instead of the sheet, and a half-filled registration was lost
   * to any navigation. A phone keyboard covering two thirds of a bottom sheet
   * was the other half of the complaint.
   */
  | 'LOGIN'
  | 'REGISTER'
  | 'FORGOT_PASSWORD'
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

  // -- Signed-in and account screens: English -------------------------------
  //
  // Every one of these is in PRIVATE_VIEWS, which means noindex and out of the
  // sitemap — so no search engine ever reads these words and their language
  // carries no ranking signal at all. They are addresses the owner types,
  // pastes and reads in a support chat, and English is what was asked for.
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forget-password',
  FAVORITES: '/favorites',
  PROFILE: '/profile',
  MY_LISTINGS: '/my-listings',
  CREATE_LISTING: '/post-listing',
  VERIFICATION: '/verification',
  REFERRAL: '/invite',
  CHAT: '/messages',

  // -- Public pages: Uzbek, and deliberately so -----------------------------
  //
  // These ARE indexed, and the words in them are the ones people type into
  // Google. `/elonlar` and `/kvartira-ijaraga` match Uzbek queries in a way
  // `/listings` never will, they are already submitted to Search Console, and
  // renaming them would need a 301 for every landing page on the site. The
  // split is the point: language follows whether a crawler reads the page.
  LISTINGS: '/elonlar',
  MAP: '/xarita',
  STUDENT_PROGRAM: '/talabalar-dasturi',
  ECOSYSTEM_PREVIEW: '/ekotizim',
};

/**
 * The Uzbek addresses the account screens used to live at.
 *
 * Kept resolvable rather than dropped. Somebody has these in a bookmark, in a
 * Telegram message or open in a tab right now, and a renamed URL that answers
 * 404 is indistinguishable from a deleted account page. They resolve to the
 * same view; because VIEW_PATHS now holds the English address, every link the
 * app builds afterwards is the new one, so a visitor who arrives on an old
 * path leaves on the new one without being told anything.
 */
const RETIRED_PATHS: Record<string, ViewState> = {
  '/saqlanganlar': 'FAVORITES',
  '/profil': 'PROFILE',
  '/mening-elonlarim': 'MY_LISTINGS',
  '/elon-berish': 'CREATE_LISTING',
  '/tasdiqlash': 'VERIFICATION',
  '/dostni-taklif-qilish': 'REFERRAL',
  '/xabarlar': 'CHAT',
};

export const PATH_TO_VIEW: ReadonlyMap<string, ViewState> = new Map([
  ...Object.entries(VIEW_PATHS).map(
    ([view, path]) => [path, view as ViewState] as const,
  ),
  ...Object.entries(RETIRED_PATHS),
]);

/**
 * Views behind a sign-in, or otherwise useless to a search engine.
 *
 * These are `noindex` in the page head *and* disallowed in robots.txt. Both,
 * because robots.txt only stops the crawl — a URL that is linked from
 * elsewhere can still be indexed without ever being fetched.
 */
export const PRIVATE_VIEWS: ReadonlySet<ViewState> = new Set<ViewState>([
  // A sign-in form is thin content that would compete with the pages that
  // actually answer a search, and there is nothing on it for a crawler to
  // read. Being here also keeps them out of the sitemap.
  'LOGIN',
  'REGISTER',
  'FORGOT_PASSWORD',
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

/**
 * The auth routes themselves.
 *
 * Used to keep the "where was I going?" target from being overwritten by the
 * auth pages' own navigation: pressing "create an account" on /login must not
 * make /login the place the visitor is returned to after signing up.
 */
export const AUTH_VIEWS: ReadonlySet<ViewState> = new Set<ViewState>([
  'LOGIN',
  'REGISTER',
  'FORGOT_PASSWORD',
]);

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
