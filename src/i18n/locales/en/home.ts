/**
 * Home page: hero, categories, trust stats, AI recommendations.
 *
 * English strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const home = {
  hero: {
    badge: '0% commission · rent directly',
    title: 'Rent a home or flat, no agents',
    // Not "{regions} provinces": Uzbekistan has 12 viloyats plus the Republic
    // of Karakalpakstan plus the city of Tashkent, so the number the page
    // counts is 14 and the word for it is "region", not "province".
    subtitle:
      'No agents, no commission — verified homes across {regions} regions '
      + 'and {districts} districts and cities.',
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
      qizlargaOnlyGirls: 'Women only',
      qizlargaRoommate: 'Female roommate',
      komfortFurnished: 'Furnished',
      komfortAppliances: 'AC and washing machine',
      centerWalkable: 'Walk to the centre',
      centerDistricts: 'Central districts',
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

    /**
     * Geography, stated truthfully.
     *
     * The old line promised "{regions} provinces" while the number behind it
     * counted 12 viloyats + the Republic of Karakalpakstan + the city of
     * Tashkent. "Region" is the word that covers all three, and the second-
     * level unit is a "district or city", not a district alone.
     *
     * `geoSublineActive` is the honest variant: how many places actually have
     * listings, not how many sit in the dropdown.
     */
    geoHeadline: 'No agents, no commission — straight from the owner',
    geoSubheadline: '0% commission. You talk to the homeowner yourself.',
    geoSubline:
      'Verified homes across {regions} regions and {districts} districts and cities of Uzbekistan.',
    geoSublineActive:
      'Right now there are active listings in {regions} regions and {districts} districts and cities.',
    regionsLabel: 'Regions',
    regionsHint: '12 provinces, the Republic of Karakalpakstan and the city of Tashkent',
    districtsLabel: 'Districts and cities',
    districtsHint: 'Districts and cities inside the regions',
    regionsWithListings: 'Regions with listings',
    regionsWithListingsHint: 'Regions with at least one active listing',
    districtsWithListings: 'Districts and cities with listings',
    districtsWithListingsHint: 'Districts and cities with at least one active listing',
    coverageTitle: 'Coverage',
    coverageSubtitle: 'These are the places that actually have listings, not the whole directory.',
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
    regionLabel: 'Region',
    districtLabel: 'District or city',
    metroLabel: 'Metro station',
    roomsLabel: 'Number of rooms',
    audienceLabel: 'Who it is for',
    priceLabel: 'Monthly price (so‘m)',
    priceMinPlaceholder: 'from — 1,000,000',
    priceMaxPlaceholder: 'up to — 10,000,000',
    priceAny: 'Any price',
    areaLabel: 'Minimum area (m²)',
    areaPlaceholder: 'For example: 40',
    sortLabel: 'Sort by',
    amenitiesLabel: 'Amenities',
    amenitiesHint: 'Only homes that have every amenity you pick are shown.',
    advancedShow: 'More options',
    advancedHide: 'Hide the extra options',
    reset: 'Reset the options',
    resultsHint: '{count} listings match these options',
  },
} as const;
