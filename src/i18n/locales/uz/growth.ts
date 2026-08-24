/**
 * Referral programme.
 *
 * Uzbek strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const growth = {
  hero: {
    eyebrow: 'Taklif dasturi',
    title: 'Do‘stlaringizni taklif qiling va mukofot oling',
    subtitle:
      'Taklif havolangiz orqali ro‘yxatdan o‘tgan har bir do‘st sizga tajriba ballari '
      + 'olib keladi va yangi imkoniyatlarni ochadi.',
  },

  code: {
    label: 'Sizning taklif kodingiz',
    linkLabel: 'Taklif havolasi',
    copyLink: 'Taklif havolasini nusxalash',
    copied: 'Havola nusxalandi',
    copyFailed: 'Havolani nusxalab bo‘lmadi. Uni qo‘lda belgilab oling.',
    missingTitle: 'Taklif kodi hali berilmagan',
    missingBody: 'Hisobingiz uchun kod tayyorlanmoqda. Biroz vaqtdan so‘ng qayta tekshiring.',
    guestTitle: 'Taklif kodini olish uchun kiring',
    guestBody: 'Ro‘yxatdan o‘tgach, sizga shaxsiy taklif kodi va havola beriladi.',
    guestCta: 'Kirish',
  },

  xp: {
    label: 'Tajriba ballari',
    value: '{count} XP',
    hint: 'Ballar profilni to‘ldirish, tasdiqlashdan o‘tish va faollik uchun beriladi.',
  },

  rewards: {
    title: 'Taklif mukofotlari',
    subtitle: 'Taklif qilingan do‘stlar soni ortgani sayin ochiladigan imkoniyatlar',
    friends: '{count} ta do‘st',
    xpTitle: 'Tajriba ballari',
    xpDesc: 'Har bir taklif qilingan do‘st uchun qo‘shimcha XP',
    badgeTitle: 'Taklif nishoni',
    badgeDesc: 'Profilingizda maxsus belgi paydo bo‘ladi',
    premiumTitle: 'Premium qidiruv',
    premiumDesc: 'Kengaytirilgan qidiruv 1 oy bepul',
    boostTitle: 'E’lonni yuqoriga chiqarish',
    boostDesc: 'Bitta e’lon uchun bepul ko‘tarish',
    vipTitle: 'VIP a’zolik',
    vipDesc: 'VIP nishon va qidiruvda ustunlik',
    ambassadorTitle: 'Kampus elchisi',
    ambassadorDesc: 'Universitetdagi rasmiy elchi maqomi',
  },

  progress: {
    title: 'Taklif qilingan do‘stlar',
    unavailable: 'Taklif qilingan do‘stlar soni hozircha hisoblanmaydi.',
  },

  leaderboard: {
    title: 'Eng faol taklif qiluvchilar',
    unavailableTitle: 'Reyting hozircha mavjud emas',
    unavailableBody:
      'Taklif reytingi server tomonida hali tayyor emas. Tayyor bo‘lishi bilan shu yerda ko‘rinadi.',
  },
} as const;
