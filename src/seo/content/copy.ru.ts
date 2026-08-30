/**
 * Russian SEO copy — structurally identical to `copy.uz.ts`, written from
 * scratch rather than translated.
 *
 * Three things this file does that the Uzbek one does not have to:
 *
 *  - It declines place names. Russian puts a rented flat "в Чиланзаре", not
 *    "Чиланзар", and no suffix rule produces that from the stored Uzbek name,
 *    so `placeWords` looks the name up in a table of real Russian forms
 *    ("Toshkent shahri" -> Ташкент / в Ташкенте, "Olmazor" -> Алмазар /
 *    в Алмазаре). The Record keys stay the Latin slugs; only the prose moves.
 *  - It counts in Russian. `resultsCount` has to pick between «объявление»,
 *    «объявления» and «объявлений», which is a three-way rule, not an `s`.
 *  - It keeps the category noun out of the accusative. Every plural here is
 *    inanimate, so `category.plural` is safe wherever a direct object is
 *    needed ("найти квартиры"), and the singular `noun` is never put in a
 *    position that would inflect it.
 *
 * The two rules from the Uzbek pack carry over unchanged: a page states what
 * it is once and then spends its words being useful, and nothing claims a
 * number the platform cannot prove.
 */

import { RU_ARTICLES, RU_HELP } from './articles.ru';
import { RU_DISTRICT_PROFILES, RU_REGION_PROFILES } from './places.ru';
import type { CategoryWords, CopyPack, FaqEntry, PlaceProfile, PlaceWords } from './types';

const SUFFIX = ' | Uyiz.uz';

/** Sentence case for a phrase stored lowercase, e.g. a category headline. */
function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Place names arrive as they are stored — Uzbek Latin, with any of the three
 * apostrophe characters the data file mixes. Lookups are done on a form with
 * those stripped so `Mirzo Ulugʻbek` and `Mirzo Ulug'bek` find one entry.
 */
