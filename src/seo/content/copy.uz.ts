/**
 * Uzbek SEO copy — the source of truth for the pack's structure.
 *
 * Two rules the text here follows, and the reason for each:
 *
 *  - A page says what it is once, in the language people search in, and then
 *    spends the rest of its words being useful. Repeating "kvartira ijarasi
 *    Toshkent" six times is what keyword stuffing looks like, and Google has
 *    been demoting it since 2011.
 *  - Nothing claims a number the platform cannot prove. There is no "10 000
 *    e'lon" anywhere, because the count comes from the API at runtime and a
 *    hard-coded figure would be a lie the moment it was written.
 */

import { UZ_ARTICLES, UZ_HELP } from './articles.uz';
import { UZ_DISTRICT_PROFILES, UZ_REGION_PROFILES } from './places.uz';
import type { CategoryWords, CopyPack, FaqEntry, PlaceProfile, PlaceWords } from './types';

const SUFFIX = ' | Uyiz.uz';

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
    headline: 'kvartira ijarasi',
    blurb:
      'Ko‘p qavatli uylardagi alohida kvartiralar — oila, juftlik yoki yolg‘iz yashovchi uchun.',
  },
  house: {
    noun: 'uy',
    plural: 'uylar',
    label: 'Uy ijarasi',
    headline: 'uy ijarasi',
    blurb: 'Hovlili uylar va yakka tartibdagi turar joylar — ko‘proq joy va alohida kirish.',
  },
  room: {
    noun: 'xona',
    plural: 'xonalar',
    label: 'Xona ijarasi',
    headline: 'xona ijarasi',
    blurb: 'Umumiy kvartiradagi alohida xona — eng arzon va eng tez topiladigan variant.',
  },
  studio: {
    noun: 'studiya',
    plural: 'studiyalar',
    label: 'Studiya ijarasi',
    headline: 'studiya ijarasi',
    blurb: 'Yotoq va oshxona bir xonada — yolg‘iz yashovchi va yosh juftliklar uchun.',
  },
  roommate: {
    noun: 'sherikchilik',
    plural: 'sherikchilik e’lonlari',
    label: 'Sheriklikka ijara',
    headline: 'sheriklikka ijara',
    blurb:
      'Ijara haqini bo‘lishib to‘laydigan sherik izlayotganlar uchun. Jins bo‘yicha alohida tanlash bor.',
  },
  student: {
    noun: 'talabalar uchun uy',
    plural: 'talabalar uchun uylar',
    label: 'Talabalar uchun ijara',
    headline: 'talabalar uchun ijara',
    blurb:
      'Universitetga yaqin, yotoqxonaga muqobil bo‘ladigan narxdagi uylar va sherikchilik.',
  },
  family: {
    noun: 'oilaviy kvartira',
    plural: 'oilaviy kvartiralar',
    label: 'Oilalar uchun ijara',
    headline: 'oilalar uchun ijara',
    blurb: 'Ikki va undan ortiq xonali, uzoq muddatga topshiriladigan turar joylar.',
  },
  budget: {
    noun: 'arzon ijara',
    plural: 'arzon variantlar',
    label: 'Arzon ijara',
    headline: 'arzon ijara',
    blurb: 'Oyiga 3 million so‘mgacha bo‘lgan e’lonlar, narx bo‘yicha saralangan.',
  },
};

/**
 * The one sentence every landing page's first paragraph ends with.
 *
 * It describes how the marketplace works — the number is in the advert and the
 * two sides talk to each other — and deliberately says nothing about who the
 * other side is. Uy egasi ham, agentlik ham e’lon joylaydi.
 */
const MARKETPLACE_LINE =
  'Har bir e’londa telefon raqam ochiq: kelishuvni e’lon beruvchi bilan '
  + 'to‘g‘ridan-to‘g‘ri o‘zingiz qilasiz.';

