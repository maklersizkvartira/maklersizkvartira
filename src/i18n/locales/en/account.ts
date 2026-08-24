/**
 * Profile and account settings.
 *
 * English strings. Keys mirror `locales/uz/account.ts` exactly — the Uzbek
 * file is the source of truth for the key shape.
 */
export const account = {
  page: {
    title: 'Account settings',
    subtitle: 'Your profile details, security and app preferences.',
  },

  profile: {
    title: 'Profile details',
    avatarAlt: '{name} — profile photo',
    avatarChange: 'Change profile photo',
    avatarBadge: 'Photo',
    avatarHint: 'JPG or PNG, up to {size} MB.',
    avatarTooLarge: 'The photo must be smaller than {size} MB.',
    avatarWrongType: 'Only image files can be uploaded.',
    avatarReadFailed: 'Could not read that file. Please pick another one.',
    badgeOwner: 'Owner profile',
    badgeStudent: 'Student profile',
    captionOwner: 'Your photo is shown to tenants on your listing.',
    captionStudent: 'Your photo is shown to the owner in your chat.',
    nameSaved: 'Your name has been updated.',
    phone: 'Phone number',
    phoneLocked: 'Your phone number identifies your account and cannot be changed.',
    memberSince: 'Member since',
    trustScore: 'Trust score',
    verificationLevel: 'Verification level',
    xpPoints: 'XP points',
    verified: 'Verified account',
    notVerified: 'Unverified account',
    verify: 'Verify your account',
  },

  role: {
    title: 'Your role',
    subtitle: 'You can switch roles at any time.',
    owner: {
      title: 'Owner',
      description: 'Post apartment listings',
    },
    student: {
      title: 'Student',
      description: 'Search for an apartment',
    },
    active: 'Current role',
    switching: 'Switching...',
    switchFailed: 'Could not switch your role.',
    createListing: '+ Post a new listing',
  },

  preferences: {
    title: 'App preferences',
    languageHint: 'Your language is saved to your account and applies on every device.',
    themeHint: '“System” follows your device setting.',
  },

  security: {
    title: 'Security',
    passwordTitle: 'Password',
    passwordDescription: 'Update your password from time to time.',
    passwordNeverShown: 'Your password is never stored in the browser and never shown.',
  },

  sessions: {
    title: 'Active sessions',
    subtitle: 'Devices that are currently signed in to your account.',
    count: 'Active sessions: {count}',
    device: 'Device',
    ip: 'IP address',
    started: 'Signed in',
    expires: 'Expires',
    unknownDevice: 'Unknown device',
    unknownIp: 'IP unavailable',
    empty: 'No active sessions found.',
    loadFailed: 'Could not load your sessions.',
    reload: 'Reload the list',
  },

  signOut: {
    title: 'Sign out',
    thisDevice: 'Sign out on this device',
    allDevices: 'Sign out everywhere',
    allDevicesHint:
      'Every device is signed out and will need to sign in again next time.',
    confirmAll: 'Sign out on all devices?',
    failed: 'Something went wrong while signing out.',
  },
} as const;
