/**
 * The listings surface — the platform's main showcase.
 */
export const listings = {
  page: {
    title: 'Listings',
    subtitle: 'Contact the lister directly — free to post',
    metaTitle: 'Apartments for rent — Uyiz',
    resultCount: '{count} listings found',
    resultCountFiltered: '{count} listings match your filters',
    searchPlaceholder: 'Search by district, metro or keyword',
    view: {
      grid: 'Grid view',
      list: 'List view',
      map: 'Map view',
    },
  },

  /**
   * The filter bar and the filter sheet.
   *
   * Separate from `common.filters` on purpose: those are the words a filter
   * is called anywhere in the app, these are the ones the listings surface
   * puts on its own chips, its sort menu and its "show results" button.
   */
  filters: {
    title: 'Filters',
    subtitle: 'Tune the search to what you need',
    openAria: 'Open the filters',
    closeAria: 'Close the filters',
    activeCount: '{count} filters active',
    activeNone: 'No filters selected',
    clearAll: 'Clear all',
    clearOne: 'Remove the “{label}” filter',
    apply: 'Apply',
    showResults: 'Show {count} listings',
    showResultsNone: 'No listings match',
    more: 'More filters',
    less: 'Fewer filters',

    quickLabel: 'Quick filters',
    quick: {
      all: 'All',
      roommate: 'Shared',
      student: 'For students',
      family: 'For families',
      metro: 'Near the metro',
      budget: 'Budget',
      premium: 'Highly trusted',
      qizlarga: 'For women',
      komfort: 'Comfort',
      center: 'Central',
      hovli: 'House',
      verified: 'Verified',
      noDeposit: 'No deposit',
      newest: 'Newest',
      petsAllowed: 'Pets allowed',
    },

    priceTitle: 'Monthly price',
    minPrice: 'Minimum price (so‘m)',
    maxPrice: 'Maximum price (so‘m)',
    minPricePlaceholder: '1,000,000',
    maxPricePlaceholder: '10,000,000',
    priceHint: 'Leave it empty to apply no price limit.',

    areaTitle: 'Area',
    minArea: 'Minimum area (m²)',
    maxArea: 'Maximum area (m²)',
    minAreaPlaceholder: '30',
    maxAreaPlaceholder: '120',

    roomsTitle: 'Number of rooms',
    amenitiesTitle: 'Amenities',
    locationTitle: 'Location',

    sortBy: 'Sort by',
    sort: {
      recommended: 'Recommended',
      newest: 'Newest first',
      priceLow: 'Cheapest first',
      priceHigh: 'Most expensive first',
      trust: 'By trust score',
      areaLarge: 'Largest first',
      popular: 'Popular',
    },
  },

  featured: {
    title: 'Featured listings',
    subtitle: 'The most trusted and popular offers',
    badge: 'Ad',
    vipTitle: 'VIP listings',
    topBadge: 'Top',
    empty: 'No featured listings yet',
  },

  card: {
    perMonth: 'per month',
    deposit: 'Deposit: {amount}',
    noDeposit: 'No deposit',
    utilitiesIncluded: 'Utilities included',
    roomsAndArea: '{rooms} rooms · {area} m²',
    floor: 'Floor {floor}/{total}',
    metro: '{station} — {minutes} min',
    university: '{minutes} min to {name}',
    viewsCount: 'Viewed {count} times',
    postedAgo: 'Posted {time}',
    roommateSpots: '{count} spots available',
    contactOwner: 'Contact the owner',
    showPhone: 'Show number',
    phoneHidden: 'Sign in to see the number',
    saveListing: 'Save',
    savedListing: 'Saved',
    shareListing: 'Share listing',
    shareText: '{title} — {price}. On Uyiz!',
    // The card's closing chip and the price block on the detail page. It says
    // what the platform actually guarantees — you reach whoever published the
    // listing yourself — rather than making a promise about their fee.
    directContact: 'Direct contact',
    // The card carousel. Dots are buttons, so each one needs a name a screen
    // reader can read; the live region reads the position after a swipe.
    photoCarousel: '{title} — listing photos',
    photoDot: 'Go to photo {index}',
    photoPosition: '{current} / {total}',
    photoNext: 'Next photo',
    photoPrev: 'Previous photo',
    photoNone: 'No photo',
    photoCount: '{count} photos',
  },

  detail: {
    aboutTitle: 'About this listing',
    amenitiesTitle: 'Amenities',
    locationTitle: 'Location',
    ownerTitle: 'Owner',
    safetyTitle: 'Safety',
    similarTitle: 'Similar listings',
    priceTitle: 'Price and terms',
    memberSince: 'Member since {date}',
    ownerListings: 'Has {count} listings',
    contactHours: 'Contact hours: {time}',
    reportListing: 'Does this listing look suspicious?',
    backToList: 'Back to listings',
    imageOf: '{current} / {total}',
    notFoundTitle: 'Listing not found',
    notFoundBody: 'It may have been removed, or the link is incorrect.',
    districtNamed: '{name} district',
    floorLabel: 'Floor',
    showImage: 'Show photo {index}',
    photoOf: '{title} — photo {index}',
    viewOnMap: 'Show on map',
    ownerRentals: '{count} successful rentals',
    utilitiesExcluded: 'Utilities billed separately',

    /**
     * The reliability figure, said plainly.
     *
     * It is not a machine's opinion of the listing: every listing starts at
     * 100 and the only thing that moves the number is an administrator
     * confirming a complaint about it. These four strings are the whole
     * explanation the reader gets, so they must not imply any other check.
     */
    trustTitle: 'Reliability',
    trustSubtitle: 'Calculated from confirmed complaints',
    trustExplainer:
      'Every listing starts at 100. The score falls only when an '
      + 'administrator confirms a complaint about it.',
    trustNoComplaints: 'No complaint about this listing has been confirmed.',
    trustHasComplaints: 'A complaint about this listing has been confirmed.',
    /** Hover text for the score chip on the card and in the page heading. */
    trustTooltip: 'Reliability: {score}/100. It drops only on a confirmed complaint.',
    /**
     * The owner chip in the sidebar shows the USER's score, which still rises
     * on verification — a different rule from the listing figure above, so it
     * gets its own label rather than borrowing one that mentions complaints.
     */
    ownerTrustScore: 'Owner trust: {score}',
    ownerToolbar: 'You own this listing',
    confirmDelete: 'Delete this listing permanently?',
    amenityAvailable: 'available',
    amenityUnavailable: 'not available',
    chatUnavailable: 'Chat is temporarily unavailable. Contact the owner by phone.',
    phoneUnavailable: 'The owner has hidden their number. Use another way to get in touch.',
    telegramContact: 'Message on Telegram',
  },

  amenities: {
    furnished: 'Furnished',
    parking: 'Parking',
    internet: 'Internet',
    airConditioning: 'Air conditioning',
    washingMachine: 'Washing machine',
    petsAllowed: 'Pets allowed',
    utilitiesIncluded: 'Utilities',
    virtualTour: '3D tour',
  },

  propertyType: {
    apartment: 'Flat',
    house: 'House',
    room: 'Room',
    studio: 'Studio',
    dormitory: 'Dormitory',
  },

  seller: {
    ownerLabel: 'Owner',
    agentLabel: 'Real-estate agent',
    ownerBadge: 'From the owner',
    agentBadge: 'Through an agent',
    agency: 'Agency: {name}',
    filterLabel: 'Posted by',
    filterAll: 'Anyone',
    filterOwner: 'Owners only',
    filterAgent: 'Agents',
    contactAgent: 'Contact the agent',
    trustAgent: 'Agent trust: {score}',
    phoneUnavailableAgent: 'The agent has hidden their number. Use another way to get in touch.',
  },

  empty: {
    title: 'No listings match these criteria',
    body: 'Try widening your filters or choosing another district.',
    cta: 'Clear filters',
    noListingsTitle: 'No listings yet',
    noListingsBody: 'Be the first to post a listing — it is completely free.',
    noListingsCta: 'Post a listing',
  },

  safety: {
    title: 'Safe renting rules',
    tip1: 'Never transfer money before seeing the property.',
    tip2: 'Pay the deposit only after the contract is signed.',
    tip3: 'Ask the owner for documents (title deed or passport).',
    tip4: 'Agree every payment term in writing before you pay anything.',
    reportCta: 'Report a suspicious listing',
  },

  report: {
    title: 'Send a report',
    subtitle: 'Choose what is wrong',
    reasonLabel: 'Reason',
    // No "this is a broker listing" reason: professional agents publish here
    // too, so it is not something to complain about — and a confirmed report
    // now costs the listing real reliability points.
    reasons: {
      scam: 'Fraud',
      fakeListing: 'Fake listing',
      fakePhotos: 'Photos are of another property',
      wrongPrice: 'Wrong price',
      spam: 'Spam',
      harassment: 'Inappropriate behaviour',
      other: 'Other reason',
    },
    detailsLabel: 'Additional comment',
    detailsPlaceholder: 'Briefly describe what happened...',
    submit: 'Send report',
    success: 'Your report has been received. We will review it shortly.',
  },
} as const;
