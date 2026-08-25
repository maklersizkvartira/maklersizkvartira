/**
 * Home page: hero, categories, trust stats, AI recommendations.
 *
 * Russian strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const home = {
  hero: {
    badge: '0% комиссии · аренда напрямую',
    title: 'Найдите квартиру без посредников',
    subtitle:
      'Проверенное жильё в {regions} регионах и {districts} районах Узбекистана.',
    searchTitle: 'Где ищете жильё?',
    searchHintShort: 'Нажмите, чтобы найти',
    searchHintLong: 'Район, улица, ориентир или станция метро',
    openSearch: 'Открыть окно поиска',
  },

  categories: {
    eyebrow: 'Главные разделы',
    title: 'Быстрый поиск по категориям',
    subtitle: 'Выберите подходящий тип аренды и смотрите объявления',
    viewAll: 'Смотреть все объявления',
    tags: {
      roommateBoys: 'Для парней',
      roommateGirls: 'Для девушек',
      studentNearUniversity: 'Рядом с университетом',
      studentDormAlternative: 'Альтернатива общежитию',
      familyTwoRooms: '2 комнаты',
      familyThreeRooms: '3 комнаты',
      metroWalk: 'В пешей доступности',
      metroCentral: 'Ближе к центру',
      budgetNoDeposit: 'Без залога',
      budgetLowPrice: 'Низкая цена',
      premiumVerifiedOwner: 'Проверенный владелец',
      premiumHighTrust: 'Высокий рейтинг доверия',
    },
  },

  stats: {
    toggleTitle: 'Показатели платформы',
    toggleSubtitle: 'Только реальные цифры · 0% комиссии',
    toggleSubtitleWithCount: '{count} активных объявлений · 0% комиссии',
    expand: 'Показать',
    collapse: 'Свернуть',
    title: 'Аренда без посредников, с доверием',
    subtitle:
      'Мы убираем из системы посредников и мошенников, чтобы люди находили квартиру самостоятельно.',
    activeListings: 'Активные объявления',
    activeListingsHint: 'Открыты прямо сейчас',
    featuredListings: 'Рекомендуемые объявления',
    featuredListingsHint: 'Самые надёжные после проверки',
    commission: 'Комиссия посредника',
    commissionHint: 'Напрямую с владельцем жилья',
    unavailable: 'Показатели сейчас загрузить не удалось.',
  },

  recommended: {
    badge: 'Рекомендации',
    title: 'Объявления',
    titleVIP: 'Топ и VIP Объявления',
    subtitle: 'Самые новые и надёжные',
    subtitleVIP: 'Самые надёжные объявления, поднятые наверх',
    viewAll: 'Все',
    listLabel: 'Рекомендуемые объявления',
    empty: 'Пока нет объявлений для рекомендации.',
    emptyCta: 'Разместить объявление',
    error: 'Не удалось загрузить рекомендации.',
  },

  search: {
    title: 'Параметры поиска',
    queryLabel: 'Ключевое слово',
    queryPlaceholder: 'Район, улица или ориентир',
    metroAll: 'Все станции метро',
    metroStation: 'Станция {station}',
    rentalTypeLabel: 'Тип аренды',
    submit: 'Показать результаты',
  },
} as const;
