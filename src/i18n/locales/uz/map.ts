/**
 * Map view: chrome, popups, legend.
 *
 * Uzbek strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const map = {
  page: {
    title: 'Xaritada qidirish',
    subtitle: 'Kvartirani joylashuvi bo‘yicha toping',
    counter: 'Xaritada {count} ta e’lon',
    listCta: 'Ro‘yxat ko‘rinishida ko‘rish',
    filtersCta: 'Filtrlar',
    resetAll: 'Hammasini tozalash',
  },

  search: {
    placeholder: 'Manzil, ko‘cha yoki tuman bo‘yicha qidiring',
  },

  filters: {
    district: 'Tuman',
    rooms: 'Xonalar',
    currency: 'Valyuta',
    /**
     * Uchinchi holat, va sukut bo‘yicha tanlangani — e’lon qanday
     * valyutada joylashtirilgan bo‘lsa, xaritada ham shunday ko‘rinadi.
     * Ilgari “So‘m” o‘zi bosilgan turardi va $1 000 lik kvartira
     * “12.7 mln” bo‘lib chiqardi — hech kim rozi bo‘lmagan raqam.
     */
    currencyAuto: 'Aslida',
    currencyUzs: 'So‘m',
    currencyUsd: 'Dollar',
    currencyHint:
      'Sukut bo‘yicha har bir e’lon uy egasi ko‘rsatgan valyutada chiqadi. '
      + 'So‘m yoki dollarni tanlasangiz, barcha narxlar shu valyutaga o‘tkaziladi.',
  },

  /** Toshkent tumanlari — nomlar `data/mockLocations` dan olinadi. */
  districts: {
    chilonzor: 'Chilonzor',
    yunusobod: 'Yunusobod',
    mirobod: 'Mirobod',
    mirzoUlugbek: 'Mirzo Ulug‘bek',
    olmazor: 'Olmazor',
    yakkasaroy: 'Yakkasaroy',
    sergeli: 'Sergeli',
    shayxontohur: 'Shayxontohur',
    yashnobod: 'Yashnobod',
    uchtepa: 'Uchtepa',
    bektemir: 'Bektemir',
    yangihayot: 'Yangihayot',
  },

  me: {

    label: 'Siz shu yerdasiz',

    cta: 'Meni xaritada ko‘rsat',

  },

  marker: {
    // The unit belongs on the pin. A bare "12.7 mln" next to a "$1 000"
    // leaves half the map's prices to inference — and when the viewer has
    // explicitly asked for so'm, not one pin was saying so'm.
    priceMillion: '{value} mln so‘m',
    label: '{title} — {price}',
    // What a pin reads out when several listings stand on the same spot.
    groupLabel: 'Shu manzilda {count} ta e’lon',
  },

  group: {
    title: 'Shu manzildagi e’lonlar',
    subtitle: 'Bir joyda {count} ta e’lon bor. Kerakligini tanlang.',
  },

  panel: {
    metro: '{station} metrosi',
    close: 'E’lon kartasini yopish',
  },

  state: {
    loadingMap: 'Xarita yuklanmoqda...',
    loadingListings: 'E’lonlar yuklanmoqda...',
    scriptError: {
      title: 'Xaritani yuklab bo‘lmadi',
      body:
        'Xarita kutubxonasi yuklanmadi. Internet aloqasini tekshiring yoki '
        + 'e’lonlarni ro‘yxat ko‘rinishida oching.',
    },
    listingsError: {
      title: 'E’lonlarni yuklab bo‘lmadi',
    },
    empty: {
      title: 'Bu hududda e’lon topilmadi',
      body: 'Filtrlarni o‘zgartiring yoki tozalab ko‘ring.',
    },
    noCoordinates: 'Joylashuvi ko‘rsatilmagan {count} ta e’lon xaritada ko‘rinmaydi',
    noMapped: {
      title: 'Xaritada ko‘rsatiladigan e’lon yo‘q',
      body: 'Topilgan e’lonlarda aniq koordinata yo‘q. Ularni ro‘yxatda ko‘rishingiz mumkin.',
    },
  },

  a11y: {
    map: 'E’lonlar xaritasi',
    resultList: 'Xaritadagi e’lonlar ro‘yxati',
    zoomIn: 'Kattalashtirish',
    zoomOut: 'Kichraytirish',
  },
} as const;
