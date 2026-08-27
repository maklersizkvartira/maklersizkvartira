/**
 * Uzbek SEO copy — the source of truth for the pack's structure.
 *
 * Two rules the text here follows, and the reason for each:
 *
 *  - A page says what it is once, in the language people search in, and then
 *    spends the rest of its words being useful. Repeating "maklersiz kvartira
 *    Toshkent" six times is what keyword stuffing looks like, and Google has
 *    been demoting it since 2011.
 *  - Nothing claims a number the platform cannot prove. There is no "10 000
 *    e'lon" anywhere, because the count comes from the API at runtime and a
 *    hard-coded figure would be a lie the moment it was written.
 */

import { UZ_ARTICLES, UZ_HELP } from './articles.uz';
import { UZ_DISTRICT_PROFILES, UZ_REGION_PROFILES } from './places.uz';
import type { CategoryWords, CopyPack, FaqEntry, PlaceProfile, PlaceWords } from './types';

const SUFFIX = ' | Maklersizuy.uz';

/** `Samarqand sh.` is how it is stored; `Samarqand shahri` is how it reads. */
export function displayPlaceName(name: string): string {
  return name.replace(/\s+sh\.$/i, ' shahri').replace(/\s+t\.$/i, ' tumani');
}

/** The part of a place name a headline should use. */
function shortName(name: string): string {
  if (name === 'Toshkent shahri') return 'Toshkent';
  if (name === 'Toshkent viloyati') return 'Toshkent viloyati';
  if (name === 'Qoraqalpogʻiston Respublikasi') return 'Qoraqalpogʻiston';
  return displayPlaceName(name)
    .replace(/\s+viloyati$/i, '')
    .replace(/\s+shahri$/i, '')
    .replace(/\s+tumani$/i, '');
}

/**
 * The locative case, which in Uzbek is `-da` after every ending — vowels
 * included. `Sergeli` -> `Sergelida`, `Samarqand` -> `Samarqandda`.
 */
function locative(short: string): string {
  return `${short}da`;
}

function placeWords(name: string): PlaceWords {
  const short = shortName(name);
  return { name: displayPlaceName(name), short, inPlace: locative(short) };
}

const CATEGORIES: Record<string, CategoryWords> = {
  apartment: {
    noun: 'kvartira',
    plural: 'kvartiralar',
    label: 'Kvartira ijarasi',
    headline: 'maklersiz kvartira ijarasi',
    blurb:
      'Ko‘p qavatli uylardagi alohida kvartiralar — oila, juftlik yoki yolg‘iz yashovchi uchun.',
  },
  house: {
    noun: 'uy',
    plural: 'uylar',
    label: 'Uy ijarasi',
    headline: 'maklersiz uy ijarasi',
    blurb: 'Hovlili uylar va yakka tartibdagi turar joylar — ko‘proq joy va alohida kirish.',
  },
  room: {
    noun: 'xona',
    plural: 'xonalar',
    label: 'Xona ijarasi',
    headline: 'maklersiz xona ijarasi',
    blurb: 'Umumiy kvartiradagi alohida xona — eng arzon va eng tez topiladigan variant.',
  },
  studio: {
    noun: 'studiya',
    plural: 'studiyalar',
    label: 'Studiya ijarasi',
    headline: 'maklersiz studiya ijarasi',
    blurb: 'Yotoq va oshxona bir xonada — yolg‘iz yashovchi va yosh juftliklar uchun.',
  },
  roommate: {
    noun: 'sherikchilik',
    plural: 'sherikchilik e’lonlari',
    label: 'Sheriklikka ijara',
    headline: 'sheriklikka maklersiz ijara',
    blurb:
      'Ijara haqini bo‘lishib to‘laydigan sherik izlayotganlar uchun. Jins bo‘yicha alohida tanlash bor.',
  },
  student: {
    noun: 'talabalar uchun uy',
    plural: 'talabalar uchun uylar',
    label: 'Talabalar uchun ijara',
    headline: 'talabalar uchun maklersiz ijara',
    blurb:
      'Universitetga yaqin, yotoqxonaga muqobil bo‘ladigan narxdagi uylar va sherikchilik.',
  },
  family: {
    noun: 'oilaviy kvartira',
    plural: 'oilaviy kvartiralar',
    label: 'Oilalar uchun ijara',
    headline: 'oilalar uchun maklersiz ijara',
    blurb: 'Ikki va undan ortiq xonali, uzoq muddatga topshiriladigan turar joylar.',
  },
  budget: {
    noun: 'arzon ijara',
    plural: 'arzon variantlar',
    label: 'Arzon ijara',
    headline: 'arzon maklersiz ijara',
    blurb: 'Oyiga 3 million so‘mgacha bo‘lgan e’lonlar, narx bo‘yicha saralangan.',
  },
};

