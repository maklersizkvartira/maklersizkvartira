/**
 * Owner surfaces: create listing wizard, edit modal, my listings.
 *
 * Uzbek strings — the source of truth for the key shape. Anything that is
 * not owner-specific (actions, units, statuses, filters) lives in `common`
 * and is reused from there instead of being repeated here.
 */
export const owner = {
  gate: {
    signInTitle: 'Avval tizimga kiring',
    signInBody: 'E’lon joylash uchun uy egasi sifatida tizimga kiring.',
    studentTitle: 'Talaba e’lon joylay olmaydi',
    studentBody:
      'Bu bo‘lim faqat uy egalari uchun. Siz kvartiralarni qidirishingiz va ko‘rishingiz mumkin.',
    browseCta: 'Kvartiralarni ko‘rish',
    switchToOwner: 'Uy egasi rejimiga o‘tish',
    switchFailed: 'Rolni o‘zgartirib bo‘lmadi. Qayta urinib ko‘ring.',
    myListingsTitle: 'Faqat uy egalari uchun',
    myListingsBody: 'E’lonlaringiz va statistikani ko‘rish uchun uy egasi sifatida kiring.',
  },

  create: {
    breadcrumb: 'E’lon berish',
    title: 'E’lon joylashtirish',
    subtitle:
      '4 ta oddiy qadam — 3 daqiqada e’loningiz tayyor. Maklersiz, to‘g‘ridan-to‘g‘ri ijarachilar bilan.',
    stepCounter: '{current}-qadam / {total}',
    stepBadge: '{step}-qadam',
    errorsTitle: 'Iltimos, quyidagi maydonlarni to‘g‘rilang:',

    steps: {
      locationTitle: '1. Manzil',
      locationHint: 'Uy qayerda joylashgan?',
      detailsTitle: '2. Uy ma’lumoti',
      detailsHint: 'Xonalar, maydon, narx',
      photosTitle: '3. Rasmlar',
      photosHint: 'Kamida 3 ta rasm',
      contactTitle: '4. Aloqa',
      contactHint: 'Sizga qanday bog‘lanishadi?',
    },

    next: {
      toDetails: 'Keyingi: uy ma’lumoti',
      toPhotos: 'Keyingi: rasmlar',
      toContact: 'Keyingi: aloqa va tekshiruv',
    },

    location: {
      heading: 'Manzil va joylashuv',
      subheading: 'Kvartirangiz qaysi tuman va ko‘chada joylashgan?',
      regionLabel: 'Viloyat / shahar',
      districtLabel: 'Tuman',
      addressLabel: 'Ko‘cha va mo‘ljal (aniq manzil)',
      addressPlaceholder:
        'Masalan: Mustaqillik shoh ko‘chasi, 14-uy (mo‘ljal: Mirzo Ulug‘bek metrosi)',
      gpsTitle: 'Joylashuvni avtomatik aniqlash',
      gpsHint: 'Bir bosishda viloyat, tuman va ko‘cha o‘zi to‘ldiriladi.',
      gpsDetect: 'GPS orqali aniqlash',
      gpsDetecting: 'Aniqlanmoqda...',
      gpsDetected: 'GPS aniqlandi',
      gpsFound: 'GPS manzil topildi: {region}, {district}, {address}',
      gpsCoordinates: 'GPS koordinatalari aniqlandi: {latitude}, {longitude}',
      // The Geolocation API reports three different failures and the button
      // used to call all of them "permission denied", which sent people to
      // the browser settings to fix a timeout they could have fixed by
      // stepping outside.
      gpsDenied: 'GPS ruxsati berilmadi. Brauzer sozlamalaridan ruxsat bering yoki manzilni yozing.',
      gpsTimeout: 'GPS javob bermadi. Ochiq joyga chiqib qayta urining yoki manzilni yozing.',
      gpsUnavailable: 'Joylashuvni aniqlab bo‘lmadi. Signal kuchsiz bo‘lishi mumkin.',
      gpsPrompt: 'Brauzer joylashuv so‘rayapti — “Ruxsat berish”ni tanlang.',
      gpsSearching: 'Joylashuv qidirilmoqda...',
      gpsSuccess: 'Joylashuv aniqlandi.',
      gpsUnsupported: 'Qurilmangiz GPS ni qo‘llab-quvvatlamaydi.',
      metroLabel: 'Yaqin metro bekati',
      metroNone: 'Yo‘q (metro yaqin emas)',
      metroOption: '{station} bekati',
      metroChoose: 'Bekatni tanlash',
      metroSearch: 'Bekat nomini yozing...',
      metroNoMatch: 'Bunday bekat topilmadi',
      metroMinutesLabel: 'Metroga piyoda masofa (daqiqa)',
    },

    details: {
      heading: 'Uy va ijara ma’lumotlari',
      subheading: 'Xonalar soni, oylik narx va qulayliklar',
      rentalTypeLabel: 'Ijara turi',
      whole: 'Butun kvartira',
      roommate: 'Sheriklikka',
      roommateHeading: 'Sheriklik shartlari',
      roommateGenderLabel: 'Kimlar uchun sheriklik?',
      roommateGenderAny: 'Farqi yo‘q',
      roommateGenderBoys: 'Faqat yigitlar uchun',
      roommateGenderGirls: 'Faqat qizlar uchun',
      roommateSpotsLabel: 'Qancha sherik kerak?',
      roommateSpotsOption: '{count} ta sherik',
      roommateSpotsPlus: '{count}+ ta sherik',
      titleLabel: 'E’lon sarlavhasi',
      titlePlaceholder: 'Masalan: Yunusobod 4-kvartalda shinam 2 xonali kvartira',
      descriptionLabel: 'Batafsil tavsif',
      descriptionPlaceholder:
        'Kvartira sharoitlari, ta’mir holati va qo‘shnilar haqida yozing...',
      priceLabel: 'Oylik narx (so‘m)',
      priceApprox: '≈ {amount} / oyiga',
      depositLabel: 'Depozit summasi (so‘m)',
      areaLabel: 'Maydoni (m²)',
      floorLabel: 'Qavat',
      totalFloorsLabel: 'Jami qavat',
      amenitiesLabel: 'Mavjud sharoit va qulayliklar',
      // These fields start empty now. A seeded number reads as an answer, and
      // people published it unchanged; a placeholder reads as an example.
      pricePlaceholder: 'Masalan: 4 000 000',
      depositPlaceholder: 'Zaklad yo‘q bo‘lsa — 0',
      areaPlaceholder: 'Masalan: 54',
      floorPlaceholder: 'Masalan: 3',
      totalFloorsPlaceholder: 'Masalan: 9',
      roomsPlaceholder: 'Masalan: 2',
    },

    /**
     * One label per amenity key the form toggles.
     *
     * `listings.amenities.*` describes an amenity on a published listing
     * ("Uy hayvonlariga ruxsat"); these are the words on the wizard's own
     * checkboxes, keyed exactly as the form's state is.
     */
    amenities: {
      furnished: 'Mebel bilan',
      utilities: 'Kommunal to‘lov narxga kiradi',
      airConditioning: 'Konditsioner',
      washingMachine: 'Kir yuvish mashinasi',
      internet: 'Internet / Wi-Fi',
      parking: 'Parkovka',
      pets: 'Uy hayvonlariga ruxsat',
    },

    photos: {
      heading: 'Kvartira rasmlari va video',
      subheading: 'Kamida 3 ta sifatli rasm yuklang — ko‘proq rasm ko‘proq ijarachi demak.',
      dropTitle: 'Rasmlarni yuklash uchun bosing',
      dropBody: 'Telefoningiz yoki galereyangizdan rasm tanlang (JPG, PNG, WEBP).',
      dropCta: 'Fayllarni tanlash ({count} ta yuklandi)',
      uploadedTitle: 'Yuklangan rasmlaringiz',
      coverBadge: 'Asosiy rasm',
      imageAlt: '{index}-rasm',
      removeImage: '{index}-rasmni o‘chirish',
      emptyHint: 'Siz hali rasm yuklamadingiz. Yuqoridagi maydonni bosib rasm tanlang.',
      limitNotice: 'Ko‘pi bilan {max} ta rasm yuklash mumkin.',
      limitReached: 'Rasmlar chegarasi to‘ldi: {max} ta.',
      sizeNotice: 'Yuklangan hajm: {size} MB / {max} MB.',
      readFailed: 'Ba’zi fayllarni o‘qib bo‘lmadi. Boshqa rasm tanlang.',
      videoLabel: 'Kvartira video sharhi',
      videoDropTitle: 'Telefoningizdan video tanlang',
      videoDropBody: 'MP4, MOV yoki WEBM formatidagi qisqa video.',
      videoCta: 'Videoni yuklash',
      videoUploaded: 'Video yuklandi',
      videoRemove: 'Videoni o‘chirish',
      videoUploadUnsupported: 'Hozircha videoni to‘g‘ridan-to‘g‘ri yuklab bo‘lmaydi. Videoni YouTube’ga joylab, havolasini qo‘ying.',
      // Said once, before the upload, instead of only as an error afterwards.
      countHint: 'Kamida {min} ta, ko‘pi bilan {max} ta rasm.',
      sizeHint: 'Barcha fayllar jami {max} MB gacha.',
      countAndSizeHint: '{min}–{max} ta rasm, jami {size} MB gacha.',
      remainingHint: 'Yana {count} ta rasm qo‘shishingiz mumkin.',
    },

    contact: {
      heading: 'Aloqa va xavfsizlik tekshiruvi',
      subheading: 'Ijarachilar siz bilan qanday bog‘lanadi?',
      phoneLabel: 'Telefon raqamingiz',
      phoneHint: 'Raqam profilingizdan olinadi. O‘zgartirish uchun profilga o‘ting.',
      phoneMissing: 'Profilingizda telefon raqami yo‘q.',
      telegramLabel: 'Telegram username',
      telegramPlaceholder: '@username',
      telegramHint: '@ bilan boshlang. Faqat lotin harflari, raqam va pastki chiziq.',
      timeLabel: 'Qulay aloqa vaqti',
      timePlaceholder: 'Har kuni 09:00 – 21:00',
    },

    moderation: {
      title: 'E’lonni tekshiruvdan o‘tkazing',
      body: 'Nashr qilishdan oldin sarlavha, tavsif va narxni avtomatik tekshiruvdan o‘tkazing.',
      runCta: 'Tekshirishni boshlash',
      rerunCta: 'Qayta tekshirish',
      scanning: 'E’lon tekshirilmoqda...',
      scanningBody: 'Maklerlik belgilari, firibgarlik va narx mantiqi tahlil qilinmoqda.',
      passedTitle: 'Tekshiruvdan muvaffaqiyatli o‘tdi',
      passedBody: 'E’loningiz qoidalarga mos. Endi uni nashr qilishingiz mumkin.',
      blockedTitle: 'E’lon tekshiruvdan o‘tmadi',
      blockedBody: 'Quyidagi sabablarni to‘g‘rilab, qayta tekshiring.',
      reasonsTitle: 'Sabablar',
      riskScore: 'Xavf darajasi: {score}',
      provider: 'Tekshiruvchi: {provider}',
      failed: 'Tekshiruvni bajarib bo‘lmadi. Keyinroq urinib ko‘ring.',
      editCta: 'Matnni tahrirlash',
      rejectedTitle: 'E’lon moderatsiyadan o‘tmadi',
      rejectedBody:
        'E’loningiz saqlandi, lekin moderatsiyadan o‘tmagani uchun hozircha ko‘rinmaydi. Quyidagilarni to‘g‘rilang.',
      goToMyListings: 'Mening e’lonlarim',
    },

    ai: {
      writeCopy: 'AI matn yozsin',
      suggestPrice: 'AI narx tavsiya qilsin',
      photoTitle: 'AI rasm tahlili va narx tavsiyasi',
      photoBody:
        'AI rasmlardan kvartira holatini aniqlab, hududdagi e’lonlar asosida narx tavsiya qiladi.',
      unavailable:
        'Bu funksiya hozircha ishlamaydi: AI tahlili server tomoniga ko‘chirildi. Matn va narxni o‘zingiz kiriting.',
    },

    /**
     * Draft persistence.
     *
     * The wizard is four steps long and a mis-tapped back gesture used to
     * empty all four, so the answers are kept and the exit is confirmed.
     */
    draft: {
      restored: 'Saqlangan qoralama tiklandi.',
      restoredAt: '{time} da saqlangan qoralama tiklandi.',
      discard: 'Qoralamani o‘chirish',
      discarded: 'Qoralama o‘chirildi.',
      saved: 'Qoralama saqlandi',
      confirmLeaveTitle: 'E’lonni yakunlamay chiqasizmi?',
      confirmLeaveBody:
        'Kiritganlaringiz qoralama sifatida saqlanadi va keyin shu joydan davom ettirasiz.',
      stay: 'Bu yerda qolish',
      leave: 'Chiqish',
    },

    submit: 'E’lonni chiqarish',
    submitting: 'Yuborilmoqda...',
    submitFailed: 'E’lonni yuborib bo‘lmadi. Internet aloqasini tekshirib qayta urining.',

    rules: {
      title: 'Yaxshi e’lon qoidalari',
      subtitle: 'Tez va ishonchli ijara uchun tavsiyalar',
      photos: 'Haqiqiy rasmlar joylang — internetdan olingan rasmlar rad etiladi.',
      price: 'Oylik narxni aniq ko‘rsating.',
      address: 'Manzilni mo‘ljal bilan yozing, ijarachi tez topadi.',
      terms: 'Depozit va kommunal shartlarini tavsifda aniq yozing.',
      freeTitle: '100% bepul joylashtirish',
      freeBody:
        'E’lon joylash butunlay bepul. Biz komissiya olmaymiz — ijarachi siz bilan to‘g‘ridan-to‘g‘ri bog‘lanadi.',
      badgeTitle: 'Tasdiqlangan uy egasi belgisi',
      badgeCta: 'Ishonch belgisini olish',
    },

    validation: {
      address: 'Ko‘cha va aniq manzilni kiriting.',
      metroMinutes: 'Metro masofasi 1 dan 60 daqiqagacha bo‘lishi kerak.',
      title: 'Sarlavha kamida 8 ta belgidan iborat bo‘lsin.',
      description: 'Tavsif kamida 20 ta belgidan iborat bo‘lsin.',
      price: 'Oylik narxni to‘g‘ri kiriting.',
      deposit: 'Depozit 0 yoki undan katta bo‘lishi kerak.',
      area: 'Maydonni to‘g‘ri kiriting.',
      floor: 'Qavat 1 dan jami qavatgacha bo‘lishi kerak.',
      images: 'Kamida 3 ta haqiqiy rasm yuklang.',
      imagesTooLarge:
        'Rasm va video hajmi {size} MB — chegaradan ({max} MB) oshdi. Kamroq yoki kichikroq fayl yuklang.',
      phone: 'Profilingizga ishlaydigan telefon raqamini qo‘shing.',
      telegram: 'Telegram username noto‘g‘ri. Masalan: @dilshod_karimov',
      limitReached: 'Faol e’lonlar chegarasiga yetdingiz ({max} ta). Avval eskisini o‘chiring.',
    },
  },

  edit: {
    title: 'E’lonni tahrirlash',
    subtitle: 'Ma’lumotlarni o‘zgartiring va saqlang',
    saveFailed: 'O‘zgarishlarni saqlab bo‘lmadi.',
  },

  my: {
    title: 'Mening e’lonlarim va statistika',
    subtitle: 'E’lonlaringizni necha kishi ko‘rgani, saqlagani va bog‘langanini kuzatib boring.',
    createCta: 'Yangi e’lon joylash',
    listTitle: 'Har bir e’lon statistikasi ({count} ta)',

    stats: {
      views: 'Jami ko‘rishlar',
      viewsHint: 'E’lonlaringizni ko‘rib chiqqanlar',
      favorites: 'Saqlanganlar',
      favoritesHint: 'Sevimlilarga qo‘shganlar',
      contacts: 'Qo‘ng‘iroq qilmoqchi',
      contactsHint: 'Raqamingizni ochganlar',
      messages: 'Xabar yozmoqchi',
      messagesHint: 'Siz bilan chat boshlaganlar',
      listings: 'Faol e’lonlar',
      listingsHint: 'Hozirda joylangan e’lonlar',
    },

    metrics: {
      views: 'Ko‘rishlar',
      viewsHint: 'Sahifaga kirganlar',
      favorites: 'Saqlaganlar',
      favoritesHint: 'Sevimlilarga qo‘shgan',
      contacts: 'Qo‘ng‘iroq',
      contactsHint: 'Raqamni ochgan',
      messages: 'Xabar',
      messagesHint: 'Chat boshlagan',
      conversion: 'Konversiya: {rate}%',
      conversionHint: 'Aloqa so‘rovining ko‘rishlarga nisbati',
    },

    empty: {
      title: 'Siz hali e’lon joylashtirmadingiz',
      body: 'Kvartirangizni komissiyasiz, mutlaqo bepul e’lon qiling.',
      cta: 'E’lon joylash',
    },

    error: {
      title: 'E’lonlarni yuklab bo‘lmadi',
      body: 'Server bilan aloqa yo‘q. Qayta urinib ko‘ring.',
    },

    districtLabel: '{district} tumani',
    deleteConfirm: 'Ushbu e’lonni o‘chirasizmi? Bu amalni bekor qilib bo‘lmaydi.',
    openListing: 'E’lonni ochish',

    moderation: {
      title: 'Moderatsiya holati',
      reasons: 'Moderator izohlari',
      verificationRequired: 'Tasdiqlash talab qilinadi',
      noReasons: 'Qo‘shimcha izoh yo‘q.',
    },
  },

  /**
   * The account-wide statistics panel.
   *
   * Distinct from `owner.my.stats`, which labels the tiles on one listing's
   * row: these count every listing the owner has, moderation states included.
   */
  stats: {
    title: 'Mening e’lonlarim va statistika',
    subtitle: 'Barcha e’lonlaringiz bo‘yicha umumiy ko‘rsatkichlar.',
    totalListings: 'Jami e’lonlar',
    approved: 'Tasdiqlangan',
    pending: 'Ko‘rib chiqilmoqda',
    rejected: 'Rad etilgan',
    views: 'Ko‘rishlar',
    favorites: 'Saqlanganlar',
    contacts: 'Aloqa so‘rovlari',
    avgTrust: 'O‘rtacha ishonch reytingi',
    empty: 'Statistika uchun hali ma’lumot yo‘q — birinchi e’loningizni joylang.',
    emptyCta: 'E’lon joylash',
  },
} as const;
