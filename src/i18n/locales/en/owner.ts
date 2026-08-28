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
      gpsTitle: 'Detect the location automatically',
      gpsHint: 'One tap fills the region, district and street for you.',
      gpsDetect: 'Detect with GPS',
      gpsDetecting: 'Detecting...',
      gpsDetected: 'GPS detected',
      gpsFound: 'Address found by GPS: {region}, {district}, {address}',
      gpsCoordinates: 'GPS coordinates detected: {latitude}, {longitude}',
      // The Geolocation API reports three different failures and the button
      // used to call all of them "permission denied", which sent people to
      // the browser settings to fix a timeout they could have fixed by
      // stepping outside.
      gpsDenied: 'GPS permission was denied. Allow it in your browser settings, or type the address.',
      gpsTimeout: 'GPS did not answer. Step outside and try again, or type the address.',
      gpsUnavailable: 'Your location could not be determined. The signal may be weak.',
      gpsPrompt: 'Your browser is asking for location access — choose “Allow”.',
      gpsSearching: 'Looking for your location...',
      gpsSuccess: 'Location detected.',
      gpsUnsupported: 'Your device does not support GPS.',
      metroLabel: 'Nearest metro station',
      metroNone: 'None (no metro nearby)',
      metroOption: '{station} station',
      metroChoose: 'Choose a station',
      metroSearch: 'Type a station name...',
      metroNoMatch: 'No station matches that',
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
      // These fields start empty now. A seeded number reads as an answer, and
      // people published it unchanged; a placeholder reads as an example.
      pricePlaceholder: 'For example: 4,000,000',
      depositPlaceholder: 'Enter 0 if there is no deposit',
      areaPlaceholder: 'For example: 54',
      floorPlaceholder: 'For example: 3',
      totalFloorsPlaceholder: 'For example: 9',
      roomsPlaceholder: 'For example: 2',
    },

    /**
     * One label per amenity key the form toggles.
     *
     * `listings.amenities.*` describes an amenity on a published listing
     * ("Pets allowed"); these are the words on the wizard's own checkboxes,
     * keyed exactly as the form's state is.
     */
    amenities: {
      furnished: 'Furnished',
      utilities: 'Utilities included in the price',
      airConditioning: 'Air conditioning',
      washingMachine: 'Washing machine',
      internet: 'Internet / Wi-Fi',
      parking: 'Parking',
      pets: 'Pets allowed',
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
      // Said once, before the upload, instead of only as an error afterwards.
      countHint: 'At least {min} photos, at most {max}.',
      sizeHint: 'All files together up to {max} MB.',
      countAndSizeHint: '{min}–{max} photos, up to {size} MB in total.',
      remainingHint: 'You can add {count} more photos.',
    },

    contact: {
      heading: 'Contact and safety check',
      subheading: 'How will tenants get in touch with you?',
      phoneLabel: 'Your phone number',
      phoneHint: 'The number comes from your profile. Change it in your profile settings.',
      phoneMissing: 'Your profile has no phone number.',
      telegramLabel: 'Telegram username',
      telegramPlaceholder: '@username',
      telegramHint: 'Start with @. Latin letters, digits and underscores only.',
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

    /**
     * Draft persistence.
     *
     * The wizard is four steps long and a mis-tapped back gesture used to
     * empty all four, so the answers are kept and the exit is confirmed.
     */
    draft: {
      restored: 'Your saved draft was restored.',
      restoredAt: 'Restored the draft saved at {time}.',
      discard: 'Discard the draft',
      discarded: 'The draft was discarded.',
      saved: 'Draft saved',
      confirmLeaveTitle: 'Leave without finishing the listing?',
      confirmLeaveBody:
        'What you have entered is kept as a draft, and you will continue from the same place.',
      stay: 'Stay here',
      leave: 'Leave',
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
      telegram: 'That Telegram username is not valid. For example: @dilshod_karimov',
      limitReached: 'You have reached the limit of {max} active listings. Delete an old one first.',
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
      contacts: 'Wanted to call',
      contactsHint: 'Revealed your number',
      messages: 'Wanted to message',
      messagesHint: 'Started a chat with you',
      listings: 'Active listings',
      listingsHint: 'Listings you have posted',
    },

    metrics: {
      views: 'Views',
      viewsHint: 'Opened the page',
      favorites: 'Saves',
      favoritesHint: 'Added to favourites',
      contacts: 'Calls',
      contactsHint: 'Revealed the number',
      messages: 'Messages',
      messagesHint: 'Opened a chat',
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

    moderation: {
      title: 'Moderation status',
      reasons: 'Moderator notes',
      verificationRequired: 'Verification required',
      noReasons: 'No further notes.',
    },
  },

  /**
   * The account-wide statistics panel.
   *
   * Distinct from `owner.my.stats`, which labels the tiles on one listing's
   * row: these count every listing the owner has, moderation states included.
   */
  stats: {
    title: 'My listings and statistics',
    subtitle: 'Combined figures across every listing you have.',
    totalListings: 'Total listings',
    approved: 'Approved',
    pending: 'Under review',
    rejected: 'Rejected',
    views: 'Views',
    favorites: 'Saved',
    contacts: 'Contact requests',
    avgTrust: 'Average trust score',
    empty: 'There is nothing to report yet — post your first listing.',
    emptyCta: 'Post a listing',
  },
} as const;
