/**
 * Shield AI mascot and its notifications.
 *
 * Uzbek strings — the source of truth for the key shape.
 */
export const assistant = {
  mascot: {
    /** A product name: never translated. */
    name: 'Shield AI',
    tagline: 'Aqlli uy qidiruv yordamchisi',
    shortTagline: 'Aqlli yordamchi',
    open: 'Shield AI yordamchisini ochish',
    panelLabel: 'Shield AI bilan suhbat',
  },

  chat: {
    welcome:
      'Assalomu alaykum! Men Shield AI — MaklersizUy kompaniyasining AI yordamchisiman 🛡️\n\n'
      + 'Uy-joy bo‘yicha savolingizga javob beraman va bazadan mos e’lonlarni tanlab beraman.\n\n'
      + 'Masalan:\n'
      + '• «Chilonzordan 3 mlnga kvartira kerak»\n'
      + '• «Yunusobod 2 xona talaba uchun»\n'
      + '• «Qishda 2 xonali yaxshimi yoki 3 xonali?»',
    welcomeNamed:
      'Assalomu alaykum, {name}. Men Shield AI — MaklersizUy kompaniyasining AI yordamchisiman 🛡️\n\n'
      + 'Uy-joy bo‘yicha savolingizni bering yoki qanday uy kerakligini ayting — tuman, xona soni, byudjet.',
    log: 'Suhbat tarixi',
    you: 'Siz',
    inputLabel: 'Shield AI ga xabar',
    inputPlaceholder: 'Chilonzordan 3 mlnga...',
    inputThinking: 'Shield AI o‘ylamoqda...',
    inputDisabled: 'Bugungi limit tugadi',
    send: 'Xabarni yuborish',
    thinking: 'Shield AI javob tayyorlamoqda',
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

  notice: {
    regionLabel: 'E’lonlar bo‘yicha AI ogohlantirishlari',
    title: 'Diqqat! E’loningiz ommaga ko‘rsatilmayapti',
    body: '«{title}» — {reason} Agar tahrirlamasangiz, e’lon o‘chirib yuboriladi.',
    defaultReason: 'Boshqa manbadan ko‘chirilgani aniqlandi.',
    fix: 'Tahrirlash',
    confirmDelete: 'E’lonni butunlay o‘chirasizmi?',
  },
} as const;
