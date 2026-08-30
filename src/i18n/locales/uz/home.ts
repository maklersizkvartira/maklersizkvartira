/**
 * Home page: hero, categories, platform figures, the recommended rail.
 *
 * Uzbek strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 *
 * Category titles and descriptions are NOT duplicated here — the header
 * dropdown and this page show the same six sections, so both read
 * `layout.categories.*`.
 */
export const home = {
  hero: {
    badge: 'Bepul e’lon joylash · to‘g‘ridan-to‘g‘ri aloqa',
    title: 'O‘zbekistonda uy va kvartira ijarasi',
    // Not "{regions} ta viloyat": Uzbekistan has 12 viloyats plus the
    // Republic of Karakalpakstan plus the city of Tashkent, so the number the
    // page counts is 14 and the word for it is "hudud", not "viloyat".
    subtitle:
      'O‘zbekistonning {regions} ta hududi va {districts} ta tuman va shahridagi '
      + 'tekshirilgan uy-joy e’lonlari.',
    searchTitle: 'Qayerdan izlayapsiz?',
    searchHintShort: 'Qidirish uchun bosing',
    searchHintLong: 'Tuman, ko‘cha, mo‘ljal yoki metro bekati',
    openSearch: 'Qidiruv oynasini ochish',
    // The pills that sit on the two hero illustrations. Short by design: they
    // float over artwork, so anything longer than two words per line covers
    // the thing it is annotating.
    badges: {
      trustedListings: 'Ishonchli e’lonlar',
      directFromOwner: 'To‘g‘ridan-to‘g‘ri egadan',
      safeAndSecure: 'Xavfsiz va ishonchli',
      freeToPost: 'Bepul e’lon joylash',
      fastAndEasy: 'Tez va oson ijara',
      passportChecked: 'Pasport tekshirilgan',
      supportAlways: '24/7 qo‘llab-quvvatlash',
    },
  },

  categories: {
    eyebrow: 'Sara bo‘limlar',
    title: 'Kategoriyalar bo‘yicha tezkor qidiruv',
    subtitle: 'O‘zingizga ma’qul ijara turini tanlang va uylarni ko‘ring',
    viewAll: 'Barcha e’lonlarni ko‘rish',
    tags: {
      roommateBoys: 'Yigitlarga',
      roommateGirls: 'Qizlarga',
      studentNearUniversity: 'Universitet yaqinida',
      studentDormAlternative: 'Yotoqxonaga muqobil',
      familyTwoRooms: '2 xona',
      familyThreeRooms: '3 xona',
      metroWalk: 'Piyoda masofada',
      metroCentral: 'Markazga yaqin',
      budgetNoDeposit: 'Zakladsiz',
      budgetLowPrice: 'Arzon narx',
      premiumVerifiedOwner: 'Tasdiqlangan egasi',
      premiumHighTrust: 'Yuqori ishonch reytingi',
      qizlargaOnlyGirls: 'Faqat qizlarga',
      qizlargaRoommate: 'Qiz sherik',
      komfortFurnished: 'Mebel bilan',
      komfortAppliances: 'Konditsioner va kir mashinasi',
      centerWalkable: 'Markazga piyoda',
      centerDistricts: 'Markaziy tumanlar',
    },
  },

  stats: {
    toggleTitle: 'Platforma ko‘rsatkichlari',
    toggleSubtitle: 'Faqat haqiqiy raqamlar',
    toggleSubtitleWithCount: '{count} ta faol e’lon',
    expand: 'Ko‘rish',
    collapse: 'Yopish',
    title: 'Ijara, ishonch bilan',
    subtitle:
      'E’lon joylash bepul, aloqa to‘g‘ridan-to‘g‘ri. '
      + 'Har bir shikoyat moderator tomonidan ko‘rib chiqiladi.',
    activeListings: 'Faol e’lonlar',
    activeListingsHint: 'Hozir ochiq turgan e’lonlar',
    featuredListings: 'Tavsiya etilgan e’lonlar',
    featuredListingsHint: 'Administrator tasdiqlagan Top e’lonlar',
    unavailable: 'Ko‘rsatkichlarni hozir yuklab bo‘lmadi.',

    /**
     * Geography, stated truthfully.
     *
     * The old line promised "{regions} ta viloyat" while the number behind it
     * counted 12 viloyats + the Republic of Karakalpakstan + the city of
     * Tashkent. "Hudud" is the word that covers all three, and the second-
     * level unit is a "tuman va shahar", not a "tuman" alone.
     *
     * `geoSublineActive` is the honest variant: how many places actually have
     * listings, not how many sit in the dropdown.
     */
    geoHeadline: 'O‘zbekiston bo‘ylab tekshirilgan e’lonlar',
    geoSubheadline: 'E’lon egasi bilan o‘zingiz to‘g‘ridan-to‘g‘ri gaplashasiz.',
    geoSubline:
      'O‘zbekistonning {regions} ta hududi va {districts} ta tuman va shahridagi tekshirilgan uylar.',
    geoSublineActive:
      'Hozir {regions} ta hududda va {districts} ta tuman va shahrida faol e’lonlar bor.',
    regionsLabel: 'Hududlar',
    regionsHint: '12 viloyat, Qoraqalpog‘iston Respublikasi va Toshkent shahri',
    districtsLabel: 'Tuman va shaharlar',
    districtsHint: 'O‘zbekiston bo‘ylab qamrab olingan tuman va shaharlar',
    regionsWithListings: 'E’lon bor hududlar',
    regionsWithListingsHint: 'Kamida bitta faol e’loni bor hududlar',
    districtsWithListings: 'E’lon bor tuman va shaharlar',
    districtsWithListingsHint: 'Kamida bitta faol e’loni bor tuman va shaharlar',
    coverageTitle: 'Qamrov',
    coverageSubtitle: 'Ro‘yxatdagi emas, haqiqatan e’lon bor joylar ko‘rsatilgan.',
  },

  recommended: {
    badge: 'Tavsiya',
    title: 'E’lonlar',
    titleVIP: 'Top va VIP E’lonlar',
    subtitle: 'Eng so’nggi va ishonchli uylar',
    subtitleVIP: 'Saytimiz orqali yuqoriga ko’tarilgan ishonchli uylar',
    viewAll: 'Barchasi',
    listLabel: 'Tavsiya etilgan e’lonlar',
    empty: 'Hozircha e’lonlar yo‘q.',
    emptyCta: 'E’lon joylash',
    error: 'E’lonlarni yuklab bo‘lmadi.',
  },

  search: {
    title: 'Qidiruv parametrlari',
    queryLabel: 'Kalit so‘z',
    queryPlaceholder: 'Tuman, ko‘cha yoki mo‘ljal',
    metroAll: 'Barcha metro bekatlari',
    metroStation: '{station} bekati',
    rentalTypeLabel: 'Ijara turi',
    submit: 'Natijalarni ko‘rish',
    regionLabel: 'Hudud',
    districtLabel: 'Tuman yoki shahar',
    metroLabel: 'Metro bekati',
    roomsLabel: 'Xonalar soni',
    audienceLabel: 'Kimlar uchun',
    priceLabel: 'Oylik narx (so‘m)',
    priceMinPlaceholder: 'dan — 1 000 000',
    priceMaxPlaceholder: 'gacha — 10 000 000',
    priceAny: 'Narx muhim emas',
    areaLabel: 'Eng kam maydon (m²)',
    areaPlaceholder: 'Masalan: 40',
    sortLabel: 'Saralash',
    amenitiesLabel: 'Qulayliklar',
    amenitiesHint: 'Tanlangan qulayliklarning barchasi bor uylar ko‘rsatiladi.',
    advancedShow: 'Qo‘shimcha parametrlar',
    advancedHide: 'Qo‘shimcha parametrlarni yashirish',
    reset: 'Parametrlarni tozalash',
    resultsHint: '{count} ta e’lon shu shartlarga mos keladi',
  },
} as const;