const NO_BROKER_LINE =
  'Bu yerdagi har bir e’lonni uy egasining o‘zi joylaydi: siz bilan gaplashadigan odam ham o‘sha. '
  + 'Vositachilik haqi yo‘q, komissiya 0%.';

function placeIntro(
  place: PlaceWords,
  category: CategoryWords | null,
  profile: PlaceProfile | null,
  metroStations: string[],
): string[] {
  const what = category ? category.plural : 'uy va kvartiralar';
  const paragraphs: string[] = [
    `${place.inPlace} ijaraga beriladigan ${what} — to‘g‘ridan-to‘g‘ri uy egalaridan. `
      + NO_BROKER_LINE,
  ];

  if (profile?.about) paragraphs.push(profile.about);

  if (metroStations.length > 0) {
    const list = metroStations.slice(0, 5).join(', ');
    paragraphs.push(
      `Metro bilan qatnaydiganlar uchun: ${place.short} hududiga ${list} bekatlari xizmat qiladi. `
        + 'E’londa bekatgacha necha daqiqa piyoda ekani ko‘rsatilgan bo‘lsa, uni filtrdan ham topa olasiz.',
    );
  }

  paragraphs.push(
    'Har bir e’lon joylanishidan oldin avtomatik tekshiruvdan o‘tadi: takroriy rasm, makler '
      + 'uslubidagi matn va real bo‘lmagan narx belgilanadi. Shubhali e’lonni bir bosishda '
      + 'shikoyat qilib qoldirishingiz mumkin.',
  );

  return paragraphs;
}

function placeFaq(place: PlaceWords, category: CategoryWords | null): FaqEntry[] {
  const what = category ? category.noun : 'uy';
  return [
    {
      q: `${place.inPlace} maklersiz ${what} qanday topiladi?`,
      a:
        `Ushbu sahifadagi e’lonlarning barchasi uy egalarining o‘zi tomonidan joylangan. `
        + `Sizga yoqqanini oching, telefon raqamni ko‘ring va to‘g‘ridan-to‘g‘ri qo‘ng‘iroq qiling. `
        + `Oraliqda hech kim turmaydi va hech kimga foiz to‘lamaysiz.`,
    },
    {
      q: `${place.inPlace} ijara narxi qancha turadi?`,
      a:
        'Narx xonalar soni, uyning holati va joylashuviga qarab keskin farq qiladi, shuning '
        + 'uchun biz o‘rtacha raqam yozib qo‘ymaymiz. Yuqoridagi ro‘yxatni narx bo‘yicha '
        + 'saralang — hozirgi real narxlar shundoq ko‘rinadi.',
    },
    {
      q: 'Komissiya yoki xizmat haqi bormi?',
      a:
        'Yo‘q. Platformadan foydalanish ijarachi uchun ham, uy egasi uchun ham bepul. '
        + 'Agar kimdir sizdan "sayt uchun" pul so‘rasa, bu makler — e’lonni shikoyat qiling.',
    },
    {
      q: 'E’lon haqiqiyligiga qanday ishonch hosil qilaman?',
      a:
        'Uy egasining ishonch reytingi va tasdiqlash darajasi har bir e’londa ko‘rsatilgan. '
        + 'Pasport va kadastr hujjati tekshirilgan e’lonlar alohida belgi oladi. '
        + 'Uyni ko‘rmasdan turib oldindan pul o‘tkazmang.',
    },
  ];
}

