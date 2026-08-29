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
    search: 'Qidiruv',
    more: 'Yana',
    settings: 'Sozlamalar',
    notifications: 'Bildirishnomalar',
    support: 'Qo‘llab-quvvatlash',
  },

  header: {
    createListingCta: 'E’lon berish',
    savedCount: 'Saqlanganlar ({count})',
    loginOrRegister: 'Kirish / Ro‘yxatdan o‘tish',
    searchPlaceholder: 'Qidirish...',
    openMenu: 'Menyuni ochish',
    closeMenu: 'Menyuni yopish',
    // The header drawer is a Sheet now, so it has a real heading instead of
    // an unlabelled panel that a screen reader announced as “dialog”.
    menuTitle: 'Menyu',
    menuSubtitle: 'Bo‘limlar, kategoriyalar va hisobingiz',
    drawerCategories: 'Kategoriyalar',
    drawerQuickLinks: 'Tezkor havolalar',
    drawerSettings: 'Sozlamalar',
    skipToContent: 'Asosiy mazmunga o‘tish',
    searchAria: 'E’lonlar bo‘yicha qidirish',
    // The eyebrow over the four section links at the top of the browse
    // panel — distinct from `categories.chooseSection`, which heads the ten
    // category tiles below them in the same panel.
    browseSections: 'Bo‘limlar',
    // The bar carries one glyph for both preferences now, so its label has to
    // name both; neither `common.language.label` nor `common.theme.label`
    // describes what pressing it opens.
    settingsAria: 'Til va ko‘rinish',
    // Not `nav.profile`: the avatar opens a menu, it no longer navigates to
    // the profile page, and calling it "Profil" would lie to a screen reader.
    accountAria: 'Hisobim menyusi',
    mapSearchAria: 'Xaritada qidirish',
    backAria: 'Ortga qaytish',
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
    qizlarga: {
      title: 'Qizlarga',
      description: 'Faqat qizlar uchun xona va sheriklik',
    },
    komfort: {
      title: 'Komfort',
      description: 'Mebel, konditsioner, kir yuvish mashinasi va internet',
    },
    center: {
      title: 'Markazda',
      description: 'Shaharning markaziy tumanlaridagi uylar',
    },
    hovli: {
      title: 'Hovli',
      description: 'Hovlili uylar — alohida kirish va oʻz hovlisi bilan',
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
    // The helpline is a separate group from the `support` link above it: that
    // one goes to a page, this one is the number somebody can dial now. It is
    // `supportBlock` rather than `support` because `support` is already the
    // footer's link label and the footer still renders it.
    supportBlock: {
      title: 'Yordam kerakmi?',
      feedback: 'Taklif va shikoyatlar uchun:',
      phoneAria: '{phone} raqamiga qo‘ng‘iroq qilish',
      hours: 'Har kuni 09:00 – 21:00',
    },
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
