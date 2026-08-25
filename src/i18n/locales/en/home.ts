/**
 * Home page: hero, categories, trust stats, AI recommendations.
 *
 * English strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const home = {
  hero: {
    badge: '0% commission · rent directly',
    title: 'Find a home without a broker',
    subtitle: 'Verified homes across {regions} regions and {districts} districts of Uzbekistan.',
    searchTitle: 'Where are you looking?',
    searchHintShort: 'Tap to search',
    searchHintLong: 'District, street, landmark or metro station',
    openSearch: 'Open the search dialog',
  },

  categories: {
    eyebrow: 'Featured sections',
    title: 'Quick search by category',
    subtitle: 'Pick the kind of rental you need and browse the homes',
    viewAll: 'View all listings',
    tags: {
      roommateBoys: 'For men',
      roommateGirls: 'For women',
      studentNearUniversity: 'Near a university',
      studentDormAlternative: 'Dorm alternative',
      familyTwoRooms: '2 rooms',
      familyThreeRooms: '3 rooms',
      metroWalk: 'Within walking distance',
      metroCentral: 'Closer to the centre',
      budgetNoDeposit: 'No deposit',
      budgetLowPrice: 'Low price',
      premiumVerifiedOwner: 'Verified owner',
      premiumHighTrust: 'High trust score',
    },
  },

  stats: {
    toggleTitle: 'Platform figures',
    toggleSubtitle: 'Real numbers only · 0% commission',
    toggleSubtitleWithCount: '{count} active listings · 0% commission',
    expand: 'Show',
    collapse: 'Hide',
    title: 'Renting without a broker, with confidence',
    subtitle:
      'We keep brokers and fraudsters out of the system so people can find a home on their own.',
    activeListings: 'Active listings',
    activeListingsHint: 'Open right now',
    featuredListings: 'Recommended listings',
    featuredListingsHint: 'The most trusted after review',
    commission: 'Broker commission',
    commissionHint: 'Straight from the homeowner',
    unavailable: 'The figures could not be loaded right now.',
  },

  recommended: {
    badge: 'Recommended',
    title: 'Listings',
    titleVIP: 'Top and VIP Listings',
    subtitle: 'The latest and most trusted',
    subtitleVIP: 'Most trusted listings promoted on our platform',
    viewAll: 'See all',
    listLabel: 'Recommended listings',
    empty: 'There are no listings to recommend yet.',
    emptyCta: 'Post a listing',
    error: 'The recommendations could not be loaded.',
  },

  search: {
    title: 'Search options',
    queryLabel: 'Keyword',
    queryPlaceholder: 'District, street or landmark',
    metroAll: 'All metro stations',
    metroStation: '{station} station',
    rentalTypeLabel: 'Rental type',
    submit: 'Show results',
  },
} as const;
