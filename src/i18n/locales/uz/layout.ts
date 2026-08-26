/** Header, bottom navigation, footer, and global system messages. */
export const layout = {
  nav: {
    home: 'Bosh sahifa',
    listings: 'E’lonlar',
    map: 'Xarita',
    favorites: 'Saqlanganlar',
    chat: 'Xabarlar',
    profile: 'Profil',
    myListings: 'Mening e’lonlarim',
    createListing: 'E’lon berish',
    verification: 'Tasdiqlash',
    referral: 'Do‘st taklif qilish',
    studentProgram: 'Talabalar dasturi',
    ecosystem: 'Ekotizim',
    admin: 'Boshqaruv',
    help: 'Yordam',
  },

  header: {
    createListingCta: 'E’lon berish',
    savedCount: 'Saqlanganlar ({count})',
    loginCta: 'Kirish',
    registerCta: 'Ro‘yxatdan o‘tish',
    loginOrRegister: 'Kirish / Ro‘yxatdan o‘tish',
    searchPlaceholder: 'Qidirish...',
    openMenu: 'Menyuni ochish',
    closeMenu: 'Menyuni yopish',
  },

  categories: {
    label: 'Kategoriyalar',
    chooseSection: 'Bo‘limni tanlang',
    popularDistricts: 'Mashhur tumanlar',
    roommate: {
      title: 'Sheriklikka',
      description: 'Talaba va ijarachiga sherik',
    },
    student: {
      title: 'Talabalar uchun',
      description: 'Universitetga yaqin arzon uylar',
    },
    family: {
      title: 'Oilalar uchun',
      description: '2 va undan ortiq xonali shinam uylar',
    },
    metro: {
      title: 'Metro yaqinida',
      description: 'Bekatga 10 daqiqa piyoda',
    },
    budget: {
      title: 'Arzon narxda',
      description: '3 mln so‘mgacha',
    },
    premium: {
      title: 'Yuqori ishonchli',
      description: 'Tasdiqlangan uy egalaridan',
    },
  },

  sidebar: {
    guestTitle: 'Xush kelibsiz',
    guestSubtitle: 'E’lon joylash va uy egalari bilan bevosita bog‘lanish uchun kiring',
    level: '{level}-daraja',
    xpPoints: '{count} XP',
    xpToNext: 'Keyingi darajagacha {count} XP',
    settings: 'Sozlamalar',
  },

  footer: {
    about: 'Platforma haqida',
    aboutText:
      'Maklersiz Uy — O‘zbekistonda uy-joy ijarasini vositachisiz, to‘g‘ridan-to‘g‘ri '
      + 'uy egasidan topish platformasi. Komissiya 0%.',
    forTenants: 'Ijarachilar uchun',
    forOwners: 'Uy egalari uchun',
    company: 'Kompaniya',
    legal: 'Huquqiy',
    terms: 'Foydalanish shartlari',
    privacy: 'Maxfiylik siyosati',
    safety: 'Xavfsizlik qoidalari',
    guides: 'Qo‘llanmalar',
    contact: 'Bog‘lanish',
    support: 'Qo‘llab-quvvatlash',
    faq: 'Ko‘p so‘raladigan savollar',
    followUs: 'Ijtimoiy tarmoqlar',
    rights: '© {year} Maklersiz Uy. Barcha huquqlar himoyalangan.',
    madeIn: 'O‘zbekistonda ishlab chiqildi',
  },

  splash: {
    loading: 'E’lonlar va xarita yuklanmoqda...',
  },

  toast: {
    listingCreated: 'E’lon muvaffaqiyatli joylandi!',
    listingUpdated: 'E’lon tahrirlandi.',
    listingDeleted: 'E’lon o‘chirildi.',
    listingRejected: 'E’lon moderatsiyadan o‘tmadi.',
    favoriteAdded: 'Saqlanganlarga qo‘shildi.',
    favoriteRemoved: 'Saqlanganlardan olib tashlandi.',
    roleSwitched: 'Rol “{role}” ga o‘zgartirildi.',
    avatarUpdated: 'Profil rasmi yangilandi.',
    languageChanged: 'Til o‘zgartirildi.',
    themeChanged: 'Ko‘rinish o‘zgartirildi.',
    copiedLink: 'Havola nusxalandi.',
    xpEarned: '+{amount} XP — {reason}',
    welcomeOwner: 'Xush kelibsiz! Endi e’lon joylashingiz mumkin.',
    welcomeStudent: 'Xush kelibsiz! Kvartirani maklersiz tanlang.',
    sessionExpired: 'Sessiya muddati tugadi. Qaytadan kiring.',
  },

  offline: {
    title: 'Internet aloqasi yo‘q',
    body: 'Ulanishni tekshiring — sahifa avtomatik yangilanadi.',
  },
} as const;
