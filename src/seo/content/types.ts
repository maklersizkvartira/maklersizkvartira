/**
 * The shape every language's SEO copy has to satisfy.
 *
 * Uzbek is the source of truth for the *structure*; Russian and English are
 * type-checked against `CopyPack`, so a missing category or a forgotten FAQ
 * entry is a compile error rather than an English string appearing on a
 * Russian page.
 *
 * The templates take a `PlaceWords` bundle rather than a bare name because
 * Uzbek and Russian both inflect place names, and "Chilonzor kvartira" reads
 * like machine output while "Chilonzorda kvartira" reads like a sentence.
 */

/** A place in every grammatical form the copy needs. */
export interface PlaceWords {
  /** Nominative, as displayed: "Chilonzor", "Toshkent shahri". */
  name: string;
  /** Locative: "Chilonzorda", "в Чилонзоре", "in Chilonzor". */
  inPlace: string;
  /** Short form for titles and breadcrumbs: "Chilonzor". */
  short: string;
}

/** Editorial context for one region or district. Written per language. */
export interface PlaceProfile {
  /** Two to four sentences that are true of this place and nowhere else. */
  about: string;
  /** Concrete draws: universities, markets, business districts, transport. */
  highlights: string[];
}

export interface CategoryWords {
  /** Singular noun: "kvartira". */
  noun: string;
  /** Plural: "kvartiralar". */
  plural: string;
  /** Menu / breadcrumb label: "Kvartira ijarasi". */
  label: string;
  /** Headline phrase: "kvartira ijarasi". */
  headline: string;
  /** One sentence describing who this category is for. */
  blurb: string;
}

export interface FaqEntry {
  q: string;
  a: string;
}

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
  /** Optional bullet list rendered under the paragraphs. */
  bullets?: string[];
}

export interface Article {
  slug: string;
  title: string;
  /** Meta description and the excerpt on the index page. */
  summary: string;
  /** ISO date. Editorial publication date, not the build date. */
  publishedAt: string;
  updatedAt: string;
  /** Reading time in minutes, shown on the card. */
  readingMinutes: number;
  h1: string;
  intro: string;
  sections: ArticleSection[];
  faq: FaqEntry[];
}

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  h1: string;
  intro: string;
  sections: ArticleSection[];
  updatedAt: string;
}

/**
 * Everything the landing-page builder needs, per language.
 *
 * The `*Title` and `*Description` members are functions rather than templates
 * with `{place}` holes because Russian needs the place name in a different
 * position from Uzbek, and a positional template cannot express that.
 */
export interface CopyPack {
  /** BCP-47 tag used in `hreflang` and `og:locale`. */
  htmlLang: string;
  ogLocale: string;

  brand: {
    name: string;
    tagline: string;
    /** The site's own description, used on the home page and in Organization. */
    about: string;
  };

  common: {
    breadcrumbHome: string;
    allListings: string;
    listingsIn: (place: string) => string;
    resultsCount: (count: number) => string;
    emptyTitle: string;
    emptyBody: string;
    faqHeading: string;
    exploreHeading: string;
    nearbyHeading: string;
    categoriesHeading: string;
    regionsHeading: string;
    districtsHeading: string;
    readMore: string;
    publishedOn: string;
    updatedOn: string;
    readingTime: (minutes: number) => string;
    blogHeading: string;
    blogIntro: string;
    helpHeading: string;
    helpIntro: string;
    notFoundTitle: string;
    notFoundBody: string;
    notFoundCta: string;
  };

  categories: Record<string, CategoryWords>;

  /** Region and district editorial context, keyed by slug. */
  places: {
    regions: Record<string, PlaceProfile>;
    districts: Record<string, PlaceProfile>;
  };

  /** Turns a stored place name into its grammatical forms. */
  placeWords: (name: string, kind: 'region' | 'district') => PlaceWords;

  /**
   * The country, in the same grammatical forms.
   *
   * Category pages are about a kind of home rather than a place, but their
   * FAQ is still phrased "how do I find X in Y". Without this the builder
   * substituted the brand name for Y and asked "how do I find a flat in
   * Uyiz".
   */
  country?: PlaceWords;

  /** Home page. */
  home: {
    title: string;
    description: string;
    h1: string;
    intro: string[];
    faq: FaqEntry[];
  };

  /** The full catalogue at /elonlar. */
  catalog: {
    title: string;
    description: string;
    h1: string;
    intro: string[];
  };

  /** Per-facet page copy. */
  landing: {
    categoryTitle: (category: CategoryWords) => string;
    categoryDescription: (category: CategoryWords) => string;
    categoryH1: (category: CategoryWords) => string;
    categoryIntro: (category: CategoryWords) => string[];

    regionTitle: (place: PlaceWords) => string;
    regionDescription: (place: PlaceWords) => string;
    regionH1: (place: PlaceWords) => string;

    placeCategoryTitle: (place: PlaceWords, category: CategoryWords) => string;
    placeCategoryDescription: (place: PlaceWords, category: CategoryWords) => string;
    placeCategoryH1: (place: PlaceWords, category: CategoryWords) => string;

    /** Paragraphs shared by every geography page, given its profile. */
    placeIntro: (
      place: PlaceWords,
      category: CategoryWords | null,
      profile: PlaceProfile | null,
      metroStations: string[],
    ) => string[];

    /** Four questions worth answering about renting in this place. */
    placeFaq: (place: PlaceWords, category: CategoryWords | null) => FaqEntry[];
  };

  /**
   * The app's own public screens — the map, the student programme, the
   * ecosystem preview.
   *
   * Optional so that a pack is still valid without it, but a view left out
   * falls back to the brand title, and three pages sharing one title is three
   * pages Google will pick one of.
   */
  views?: Partial<
    Record<'map' | 'studentProgram' | 'ecosystem', { title: string; description: string }>
  >;

  /** Listing detail page, built from the listing itself. */
  listing: {
    title: (input: { title: string; district?: string | null; rooms?: number | null }) => string;
    description: (input: {
      title: string;
      district?: string | null;
      rooms?: number | null;
      area?: number | null;
      price: string;
    }) => string;
    loadingTitle: string;
    notFoundTitle: string;
  };

  articles: Article[];
  help: HelpArticle[];
}
