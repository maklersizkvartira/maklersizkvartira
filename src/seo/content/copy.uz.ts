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
import type { PropertyTypeCode } from '../taxonomy';

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
    placeBlurb:
      'Kvartira bu hududda eng ko‘p uchraydigan variant, va uning narxini asosan uchta narsa '
      + 'belgilaydi: xonalar soni, ta’mir holati va markazgacha bo‘lgan vaqt. Lift, isitish va '
      + 'avtoturargoh haqidagi ma’lumot e’londa yozilgan bo‘lsa, ko‘chib o‘tishdan oldin '
      + 'o‘zingiz tekshirib oling.',
    findTip: 'Ro‘yxatni xonalar soni, narx va qavat bo‘yicha filtrlang.',
    priceTip:
      'Kvartira narxini eng ko‘p uchta narsa o‘zgartiradi: xonalar soni, ta’mir holati va '
      + 'markazgacha bo‘lgan masofa.',
  },
  house: {
    noun: 'uy',
    // Nobody searches "uylar" for a detached house; they search "hovli".
    // `noun` stays 'uy' because the slug `uy-ijaraga` — and the eighty live
    // URLs built on it — must not move.
    plural: 'hovli uylar',
    label: 'Hovli uy ijarasi',
    headline: 'hovli uy ijarasi',
    blurb: 'Hovlili uylar va yakka tartibdagi turar joylar — ko‘proq joy va alohida kirish.',
    placeBlurb:
      'Hovli uyda joy ko‘proq, kirish alohida, ko‘pincha avtoturargoh ham bor. Shartnoma '
      + 'imzolashdan oldin isitish turi, suv va gaz ta’minoti hamda hovlidan foydalanish '
      + 'chegarasi aniq kelishib olinadi — bular kvartira ijarasida umuman chiqmaydigan '
      + 'savollar.',
    findTip:
      'Hovli uyda maydon va hovlining o‘lchami xonalar sonidan muhimroq — filtrda avval '
      + 'shularga qarang.',
    priceTip:
      'Hovli uy narxi yer maydoni, isitish turi va shahar markazidan uzoqligiga qarab '
      + 'belgilanadi.',
  },
  room: {
    noun: 'xona',
    plural: 'xonalar',
    label: 'Xona ijarasi',
    headline: 'xona ijarasi',
    blurb: 'Umumiy kvartiradagi alohida xona — eng arzon va eng tez topiladigan variant.',
    placeBlurb:
      'Alohida xona — bu hududga eng kam pul bilan kirib kelish yo‘li. Oshxona va hammom '
      + 'umumiy bo‘lgani uchun kim bilan yashashingiz, qo‘shnilar soni va uy qoidalari xona '
      + 'maydonidan ham muhimroq bo‘lib chiqadi.',
    findTip:
      'Alohida xona izlayotganda xonalar soni bo‘yicha filtr ish bermaydi: narx va tumanni '
      + 'tanlang, qolganini e’lon matnidan o‘qing.',
    priceTip:
      'Xona ijarasi butun kvartiradan sezilarli arzon, chunki oshxona va hammom umumiy '
      + 'bo‘ladi.',
  },
  studio: {
    noun: 'studiya',
    plural: 'studiyalar',
    label: 'Studiya ijarasi',
    headline: 'studiya ijarasi',
    blurb: 'Yotoq va oshxona bir xonada — yolg‘iz yashovchi va yosh juftliklar uchun.',
    placeBlurb:
      'Studiyada yotoq joyi va oshxona bir xonada bo‘ladi, shuning uchun kundalik qulaylikni '
      + 'xonalar soni emas, maydon, shift balandligi va derazaning qayerga qarashi hal qiladi.',
    findTip:
      'Studiyada xona bitta, shuning uchun filtrda xonalar sonini emas, maydon va tumanni '
      + 'tanlang.',
    priceTip:
      'Studiya odatda bir xonali kvartiradan arzonroq, lekin markazda ikkalasining narxi '
      + 'deyarli tenglashadi.',
  },
  roommate: {
    noun: 'sherikchilik',
    plural: 'sherikchilik e’lonlari',
    label: 'Sheriklikka ijara',
    headline: 'sheriklikka ijara',
    // Shortened to one sentence: with the description template's tail this
    // used to come out at 162 characters and was clamped mid-phrase. The
    // gender filter it named now lives in `findTip`, where it is advice.
    blurb: 'Ijara haqini bo‘lishib to‘laydigan sherik izlayotganlar uchun.',
    placeBlurb:
      'Sheriklikda siz butun uyni emas, undagi joyni olasiz. E’londa sherik jinsi va nechta '
      + 'joy bo‘shligi ko‘rsatiladi; ijara haqi bilan kommunal to‘lov qanday bo‘linishini esa '
      + 'birinchi suhbatdayoq aniqlashtirib oling.',
    findTip:
      'Sheriklikda sherik jinsi va bo‘sh joylar soni ko‘rsatiladi — filtrni xonalar sonidan '
      + 'emas, shulardan boshlang.',
    priceTip:
      'Sheriklikda ijara haqi va kommunal to‘lov sheriklar o‘rtasida bo‘linadi — summalar '
      + 'butun kvartira narxidan past bo‘ladi.',
  },
  student: {
    noun: 'talabalar uchun uy',
    plural: 'talabalar uchun uylar',
    label: 'Talabalar uchun ijara',
    headline: 'talabalar uchun ijara',
    blurb:
      'Universitetga yaqin, yotoqxonaga muqobil bo‘ladigan narxdagi uylar va sherikchilik.',
    placeBlurb:
      'Talaba uchun asosiy o‘lchov — darsga ketadigan vaqt. Kampusgacha piyoda yoki bir marta '
      + 'transportda yetib boradigan uy, odatda, arzonroq lekin uzoqroq variantdan foydaliroq '
      + 'chiqadi: yo‘lkira va uyqu ham xarajat.',
    findTip:
      'Bu bo‘limga universitet nomi ko‘rsatilgan, kampus tumanidagi va sheriklikka '
      + 'beriladigan e’lonlar tushadi — universitetgacha bo‘lgan masofani mezon qiling.',
    priceTip:
      'Talaba uchun eng arzoni — sheriklik: butun kvartira o‘rniga undagi bitta joy uchun '
      + 'to‘laysiz.',
  },
  family: {
    noun: 'oilaviy kvartira',
    plural: 'oilaviy kvartiralar',
    label: 'Oilalar uchun ijara',
    headline: 'oilalar uchun ijara',
    blurb: 'Ikki va undan ortiq xonali, uzoq muddatga topshiriladigan turar joylar.',
    placeBlurb:
      'Oila uchun uy tanlashda maktab, bog‘cha va poliklinika masofasi narxdan keyingi '
      + 'ikkinchi mezon. Uzoq muddatga olinadigani uchun shartnoma muddatini va narx qachon, '
      + 'qanchaga oshishi mumkinligini boshidayoq yozib qo‘ying.',
    findTip:
      'Bu bo‘limda kamida ikki xonali, butun holda topshiriladigan uylar yig‘ilgan — filtrda '
      + 'xonalar sonini o‘zingizga qarab oshiring.',
    priceTip:
      'Oilaviy ijarada oylik narxdan tashqari kommunal to‘lov va maktabgacha bo‘lgan yo‘l ham '
      + 'hisobga olinadi.',
  },
  budget: {
    noun: 'arzon ijara',
    plural: 'arzon variantlar',
    label: 'Arzon ijara',
    headline: 'arzon ijara',
    blurb: 'Oyiga 3 million so‘mgacha bo‘lgan e’lonlar, narx bo‘yicha saralangan.',
    placeBlurb:
      'Arzon variantlar tez ketadi: e’lon chiqqan kuni qo‘ng‘iroq qilgan odam ko‘pincha '
      + 'birinchi bo‘ladi. Narxdan tashqari kommunal to‘lov kimning zimmasida ekanini ham '
      + 'so‘rab oling — u oylik xarajatni sezilarli o‘zgartiradi.',
    findTip:
      'Bu bo‘limdagi barcha e’lonlar oyiga 3 million so‘mgacha; qolganini tuman va xonalar '
      + 'soni bilan toraytiring.',
    priceTip:
      'Yuqori chegara — oyiga 3 million so‘m. Eng arzon variantlar odatda markazdan uzoqroq '
      + 'tumanlarda va sheriklikda chiqadi.',
  },
};

