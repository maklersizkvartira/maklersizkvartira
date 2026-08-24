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
  },

  header: {
    createListingCta: 'Post a listing',
    savedCount: 'Saved ({count})',
    loginCta: 'Sign in',
    registerCta: 'Sign up',
    loginOrRegister: 'Sign in / Sign up',
    searchPlaceholder: 'Search...',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
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
    contact: 'Contact',
    support: 'Support',
    faq: 'Frequently asked questions',
    followUs: 'Social media',
    rights: '© {year} Maklersiz Uy. All rights reserved.',
    madeIn: 'Made in Uzbekistan',
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