function placeIntro(
  place: PlaceWords,
  category: CategoryWords | null,
  profile: PlaceProfile | null,
  metroStations: string[],
): string[] {
  const what = category ? category.plural : 'uy va kvartiralar';
  const paragraphs: string[] = [
    `${place.inPlace} ijaraga beriladigan ${what} — bitta ro‘yxatda. `
      + MARKETPLACE_LINE,
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
    'Har bir e’londa ishonchlilik foizi ko‘rsatiladi. Shikoyat kelib, moderator uni '
      + 'tasdiqlasa, foiz pasayadi — shubhali e’lonni bir bosishda belgilab qoldirishingiz '
      + 'mumkin.',
  );

  return paragraphs;
}

function placeFaq(place: PlaceWords, category: CategoryWords | null): FaqEntry[] {
  const what = category ? category.noun : 'uy';
  return [
    {
      q: `${place.inPlace} ${what} qanday topiladi?`,
      a:
        `Yuqoridagi ro‘yxatni narx, xonalar soni va hudud bo‘yicha filtrlang. `
        + `Sizga yoqqan e’lonni oching, telefon raqamni ko‘ring va e’lon beruvchining `
        + `o‘ziga qo‘ng‘iroq qiling.`,
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
        'Platformadan foydalanish bepul: qidiruv, e’lon ko‘rish va e’lon joylash uchun haq '
        + 'olinmaydi. Kelishuv shartlari e’lon beruvchi bilan sizning o‘rtangizda hal '
        + 'qilinadi.',
    },
    {
      q: 'E’lon haqiqiyligiga qanday ishonch hosil qilaman?',
      a:
        'E’lon beruvchining ishonchlilik foizi va tasdiqlash darajasi har bir e’londa '
        + 'ko‘rsatilgan. Pasport va kadastr hujjati tekshirilgan e’lonlar alohida belgi oladi. '
        + 'Uyni ko‘rmasdan turib oldindan pul o‘tkazmang.',
    },
  ];
}

