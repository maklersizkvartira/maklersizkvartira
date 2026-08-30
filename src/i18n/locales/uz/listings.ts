/**
 * The listings surface — the platform's main showcase.
 */
export const listings = {
  page: {
    title: 'E’lonlar',
    subtitle: 'To‘g‘ridan-to‘g‘ri bog‘lanish — e’lon joylash bepul',
    metaTitle: 'Ijaraga kvartiralar — Uyiz',
    resultCount: '{count} ta e’lon topildi',
    resultCountFiltered: 'Filtr bo‘yicha {count} ta e’lon',
    searchPlaceholder: 'Tuman, metro yoki kalit so‘z bo‘yicha qidiring',
    view: {
      grid: 'Katak ko‘rinishi',
      list: 'Ro‘yxat ko‘rinishi',
      map: 'Xaritada ko‘rish',
    },
  },

  /**
   * The filter bar and the filter sheet.
   *
   * Separate from `common.filters` on purpose: those are the words a filter
   * is called anywhere in the app, these are the ones the listings surface
   * puts on its own chips, its sort menu and its "show results" button.
   */
  filters: {
    title: 'Filtrlar',
    subtitle: 'Qidiruvni o‘zingizga moslang',
    openAria: 'Filtrlarni ochish',
    closeAria: 'Filtrlarni yopish',
    activeCount: '{count} ta filtr faol',
    activeNone: 'Filtr tanlanmagan',
    clearAll: 'Hammasini tozalash',
    clearOne: '“{label}” filtrini olib tashlash',
    apply: 'Qo‘llash',
    showResults: '{count} ta e’lonni ko‘rish',
    showResultsNone: 'Mos e’lon topilmadi',
    more: 'Ko‘proq filtr',
    less: 'Filtrlarni yig‘ish',

    quickLabel: 'Tezkor filtrlar',
    quick: {
      all: 'Barchasi',
      roommate: 'Sheriklikka',
      student: 'Talabalarga',
      family: 'Oilalarga',
      metro: 'Metro yaqinida',
      budget: 'Arzon',
      premium: 'Yuqori ishonchli',
      qizlarga: 'Qizlarga',
      komfort: 'Komfort',
      center: 'Markazda',
      hovli: 'Hovli',
      verified: 'Tasdiqlangan',
      noDeposit: 'Zakladsiz',
      newest: 'Eng yangi',
      petsAllowed: 'Uy hayvonlariga ruxsat',
    },

    priceTitle: 'Oylik narx',
    minPrice: 'Eng kam narx (so‘m)',
    maxPrice: 'Eng ko‘p narx (so‘m)',
    minPricePlaceholder: '1 000 000',
    maxPricePlaceholder: '10 000 000',
    priceHint: 'Bo‘sh qoldirsangiz narx bo‘yicha cheklov qo‘llanmaydi.',

    areaTitle: 'Maydon',
    minArea: 'Eng kam maydon (m²)',
    maxArea: 'Eng ko‘p maydon (m²)',
    minAreaPlaceholder: '30',
    maxAreaPlaceholder: '120',

    roomsTitle: 'Xonalar soni',
    amenitiesTitle: 'Qulayliklar',
    locationTitle: 'Joylashuv',

    sortBy: 'Saralash',
    sort: {
      recommended: 'Tavsiya etilgan',
      newest: 'Eng yangi',
      priceLow: 'Avval arzoni',
      priceHigh: 'Avval qimmati',
      trust: 'Ishonch reytingi bo‘yicha',
      areaLarge: 'Avval kattasi',
      popular: 'Ommabop',
    },
  },

  featured: {
    title: 'Tavsiya etilgan e’lonlar',
    subtitle: 'Eng ishonchli va ommabop takliflar',
    badge: 'Reklama',
    vipTitle: 'VIP e’lonlar',
    topBadge: 'Top',
    empty: 'Hozircha tavsiya etilgan e’lon yo‘q',
  },

  card: {
    perMonth: 'oyiga',
    deposit: 'Zaklad: {amount}',
    noDeposit: 'Zakladsiz',
    utilitiesIncluded: 'Kommunal to‘lov ichida',
    roomsAndArea: '{rooms} xona · {area} m²',
    floor: '{floor}/{total}-qavat',
    metro: '{station} — {minutes} daq.',
    university: '{name}gacha {minutes} daq.',
    viewsCount: '{count} marta ko‘rilgan',
    postedAgo: '{time} joylangan',
    roommateSpots: '{count} ta joy bor',
    contactOwner: 'Uy egasi bilan bog‘lanish',
    showPhone: 'Raqamni ko‘rsatish',
    phoneHidden: 'Raqamni ko‘rish uchun kiring',
    saveListing: 'Saqlash',
    savedListing: 'Saqlangan',
    shareListing: 'E’lonni ulashish',
    shareText: '{title} — {price}. Uyizda!',
    // The card's closing chip and the price block on the detail page. It says
    // what the platform actually guarantees — you reach whoever published the
    // listing yourself — rather than making a promise about their fee.
    directContact: 'To‘g‘ridan-to‘g‘ri aloqa',
    // The card carousel. Dots are buttons, so each one needs a name a screen
    // reader can read; the live region reads the position after a swipe.
    photoCarousel: '{title} — e’lon rasmlari',
    photoDot: '{index}-rasmga o‘tish',
    photoPosition: '{current} / {total}',
    photoNext: 'Keyingi rasm',
    photoPrev: 'Oldingi rasm',
    photoNone: 'Rasm yo‘q',
    photoCount: '{count} ta rasm',
  },

  detail: {
    aboutTitle: 'E’lon haqida',
    amenitiesTitle: 'Qulayliklar',
    locationTitle: 'Joylashuv',
    ownerTitle: 'Uy egasi',
    safetyTitle: 'Xavfsizlik',
    similarTitle: 'O‘xshash e’lonlar',
    priceTitle: 'Narx va shartlar',
    memberSince: '{date} dan beri a’zo',
    ownerListings: '{count} ta e’loni bor',
    contactHours: 'Bog‘lanish vaqti: {time}',
    reportListing: 'Bu e’lon shubhalimi?',
    backToList: 'E’lonlar ro‘yxatiga qaytish',
    imageOf: '{current} / {total}',
    notFoundTitle: 'E’lon topilmadi',
    notFoundBody: 'Bu e’lon o‘chirilgan yoki havola noto‘g‘ri bo‘lishi mumkin.',
    districtNamed: '{name} tumani',
    floorLabel: 'Qavat',
    showImage: '{index}-rasmni ko‘rsatish',
    photoOf: '{title} — {index}-rasm',
    viewOnMap: 'Xaritada ko‘rish',
    ownerRentals: '{count} ta muvaffaqiyatli ijara',
    utilitiesExcluded: 'Kommunal to‘lovlar alohida',

    /**
     * The reliability figure, said plainly.
     *
     * It is not a machine's opinion of the listing: every e’lon starts at 100
     * and the only thing that moves the number is an administrator confirming
     * a complaint about it. These four strings are the whole explanation the
     * reader gets, so they must not imply any other kind of check.
     */
    trustTitle: 'Ishonchlilik darajasi',
    trustSubtitle: 'Tasdiqlangan shikoyatlar asosida hisoblanadi',
    trustExplainer:
      'Har bir e’lon 100 balldan boshlanadi. Ball faqat administrator '
      + 'shikoyatni tasdiqlaganda pasayadi.',
    trustNoComplaints: 'Bu e’longa tasdiqlangan shikoyat yo‘q.',
    trustHasComplaints: 'Bu e’lon bo‘yicha tasdiqlangan shikoyatlar bor.',
    /** Hover text for the score chip on the card and in the page heading. */
    trustTooltip: 'Ishonchlilik: {score}/100. Faqat tasdiqlangan shikoyatdan keyin pasayadi.',
    /**
     * The owner chip in the sidebar shows the USER's score, which still rises
     * on verification — a different rule from the listing figure above, so it
     * gets its own label rather than borrowing one that mentions complaints.
     */
    ownerTrustScore: 'Egasi ishonchi: {score}',
    ownerToolbar: 'Siz bu e’lonning egasisiz',
    confirmDelete: 'E’lonni butunlay o‘chirasizmi?',
    amenityAvailable: 'mavjud',
    amenityUnavailable: 'mavjud emas',
    chatUnavailable: 'Chat vaqtincha ishlamayapti. Uy egasi bilan telefon orqali bog‘laning.',
    phoneUnavailable: 'Uy egasi raqamini yashirgan. Boshqa aloqa usulidan foydalaning.',
    telegramContact: 'Telegram orqali yozish',
  },

  amenities: {
    furnished: 'Mebel bilan',
    parking: 'Parkovka',
    internet: 'Internet',
    airConditioning: 'Konditsioner',
    washingMachine: 'Kir yuvish mashinasi',
    petsAllowed: 'Uy hayvonlariga ruxsat',
    utilitiesIncluded: 'Kommunal xizmatlar',
    virtualTour: '3D sayohat',
  },

  propertyType: {
    apartment: 'Kvartira',
    house: 'Hovli uy',
    room: 'Xona',
    studio: 'Studiya',
    dormitory: 'Yotoqxona',
  },

  empty: {
    title: 'Bu shartlarga mos e’lon topilmadi',
    body: 'Filtrlarni kengaytirib ko‘ring yoki boshqa tumanni tanlang.',
    cta: 'Filtrlarni tozalash',
    noListingsTitle: 'Hozircha e’lonlar yo‘q',
    noListingsBody: 'Birinchi bo‘lib e’lon joylang — bu mutlaqo bepul.',
    noListingsCta: 'E’lon joylash',
  },

  safety: {
    title: 'Xavfsiz ijara qoidalari',
    tip1: 'Uyni ko‘rmasdan turib oldindan pul o‘tkazmang.',
    tip2: 'Zakladni faqat shartnoma imzolangandan keyin bering.',
    tip3: 'Uy egasidan hujjatni (kadastr yoki pasport) so‘rang.',
    tip4: 'Barcha to‘lov shartlarini oldindan yozma kelishib oling.',
    reportCta: 'Shubhali e’lon haqida xabar berish',
  },

  report: {
    title: 'Shikoyat yuborish',
    subtitle: 'Nima noto‘g‘ri ekanini tanlang',
    reasonLabel: 'Sabab',
    // No "this is a broker listing" reason: professional agents publish here
    // too, so it is not something to complain about — and a confirmed report
    // now costs the listing real reliability points.
    reasons: {
      scam: 'Firibgarlik',
      fakeListing: 'Soxta e’lon',
      fakePhotos: 'Rasmlar boshqa uyniki',
      wrongPrice: 'Narx noto‘g‘ri',
      spam: 'Spam',
      harassment: 'Nomaqbul muomala',
      other: 'Boshqa sabab',
    },
    detailsLabel: 'Qo‘shimcha izoh',
    detailsPlaceholder: 'Nima bo‘lganini qisqacha yozing...',
    submit: 'Shikoyatni yuborish',
    success: 'Shikoyatingiz qabul qilindi. Tez orada ko‘rib chiqamiz.',
  },
} as const;
