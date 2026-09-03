/**
 * Uyiz AI assistant and its notifications.
 *
 * Uzbek strings — the source of truth for the key shape.
 */
export const assistant = {
  mascot: {
    /** A product name: never translated. */
    name: 'Uyiz AI',
    tagline: 'AI yordamchi',
    shortTagline: 'AI',
    open: 'AI yordamchisi',
    panelLabel: 'Uyiz AI bilan suhbat',
  },

  chat: {
    welcome:
      'Assalomu alaykum! Men Uyiz AI — Uyiz kompaniyasining AI yordamchisiman 🏠\n\n'
      + 'Uy-joy bo‘yicha savollaringizga javob beraman, aytganingizga mos e’lonlarni bazadan '
      + 'saralab beraman va kerak bo‘lsa jamoamiz bilan bog‘layman.\n\n'
      + 'Masalan:\n'
      + '• «Chilonzordan 3 mlnga kvartira kerak»\n'
      + '• «Yunusobod 2 xona talaba uchun»\n'
      + '• «Qishda 2 xonali yaxshimi yoki 3 xonali?»',
    welcomeNamed:
      'Assalomu alaykum, {name}. Men Uyiz AI — Uyiz kompaniyasining AI yordamchisiman 🏠\n\n'
      + 'Uy-joy bo‘yicha savolingizni bering yoki qanday uy kerakligini ayting — tuman, xona '
      + 'soni, byudjet. Mos e’lonlarni bazadan saralab beraman.',
    log: 'Suhbat tarixi',
    you: 'Siz',
    inputLabel: 'Uyiz AI ga xabar',
    inputPlaceholder: 'Chilonzordan 3 mlnga...',
    inputThinking: 'Uyiz AI o‘ylamoqda...',
    inputDisabled: 'Bugungi limit tugadi',
    send: 'Xabarni yuborish',
    thinking: 'Uyiz AI javob tayyorlamoqda',
    loadingHistory: 'Suhbat yuklanmoqda',
    reset: 'Suhbatni yakunlash va tozalash',
    close: 'Suhbatni yopish',
    quota: '{remaining}/{limit} qoldi',
    quotaLabel: 'Bugungi {limit} ta so‘rovdan {remaining} tasi qoldi',
    quotaWarning: 'Bugun yana {count} ta so‘rov qoldi.',
    limitReached:
      'Bugungi so‘rovlar limiti tugadi. Ertaga qaytib keling yoki e’lonlarni o‘zingiz qidiring.',
    resultsTitle: 'Sizga mos e’lonlar',
    /** Assistant bajargan amallar — matn ichida emas, alohida ko‘rinsin. */
    actions: {
      addFavorite: 'Sevimlilarga qo‘shildi',
      removeFavorite: 'Sevimlilardan olindi',
      requestSupportCallback: 'So‘rovingiz qo‘llab-quvvatlash xizmatiga yuborildi',
      myListings: 'E’lonlaringiz ochildi',
      listingPerformance: 'E’lon statistikasi hisoblandi',
      listFavorites: 'Sevimlilar ochildi',
    },
    /** Ha/yo‘q kutilayotganda ko‘rinadigan tugmalar. */
    confirmYes: 'Ha',
    confirmNo: 'Yo‘q',
    confirmHint: 'Tasdiqlashingizni kutyapman',
    viewAllResults: 'Barcha kvartiralarni ko‘rish',
    startFailed: 'Suhbatni boshlab bo‘lmadi. Qayta urinib ko‘ring.',
    replyFailed: 'Javob olib bo‘lmadi. Iltimos, qaytadan urinib ko‘ring.',
    networkFailed: 'Tarmoq xatosi. Internet aloqangizni tekshiring.',
  },

  closeDialog: {
    title: 'Suhbatni yakunlaysizmi?',
    description:
      'Suhbat yakunlangach, to‘liq xulosa jamoaga yuboriladi va chat tarixi tozalanadi.',
    cancel: 'Yo‘q, davom etish',
    confirm: 'Ha, yakunlash',
  },

  /**
   * E’lonlar bo‘yicha ogohlantirish banneri. Ilgari bu e’lon joylashtirilayotganda
   * ishlaydigan avtomatik tekshiruv xulosasini ko‘rsatardi; endi avtomatik tekshiruv
   * yo‘q, shuning uchun matn moderator tasdiqlagan shikoyat haqida gapiradi.
   */
  notice: {
    regionLabel: 'E’lonlaringiz bo‘yicha ogohlantirishlar',
    title: 'Diqqat! E’loningizga tushgan shikoyat tasdiqlandi',
    body: '«{title}» — {reason} Shu sababli ishonchlilik foizingiz pasaydi.',
    defaultReason: 'Moderator shikoyatni asosli deb topdi.',
    fix: 'Tahrirlash',
    confirmDelete: 'E’lonni butunlay o‘chirasizmi?',
  },
} as const;
