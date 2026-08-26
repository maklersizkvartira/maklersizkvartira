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

const SUFFIX = ' | Maklersizuy.uz';

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
    headline: 'аренда квартир без посредников',
    blurb:
      'Отдельные квартиры в многоэтажных домах — для семьи, пары или тех, кто живёт один.',
  },
  house: {
    noun: 'дом',
    plural: 'дома',
    label: 'Аренда домов',
    headline: 'аренда домов без посредников',
    blurb: 'Дома с участком и отдельные постройки — больше места и собственный вход.',
  },
  room: {
    noun: 'комната',
    plural: 'комнаты',
    label: 'Аренда комнат',
    headline: 'аренда комнат без посредников',
    blurb: 'Отдельная комната в общей квартире — самый доступный и самый быстрый вариант.',
  },
  studio: {
    noun: 'студия',
    plural: 'студии',
    label: 'Аренда студий',
    headline: 'аренда студий без посредников',
    blurb: 'Спальня и кухня в одном пространстве — для одного человека и молодых пар.',
  },
  roommate: {
    noun: 'подселение',
    plural: 'объявления о подселении',
    label: 'Подселение',
    headline: 'подселение без посредников',
    blurb:
      'Для тех, кто ищет соседа и делит плату за жильё. Есть отдельный отбор по полу.',
  },
  student: {
    noun: 'жильё для студентов',
    plural: 'жильё для студентов',
    label: 'Жильё для студентов',
    headline: 'жильё для студентов без посредников',
    blurb:
      'Рядом с вузом и по цене, которая может заменить общежитие: квартиры, комнаты и подселение.',
  },
  family: {
    noun: 'семейная квартира',
    plural: 'семейные квартиры',
    label: 'Жильё для семей',
    headline: 'семейное жильё без посредников',
    blurb: 'Жильё от двух комнат, которое сдают на длительный срок.',
  },
  budget: {
    noun: 'недорогая аренда',
    plural: 'бюджетные варианты',
    label: 'Недорогая аренда',
    headline: 'недорогая аренда без посредников',
    blurb: 'Объявления до 3 млн сум в месяц, отсортированные по цене.',
  },
};

const NO_BROKER_LINE =
  'Каждое объявление здесь размещает сам владелец жилья: с вами разговаривает он же. '
  + 'Платить за посредничество не нужно, комиссия 0%.';

function placeIntro(
  place: PlaceWords,
  category: CategoryWords | null,
  profile: PlaceProfile | null,
  metroStations: string[],
): string[] {
  const what = category ? category.plural : 'квартиры и дома';
  const paragraphs: string[] = [
    `${cap(what)} ${place.inPlace} — напрямую от собственников. ` + NO_BROKER_LINE,
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
    'Каждое объявление перед публикацией проходит автоматическую проверку: отмечаются '
      + 'повторяющиеся фотографии, текст в посредническом стиле и нереалистичная цена. На '
      + 'подозрительное объявление можно пожаловаться в одно нажатие.',
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
      q: `Как найти ${what} без посредников${where}?`,
      a:
        'Все объявления на этой странице размещены самими хозяевами. Откройте понравившееся, '
        + 'посмотрите номер телефона и позвоните напрямую. Между вами никого нет, и никакого '
        + 'процента платить не нужно.',
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
        'Нет. Пользование площадкой бесплатно и для нанимателя, и для хозяина. Если кто-то '
        + 'просит у вас деньги «за сайт», это посредник — пожалуйтесь на объявление.',
    },
    {
      q: 'Как убедиться, что объявление настоящее?',
      a:
        'Рейтинг доверия хозяина и уровень верификации указаны в каждом объявлении. Объявления '
        + 'с проверенным паспортом и документом на жильё получают отдельный знак. Не переводите '
        + 'деньги, пока не увидели квартиру.',
    },
  ];
}

