/**
 * Owner surfaces: create listing wizard, edit modal, my listings.
 *
 * English strings. The key shape mirrors the Uzbek file exactly — the
 * compiler rejects a missing, renamed or extra key.
 */
export const owner = {
  gate: {
    signInTitle: 'Sign in first',
    signInBody: 'Sign in as a property owner to post a listing.',
    studentTitle: 'Students cannot post listings',
    studentBody: 'This section is for owners only. You can still search and view apartments.',
    browseCta: 'Browse apartments',
    switchToOwner: 'Switch to owner mode',
    switchFailed: 'Could not switch your role. Please try again.',
    myListingsTitle: 'Owners only',
    myListingsBody: 'Sign in as a property owner to see your listings and their stats.',
  },

  create: {
    breadcrumb: 'Post a listing',
    title: 'Post your listing',
    subtitle:
      'Four simple steps — your listing is ready in three minutes. No brokers, straight to tenants.',
    stepCounter: 'Step {current} of {total}',
    stepBadge: 'Step {step}',
    errorsTitle: 'Please fix the following fields:',

    steps: {
      locationTitle: '1. Address',
      locationHint: 'Where is the property?',
      detailsTitle: '2. Property details',
      detailsHint: 'Rooms, area, price',
      photosTitle: '3. Photos',
      photosHint: 'At least 3 photos',
      contactTitle: '4. Contact',
      contactHint: 'How will tenants reach you?',
    },

    next: {
      toDetails: 'Next: property details',
      toPhotos: 'Next: photos',
      toContact: 'Next: contact and review',
    },

    location: {
      heading: 'Address and location',
      subheading: 'Which district and street is the apartment on?',
      regionLabel: 'Region / city',
      districtLabel: 'District',
      addressLabel: 'Street and landmark (exact address)',
      addressPlaceholder:
        'For example: Mustaqillik avenue 14 (landmark: Mirzo Ulugbek metro station)',
      gpsDetect: 'Detect with GPS',
      gpsDetecting: 'Detecting...',
      gpsDetected: 'GPS detected',
      gpsFound: 'Address found by GPS: {region}, {district}, {address}',
      gpsCoordinates: 'GPS coordinates detected: {latitude}, {longitude}',
      gpsDenied: 'GPS permission was denied. Please type the address instead.',
      gpsUnsupported: 'Your device does not support GPS.',
      metroLabel: 'Nearest metro station',
      metroNone: 'None (no metro nearby)',
      metroOption: '{station} station',
      metroMinutesLabel: 'Walking distance to metro (minutes)',
    },

    details: {
      heading: 'Property and rental details',
      subheading: 'Number of rooms, monthly price and amenities',
      rentalTypeLabel: 'Rental type',
      whole: 'Whole apartment',
      roommate: 'Shared room',
      roommateHeading: 'Sharing conditions',
      roommateGenderLabel: 'Who can share?',
      roommateGenderAny: 'Anyone',
      roommateGenderBoys: 'Men only',
      roommateGenderGirls: 'Women only',
      roommateSpotsLabel: 'How many roommates do you need?',
      roommateSpotsOption: '{count} roommate(s)',
      roommateSpotsPlus: '{count}+ roommates',
      titleLabel: 'Listing title',
      titlePlaceholder: 'For example: cosy 2-room apartment in Yunusobod, block 4',
      descriptionLabel: 'Full description',
      descriptionPlaceholder:
        'Describe the conditions, the state of the renovation and the neighbours...',
      priceLabel: 'Monthly price (so‘m)',
      priceApprox: '≈ {amount} / month',
      depositLabel: 'Deposit amount (so‘m)',
      areaLabel: 'Area (m²)',
      floorLabel: 'Floor',
      totalFloorsLabel: 'Total floors',
      amenitiesLabel: 'Available amenities',
    },

    photos: {
      heading: 'Apartment photos and video',
      subheading: 'Upload at least 3 good photos — more photos means more tenants.',
      dropTitle: 'Click to upload photos',
      dropBody: 'Pick photos from your phone or gallery (JPG, PNG, WEBP).',
      dropCta: 'Choose files ({count} uploaded)',
      uploadedTitle: 'Your uploaded photos',
      coverBadge: 'Cover photo',
      imageAlt: 'Photo {index}',
      removeImage: 'Remove photo {index}',
      emptyHint: 'You have not uploaded any photos yet. Click the area above to pick some.',
      limitNotice: 'You can upload up to {max} photos.',
      limitReached: 'Photo limit reached: {max}.',
      sizeNotice: 'Uploaded size: {size} MB of {max} MB.',
      readFailed: 'Some files could not be read. Please choose different photos.',
      videoLabel: 'Apartment video tour',
      videoDropTitle: 'Pick a video from your phone',
      videoDropBody: 'A short clip in MP4, MOV or WEBM format.',
      videoCta: 'Upload video',
      videoUploaded: 'Video uploaded',
      videoRemove: 'Remove video',
      videoUploadUnsupported: 'Direct video upload is not available yet. Upload the clip to YouTube and paste the link.',
    },

    contact: {
      heading: 'Contact and safety check',
      subheading: 'How will tenants get in touch with you?',
      phoneLabel: 'Your phone number',
      phoneHint: 'The number comes from your profile. Change it in your profile settings.',
      phoneMissing: 'Your profile has no phone number.',
      telegramLabel: 'Telegram username',
      telegramPlaceholder: '@username',
      timeLabel: 'Preferred contact hours',
      timePlaceholder: 'Every day 09:00 – 21:00',
    },

    moderation: {
      title: 'Run the listing check',
      body: 'Send the title, description and price through the automated check before publishing.',
      runCta: 'Start the check',
      rerunCta: 'Check again',
      scanning: 'Checking your listing...',
      scanningBody: 'Broker signals, fraud patterns and price sanity are being analysed.',
      passedTitle: 'The check passed',
      passedBody: 'Your listing follows the rules. You can publish it now.',
      blockedTitle: 'The listing did not pass the check',
      blockedBody: 'Fix the reasons listed below and run the check again.',
      reasonsTitle: 'Reasons',
      riskScore: 'Risk level: {score}',
      provider: 'Checked by: {provider}',
      failed: 'The check could not be completed. Please try again later.',
      editCta: 'Edit the text',
      rejectedTitle: 'The listing did not pass moderation',
      rejectedBody:
        'Your listing was saved but is not visible yet because it did not pass moderation. Fix the points below.',
      goToMyListings: 'My listings',
    },

    ai: {
      writeCopy: 'Let AI write the text',
      suggestPrice: 'Let AI suggest a price',
      photoTitle: 'AI photo analysis and price suggestion',
      photoBody:
        'AI reads the condition of the apartment from your photos and suggests a price based on nearby listings.',
      unavailable:
        'This feature is unavailable for now: AI analysis moved to the server. Please write the text and set the price yourself.',
    },

    submit: 'Publish the listing',
    submitting: 'Submitting...',
    submitFailed: 'The listing could not be submitted. Check your connection and try again.',

    rules: {
      title: 'What makes a good listing',
      subtitle: 'Tips for a fast and trustworthy rental',
      photos: 'Post real photos — pictures taken from the internet are rejected.',
      price: 'State the exact monthly price.',
      address: 'Write the address with a landmark so tenants find you quickly.',
      terms: 'Spell out the deposit and utility terms in the description.',
      freeTitle: '100% free to post',
      freeBody:
        'Posting a listing is completely free. We take no commission — tenants contact you directly.',
      badgeTitle: 'Verified owner badge',
      badgeCta: 'Get the trust badge',
    },

    validation: {
      address: 'Enter the street and the exact address.',
      metroMinutes: 'The metro distance must be between 1 and 60 minutes.',
      title: 'The title must be at least 8 characters long.',
      description: 'The description must be at least 20 characters long.',
      price: 'Enter a valid monthly price.',
      deposit: 'The deposit must be 0 or more.',
      area: 'Enter a valid area.',
      floor: 'The floor must be between 1 and the total number of floors.',
      images: 'Upload at least 3 real photos.',
      imagesTooLarge:
        'Photos and video add up to {size} MB, over the {max} MB limit. Upload fewer or smaller files.',
      phone: 'Add a working phone number to your profile.',
    },
  },

  edit: {
    title: 'Edit listing',
    subtitle: 'Change the details and save',
    saveFailed: 'The changes could not be saved.',
  },

  my: {
    title: 'My listings and stats',
    subtitle: 'Track how many people viewed, saved and contacted you about your listings.',
    createCta: 'Post a new listing',
    listTitle: 'Stats per listing ({count})',

    stats: {
      views: 'Total views',
      viewsHint: 'People who opened your listings',
      favorites: 'Saves',
      favoritesHint: 'People who added them to favourites',
      contacts: 'Contacts',
      contactsHint: 'People who revealed the number',
      listings: 'Active listings',
      listingsHint: 'Listings you have posted',
    },

    metrics: {
      views: 'Views',
      viewsHint: 'Opened the page',
      favorites: 'Saves',
      favoritesHint: 'Added to favourites',
      contacts: 'Contacts',
      contactsHint: 'Tapped the phone number',
      conversion: 'Conversion: {rate}%',
      conversionHint: 'Contacts as a share of views',
    },

    empty: {
      title: 'You have not posted a listing yet',
      body: 'Post your apartment for free, with no commission.',
      cta: 'Post a listing',
    },

    error: {
      title: 'Could not load your listings',
      body: 'No connection to the server. Please try again.',
    },

    districtLabel: '{district} district',
    deleteConfirm: 'Delete this listing? This cannot be undone.',
    openListing: 'Open the listing',
    chatMetricUnavailable:
      'Chat stats are unavailable for now — the messaging system is moving to the server.',

    moderation: {
      title: 'Moderation status',
      reasons: 'Moderator notes',
      verificationRequired: 'Verification required',
      noReasons: 'No further notes.',
    },
  },
} as const;
