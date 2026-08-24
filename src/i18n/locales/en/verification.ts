/**
 * Identity and property verification flow.
 *
 * English strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const verification = {
  page: {
    eyebrow: 'Trust verification centre',
    title: 'Triple the trust and the visibility of your listing',
    subtitle:
      'Verify your documents as an owner — your listing gets the green "Verified owner" badge, and students and tenants contact you directly.',
    trustLabel: 'Your trust score',
    xp: '{count} XP',
    currentLevel: 'Your current level: {level}',
    levelZero: 'Starting level',
    guestTitle: 'Sign in to start verification',
    guestBody: 'Sign in to your account to submit documents and follow your requests.',
  },

  compare: {
    eyebrow: 'Side by side',
    title: 'How will my listing look once it is verified?',
    subtitle:
      'Verified listings rank higher in search and earn a tenant’s trust straight away.',
    note: 'Both listings below are examples only.',
    exampleTitle: 'Cosy 2-room apartment, Yunusobod',
    beforeLabel: 'Unverified listing',
    beforeHint: 'Standard look',
    beforeTag: 'Standard',
    beforeOwner: 'Owner: Dilshod',
    beforeTrust: 'Trust score: {score}',
    beforeConBadge: 'No badge — tenants may suspect a broker',
    beforeConRank: 'Appears lower in search results',
    afterLabel: 'Verified, trusted listing',
    afterHint: '3x more enquiries',
    afterBadge: 'Verified owner',
    afterRank: 'TOP #1',
    afterOwner: 'Owner: Dilshod K.',
    afterTrust: '{score}/100 trust score',
    afterProBadge: 'Full trust thanks to the green "Verified owner" badge',
    afterProRank: 'Top placement on the home page and in search',
  },

  ladder: {
    title: 'Verification levels',
    subtitle: 'Complete the steps in order to raise your trust level.',
    navLabel: 'Verification steps',
    stepAria: 'Level {level}: {title}',
  },

  steps: {
    l1: {
      short: 'Phone',
      reward: '+10 XP',
      title: 'Level 1: phone number verified',
      description: 'Your number was checked with an SMS code during sign-up.',
    },
    l2: {
      short: 'Passport',
      reward: '+50 XP',
      title: 'Level 2: passport or ID card',
      description: 'A copy of your document is reviewed to confirm your identity.',
    },
    l3: {
      short: 'Live selfie',
      reward: '+50 XP',
      title: 'Level 3: live selfie and liveness check',
      description: 'The selfie is compared with the photo on your document.',
    },
    l4: {
      short: 'Cadastre',
      reward: '+100 XP',
      title: 'Level 4: cadastre and property ownership',
      description: 'The property document confirms that the home is really yours.',
    },
    l5: {
      short: 'VIP',
      reward: 'VIP',
      title: 'Level 5: VIP verified owner',
      description: 'The highest level, for owners who completed every step.',
    },
  },

  step: {
    pendingTitle: 'Documents under review',
    pendingBody:
      'A moderator usually replies within 24 hours. You will get the result as a notification.',
    rejectedTitle: 'Documents rejected',
    rejectedReason: 'Reason: {reason}',
    rejectedNoReason: 'The moderator did not give a reason.',
    resubmit: 'Submit again',
    approvedTitle: 'Step verified',
    lockedTitle: 'Finish the previous step',
    lockedBody: 'This step unlocks once level {level} is verified.',
    next: 'Next step: {title}',
    submitting: 'Submitting...',
  },

  phone: {
    verified: 'Your phone number is verified with an SMS code.',
    pending: 'Your phone number is not verified yet. Confirm it in your profile.',
  },

  upload: {
    cta: 'Choose a file',
    hint: 'JPG, PNG or PDF · up to 4 MB',
    selected: 'File selected',
    replace: 'Choose another file',
    preview: 'Preview of the selected document',
    document: 'Document file uploaded',
    tooLarge: 'The file is too large. Choose a file under 4 MB.',
    failed: 'The file could not be read. Choose another file.',
  },

  passport: {
    docTypeLabel: 'Document type',
    passport: 'Passport',
    idCard: 'ID card',
    uploadTitle: 'Upload a photo of your passport or ID card',
    uploadSubtitle: 'Click to choose a file, or take a photo with your phone.',
    privacy:
      'Privacy guarantee: personal documents are never shown on a listing; they are stored encrypted and used only for verification.',
    submit: 'Send passport for review',
    approved: 'Your identity is verified.',
  },

  selfie: {
    cameraTitle: 'Open your camera',
    cameraBody:
      'The camera checks your face and its liveness. The shot is stored for verification only.',
    openCamera: 'Open camera',
    videoLabel: 'Live camera preview',
    guide: 'Line your face up inside the circle',
    capture: 'Take the photo',
    retake: 'Retake the photo',
    fromFile: 'Upload from a file',
    captured: 'Live selfie ready.',
    previewAlt: 'Captured selfie',
    denied:
      'Camera access was denied. Allow it in your browser settings, or upload a photo instead.',
    unsupported: 'This device has no camera. Upload a photo instead.',
    submit: 'Send selfie for review',
    approved: 'You passed the face and liveness check.',
  },

  cadastre: {
    codeLabel: 'Cadastre number',
    codePlaceholder: '10:01:04:02:01:0045',
    codeDisabled:
      'Automatic cadastre-number lookup is not available yet — upload a copy of the document and the moderator will read the number from it.',
    uploadTitle: 'Copy of the cadastre document (image or PDF)',
    uploadSubtitle: 'Click to choose the cadastre file.',
    submit: 'Send property document for review',
    approved: 'Ownership of your apartment is verified.',
  },

  vip: {
    body:
      'Congratulations! You are among the most trusted owners on the platform. Your listings take the top spots in search.',
    locked: 'This level unlocks once the previous four steps are verified.',
    myListings: 'My listings',
  },

  requests: {
    title: 'Submitted requests',
    subtitle: 'The status of each request and the moderator’s note.',
    empty: 'No requests submitted yet.',
    error: 'The request list could not be loaded.',
    level: 'Level {level}',
    reason: 'Rejection reason: {reason}',
    doc: {
      passport: 'Passport',
      idCard: 'ID card',
      cadastre: 'Cadastre document',
      selfie: 'Live selfie',
      unknown: 'Document',
    },
  },

  checker: {
    title: 'Check a phone number for trustworthiness',
    subtitle: 'To see whether a number belongs to a real owner or to a broker.',
    placeholder: '+998 90 123 45 67',
    submit: 'Check',
    unavailable:
      'This service is not available yet: the number lookup is still being built on the server. It will start working here as soon as it is ready.',
  },

  toast: {
    submitted: 'Your documents were sent for review.',
    failed: 'The documents could not be sent. Please try again.',
    fileRequired: 'Upload the document file first.',
  },
} as const;
