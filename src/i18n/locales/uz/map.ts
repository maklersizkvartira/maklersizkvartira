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
  },

  search: {
    placeholder: 'Manzil, ko‘cha yoki tuman bo‘yicha qidiring',
  },

  filters: {
    district: 'Tuman',
    rooms: 'Xonalar',
    currency: 'Valyuta',
    currencyUzs: 'So‘m',
    currencyUsd: 'Dollar',
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

  marker: {
    priceMillion: '{value} mln',
    label: '{title} — {price}',
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