export const UZ_COPY: CopyPack = {
  htmlLang: 'uz',
  ogLocale: 'uz_UZ',

  brand: {
    name: 'Maklersiz Uy',
    tagline: 'Uy egasidan to‘g‘ridan-to‘g‘ri, 0% komissiya',
    about:
      'Maklersiz Uy — O‘zbekistonda uy va kvartirani vositachisiz, to‘g‘ridan-to‘g‘ri '
      + 'egasidan ijaraga olish platformasi. Har bir e’lon avtomatik tekshiruvdan o‘tadi, '
      + 'komissiya olinmaydi.',
  },

  common: {
    breadcrumbHome: 'Bosh sahifa',
    allListings: 'Barcha e’lonlar',
    listingsIn: (place) => `${place} e’lonlari`,
    resultsCount: (count) =>
      count === 0 ? 'Hozircha e’lon yo‘q' : `${count} ta e’lon topildi`,
    emptyTitle: 'Bu yo‘nalishda hozircha e’lon yo‘q',
    emptyBody:
      'Yaqin atrofdagi boshqa bo‘limlarni ko‘rib chiqing yoki keyinroq qaytib kiring — '
      + 'yangi e’lonlar har kuni qo‘shiladi.',
    faqHeading: 'Ko‘p beriladigan savollar',
    exploreHeading: 'Yana ko‘rish',
    nearbyHeading: 'Yaqin atrofdagi tumanlar',
    categoriesHeading: 'Bo‘limlar',
    regionsHeading: 'Viloyatlar bo‘yicha',
    districtsHeading: 'Tumanlar bo‘yicha',
    readMore: 'To‘liq o‘qish',
    publishedOn: 'Chop etilgan',
    updatedOn: 'Yangilangan',
    readingTime: (minutes) => `${minutes} daqiqa o‘qish`,
    blogHeading: 'Ijara bo‘yicha qo‘llanmalar',
    blogIntro:
      'Uy tanlash, shartnoma tuzish va firibgarlikdan saqlanish bo‘yicha amaliy maqolalar. '
      + 'Hammasi O‘zbekiston bozori uchun yozilgan.',
    helpHeading: 'Yordam markazi',
    helpIntro:
      'Platforma qanday ishlaydi, xavfsizlik qoidalari, shartlar va maxfiylik siyosati.',
    notFoundTitle: 'Bunday sahifa topilmadi',
    notFoundBody:
      'Manzil noto‘g‘ri yozilgan bo‘lishi yoki e’lon o‘chirilgan bo‘lishi mumkin. '
      + 'Quyidagi bo‘limlardan davom eting.',
    notFoundCta: 'Barcha e’lonlarga qaytish',
  },

  categories: CATEGORIES,

  places: {
    regions: UZ_REGION_PROFILES,
    districts: UZ_DISTRICT_PROFILES,
  },

  placeWords: (name) => placeWords(name),
  country: { name: 'O‘zbekiston', short: 'O‘zbekiston', inPlace: 'O‘zbekistonda' },

  home: {
    title: `Maklersiz uy va kvartira ijarasi${SUFFIX}`,
    description:
      'Uy egasidan to‘g‘ridan-to‘g‘ri, maklersiz ijara. O‘zbekiston bo‘ylab tekshirilgan '
      + 'kvartira, uy va xona e’lonlari. Komissiya 0%.',
    h1: 'Maklersiz uy va kvartira ijarasi',
    intro: [
      'Maklersiz Uy uy egasi bilan ijarachini to‘g‘ridan-to‘g‘ri bog‘laydi. '
        + 'E’lonni uyning egasi joylaydi, raqamni siz ko‘rasiz, kelishuvni ikkovingiz qilasiz — '
        + 'oraliqda vositachi ham, uning foizi ham yo‘q.',
      'Kvartira, hovlili uy, studiya, alohida xona va sheriklikka joy — barchasi bitta joyda. '
        + 'Tuman, metro bekati, universitetga yaqinlik va narx bo‘yicha filtrlab, o‘zingizga '
        + 'to‘g‘ri keladiganini toping.',
      'Har bir e’lon joylanishidan oldin avtomatik tekshiruvdan o‘tadi: takroriy rasmlar, '
        + 'makler uslubidagi matn va bozorga mos kelmaydigan narx belgilanadi. Uy egalari '
        + 'pasport va mulk hujjatini tasdiqlab, ishonch reytingini oshirishi mumkin.',
    ],
    faq: [
      {
        q: 'Maklersiz uy topish nimani anglatadi?',
        a:
          'E’lonni uyning egasi joylaydi va u bilan siz bevosita gaplashasiz. '
          + 'Vositachi bo‘lmagani uchun bir oylik ijara haqiga teng keladigan komissiya to‘lamaysiz, '
          + 'uy haqidagi savollarga esa haqiqiy javob olasiz.',
      },
      {
        q: 'Saytdan foydalanish pulikmi?',
        a:
          'Yo‘q. Qidirish, e’lon ko‘rish, raqam olish va e’lon joylash — hammasi bepul. '
          + 'Xizmat haqi so‘ragan har qanday odam makler hisoblanadi va shikoyat qilinishi kerak.',
      },
      {
        q: 'Maklerlar e’lon joylay olmaydimi?',
        a:
          'Urinishlari bo‘ladi. Shuning uchun har bir e’lon matni va rasmlari avtomatik '
          + 'tahlildan o‘tadi, uy egasi esa pasport va kadastr hujjatini tasdiqlashi mumkin. '
          + 'Shubhali e’lonni foydalanuvchilar bir bosishda belgilaydi va moderator ko‘rib chiqadi.',
      },
      {
        q: 'Qaysi shaharlarda ishlaydi?',
        a:
          'Platforma O‘zbekistonning barcha viloyatlari uchun ochiq. Eng ko‘p e’lon '
          + 'Toshkent shahrida, undan keyin Samarqand, Buxoro va Farg‘ona vodiysi shaharlarida.',
      },
      {
        q: 'Uy egasi bo‘lsam, e’lonni qanday joylayman?',
        a:
          'Ro‘yxatdan o‘ting, telefon raqamingizni tasdiqlang va "E’lon berish" tugmasini bosing. '
          + 'Rasm, narx va manzilni kiritganingizdan so‘ng e’lon tekshiruvdan o‘tib chop etiladi. '
          + 'Bu ham bepul.',
      },
    ],
  },

  catalog: {
    title: `Barcha ijara e’lonlari — maklersiz${SUFFIX}`,
    description:
      'O‘zbekiston bo‘ylab barcha maklersiz ijara e’lonlari. Tuman, narx, xonalar soni va '
      + 'metro bekati bo‘yicha filtrlang.',
    h1: 'Barcha ijara e’lonlari',
    intro: [
      'Platformadagi barcha faol e’lonlar shu yerda. Filtrlar yordamida tumanni, narx '
        + 'oralig‘ini, xonalar sonini va kerakli qulayliklarni tanlang.',
    ],
  },

  landing: {
    categoryTitle: (category) =>
      `${category.headline.charAt(0).toUpperCase()}${category.headline.slice(1)}${SUFFIX}`,
    categoryDescription: (category) =>
      `${category.blurb} Uy egasidan to‘g‘ridan-to‘g‘ri, komissiyasiz. `
      + `O‘zbekiston bo‘ylab tekshirilgan e’lonlar.`,
    categoryH1: (category) =>
      `${category.headline.charAt(0).toUpperCase()}${category.headline.slice(1)}`,
    categoryIntro: (category) => [
      `${category.blurb} ${NO_BROKER_LINE}`,
      'Quyidagi ro‘yxat real vaqtda yangilanadi. Hududni tanlang yoki narx bo‘yicha saralang — '
        + 'kerakli variantni tezroq topasiz.',
    ],

    regionTitle: (place) => `${place.inPlace} maklersiz ijara${SUFFIX}`,
    regionDescription: (place) =>
      `${place.inPlace} uy egalaridan to‘g‘ridan-to‘g‘ri ijaraga beriladigan kvartira, uy va `
      + `xonalar. Vositachisiz, komissiya 0%.`,
    regionH1: (place) => `${place.inPlace} maklersiz uy-joy ijarasi`,

    placeCategoryTitle: (place, category) =>
      `${place.inPlace} ${category.headline}${SUFFIX}`,
    placeCategoryDescription: (place, category) =>
      `${place.inPlace} ijaraga beriladigan ${category.plural}. `
      + `Uy egasidan to‘g‘ridan-to‘g‘ri, maklersiz va komissiyasiz.`,
    placeCategoryH1: (place, category) => `${place.inPlace} ${category.headline}`,

    placeIntro,
    placeFaq,
  },

  views: {
    map: {
      title: `Xaritada maklersiz uy va kvartiralar${SUFFIX}`,
      description:
        'Ijaraga beriladigan uy va kvartiralarni xaritada ko‘ring: qaysi ko‘chada, '
        + 'metroga qancha yaqin. Barchasi uy egalaridan, komissiyasiz.',
    },
    studentProgram: {
      title: `Talabalar uchun ijara dasturi${SUFFIX}`,
      description:
        'Universitetga yaqin, yotoqxonaga muqobil narxdagi uylar va sheriklik. '
        + 'Talabalar uchun alohida shartlar, maklersiz.',
    },
    ecosystem: {
      title: `Maklersiz Uy ekotizimi — nima ustida ishlayapmiz${SUFFIX}`,
      description:
        'Platformaning keyingi bosqichlari: tekshiruv, shartnoma, to‘lov va uy egasi '
        + 'uchun asboblar. Qaysi biri tayyor, qaysi biri yo‘lda.',
    },
  },
  listing: {
    title: ({ title, district, rooms }) => {
      const bits = [
        rooms ? `${rooms} xonali` : '',
        district ? displayPlaceName(district) : '',
      ].filter(Boolean);
      const prefix = bits.length ? `${bits.join(', ')} — ` : '';
      return `${prefix}${title}`.slice(0, 65);
    },
    description: ({ title, district, rooms, area, price }) => {
      const bits = [
        rooms ? `${rooms} xonali` : null,
        area ? `${area} m²` : null,
        district ? displayPlaceName(district) : null,
        price,
      ].filter(Boolean);
      return `${bits.join(' · ')}. ${title}. Maklersiz, uy egasidan to‘g‘ridan-to‘g‘ri.`.slice(
        0,
        300,
      );
    },
    loadingTitle: `E’lon yuklanmoqda${SUFFIX}`,
    notFoundTitle: `E’lon topilmadi${SUFFIX}`,
  },

  articles: UZ_ARTICLES,
  help: UZ_HELP,
};

export default UZ_COPY;
