/**
 * Student programme page — English.
 */
export const student = {
  hero: {
    eyebrow: 'Student programme',
    title: 'Safe homes close to your university',
    subtitle:
      'Affordable, broker-free rentals around the major universities of Tashkent — '
      + 'every listing screened by AI.',
    bonusLabel: 'Student bonus',
    bonusValue: 'A free listing boost',
    bonusHint: 'Once your student ID is verified',
  },

  picker: {
    title: 'Choose your university',
    select: 'Select {name}',
  },

  selected: {
    eyebrow: 'Selected university',
    location: '{district} district, {city}',
    nearby: 'Listings near {name}',
    viewAll: 'View all',
  },

  empty: {
    title: 'No listings found near {name}',
    body: 'Pick another university, or widen your search on the listings page.',
    cta: 'Browse listings',
  },

  error: {
    title: 'Could not load listings',
  },
} as const;
