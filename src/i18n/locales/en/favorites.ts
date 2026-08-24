/**
 * Saved listings page — English.
 */
export const favorites = {
  page: {
    title: 'Saved listings',
    subtitle: 'Everything you marked with a heart is kept here',
    count: '{count} listings',
    browse: 'Go to listings',
  },

  empty: {
    title: 'No saved listings yet',
    body: 'Tap the heart on a listing and it will be kept on this page.',
    cta: 'Browse listings',
  },

  guest: {
    title: 'Sign in to see your saved listings',
    body: 'Once you sign in, your saved listings follow you across every device.',
    cta: 'Sign in',
  },

  error: {
    title: 'Could not load your saved listings',
  },
} as const;
