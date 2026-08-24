/**
 * Referral programme — English.
 */
export const growth = {
  hero: {
    eyebrow: 'Referral programme',
    title: 'Invite your friends and earn rewards',
    subtitle:
      'Every friend who signs up through your link earns you experience points '
      + 'and unlocks new features.',
  },

  code: {
    label: 'Your referral code',
    linkLabel: 'Referral link',
    copyLink: 'Copy referral link',
    copied: 'Link copied',
    copyFailed: 'Could not copy the link. Please select it manually.',
    missingTitle: 'No referral code yet',
    missingBody: 'A code is being prepared for your account. Check back in a little while.',
    guestTitle: 'Sign in to get your referral code',
    guestBody: 'Once you register, you get a personal referral code and link.',
    guestCta: 'Sign in',
  },

  xp: {
    label: 'Experience points',
    value: '{count} XP',
    hint: 'Points are earned by completing your profile, verifying it and staying active.',
  },

  rewards: {
    title: 'Referral rewards',
    subtitle: 'What unlocks as the number of invited friends grows',
    friends: '{count} friends',
    xpTitle: 'Experience points',
    xpDesc: 'Extra XP for every friend you invite',
    badgeTitle: 'Referral badge',
    badgeDesc: 'A dedicated mark appears on your profile',
    premiumTitle: 'Premium search',
    premiumDesc: 'Advanced search free for one month',
    boostTitle: 'Listing boost',
    boostDesc: 'One free boost for a listing of yours',
    vipTitle: 'VIP membership',
    vipDesc: 'A VIP badge and priority in search results',
    ambassadorTitle: 'Campus ambassador',
    ambassadorDesc: 'Official ambassador status at your university',
  },

  progress: {
    title: 'Invited friends',
    unavailable: 'The number of invited friends is not tracked yet.',
  },

  leaderboard: {
    title: 'Top referrers',
    unavailableTitle: 'Leaderboard is not available yet',
    unavailableBody:
      'The referral leaderboard is not ready on the server yet. It will appear here as soon as it is.',
  },
} as const;
