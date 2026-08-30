/**
 * Direct messaging between tenant and owner.
 *
 * Uzbek strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 *
 * The messaging backend exists now, so this namespace covers a working
 * inbox: who the thread is with, which listing it is about, and what was
 * said last.
 */
export const chat = {
  list: {
    unknownPerson: 'Foydalanuvchi',
    roleTenant: 'Ijarachi',
    roleOwner: 'Uy egasi',
    youPrefix: 'Siz:',
  },
  page: {
    subtitle: 'E’lon egasi bilan to‘g‘ridan-to‘g‘ri bog‘laning.',
  },

  notice: {
    title: 'Ichki xabar almashish hali ishga tushmagan',
    body: 'Sayt ichida yozishish imkoniyati hozircha mavjud emas. Uy egasiga e’lon sahifasidagi telefon raqami yoki Telegram orqali murojaat qiling.',
    legacyNote:
      'Ilgari shu sahifada yozilgan xabarlar faqat brauzeringizda saqlangan va hech kimga yetib bormagan.',
  },

  contact: {
    title: 'Uy egasi bilan qanday bog‘lanasiz',
    step1Title: 'E’lonni oching',
    step1Body: 'Kerakli kvartirani toping va uning sahifasiga o‘ting.',
    step2Title: 'Qo‘ng‘iroq qiling',
    step2Body: 'E’lon sahifasidagi qo‘ng‘iroq tugmasi sizni uy egasiga bevosita ulaydi.',
    step3Title: 'Telegramda yozing',
    step3Body: 'Uy egasi Telegram havolasini qoldirgan bo‘lsa, xabarni o‘sha yerda yozing.',
  },

  safety: {
    title: 'Xavfsiz muloqot qoidasi',
    body: 'Kvartirani shaxsan ko‘rib, kalit va hujjatlarni olmaguningizcha oldindan plastik kartaga pul o‘tkazmang.',
  },

  composer: {
    title: 'Xabar matnini tayyorlang',
    placeholder: 'Uy egasiga aytmoqchi bo‘lgan gapingizni shu yerda yozing...',
    disabledHint:
      'Yuborish tugmasi hali ishlamaydi. Matnni nusxalab, uy egasiga Telegram yoki SMS orqali yuboring.',
    quickTitle: 'Tayyor savollar',
    quickHint: 'Savolni bosing — u xabar matniga qo‘shiladi.',
    quick: {
      viewing: 'Bugun uyni ko‘rsam bo‘ladimi?',
      address: 'Aniq manzil va mo‘ljalni yuboring',
      contract: 'Shartnoma rasmiylashtiriladimi?',
      phone: 'Telefon raqamingizni bering',
    },
  },

  actions: {
    browse: 'E’lonlarni ko‘rish',
    create: 'E’lon joylash',
  },

  toast: {
    ownerOnly: 'E’lon joylash uchun profilda «Uy egasi» roliga o‘ting.',
    unavailable:
      'Xabar yuborish hali mavjud emas. Uy egasiga e’lon sahifasidan qo‘ng‘iroq qiling.',
  },
} as const;
