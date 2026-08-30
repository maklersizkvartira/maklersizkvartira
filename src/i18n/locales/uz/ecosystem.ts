/**
 * Ecosystem preview page.
 *
 * Uzbek strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const ecosystem = {
  hero: {
    eyebrow: 'Kompaniya yo‘l xaritasi',
    title: 'Uyiz — ko‘chmas mulk super-ilovasi',
    subtitle:
      'Oddiy e’lonlar saytidan O‘zbekistondagi eng yirik ko‘chmas mulk va yashash '
      + 'xizmatlari ekotizimiga aylanish yo‘li.',
  },

  stageLabel: '{number}-bosqich',
  roadmapTitle: 'Bosqichlar',

  status: {
    active: 'Hozir faol',
    inProgress: 'Ishlanmoqda',
    planned: 'Rejalashtirilgan',
    future: 'Kelajakdagi ekotizim',
    vision: 'Uzoq muddatli reja',
  },

  stages: {
    marketplace: {
      title: 'Ijara bozori va ishonch tizimi',
      desc:
        'Kvartira qidirish, e’lonlarning ishonchlilik foizi va e’lon egasini besh '
        + 'bosqichda tasdiqlash.',
      badge: 'Faol MVP',
    },
    profile: {
      title: 'Raqamli ijara profili va obro‘ tizimi',
      desc: 'Ijarachi va uy egasi uchun ikki tomonlama obro‘ hamda ishonch profili.',
      badge: 'Tez orada',
    },
    agreement: {
      title: 'Elektron shartnoma va RentPay',
      desc:
        'Platforma ichida huquqiy elektron ijara shartnomasi va kafolatlangan '
        + 'zaklad to‘lovlari.',
      badge: 'Sinov bosqichi',
    },
    services: {
      title: 'Ko‘chirish, mebel va uy xizmatlari',
      desc:
        'Ko‘chirish brigadalari, mebel bozori, tozalash va internet ulash bo‘yicha '
        + 'hamkor xizmatlar.',
      badge: 'Ekotizim',
    },
    mortgage: {
      title: 'Ipoteka va ko‘chmas mulk super-ilovasi',
      desc: 'Banklar bilan ipoteka shartlarini taqqoslash va uy sotib olish platformasi.',
      badge: 'Super-ilova',
    },
  },

  cta: {
    title: 'Hozirgi versiyani sinab ko‘ring',
    body: 'Kvartira izlang, hujjatlaringizni tasdiqlang yoki bepul e’lon joylang.',
    button: 'E’lonlarga o‘tish',
  },
} as const;
