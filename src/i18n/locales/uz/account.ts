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
    verificationLevel: 'Tasdiqlash darajasi',
    xpPoints: 'XP ballari',
    verified: 'Tasdiqlangan hisob',
    notVerified: 'Tasdiqlanmagan hisob',
    verify: 'Hisobni tasdiqlash',
  },

  role: {
    title: 'Tizimdagi rolingiz',
    subtitle: 'Rolni istalgan vaqtda almashtirishingiz mumkin.',
    owner: {
      title: 'Uy egasi',
      description: 'Kvartira e’lon berish',
    },
    student: {
      title: 'Talaba',
      description: 'Kvartira qidirish',
    },
    active: 'Joriy rol',
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
    reload: 'Ro‘yxatni yangilash',
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
} as const;