/**
 * The noun a listing's own head is built from.
 *
 * Four of the five codes have a landing page and take their word from
 * `CATEGORIES`; DORMITORY has neither, so it is named here. Without this line
 * a lookup by key would fall through to the raw enum value and put the
 * English word "dormitory" in the middle of an Uzbek title.
 */
const TYPE_NOUNS: Record<PropertyTypeCode, string> = {
  APARTMENT: CATEGORIES.apartment.noun,
  HOUSE: CATEGORIES.house.noun,
  ROOM: CATEGORIES.room.noun,
  STUDIO: CATEGORIES.studio.noun,
  DORMITORY: 'yotoqxona',
};

/**
 * A room count is meaningless on the three types that have one room by
 * definition: "1 xonali studiya" is noise, not information.
 */
const TYPES_WITH_ROOMS: ReadonlySet<PropertyTypeCode> = new Set<PropertyTypeCode>([
  'APARTMENT',
  'HOUSE',
]);

/** Titles beyond this are truncated in a result, so the head has to fit first. */
const LISTING_TITLE_MAX = 65;

/**
 * Appends the landlord's own title to the controlled head, but only as far as
 * the budget goes — the head is the part that has to survive truncation.
 */
function withOwnTitle(head: string, title: string): string {
  if (!head) return title.slice(0, LISTING_TITLE_MAX);
  const room = LISTING_TITLE_MAX - head.length - 3;
  // Under a few words the fragment says nothing and only eats the budget.
  if (room < 14) return head;
  if (title.length <= room) return `${head} — ${title}`;
  const cut = title.slice(0, room - 1);
  const space = cut.lastIndexOf(' ');
  return `${head} — ${cut.slice(0, space > 10 ? space : cut.length).trimEnd()}…`;
}

