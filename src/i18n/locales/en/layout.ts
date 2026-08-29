/** Header, bottom navigation, footer, and global system messages. */
export const layout = {
  nav: {
    home: 'Home',
    listings: 'Listings',
    map: 'Map',
    favorites: 'Saved',
    chat: 'Messages',
    profile: 'Profile',
    myListings: 'My listings',
    createListing: 'Post a listing',
    verification: 'Verification',
    referral: 'Invite a friend',
    studentProgram: 'Student programme',
    ecosystem: 'Ecosystem',
    admin: 'Admin',
    help: 'Help',
    search: 'Search',
    more: 'More',
    settings: 'Settings',
    notifications: 'Notifications',
    support: 'Support',
  },

  header: {
    createListingCta: 'Post a listing',
    savedCount: 'Saved ({count})',
    loginOrRegister: 'Sign in / Sign up',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    // The header drawer is a Sheet now, so it has a real heading instead of
    // an unlabelled panel that a screen reader announced as “dialog”.
    menuTitle: 'Menu',
    menuSubtitle: 'Sections, categories and your account',
    drawerCategories: 'Categories',
    drawerQuickLinks: 'Quick links',
    drawerSettings: 'Settings',
    skipToContent: 'Skip to main content',
    // The accessible name of the primary <nav> in the middle of the bar —
    // the four section links themselves, which are visible text and need no
    // eyebrow. Distinct from `categories.chooseSection`, which heads the ten
    // category tiles inside the browse panel that nav's last control opens.
    browseSections: 'Sections',
    // The bar carries one glyph for both preferences now, so its label has to
    // name both; neither `common.language.label` nor `common.theme.label`
    // describes what pressing it opens.
    settingsAria: 'Language and appearance',
    // Not `nav.profile`: the avatar opens a menu, it no longer navigates to
    // the profile page, and calling it "Profile" would lie to a screen reader.
    accountAria: 'Account menu',
    mapSearchAria: 'Search on the map',
    backAria: 'Go back',
  },

  categories: {
    label: 'Categories',
    chooseSection: 'Choose a section',
    popularDistricts: 'Popular districts',
    roommate: {
      title: 'Shared / roommate',
      description: 'A roommate for students and tenants',
    },
    student: {
      title: 'For students',
      description: 'Affordable homes near universities',
    },
    family: {
      title: 'For families',
      description: 'Cosy homes with 2 or more rooms',
    },
    metro: {
      title: 'Near the metro',
      description: '10 minutes on foot to the station',
    },
    budget: {
      title: 'Budget-friendly',
      description: "Up to 3 million so'm",
    },
    premium: {
      title: 'Highly trusted',
      description: 'From verified homeowners',
    },
    qizlarga: {
      title: 'For women',
      description: 'Rooms and shared homes for female tenants only',
    },
    komfort: {
      title: 'Comfort',
      description: 'Furnished, with AC, a washing machine and internet',
    },
    center: {
      title: 'Central',
      description: 'Homes in the central districts of the city',
    },
    hovli: {
      title: 'House',
      description: 'Houses with a yard — private entrance and your own plot',
    },
  },

  sidebar: {
    guestTitle: 'Welcome',
    guestSubtitle: 'Sign in to post listings and contact homeowners directly',
    level: 'Level {level}',
    xpPoints: '{count} XP',
    xpToNext: '{count} XP to the next level',
    settings: 'Settings',
  },

  footer: {
    about: 'About the platform',
    aboutText:
      'Maklersiz Uy is a platform for finding rental housing in Uzbekistan directly '
      + 'from the owner, without a broker. 0% commission.',
    forTenants: 'For tenants',
    forOwners: 'For homeowners',
    company: 'Company',
    legal: 'Legal',
    terms: 'Terms of use',
    privacy: 'Privacy policy',
    safety: 'Safety rules',
    guides: 'Guides',
    contact: 'Contact',
    support: 'Support',
    faq: 'Frequently asked questions',
    followUs: 'Social media',
    rights: '© {year} Maklersiz Uy. All rights reserved.',
    madeIn: 'Made in Uzbekistan',
    // The helpline is a separate group from the `support` link above it: that
    // one goes to a page, this one is the number somebody can dial now. It is
    // `supportBlock` rather than `support` because `support` is already the
    // footer's link label and the footer still renders it.
    supportBlock: {
      title: 'Need help?',
      // The row's own call to action. It is a word, not an icon, because the
      // row is a `tel:` link and nothing else on it says what pressing does.
      call: 'Call',
      phoneAria: 'Call {phone}',
      hours: 'Every day 09:00 – 21:00',
    },
  },

  splash: {
    loading: 'Loading listings and map...',
  },

  toast: {
    listingCreated: 'Listing posted successfully!',
    listingUpdated: 'Listing updated.',
    listingDeleted: 'Listing deleted.',
    listingRejected: 'Listing did not pass moderation.',
    favoriteAdded: 'Added to saved.',
    favoriteRemoved: 'Removed from saved.',
    roleSwitched: 'Role changed to "{role}".',
    avatarUpdated: 'Profile photo updated.',
    languageChanged: 'Language changed.',
    themeChanged: 'Appearance changed.',
    copiedLink: 'Link copied.',
    xpEarned: '+{amount} XP — {reason}',
    welcomeOwner: 'Welcome! You can now post listings.',
    welcomeStudent: 'Welcome! Find your flat without a broker.',
    sessionExpired: 'Your session has expired. Please sign in again.',
  },

  offline: {
    title: 'No internet connection',
    body: 'Check your connection — the page will refresh automatically.',
  },
} as const;
