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
      gpsDenied: 'GPS ruxsati berilmadi. Manzilni matn ko‘rinishida kiriting.',
      gpsUnsupported: 'Qurilmangiz GPS ni qo‘llab-quvvatlamaydi.',
      metroLabel: 'Yaqin metro bekati',
      metroNone: 'Yo‘q (metro yaqin emas)',
      metroOption: '{station} bekati',
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
    },

    contact: {
      heading: 'Aloqa va xavfsizlik tekshiruvi',
      subheading: 'Ijarachilar siz bilan qanday bog‘lanadi?',
      phoneLabel: 'Telefon raqamingiz',
      phoneHint: 'Raqam profilingizdan olinadi. O‘zgartirish uchun profilga o‘ting.',
      phoneMissing: 'Profilingizda telefon raqami yo‘q.',
      telegramLabel: 'Telegram username',
      telegramPlaceholder: '@username',
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
      contacts: 'Bog‘langanlar',
      contactsHint: 'Raqamni ko‘rib bog‘langanlar',
      listings: 'Faol e’lonlar',
      listingsHint: 'Hozirda joylangan e’lonlar',
    },

    metrics: {
      views: 'Ko‘rishlar',
      viewsHint: 'Sahifaga kirganlar',
      favorites: 'Saqlaganlar',
      favoritesHint: 'Sevimlilarga qo‘shgan',
      contacts: 'Bog‘langanlar',
      contactsHint: 'Raqamni bosib ko‘rgan',
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
    chatMetricUnavailable:
      'Chat statistikasi vaqtincha yo‘q — xabarlar tizimi serverga ko‘chirilmoqda.',

    moderation: {
      title: 'Moderatsiya holati',
      reasons: 'Moderator izohlari',
      verificationRequired: 'Tasdiqlash talab qilinadi',
      noReasons: 'Qo‘shimcha izoh yo‘q.',
    },
  },
} as const;