/**
 * The one sentence every landing page's first paragraph ends with.
 *
 * It describes how the marketplace works — the two sides settle the terms
 * between themselves — and deliberately says nothing about who the other side
 * is. Uy egasi ham, agentlik ham e’lon joylaydi.
 *
 * It used to open with "har bir e’londa telefon raqam ochiq". The API strips
 * `owner.phone` from every payload a stranger receives, so that sentence was
 * a promise the page could not keep for the visitor who arrived from a search
 * result — the landing-page half of a snippet mismatch.
 */
const MARKETPLACE_LINE =
  'Kelishuv shartlarini e’lon beruvchi bilan to‘g‘ridan-to‘g‘ri o‘zingiz hal qilasiz.';

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

  // What makes /toshkent/chilonzor/uy-ijaraga a different page from
  // /toshkent/chilonzor: the place profile below is the same on both, so
  // without this the two differ by a couple of words in one sentence.
  if (category) paragraphs.push(category.placeBlurb);

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
  // The first two answers are where a category page earns its place: the
  // generic "filter by price and rooms" is wrong advice on half of them, and
  // the useful half of a price answer is what moves the price *here*.
  const findTip =
    category?.findTip ?? 'Ro‘yxatni narx, xonalar soni va hudud bo‘yicha filtrlang.';
  const priceTip =
    category?.priceTip
    ?? 'Narx xonalar soni, uyning holati va joylashuviga qarab keskin farq qiladi.';
  return [
    {
      q: `${place.inPlace} ${what} qanday topiladi?`,
      a:
        `${findTip} So‘ng mos e’lonni oching va e’lon beruvchining o‘zi bilan bog‘laning: `
        + `kelishuvda platforma vositachi bo‘lmaydi.`,
    },
    {
      q: `${place.inPlace} ijara narxi qancha turadi?`,
      a:
        `${priceTip} Shuning uchun biz o‘rtacha raqam yozib qo‘ymaymiz — yuqoridagi ro‘yxatni `
        + 'narx bo‘yicha saralang, bugungi real narxlar shundoq ko‘rinadi.',
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
    // The filter list this used to end on is what every rival snippet says,
    // so it gave a searcher no reason to pick this result. What the platform
    // has and they mostly do not is that it costs nothing to use.
    categoryDescription: (category) =>
      `${category.blurb} O‘zbekiston bo‘ylab e’lonlar; qidirish ham, e’lon berish ham bepul.`,
    categoryH1: (category) =>
      `${category.headline.charAt(0).toUpperCase()}${category.headline.slice(1)}`,
    categoryIntro: (category) => [
      `${category.blurb} ${MARKETPLACE_LINE}`,
      'Quyidagi ro‘yxat real vaqtda yangilanadi. Hududni tanlang yoki narx bo‘yicha saralang — '
        + 'kerakli variantni tezroq topasiz.',
    ],

    regionTitle: (place) => `${place.inPlace} uy va kvartira ijarasi${SUFFIX}`,
    // The metro clause is kept, not deleted: it is true and it is worth
    // reading on the Tashkent pages. It is only false on the thirteen regions
    // that have no metro at all, which is what `hasMetro` decides.
    regionDescription: (place, hasMetro) =>
      `${place.inPlace} ijaraga beriladigan kvartira, uy va xonalar. `
      + (hasMetro ? 'Metro bekati bo‘yicha ham saralaysiz. ' : '')
      + 'Qidirish ham, e’lon berish ham bepul.',
    regionH1: (place) => `${place.inPlace} uy-joy ijarasi`,

    placeCategoryTitle: (place, category) =>
      `${place.inPlace} ${category.headline}${SUFFIX}`,
    placeCategoryDescription: (place, category, hasMetro) =>
      `${place.inPlace} ijaraga beriladigan ${category.plural}. `
      + (hasMetro ? 'Metro bekati bo‘yicha ham saralaysiz. ' : '')
      + 'Qidirish ham, e’lon berish ham bepul.',
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
      // This described proximity to universities, which is what
      // /talabalar-uchun-ijara already says — two indexable pages whose
      // descriptions agreed for their first sixty characters. This one
      // describes the programme itself: what it does and what it asks of you.
      // It claims no student discount or verified-student terms, because
      // nothing in the API grants either; the hero's "talaba bonusi" chip has
      // no rule behind it yet.
      description:
        'Universitetingizni tanlaysiz — dastur o‘sha kampus tumanidagi talabalarga mos '
        + 'e’lonlarni yig‘adi: kvartira ham, sheriklik ham. Ro‘yxatdan o‘tish bepul.',
    },
    login: {
      title: `Kirish${SUFFIX}`,
      description:
        'Telefon raqamingiz va parolingiz bilan Uyiz hisobingizga kiring.',
    },
    register: {
      title: `Ro‘yxatdan o‘tish${SUFFIX}`,
      description:
        'Uy egasi, ko‘chmas mulk agenti yoki uy izlayotgan sifatida bepul '
        + 'ro‘yxatdan o‘ting — bir daqiqada.',
    },
    forgotPassword: {
      title: `Parolni tiklash${SUFFIX}`,
      description:
        'Telefon raqamingizga SMS kod yuboramiz va yangi parol o‘rnatasiz.',
    },
    ecosystem: {
      title: `Uyiz ekotizimi — nima ustida ishlayapmiz${SUFFIX}`,
      description:
        'Platformaning keyingi bosqichlari: tekshiruv, shartnoma, to‘lov va uy egasi '
        + 'uchun asboblar. Qaysi biri tayyor, qaysi biri yo‘lda.',
    },
  },
  listing: {
    // The landlord's own title is whatever they typed, so the search-legible
    // part is built here instead — from the place, the room count and the
    // property type — and their words are appended only as far as the budget
    // stretches.
    title: ({ title, district, rooms, propertyType }) => {
      const kind = propertyType ? TYPE_NOUNS[propertyType] : '';
      const countable = !propertyType || TYPES_WITH_ROOMS.has(propertyType);
      const head = [
        district ? locative(shortName(district)) : '',
        rooms && countable ? `${rooms} xonali` : '',
        kind ? `${kind} ijaraga` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return withOwnTitle(head, title);
    },
    description: ({ title, district, rooms, area, price, propertyType }) => {
      const kind = propertyType ? TYPE_NOUNS[propertyType] : null;
      const countable = !propertyType || TYPES_WITH_ROOMS.has(propertyType);
      const bits = [
        rooms && countable ? `${rooms} xonali${kind ? ` ${kind}` : ''}` : kind,
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
