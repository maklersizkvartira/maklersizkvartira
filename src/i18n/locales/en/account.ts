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
    granted: {
      title: 'You have been given a special role',
      description:
        'The «{role}» role is granted by an administrator and cannot be changed here. Every capability is available.',
    },
    title: 'Your role',
    subtitle: 'You can switch roles at any time.',
    owner: {
      title: 'Owner',
      description: 'Post apartment listings',
    },
    agent: {
      title: 'Real-estate agent',
      description: 'Post on an owner’s behalf',
    },
    student: {
      title: 'Student',
      description: 'Search for an apartment',
    },
    active: 'Current role',
    agencyTitle: 'Your agency',
    agencySubtitle: 'This name is shown beside your listings.',
    agencyLabel: 'Agency name',
    agencyPlaceholder: 'For example: Zamin Realty',
    agencyHint: 'Optional — leave it blank if you work independently.',
    agencySaved: 'Agency name saved.',
    agencyFailed: 'Could not save the agency name.',
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
    loadError: 'Could not load your sessions. Please try again.',
    reload: 'Reload the list',
    // A person recognises their own row by the device and the browser, not by
    // a session id — and they must be able to see which row is the one they
    // are reading it on, so they do not sign themselves out by accident.
    current: 'This device',
    browser: 'Browser',
    lastSeen: 'Last active',
    revoke: 'End session',
    revokeConfirm: 'End the session on this device?',
    revokeAll: 'Sign out of all other devices',
    revoked: 'The session was ended.',
    revokeFailed: 'The session could not be ended.',
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
