/**
 * Student programme page.
 *
 * Uzbek strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const student = {
  hero: {
    eyebrow: 'Talabalar dasturi',
    title: 'Universitetingizga yaqin xavfsiz uylar',
    subtitle:
      'Toshkentdagi yirik universitetlar atrofidagi hamyonbop, maklersiz ijara e’lonlari — '
      + 'har biri sun’iy intellekt tekshiruvidan o‘tgan.',
    bonusLabel: 'Talaba bonusi',
    bonusValue: 'Bepul e’lon ko‘tarish',
    bonusHint: 'Talabalik guvohnomasi tasdiqlangandan so‘ng',
  },

  picker: {
    title: 'Universitetingizni tanlang',
    select: '{name} universitetini tanlash',
  },

  selected: {
    eyebrow: 'Tanlangan universitet',
    location: '{district} tumani, {city} shahri',
    nearby: '{name} atrofidagi e’lonlar',
    viewAll: 'Barchasini ko‘rish',
  },

  empty: {
    title: '{name} atrofida e’lon topilmadi',
    body: 'Boshqa universitetni tanlang yoki e’lonlar sahifasida qidiruvni kengaytiring.',
    cta: 'E’lonlarni ko‘rish',
  },

  error: {
    title: 'E’lonlarni yuklab bo‘lmadi',
  },
} as const;
