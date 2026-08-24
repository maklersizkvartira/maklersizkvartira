/**
 * Identity and property verification flow.
 *
 * Uzbek strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const verification = {
  page: {
    eyebrow: 'Ishonchli tekshiruv markazi',
    title: 'E’loningiz ishonchini va ko‘rinishini uch barobar oshiring',
    subtitle:
      'Uy egasi sifatida hujjatlaringizni tasdiqlang — e’loningizda yashil «Tasdiqlangan uy egasi» nishoni paydo bo‘ladi, talabalar va ijarachilar sizga to‘g‘ridan-to‘g‘ri ishonadi.',
    trustLabel: 'Ishonch reytingingiz',
    xp: '{count} XP',
    currentLevel: 'Hozirgi darajangiz: {level}',
    levelZero: 'Boshlang‘ich daraja',
    guestTitle: 'Tekshiruvni boshlash uchun tizimga kiring',
    guestBody:
      'Hujjat yuborish va arizalaringiz holatini ko‘rish uchun hisobingizga kiring.',
  },

  compare: {
    eyebrow: 'Vizual taqqoslash',
    title: 'Tekshiruvdan o‘tsam e’lonim qanday ko‘rinadi?',
    subtitle:
      'Tekshirilgan e’lonlar qidiruvda yuqoriroq chiqadi va ijarachilarda ishonch uyg‘otadi.',
    note: 'Quyidagi ikkala e’lon ham faqat namuna uchun tuzilgan.',
    exampleTitle: '2 xonali shinam kvartira, Yunusobod',
    beforeLabel: 'Tekshirilmagan e’lon',
    beforeHint: 'Oddiy ko‘rinish',
    beforeTag: 'Oddiy',
    beforeOwner: 'Uy egasi: Dilshod',
    beforeTrust: 'Ishonch reytingi: {score}',
    beforeConBadge: 'Nishon yo‘q — ijarachida makler shubhasi paydo bo‘ladi',
    beforeConRank: 'Qidiruv natijalarida pastroq o‘rinda chiqadi',
    afterLabel: 'Tasdiqlangan ishonchli e’lon',
    afterHint: '3 barobar ko‘p murojaat',
    afterBadge: 'Tasdiqlangan uy egasi',
    afterRank: 'TOP #1',
    afterOwner: 'Uy egasi: Dilshod K.',
    afterTrust: '{score}/100 ishonch reytingi',
    afterProBadge: 'Yashil «Tasdiqlangan uy egasi» nishoni bilan to‘liq ishonch',
    afterProRank: 'Bosh sahifada va qidiruvda eng yuqori o‘rinda chiqadi',
  },

  ladder: {
    title: 'Ishonchli tekshiruv bosqichlari',
    subtitle:
      'Bosqichlarni ketma-ket bajarib, ishonchlilik darajangizni oshiring.',
    navLabel: 'Tekshiruv bosqichlari',
    stepAria: '{level}-daraja: {title}',
  },

  steps: {
    l1: {
      short: 'Telefon',
      reward: '+10 XP',
      title: '1-daraja: telefon raqami tasdiqlangan',
      description: 'Raqamingiz ro‘yxatdan o‘tishda SMS kod orqali tekshirilgan.',
    },
    l2: {
      short: 'Pasport',
      reward: '+50 XP',
      title: '2-daraja: pasport yoki ID karta',
      description: 'Shaxsingizni tasdiqlash uchun hujjat nusxasi tekshiriladi.',
    },
    l3: {
      short: 'Jonli selfi',
      reward: '+50 XP',
      title: '3-daraja: jonli selfi va jonlilik tekshiruvi',
      description: 'Selfi hujjatdagi surat bilan solishtiriladi.',
    },
    l4: {
      short: 'Kadastr',
      reward: '+100 XP',
      title: '4-daraja: kadastr va mulk egaligi',
      description: 'Mulk hujjati uyning haqiqatan sizniki ekanini tasdiqlaydi.',
    },
    l5: {
      short: 'VIP',
      reward: 'VIP',
      title: '5-daraja: VIP tasdiqlangan uy egasi',
      description: 'Barcha bosqichlardan o‘tgan uy egalari uchun eng yuqori daraja.',
    },
  },

  step: {
    pendingTitle: 'Hujjatlar tekshirilmoqda',
    pendingBody:
      'Moderator odatda 24 soat ichida javob beradi. Natija bildirishnoma sifatida keladi.',
    rejectedTitle: 'Hujjatlar rad etildi',
    rejectedReason: 'Sabab: {reason}',
    rejectedNoReason: 'Moderator sababni ko‘rsatmagan.',
    resubmit: 'Qayta yuborish',
    approvedTitle: 'Bosqich tasdiqlangan',
    lockedTitle: 'Avvalgi bosqichni yakunlang',
    lockedBody: 'Bu bosqich {level}-daraja tasdiqlangandan keyin ochiladi.',
    next: 'Keyingi bosqich: {title}',
    submitting: 'Yuborilmoqda...',
  },

  phone: {
    verified: 'Telefon raqamingiz SMS kod orqali tasdiqlangan.',
    pending:
      'Telefon raqamingiz hali tasdiqlanmagan. Profilingizda raqamni tasdiqlang.',
  },

  upload: {
    cta: 'Faylni tanlash',
    hint: 'JPG, PNG yoki PDF · 4 MB gacha',
    selected: 'Fayl tanlandi',
    replace: 'Boshqa fayl tanlash',
    preview: 'Tanlangan hujjat ko‘rinishi',
    document: 'Hujjat fayli yuklandi',
    tooLarge: 'Fayl juda katta. 4 MB dan kichik fayl tanlang.',
    failed: 'Faylni o‘qib bo‘lmadi. Boshqa fayl tanlang.',
  },

  passport: {
    docTypeLabel: 'Hujjat turi',
    passport: 'Pasport',
    idCard: 'ID karta',
    uploadTitle: 'Pasport yoki ID kartaning rasmini yuklang',
    uploadSubtitle: 'Bosib fayl tanlang yoki telefoningizda suratga oling.',
    privacy:
      'Maxfiylik kafolati: shaxsiy hujjatlar e’londa ko‘rsatilmaydi, ular faqat tekshiruv uchun shifrlangan holda saqlanadi.',
    submit: 'Pasportni tekshiruvga yuborish',
    approved: 'Shaxsingiz tasdiqlangan.',
  },

  selfie: {
    cameraTitle: 'Jonli kamerani oching',
    cameraBody:
      'Kamera orqali yuzingiz va jonliligi tekshiriladi. Rasm faqat tekshiruv uchun saqlanadi.',
    openCamera: 'Jonli kamerani ochish',
    videoLabel: 'Jonli kamera tasviri',
    guide: 'Yuzingizni aylana ichiga to‘g‘rilang',
    capture: 'Rasmga tushish',
    retake: 'Qayta rasmga tushish',
    fromFile: 'Fayldan yuklash',
    captured: 'Jonli selfi tayyor.',
    previewAlt: 'Olingan selfi',
    denied:
      'Kameraga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering yoki tayyor rasm yuklang.',
    unsupported: 'Bu qurilmada kamera mavjud emas. Tayyor rasm yuklang.',
    submit: 'Selfini tekshiruvga yuborish',
    approved: 'Yuz va jonlilik tekshiruvidan o‘tdingiz.',
  },

  cadastre: {
    codeLabel: 'Kadastr raqami',
    codePlaceholder: '10:01:04:02:01:0045',
    codeDisabled:
      'Kadastr raqamini avtomatik tekshirish hozircha ishlamaydi — hujjat nusxasini yuklang, moderator raqamni hujjatdan o‘qiydi.',
    uploadTitle: 'Kadastr hujjatining nusxasi (rasm yoki PDF)',
    uploadSubtitle: 'Bosib kadastr faylini tanlang.',
    submit: 'Mulk hujjatini tekshiruvga yuborish',
    approved: 'Kvartirangiz mulk egaligi bo‘yicha tasdiqlangan.',
  },

  vip: {
    body:
      'Tabriklaymiz! Siz platformaning eng ishonchli uy egalari qatoridasiz. E’lonlaringiz qidiruvda eng yuqori o‘rinda chiqadi.',
    locked: 'Bu daraja avvalgi to‘rt bosqich tasdiqlangandan so‘ng ochiladi.',
    myListings: 'Mening e’lonlarim',
  },

  requests: {
    title: 'Yuborilgan arizalar',
    subtitle: 'Har bir arizaning holati va moderator izohi.',
    empty: 'Hozircha ariza yuborilmagan.',
    error: 'Arizalar ro‘yxatini yuklab bo‘lmadi.',
    level: '{level}-daraja',
    reason: 'Rad etish sababi: {reason}',
    doc: {
      passport: 'Pasport',
      idCard: 'ID karta',
      cadastre: 'Kadastr hujjati',
      selfie: 'Jonli selfi',
      unknown: 'Hujjat',
    },
  },

  checker: {
    title: 'Telefon raqamni ishonchlilikka tekshirish',
    subtitle:
      'Raqam haqiqiy uy egasiga tegishlimi yoki makler ekanini tekshirish uchun.',
    placeholder: '+998 90 123 45 67',
    submit: 'Tekshirish',
    unavailable:
      'Bu xizmat hozircha ishlamaydi: raqamlar bo‘yicha tekshiruv server tomonida tayyorlanmoqda. Tayyor bo‘lgach shu yerda ishga tushadi.',
  },

  toast: {
    submitted: 'Hujjatlar tekshiruvga yuborildi.',
    failed: 'Hujjatlarni yuborib bo‘lmadi. Qayta urinib ko‘ring.',
    fileRequired: 'Avval hujjat faylini yuklang.',
  },
} as const;
