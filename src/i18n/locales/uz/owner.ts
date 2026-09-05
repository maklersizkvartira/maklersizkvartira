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
      '3 ta oddiy qadam — 3 daqiqada e’loningiz tayyor. E’lon joylash bepul.',
    stepCounter: '{current}-qadam / {total}',
    stepBadge: '{step}-qadam',
    errorsTitle: 'Iltimos, quyidagi maydonlarni to‘g‘rilang:',

    steps: {
      detailsTitle: '1. Uy ma’lumoti',
      detailsHint: 'Toifa, xonalar, maydon, narx',
      locationTitle: '2. Manzil',
      locationHint: 'Uy qayerda joylashgan?',
      photosTitle: '3. Rasmlar va aloqa',
      photosHint: 'Kamida 1 ta rasm va aloqa',
    },

    next: {
      toLocation: 'Keyingi: manzil va joylashuv',
      toDetails: 'Keyingi: uy ma’lumoti',
      toPhotos: 'Keyingi: rasmlar va aloqa',
    },

    /**
     * Kim nomidan e’lon berilayotgani. Hisobning roli emas — bir agentning
     * o‘z uyi ham bo‘lishi mumkin — shuning uchun har bir e’londa alohida
     * so‘raladi. Foydalanuvchilar aynan shu tanlov yo‘qligidan shikoyat
     * qilishgan edi.
     */
    seller: {
      heading: 'Kim sifatida joylashtiryapsiz?',
      subheading: 'Qidiruvchilar qo‘ng‘iroq qilishdan oldin kim javob berishini bilishadi.',
      owner: 'Uy egasi',
      ownerHint: 'Uy o‘zimniki',
      agent: 'Ko‘chmas mulk agenti',
      agentHint: 'Uy egasi nomidan',
      agencyLabel: 'Agentlik nomi',
      agencyPlaceholder: 'Masalan: Zamin Realty',
      agencyHint: 'Ixtiyoriy — mustaqil rieltor bo‘lsangiz, bo‘sh qoldiring.',
      agentLocked:
        'Agent sifatida joylashtirish uchun profilingizdan “Ko‘chmas mulk agenti” rolini tanlang.',
      agentLockedCta: 'Profilga o‘tish',
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
      pickTitle: 'Xaritada belgilang',
      pickBody: 'Ijaraga beriladigan uy joylashgan nuqtani xaritada bosing.',
      pickHint: 'Nuqtani tanlash uchun xaritani bosing',
      pickConfirm: 'Shu joyni tanlash',
      pickCta: 'Xaritadan tanlash',
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
      priceLabel: 'Oylik narx',
      // A sale price is not a monthly one, and the field would otherwise ask
      // for the rent of a flat somebody is selling.
      priceLabelSale: 'Sotuv narxi',
      pricePlaceholderSale: 'Masalan: 600 000 000',
      pricePlaceholderSaleUsd: 'Masalan, 50 000',
      priceApproxSale: '≈ {amount}',
      priceApprox: '≈ {amount} / oyiga',
      depositLabel: 'Depozit summasi',
      areaLabel: 'Maydoni (m²)',
      floorLabel: 'Qavat',
      totalFloorsLabel: 'Jami qavat',
      amenitiesLabel: 'Mavjud sharoit va qulayliklar',
      // These fields start empty now. A seeded number reads as an answer, and
      // people published it unchanged; a placeholder reads as an example.
      pricePlaceholder: 'Masalan: 4 000 000',
      landAreaLabel: 'Yer maydoni (sotix)',
      landAreaHint: 'Masalan: 4 yoki 6 sotix',
      currencyLabel: 'Valyuta',
      currencyUzs: 'so‘m',
      currencyUsd: '$ dollar',
      pricePlaceholderUsd: 'Masalan, 500',
      depositPlaceholder: 'Zaklad yo‘q bo‘lsa — 0',
      depositPlaceholderUsd: 'Zaklad yo‘q bo‘lsa — 0',
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
      heading: 'Kvartira rasmlari',
      subheading: 'Kamida 1 ta sifatli rasm yuklang — ko‘proq rasm ko‘proq ijarachi demak.',
      dropTitle: 'Rasmlarni yuklash uchun bosing',
      dropBody: 'Telefoningiz yoki galereyangizdan rasm tanlang (JPG, PNG, WEBP).',
      dropCta: 'Fayllarni tanlash ({count} ta yuklandi)',
      uploadedTitle: 'Yuklangan rasmlaringiz',
      coverBadge: 'Asosiy rasm',
      imageAlt: '{index}-rasm',
      removeImage: '{index}-rasmni o‘chirish',
      emptyHint: 'Kamida 1 ta rasm shart. Yuqoridagi maydonni bosib rasm tanlang.',
      limitNotice: 'Ko‘pi bilan {max} ta rasm yuklash mumkin.',
      limitReached: 'Rasmlar chegarasi to‘ldi: {max} ta.',
      readFailed: 'Ba’zi fayllarni o‘qib bo‘lmadi. Boshqa rasm tanlang.',
      // Uchta alohida sabab, uchta alohida yechim: boshqa fayl tanlash,
      // kichikroq tanlash, yoki shunchaki qayta urinish.
      tooLarge: 'Rasm hajmi juda katta. Kichikroq rasm tanlang.',
      uploadFailed: 'Rasmni yuklab bo‘lmadi. Aloqani tekshirib, qayta urining.',
      uploading: 'Yuklanmoqda… {done}/{total}',
      // Said once, before the upload, instead of only as an error afterwards.
      countHint: '{min}–{max} ta rasm yuklang.',
      remainingHint: 'Yana {count} ta rasm qo‘shishingiz mumkin.',
    },

    contact: {
      heading: 'Aloqa ma’lumotlari',
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

    /**
     * The Top promotion, offered on the last step.
     *
     * Nothing here may promise a position that has not been granted: the
     * request is free, it goes to the admins, and the listing moves only
     * after they approve it. Publication never waits for any of that.
     */
    top: {
      title: 'E’loningizni Topga chiqaring',
      body:
        'Top e’lon ro‘yxatning eng boshida turadi — uni bir necha barobar ko‘p ijarachi ko‘radi.',
      free: 'Bepul',
      howItWorks:
        'So‘rovni adminlar ko‘rib chiqadi. E’lon faqat tasdiqlangandan keyin yuqoriga chiqadi.',
      daysLabel: 'Qancha muddatga?',
      daysOption: '{count} kun',
      noteLabel: 'Adminlarga izoh',
      notePlaceholder: 'Masalan: kvartirani shoshilinch ijaraga berishim kerak',
      cta: 'Top so‘rash',
      selected: 'Top so‘rovi tanlandi',
      selectedBody:
        'So‘rov e’lon chop etilgach yuboriladi. Chop etishga bu hech qanday ta’sir qilmaydi.',
      cancel: 'Bekor qilish',
      sentTitle: 'Top so‘rovi yuborildi',
      sentBody:
        'So‘rovingiz adminlarga yuborildi. Ular tasdiqlaganidan keyin e’loningiz ro‘yxat boshiga chiqadi — shu paytgacha e’lon odatdagidek ko‘rinaveradi.',
      failedTitle: 'E’lon chop etildi, Top so‘rovi yuborilmadi',
      failedBody:
        'E’loningiz saytda turibdi. Top so‘rovini “Mening e’lonlarim” bo‘limidan qayta yuborishingiz mumkin.',
      sentCta: 'Mening e’lonlarim',
    },

    /**
     * Draft persistence.
     *
     * The wizard is three steps long and a mis-tapped back gesture used to
     * empty all three, so the answers are kept and the exit is confirmed.
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
        'E’lon joylash butunlay bepul. Ijarachilar e’lonni kim joylagan bo‘lsa, o‘sha bilan to‘g‘ridan-to‘g‘ri bog‘lanadi.',
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
      images: 'Kamida 1 ta haqiqiy rasm yuklang.',
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
    emptyCategory: 'Bu toifada e’lon yo‘q.',
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
      title: 'Umumiy ko‘rsatkichlar',
      body: 'Kvartirangizni mutlaqo bepul e’lon qiling.',
      cta: 'E’lon joylash',
    },

    error: {
      title: 'E’lonlarni yuklab bo‘lmadi',
      body: 'Server bilan aloqa yo‘q. Qayta urinib ko‘ring.',
    },

    districtLabel: '{district} tumani',
    deleteConfirm: 'Ushbu e’lonni o‘chirasizmi? Bu amalni bekor qilib bo‘lmaydi.',
    openListing: 'E’lonni ochish',

    /**
     * What an administrator wrote when they warned about or took down this
     * listing. With the publish-time check gone this note is the owner's only
     * explanation, so it is printed in full rather than summarised, and only
     * ever on their own listings - the API sends it to nobody else.
     */
    moderationNote: 'Administrator izohi: {note}',

    /**
     * The Top state of one listing, on its own row.
     *
     * A listing whose request is waiting or already granted is not offered
     * the button again — the state line is the whole answer there.
     */
    top: {
      title: 'Top e’lon',
      body: 'So‘rov bepul. Adminlar tasdiqlasa, e’lon ro‘yxat boshiga chiqadi.',
      badge: 'TOP',
      cta: 'Top so‘rash',
      pending: 'Top so‘rovi yuborildi — adminlar ko‘rib chiqmoqda.',
      active: 'Top faol — e’lon ro‘yxat boshida turibdi.',
      activeUntil: 'Top faol — {date} gacha ro‘yxat boshida turadi.',
      rejected: 'Top so‘rovi rad etildi. Qaytadan so‘rashingiz mumkin.',
      send: 'So‘rovni yuborish',
      sending: 'Yuborilmoqda...',
      alreadyPending: 'Bu e’lon uchun so‘rov allaqachon yuborilgan.',
      notPublic: 'Faqat chop etilgan e’lonni Topga chiqarish mumkin.',
      failed: 'So‘rovni yuborib bo‘lmadi. Keyinroq urinib ko‘ring.',
    },
  },

  /**
   * The account-wide statistics panel.
   *
   * Distinct from `owner.my.stats`, which labels the tiles on one listing's
   * row: these count every listing the owner has, moderation states included.
   */
  stats: {
    title: 'Umumiy ko‘rsatkichlar',
    subtitle: 'Barcha e’lonlaringiz bo‘yicha jami.',
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