function lookupKey(name: string): string {
  return name
    .trim()
    .replace(/['‘’ʻʼ`´]/g, '')
    .toLowerCase();
}

/**
 * Regions in the three forms the templates need.
 *
 * `short` is the city rather than the oblast — "Самарканд", not
 * "Самаркандская область" — because that is what a breadcrumb has room for
 * and what people type when they are looking for somewhere to live. The full
 * administrative name stays in `name`.
 */
const REGION_WORDS: Record<string, PlaceWords> = {
  'toshkent shahri': { name: 'Ташкент', short: 'Ташкент', inPlace: 'в Ташкенте' },
  'toshkent viloyati': {
    name: 'Ташкентская область',
    short: 'Ташкентская область',
    inPlace: 'в Ташкентской области',
  },
  'samarqand viloyati': {
    name: 'Самаркандская область',
    short: 'Самарканд',
    inPlace: 'в Самарканде',
  },
  'fargona viloyati': { name: 'Ферганская область', short: 'Фергана', inPlace: 'в Фергане' },
  'andijon viloyati': { name: 'Андижанская область', short: 'Андижан', inPlace: 'в Андижане' },
  'namangan viloyati': { name: 'Наманганская область', short: 'Наманган', inPlace: 'в Намангане' },
  'buxoro viloyati': { name: 'Бухарская область', short: 'Бухара', inPlace: 'в Бухаре' },
  'qashqadaryo viloyati': {
    name: 'Кашкадарьинская область',
    short: 'Кашкадарья',
    inPlace: 'в Кашкадарье',
  },
  'surxondaryo viloyati': {
    name: 'Сурхандарьинская область',
    short: 'Сурхандарья',
    inPlace: 'в Сурхандарье',
  },
  'xorazm viloyati': { name: 'Хорезмская область', short: 'Хорезм', inPlace: 'в Хорезме' },
  'navoiy viloyati': { name: 'Навоийская область', short: 'Навои', inPlace: 'в Навои' },
  'jizzax viloyati': { name: 'Джизакская область', short: 'Джизак', inPlace: 'в Джизаке' },
  'sirdaryo viloyati': { name: 'Сырдарьинская область', short: 'Сырдарья', inPlace: 'в Сырдарье' },
  'qoraqalpogiston respublikasi': {
    name: 'Республика Каракалпакстан',
    short: 'Каракалпакстан',
    inPlace: 'в Каракалпакстане',
  },
};

/** The twelve Tashkent districts, in their established Russian forms. */
const DISTRICT_WORDS: Record<string, PlaceWords> = {
  chilonzor: { name: 'Чиланзар', short: 'Чиланзар', inPlace: 'в Чиланзаре' },
  yunusobod: { name: 'Юнусабад', short: 'Юнусабад', inPlace: 'в Юнусабаде' },
  mirobod: { name: 'Мирабад', short: 'Мирабад', inPlace: 'в Мирабаде' },
  'mirzo ulugbek': { name: 'Мирзо-Улугбек', short: 'Мирзо-Улугбек', inPlace: 'в Мирзо-Улугбеке' },
  olmazor: { name: 'Алмазар', short: 'Алмазар', inPlace: 'в Алмазаре' },
  yakkasaroy: { name: 'Яккасарай', short: 'Яккасарай', inPlace: 'в Яккасарае' },
  sergeli: { name: 'Сергели', short: 'Сергели', inPlace: 'в Сергели' },
  shayxontohur: { name: 'Шайхантахур', short: 'Шайхантахур', inPlace: 'в Шайхантахуре' },
  yashnobod: { name: 'Яшнабад', short: 'Яшнабад', inPlace: 'в Яшнабаде' },
  uchtepa: { name: 'Учтепа', short: 'Учтепа', inPlace: 'в Учтепе' },
  bektemir: { name: 'Бектемир', short: 'Бектемир', inPlace: 'в Бектемире' },
  yangihayot: { name: 'Янгихаёт', short: 'Янгихаёт', inPlace: 'в Янгихаёте' },
};

/**
 * Everything outside the two tables — a district of a region that does not
 * get its own pages, say — keeps its stored spelling and gets the preposition
 * without an ending, which is what Russian does with a name it cannot decline.
 */
function fallbackWords(name: string): PlaceWords {
  const short = name
    .trim()
    .replace(/\s+sh\.$/i, '')
    .replace(/\s+t(um)?\.$/i, '')
    .trim();
  return { name: short, short, inPlace: `в ${short}` };
}

function placeWords(name: string, kind: 'region' | 'district'): PlaceWords {
  const key = lookupKey(name);
  const primary = kind === 'district' ? DISTRICT_WORDS[key] : REGION_WORDS[key];
  if (primary) return primary;
  const secondary = kind === 'district' ? REGION_WORDS[key] : DISTRICT_WORDS[key];
  if (secondary) return secondary;
  return fallbackWords(name);
}

/** The Russian name of a district, for listing titles built from raw data. */
function displayPlaceName(name: string): string {
  return placeWords(name, 'district').name;
}

/** «1 объявление», «2 объявления», «5 объявлений». */
function plural(count: number, one: string, few: string, many: string): string {
  const teens = Math.abs(count) % 100;
  if (teens >= 11 && teens <= 14) return many;
  const last = Math.abs(count) % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

const CATEGORIES: Record<string, CategoryWords> = {
  apartment: {
    noun: 'квартира',
    plural: 'квартиры',
    label: 'Аренда квартир',
    headline: 'аренда квартир',
    blurb:
      'Отдельные квартиры в многоэтажных домах — для семьи, пары или тех, кто живёт один.',
  },
  house: {
    noun: 'дом',
    plural: 'дома',
    label: 'Аренда домов',
    headline: 'аренда домов',
    blurb: 'Дома с участком и отдельные постройки — больше места и собственный вход.',
  },
  room: {
    noun: 'комната',
    plural: 'комнаты',
    label: 'Аренда комнат',
    headline: 'аренда комнат',
    blurb: 'Отдельная комната в общей квартире — самый доступный и самый быстрый вариант.',
  },
  studio: {
    noun: 'студия',
    plural: 'студии',
    label: 'Аренда студий',
    headline: 'аренда студий',
    blurb: 'Спальня и кухня в одном пространстве — для одного человека и молодых пар.',
  },
  roommate: {
    noun: 'подселение',
    plural: 'объявления о подселении',
    label: 'Подселение',
    headline: 'подселение',
    blurb:
      'Для тех, кто ищет соседа и делит плату за жильё. Есть отдельный отбор по полу.',
  },
  student: {
    noun: 'жильё для студентов',
    plural: 'жильё для студентов',
    label: 'Жильё для студентов',
    headline: 'жильё для студентов',
    blurb:
      'Рядом с вузом и по цене, которая может заменить общежитие: квартиры, комнаты и подселение.',
  },
  family: {
    noun: 'семейная квартира',
    plural: 'семейные квартиры',
    label: 'Жильё для семей',
    headline: 'семейное жильё',
    blurb: 'Жильё от двух комнат, которое сдают на длительный срок.',
  },
  budget: {
    noun: 'недорогая аренда',
    plural: 'бюджетные варианты',
    label: 'Недорогая аренда',
    headline: 'недорогая аренда',
    blurb: 'Объявления до 3 млн сум в месяц, отсортированные по цене.',
  },
};

/**
 * Единственная фраза, которой заканчивается первый абзац каждой посадочной
 * страницы: как площадка устроена — телефон в объявлении, стороны говорят
 * между собой — и ни слова о том, кто именно на другой стороне.
 */
const MARKETPLACE_LINE =
  'Телефон указан прямо в объявлении: вы договариваетесь с тем, кто его разместил, '
  + 'напрямую.';

function placeIntro(
  place: PlaceWords,
  category: CategoryWords | null,
  profile: PlaceProfile | null,
  metroStations: string[],
): string[] {
  const what = category ? category.plural : 'квартиры и дома';
  const paragraphs: string[] = [
    `${cap(what)} ${place.inPlace} — в одном списке. ` + MARKETPLACE_LINE,
  ];

  if (profile?.about) paragraphs.push(profile.about);

  if (metroStations.length > 0) {
    const list = metroStations.slice(0, 5).join(', ');
    paragraphs.push(
      `Тем, кто ездит на метро: ${place.inPlace} работают станции ${list}. `
        + 'Если в объявлении указано, сколько минут пешком до станции, этот параметр можно '
        + 'задать и в фильтрах.',
    );
  }

  paragraphs.push(
    'В каждом объявлении показан рейтинг доверия. Он снижается, когда на объявление '
      + 'поступает жалоба и модератор её подтверждает, — пожаловаться можно в одно '
      + 'нажатие.',
  );

  return paragraphs;
}

function placeFaq(place: PlaceWords, category: CategoryWords | null): FaqEntry[] {
  const what = category ? category.plural : 'жильё';
  // On the category pages there is no place at all, only the brand name, so
  // the locative is left out rather than glued into the middle of a question.
  const where = place.short ? ` ${place.inPlace}` : '';
  return [
    {
      q: `Как найти ${what}${where}?`,
      a:
        'Сузьте список выше фильтрами по цене, числу комнат и району, откройте подходящее '
        + 'объявление и посмотрите номер телефона. Звонить вы будете напрямую тому, кто это '
        + 'объявление разместил.',
    },
    {
      q: `Сколько стоит аренда${where}?`,
      a:
        'Цена сильно зависит от числа комнат, состояния жилья и расположения, поэтому мы не '
        + 'пишем среднюю цифру. Отсортируйте список выше по цене — реальные цены на сегодня '
        + 'видны сразу.',
    },
    {
      q: 'Есть ли комиссия или плата за услуги?',
      a:
        'Пользование площадкой бесплатно: поиск, просмотр объявлений и их размещение не '
        + 'тарифицируются. Условия сделки вы обсуждаете напрямую с автором объявления.',
    },
    {
      q: 'Как убедиться, что объявление настоящее?',
      a:
        'Рейтинг доверия автора объявления и уровень верификации указаны в каждом объявлении. '
        + 'Объявления с проверенным паспортом и документом на жильё получают отдельный знак. '
        + 'Не переводите деньги, пока не увидели квартиру.',
    },
  ];
}

export const RU_COPY: CopyPack = {
  htmlLang: 'ru',
  ogLocale: 'ru_RU',

  brand: {
    name: 'Uyiz',
    tagline: 'Площадка аренды жилья в Узбекистане',
    about:
      'Uyiz — площадка объявлений об аренде квартир, домов и комнат в Узбекистане. '
      + 'Объявления фильтруются по региону, цене и числу комнат.',
  },

  common: {
    breadcrumbHome: 'Главная',
    allListings: 'Все объявления',
    listingsIn: (place) => `Объявления: ${place}`,
    resultsCount: (count) =>
      count === 0
        ? 'Пока объявлений нет'
        : `Найдено ${count} ${plural(count, 'объявление', 'объявления', 'объявлений')}`,
    emptyTitle: 'В этом разделе пока нет объявлений',
    emptyBody:
      'Посмотрите соседние районы и разделы или загляните позже — новые объявления '
      + 'появляются каждый день.',
    faqHeading: 'Частые вопросы',
    exploreHeading: 'Смотрите также',
    nearbyHeading: 'Районы поблизости',
    categoriesHeading: 'Разделы',
    regionsHeading: 'По регионам',
    districtsHeading: 'По районам',
    readMore: 'Читать полностью',
    publishedOn: 'Опубликовано',
    updatedOn: 'Обновлено',
    readingTime: (minutes) => `${minutes} мин чтения`,
    blogHeading: 'Руководства по аренде',
    blogIntro:
      'Практические статьи о выборе жилья, договоре и защите от мошенничества. Всё написано '
      + 'для рынка Узбекистана.',
    helpHeading: 'Справочный центр',
    helpIntro:
      'Как работает платформа, правила безопасности, условия использования и политика '
      + 'конфиденциальности.',
    notFoundTitle: 'Такая страница не найдена',
    notFoundBody:
      'Возможно, адрес набран с ошибкой или объявление уже снято. Продолжите с любого из '
      + 'разделов ниже.',
    notFoundCta: 'Вернуться ко всем объявлениям',
  },

  categories: CATEGORIES,

  places: {
    regions: RU_REGION_PROFILES,
    districts: RU_DISTRICT_PROFILES,
  },

  placeWords: (name, kind) => placeWords(name, kind),
  country: { name: 'Узбекистан', short: 'Узбекистан', inPlace: 'в Узбекистане' },

  home: {
    title: `Аренда квартир и домов в Узбекистане${SUFFIX}`,
    description:
      'Uyiz — объявления об аренде квартир, домов и комнат по всему Узбекистану. '
      + 'Фильтруйте по району, цене, числу комнат и станции метро.',
    h1: 'Аренда квартир и домов в Узбекистане',
    intro: [
      'Uyiz — площадка объявлений об аренде жилья в Узбекистане. Объявление может разместить '
        + 'и собственник, и агентство; телефон открыт в объявлении, а договариваетесь вы '
        + 'напрямую.',
      'Квартиры, дома с участком, студии, отдельные комнаты и подселение — всё в одном месте. '
        + 'Фильтруйте по району, станции метро, близости к вузу и цене, чтобы найти подходящий '
        + 'вариант.',
      'В каждом объявлении показан рейтинг доверия: он снижается, когда модератор '
        + 'подтверждает поступившую жалобу. Автор объявления может подтвердить паспорт и '
        + 'документ на жильё и получить отдельный знак.',
    ],
    faq: [
      {
        q: 'Что такое Uyiz?',
        a:
          'Uyiz — площадка, на которой собраны объявления об аренде квартир, домов и комнат '
          + 'по всему Узбекистану. Вы открываете объявление, получаете телефон и обо всём '
          + 'договариваетесь напрямую с тем, кто его разместил.',
      },
      {
        q: 'Пользование сайтом платное?',
        a:
          'Нет. Поиск, просмотр объявлений, получение номера телефона и размещение объявления '
          + 'бесплатны. Любой, кто требует у вас деньги от имени площадки, нарушает правила, и '
          + 'на него следует пожаловаться.',
      },
      {
        q: 'Кто может разместить объявление?',
        a:
          'И собственник, и агентство. В каждом объявлении видно, кто его разместил и '
          + 'насколько он верифицирован, так что вы понимаете, с кем говорите, ещё до звонка.',
      },
      {
        q: 'В каких городах это работает?',
        a:
          'Площадка открыта для всех регионов Узбекистана. Больше всего объявлений в Ташкенте, '
          + 'за ним идут Самарканд, Бухара и города Ферганской долины.',
      },
      {
        q: 'Я хозяин — как разместить объявление?',
        a:
          'Зарегистрируйтесь, подтвердите номер телефона и нажмите «Подать объявление». После '
          + 'того как вы добавите хотя бы одну фотографию, цену и адрес, объявление будет '
          + 'опубликовано сразу. Это тоже бесплатно.',
      },
    ],
  },

  catalog: {
    title: `Все объявления об аренде жилья${SUFFIX}`,
    description:
      'Все активные объявления об аренде жилья в Узбекистане: квартиры, дома, комнаты и '
      + 'студии. Фильтры по району, цене и числу комнат.',
    h1: 'Все объявления об аренде',
    intro: [
      'Здесь собраны все активные объявления площадки. С помощью фильтров выберите район, '
        + 'диапазон цены, число комнат и нужные удобства.',
    ],
  },

  landing: {
    // На странице категории места нет, поэтому поисковый смысл несёт страна:
    // одна «Аренда квартир» слишком коротка, чтобы ранжироваться.
    categoryTitle: (category) => `${cap(category.headline)} в Узбекистане${SUFFIX}`,
    categoryDescription: (category) =>
      `${category.blurb} Объявления по всему Узбекистану — фильтры по цене и региону.`,
    categoryH1: (category) => cap(category.headline),
    categoryIntro: (category) => [
      `${category.blurb} ${MARKETPLACE_LINE}`,
      'Список ниже обновляется в реальном времени. Выберите регион или отсортируйте по цене — '
        + 'так нужный вариант находится быстрее.',
    ],

    regionTitle: (place) => `Аренда квартир и домов ${place.inPlace}${SUFFIX}`,
    regionDescription: (place) =>
      `Квартиры, дома и комнаты, которые сдают ${place.inPlace}. Фильтруйте по цене, числу `
      + 'комнат, станции метро и удобствам.',
    regionH1: (place) => `Аренда жилья ${place.inPlace}`,

    placeCategoryTitle: (place, category) =>
      `${cap(category.headline)} ${place.inPlace}${SUFFIX}`,
    placeCategoryDescription: (place, category) =>
      `${cap(category.plural)}, которые сдают ${place.inPlace}. Фильтруйте по цене, числу `
      + 'комнат и станции метро и звоните автору объявления напрямую.',
    placeCategoryH1: (place, category) => `${cap(category.headline)} ${place.inPlace}`,

    placeIntro,
    placeFaq,
  },

  views: {
    map: {
      title: `Аренда жилья на карте${SUFFIX}`,
      description:
        'Смотрите сдающиеся квартиры и дома прямо на карте: на какой они улице и как '
        + 'далеко от них до ближайшей станции метро.',
    },
    studentProgram: {
      title: `Программа аренды для студентов${SUFFIX}`,
      description:
        'Жильё рядом с университетом по цене, сравнимой с общежитием, и поиск соседа. '
        + 'Отдельные условия и фильтры для студентов.',
    },
    ecosystem: {
      title: `Экосистема Uyiz — что мы строим${SUFFIX}`,
      description:
        'Следующие шаги платформы: проверка, договор, оплата и инструменты для '
        + 'собственника. Что уже готово, а что в работе.',
    },
  },
  listing: {
    title: ({ title, district, rooms }) => {
      const bits = [
        rooms ? `${rooms}-комн.` : '',
        district ? displayPlaceName(district) : '',
      ].filter(Boolean);
      const prefix = bits.length ? `${bits.join(', ')} — ` : '';
      return `${prefix}${title}`.slice(0, 65);
    },
    description: ({ title, district, rooms, area, price }) => {
      const bits = [
        rooms ? `${rooms} комн.` : null,
        area ? `${area} м²` : null,
        district ? displayPlaceName(district) : null,
        price,
      ].filter(Boolean);
      return `${bits.join(' · ')}. ${title}. Uyiz — объявления об аренде.`.slice(
        0,
        300,
      );
    },
    loadingTitle: `Объявление загружается${SUFFIX}`,
    notFoundTitle: `Объявление не найдено${SUFFIX}`,
  },

  articles: RU_ARTICLES,
  help: RU_HELP,
};

export default RU_COPY;
