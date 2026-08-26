/**
 * Home page: hero, categories, trust stats, AI recommendations.
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
    badge: '0% komissiya · to‘g‘ridan-to‘g‘ri ijara',
    title: 'Maklersiz uy va kvartira ijarasi',
    subtitle:
      'O‘zbekiston bo‘ylab {regions} ta viloyat va {districts} ta tumandagi tekshirilgan uylar.',
    searchTitle: 'Qayerdan izlayapsiz?',
    searchHintShort: 'Qidirish uchun bosing',
    searchHintLong: 'Tuman, ko‘cha, mo‘ljal yoki metro bekati',
    openSearch: 'Qidiruv oynasini ochish',
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
    },
  },

  stats: {
    toggleTitle: 'Platforma ko‘rsatkichlari',
    toggleSubtitle: 'Faqat haqiqiy raqamlar · 0% komissiya',
    toggleSubtitleWithCount: '{count} ta faol e’lon · 0% komissiya',
    expand: 'Ko‘rish',
    collapse: 'Yopish',
    title: 'Maklersiz ijara, ishonch bilan',
    subtitle:
      'Odamlar kvartirani mustaqil topishi uchun maklerlar va firibgarlarni tizimdan chiqaramiz.',
    activeListings: 'Faol e’lonlar',
    activeListingsHint: 'Hozir ochiq turgan e’lonlar',
    featuredListings: 'Tavsiya etilgan e’lonlar',
    featuredListingsHint: 'Tekshiruvdan o‘tgan eng ishonchlilari',
    commission: 'Vositachilik haqi',
    commissionHint: 'Uy egasi bilan to‘g‘ridan-to‘g‘ri',
    unavailable: 'Ko‘rsatkichlarni hozir yuklab bo‘lmadi.',
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
  },
} as const;