export const UZ_COPY: CopyPack = {
  htmlLang: 'uz',
  ogLocale: 'uz_UZ',

  brand: {
    name: 'Uyiz',
    tagline: 'O‘zbekistondagi uy-joy ijarasi platformasi',
    about:
      'Uyiz — O‘zbekistonda uy, kvartira va xona ijarasi uchun e’lonlar platformasi. '
      + 'E’lonlar hudud, narx va xonalar soni bo‘yicha filtrlanadi.',
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
    title: `Kvartira va uy ijarasi O‘zbekistonda${SUFFIX}`,
    description:
      'Uyiz — O‘zbekiston bo‘ylab kvartira, uy va xona ijarasi e’lonlari. Hudud, narx, '
      + 'xonalar soni va metro bekati bo‘yicha filtrlab, o‘zingizga mosini toping.',
    h1: 'O‘zbekistonda uy va kvartira ijarasi',
    intro: [
      'Uyiz — O‘zbekistondagi ijara e’lonlari platformasi. E’lonni uy egasi ham, agentlik '
        + 'ham joylashi mumkin; telefon raqam e’londa ochiq va kelishuvni tomonlar o‘zaro '
        + 'qiladi.',
      'Kvartira, hovlili uy, studiya, alohida xona va sheriklikka joy — barchasi bitta joyda. '
        + 'Tuman, metro bekati, universitetga yaqinlik va narx bo‘yicha filtrlab, o‘zingizga '
        + 'to‘g‘ri keladiganini toping.',
      'Har bir e’londa ishonchlilik foizi ko‘rsatiladi: shikoyat kelib, moderator uni '
        + 'tasdiqlasa, foiz pasayadi. E’lon beruvchilar pasport va mulk hujjatini tasdiqlab, '
        + 'alohida belgi olishi mumkin.',
    ],
    faq: [
      {
        q: 'Uyiz nima?',
        a:
          'Uyiz — O‘zbekiston bo‘ylab uy, kvartira va xona ijarasi e’lonlari to‘planadigan '
          + 'platforma. E’lonni ko‘rasiz, telefon raqamni olasiz va kelishuvni e’lon beruvchi '
          + 'bilan o‘zingiz qilasiz.',
      },
      {
        q: 'Saytdan foydalanish pulikmi?',
        a:
          'Yo‘q. Qidirish, e’lon ko‘rish, raqam olish va e’lon joylash — hammasi bepul. '
          + 'Platforma nomidan pul so‘ragan har qanday odam qoidabuzar hisoblanadi va shikoyat '
          + 'qilinishi kerak.',
      },
      {
        q: 'E’lonni kim joylay oladi?',
        a:
          'Uy egasi ham, professional agentlik ham. Har bir e’londa uni kim joylagani va qay '
          + 'darajada tasdiqlangani ko‘rinadi, shuning uchun qo‘ng‘iroq qilishdan oldin kim bilan '
          + 'gaplashishingizni bilasiz.',
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
          + 'Kamida bitta rasm, narx va manzilni kiritganingizdan so‘ng e’lon darhol chop '
          + 'etiladi. Bu ham bepul.',
      },
    ],
  },

  catalog: {
    title: `Barcha ijara e’lonlari${SUFFIX}`,
    description:
      'O‘zbekiston bo‘ylab barcha faol ijara e’lonlari: kvartira, uy, xona va studiya. '
      + 'Tuman, narx, xonalar soni va metro bekati bo‘yicha filtrlang.',
    h1: 'Barcha ijara e’lonlari',
    intro: [
      'Platformadagi barcha faol e’lonlar shu yerda. Filtrlar yordamida tumanni, narx '
        + 'oralig‘ini, xonalar sonini va kerakli qulayliklarni tanlang.',
    ],
  },

  landing: {
    // A category page names no place, so the country carries the search
    // intent instead: "Kvartira ijarasi" on its own is too thin to rank.
    categoryTitle: (category) =>
      `${category.headline.charAt(0).toUpperCase()}${category.headline.slice(1)}`
      + ` — O‘zbekiston${SUFFIX}`,
    categoryDescription: (category) =>
      `${category.blurb} O‘zbekiston bo‘ylab e’lonlar — narx va hudud bo‘yicha filtrlang.`,
    categoryH1: (category) =>
      `${category.headline.charAt(0).toUpperCase()}${category.headline.slice(1)}`,
    categoryIntro: (category) => [
      `${category.blurb} ${MARKETPLACE_LINE}`,
      'Quyidagi ro‘yxat real vaqtda yangilanadi. Hududni tanlang yoki narx bo‘yicha saralang — '
        + 'kerakli variantni tezroq topasiz.',
    ],

    regionTitle: (place) => `${place.inPlace} uy va kvartira ijarasi${SUFFIX}`,
    regionDescription: (place) =>
      `${place.inPlace} ijaraga beriladigan kvartira, uy va xonalar. Narx, xonalar soni, `
      + `metro bekati va qulayliklar bo‘yicha filtrlab toping.`,
    regionH1: (place) => `${place.inPlace} uy-joy ijarasi`,

    placeCategoryTitle: (place, category) =>
      `${place.inPlace} ${category.headline}${SUFFIX}`,
    placeCategoryDescription: (place, category) =>
      `${place.inPlace} ijaraga beriladigan ${category.plural}. Narx, xonalar soni va metro `
      + `bekati bo‘yicha filtrlang, e’lon beruvchi bilan bog‘laning.`,
    placeCategoryH1: (place, category) => `${place.inPlace} ${category.headline}`,

    placeIntro,
    placeFaq,
  },

  views: {
    map: {
      title: `Xaritada ijara e’lonlari${SUFFIX}`,
      description:
        'Ijaraga beriladigan uy va kvartiralarni xaritada ko‘ring: qaysi ko‘chada '
        + 'joylashgan va metro bekatiga qancha yaqin ekani darhol ko‘rinadi.',
    },
    studentProgram: {
      title: `Talabalar uchun ijara dasturi${SUFFIX}`,
      description:
        'Universitetga yaqin, yotoqxonaga muqobil narxdagi uylar va sheriklik. '
        + 'Talabalar uchun alohida shartlar va filtrlar.',
    },
    ecosystem: {
      title: `Uyiz ekotizimi — nima ustida ishlayapmiz${SUFFIX}`,
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
      return `${bits.join(' · ')}. ${title}. Uyiz — ijara e’lonlari.`.slice(
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