export const RU_COPY: CopyPack = {
  htmlLang: 'ru',
  ogLocale: 'ru_RU',

  brand: {
    name: 'Maklersiz Uy',
    tagline: 'Напрямую от хозяина, комиссия 0%',
    about:
      'Maklersiz Uy — площадка для аренды квартир и домов в Узбекистане напрямую у '
      + 'собственников, без риэлторов и посредников. Каждое объявление проходит автоматическую '
      + 'проверку, комиссия не взимается.',
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

  home: {
    title: `Аренда квартир и домов без посредников${SUFFIX}`,
    description:
      'Снять квартиру напрямую от хозяина, без риэлторов и комиссии. Проверенные объявления '
      + 'об аренде квартир, домов и комнат по всему Узбекистану.',
    h1: 'Аренда жилья без посредников — напрямую от хозяина',
    intro: [
      'Maklersiz Uy связывает хозяина жилья с нанимателем напрямую. Объявление размещает '
        + 'владелец, номер телефона видите вы, а договариваетесь вы вдвоём — между вами нет ни '
        + 'посредника, ни его процента.',
      'Квартиры, дома с участком, студии, отдельные комнаты и подселение — всё в одном месте. '
        + 'Фильтруйте по району, станции метро, близости к вузу и цене, чтобы найти подходящий '
        + 'вариант.',
      'Каждое объявление перед публикацией проходит автоматическую проверку: отмечаются '
        + 'повторяющиеся фотографии, текст в посредническом стиле и цена, не соответствующая '
        + 'рынку. Хозяева могут подтвердить паспорт и документ на жильё и поднять свой рейтинг '
        + 'доверия.',
    ],
    faq: [
      {
        q: 'Что значит снять жильё без посредников?',
        a:
          'Объявление размещает сам владелец, и разговариваете вы напрямую с ним. Посредника '
          + 'нет, поэтому вы не платите комиссию размером с месячную аренду, а на вопросы о '
          + 'квартире получаете достоверные ответы.',
      },
      {
        q: 'Пользование сайтом платное?',
        a:
          'Нет. Поиск, просмотр объявлений, получение номера телефона и размещение объявления '
          + 'бесплатны. Любой, кто требует плату за услуги, — посредник, и на него следует '
          + 'пожаловаться.',
      },
      {
        q: 'А риэлторы разместить объявление не могут?',
        a:
          'Попытки бывают. Поэтому текст и фотографии каждого объявления проходят '
          + 'автоматический анализ, а хозяин может подтвердить паспорт и документ на жильё. '
          + 'Подозрительное объявление пользователи отмечают в одно нажатие, и его смотрит '
          + 'модератор.',
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
          + 'того как вы добавите фотографии, цену и адрес, объявление пройдёт проверку и будет '
          + 'опубликовано. Это тоже бесплатно.',
      },
    ],
  },

  catalog: {
    title: `Все объявления об аренде — без посредников${SUFFIX}`,
    description:
      'Все объявления об аренде без посредников по Узбекистану. Фильтруйте по району, цене, '
      + 'числу комнат и станции метро.',
    h1: 'Все объявления об аренде',
    intro: [
      'Здесь собраны все активные объявления площадки. С помощью фильтров выберите район, '
        + 'диапазон цены, число комнат и нужные удобства.',
    ],
  },

  landing: {
    categoryTitle: (category) => `${cap(category.headline)}${SUFFIX}`,
    categoryDescription: (category) =>
      `${category.blurb} Напрямую от хозяина, без комиссии. `
      + 'Проверенные объявления по всему Узбекистану.',
    categoryH1: (category) => cap(category.headline),
    categoryIntro: (category) => [
      `${category.blurb} ${NO_BROKER_LINE}`,
      'Список ниже обновляется в реальном времени. Выберите регион или отсортируйте по цене — '
        + 'так нужный вариант находится быстрее.',
    ],

    regionTitle: (place) => `Аренда жилья ${place.inPlace} без посредников${SUFFIX}`,
    regionDescription: (place) =>
      `Квартиры, дома и комнаты ${place.inPlace}, которые сдают напрямую сами хозяева. `
      + 'Без посредников и комиссии, с проверкой каждого объявления.',
    regionH1: (place) => `Аренда жилья ${place.inPlace} без посредников`,

    placeCategoryTitle: (place, category) =>
      `${cap(category.headline)} ${place.inPlace}${SUFFIX}`,
    placeCategoryDescription: (place, category) =>
      `${cap(category.plural)} ${place.inPlace} — напрямую от хозяина, без посредников и `
      + 'комиссии. Каждое объявление проходит автоматическую проверку, телефон '
      + 'владельца открыт сразу.',
    placeCategoryH1: (place, category) => `${cap(category.headline)} ${place.inPlace}`,

    placeIntro,
    placeFaq,
  },

  views: {
    map: {
      title: `Аренда без посредников на карте${SUFFIX}`,
      description:
        'Смотрите сдающиеся квартиры и дома прямо на карте: на какой улице, как далеко '
        + 'до метро. Всё — напрямую от хозяев, без комиссии.',
    },
    studentProgram: {
      title: `Программа аренды для студентов${SUFFIX}`,
      description:
        'Жильё рядом с университетом по цене, сравнимой с общежитием, и поиск соседа. '
        + 'Отдельные условия для студентов, без посредников.',
    },
    ecosystem: {
      title: `Экосистема Maklersiz Uy — что мы строим${SUFFIX}`,
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
      return `${bits.join(' · ')}. ${title}. Без посредников, напрямую от хозяина.`.slice(
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
