/**
 * Profile and account settings.
 *
 * Uzbek strings — the source of truth for the key shape.
 *
 * Password copy lives in `auth.changePassword.*` and `auth.fields.*`: the
 * change-password form here is the same form as the reset flow, so it reads
 * the same words rather than a near-duplicate set.
 */
export const account = {
  page: {
    title: 'Hisob sozlamalari',
    subtitle: 'Profil ma’lumotlari, xavfsizlik va ilova sozlamalari.',
  },

  // The desktop sidebar of the account page. Section titles come from the
  // sections themselves; these are the entries that have no section of
  // their own.
  nav: {
    overview: 'Umumiy',
    overviewHint: 'Hisob holati va tasdiqlash',
    wallet: 'Hamyon va balans',
    walletHint: 'Click, Payme, xizmatlar',
    signOut: 'Hisobdan chiqish',
  },
  profile: {
    title: 'Profil ma’lumotlari',
    avatarAlt: '{name} — profil rasmi',
    avatarChange: 'Profil rasmini almashtirish',
    avatarBadge: 'Rasm',
    avatarHint: 'JPG yoki PNG, {size} MB gacha.',
    avatarTooLarge: 'Rasm hajmi {size} MB dan oshmasligi kerak.',
    avatarWrongType: 'Faqat rasm faylini yuklash mumkin.',
    avatarReadFailed: 'Rasmni o‘qib bo‘lmadi. Boshqa fayl tanlang.',
    badgeOwner: 'Uy egasi profili',
    badgeStudent: 'Talaba profili',
    captionOwner: 'Rasmingiz e’loningizda ijarachilarga ko‘rinadi.',
    captionStudent: 'Rasmingiz uy egasi bilan yozishmada ko‘rinadi.',
    nameSaved: 'Ismingiz yangilandi.',
    phone: 'Telefon raqam',
    phoneLocked: 'Telefon raqam — hisobingiz identifikatori. Uni o‘zgartirib bo‘lmaydi.',
    memberSince: 'Ro‘yxatdan o‘tgan',
    trustScore: 'Ishonch reytingi',
    pointsValue: '{count} ball',
    verificationLevel: 'Tasdiqlash darajasi',
    xpPoints: 'XP ballari',
    verified: 'Tasdiqlangan hisob',
    notVerified: 'Tasdiqlanmagan hisob',
    verify: 'Hisobni tasdiqlash',
  },

  role: {
    granted: {
      title: 'Sizga maxsus rol berilgan',
      description:
        '«{role}» roli administrator tomonidan beriladi va uni bu yerdan o‘zgartirib bo‘lmaydi. Barcha imkoniyatlar ochiq.',
    },
    title: 'Tizimdagi rolingiz',
    subtitle: 'Rolni istalgan vaqtda almashtirishingiz mumkin.',
    owner: {
      title: 'Uy egasi',
      description: 'Kvartira e’lon berish',
    },
    agent: {
      title: 'Ko‘chmas mulk agenti',
      description: 'Egasi nomidan e’lon berish',
    },
    student: {
      title: 'Talaba',
      description: 'Kvartira qidirish',
    },
    active: 'Joriy rol',
    agencyTitle: 'Agentligingiz',
    agencySubtitle: 'Bu nom e’lonlaringiz yonida ko‘rinadi.',
    agencyLabel: 'Agentlik nomi',
    agencyPlaceholder: 'Masalan: Zamin Realty',
    agencyHint: 'Ixtiyoriy — mustaqil rieltor bo‘lsangiz, bo‘sh qoldiring.',
    agencySaved: 'Agentlik nomi saqlandi.',
    agencyFailed: 'Agentlik nomini saqlab bo‘lmadi.',
    switching: 'Almashtirilmoqda...',
    switchFailed: 'Rolni almashtirib bo‘lmadi.',
    createListing: '+ Yangi e’lon joylash',
  },

  preferences: {
    title: 'Ilova sozlamalari',
    languageHint: 'Tanlangan til hisobingizga saqlanadi va barcha qurilmalarda qo‘llanadi.',
    themeHint: '“Tizim bo‘yicha” qurilmangiz sozlamasiga ergashadi.',
  },

  security: {
    title: 'Xavfsizlik',
    passwordTitle: 'Parol',
    passwordDescription: 'Parolni vaqti-vaqti bilan yangilab turing.',
    passwordNeverShown: 'Parolingiz brauzerda saqlanmaydi va hech qayerda ko‘rsatilmaydi.',
  },

  sessions: {
    countShort: '{count} ta seans',
    title: 'Faol seanslar',
    subtitle: 'Hisobingizga kirilgan qurilmalar ro‘yxati.',
    count: '{count} ta faol seans',
    device: 'Qurilma',
    ip: 'IP manzil',
    started: 'Kirilgan vaqt',
    expires: 'Amal qilish muddati',
    unknownDevice: 'Noma’lum qurilma',
    unknownIp: 'IP aniqlanmadi',
    empty: 'Faol seans topilmadi.',
    loadFailed: 'Seanslar ro‘yxatini yuklab bo‘lmadi.',
    loadError: 'Seanslar ro‘yxatini yuklab bo‘lmadi. Qayta urinib ko‘ring.',
    reload: 'Ro‘yxatni yangilash',
    // A person recognises their own row by the device and the browser, not by
    // a session id — and they must be able to see which row is the one they
    // are reading it on, so they do not sign themselves out by accident.
    current: 'Shu qurilma',
    browser: 'Brauzer',
    lastSeen: 'Oxirgi faollik',
    revoke: 'Seansni yakunlash',
    revokeConfirm: 'Bu qurilmadagi seansni yakunlaysizmi?',
    revokeAll: 'Boshqa barcha qurilmalardan chiqarish',
    revoked: 'Seans yakunlandi.',
    revokeFailed: 'Seansni yakunlab bo‘lmadi.',
  },

  signOut: {
    title: 'Hisobdan chiqish',
    thisDevice: 'Shu qurilmadan chiqish',
    allDevices: 'Barcha qurilmalardan chiqish',
    allDevicesHint:
      'Barcha qurilmalarda seans yakunlanadi va keyingi safar qaytadan kirish talab qilinadi.',
    confirmAll: 'Barcha qurilmalardan chiqmoqchimisiz?',
    failed: 'Chiqishda xatolik yuz berdi.',
  },

  // The balance top-up sheet (TopUpModal). Every string the sheet shows,
  // because it used to be Uzbek only while the rest of the profile page
  // followed the visitor's language.
  topUp: {
    title: 'Balansni to‘ldirish',
    subtitle: 'To‘lov {gateway}ning himoyalangan sahifasida amalga oshiriladi',
    gateway: 'To‘lov tizimi',
    clickHint: 'Uzcard · Humo',
    paymeHint: 'Ilova · karta',
    amount: 'Summa',
    customPlaceholder: 'Boshqa summa',
    currency: 'so‘m',
    range: '{min} dan {max} so‘mgacha',
    amountTooLow: 'Kamida {min} so‘m',
    amountTooHigh: 'Ko‘pi bilan {max} so‘m',
    pay: '{gateway} orqali {amount} so‘m to‘lash',
    redirecting: 'To‘lov sahifasi ochilmoqda…',
    noLink: 'To‘lov havolasi olinmadi. Birozdan so‘ng qayta urinib ko‘ring.',
    cardNote: 'Karta ma’lumotlari saytga tushmaydi. To‘lov tasdiqlangach balans bir zumda yangilanadi.',
    close: 'Yopish',
    cancelledTitle: 'To‘lov yakunlanmadi',
    cancelledBody: 'Siz to‘lov sahifasidan qaytdingiz. Balans o‘zgarmadi — istasangiz qaytadan urinib ko‘ring.',
    paidToast: 'Balans {amount} so‘mga to‘ldirildi',
    checking: 'To‘lov tekshirilmoqda…',
    leaveNote: 'Siz {gateway} sahifasiga o‘tasiz. To‘lovni bekor qilsangiz, shu yerga qayting.',
  },

  // The wallet page (WalletCard / WalletPage).
  wallet: {
    promoteBought: 'E’lon reklamaga chiqarildi',
    promoteShortfall: 'Balansda {amount} so‘m yetishmayapti',
    title: 'Hamyon',
    subtitle: 'Balans, to‘ldirish va xizmatlar',
    balance: 'Balans',
    topUp: 'Hisobni to‘ldirish',
    methods: 'Click yoki Payme orqali. Karta ma’lumotlari saytga tushmaydi.',
    servicesTitle: 'Xizmatlar',
    badgeTitle: 'Rasmiy ko‘k galochka',
    badgeDesc: 'Ismingiz yonida tasdiqlangan belgi va e’lonlaringizga yuqori ishonch.',
    badgeActive: 'Faol',
    badgeBuy: 'Sotib olish',
    badgeConfirmTitle: 'Ko‘k galochkani sotib olasizmi?',
    badgeConfirmBody: 'Balansdan {price} so‘m yechiladi. Belgi darhol faollashadi va qaytarilmaydi.',
    badgeBenefit1: 'Ism yonida ko‘k galochka',
    badgeBenefit2: 'E’lonlarda «Tasdiqlangan egasi» belgisi',
    badgeBenefit3: 'Ishonch reytingi oshadi',
    badgeShortfall: 'Balansda {amount} so‘m yetishmaydi.',
    badgeTopUp: '{amount} so‘m to‘ldirish',
    badgeBought: 'Ko‘k galochka faollashtirildi!',
    confirm: 'Tasdiqlash',
    historyTitle: 'To‘lovlar tarixi',
    historyEmpty: 'Hali to‘lovlar yo‘q. Birinchi to‘ldirish shu yerda ko‘rinadi.',
    remaining: 'qoldiq: {amount}',
    openWallet: 'Hamyonni ochish',
    cardHolder: 'Karta egasi',
    phone: 'Telefon raqam',
  },
} as const;
