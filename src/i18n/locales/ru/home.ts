/**
 * Home page: hero, categories, trust stats, AI recommendations.
 *
 * Russian strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const home = {
  hero: {
    badge: '0% комиссии · аренда напрямую',
    title: 'Аренда квартир и домов без посредников',
    // Not "{regions} областей": Uzbekistan has 12 viloyats plus the Republic
    // of Karakalpakstan plus the city of Tashkent, so the number the page
    // counts is 14 and the word for it is "регион", not "область".
    subtitle:
      'Без посредников и комиссии — проверенное жильё в {regions} регионах '
      + 'и {districts} районах и городах.',
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
      qizlargaOnlyGirls: 'Только для девушек',
      qizlargaRoommate: 'Соседка',
      komfortFurnished: 'С мебелью',
      komfortAppliances: 'Кондиционер и стиральная машина',
      centerWalkable: 'До центра пешком',
      centerDistricts: 'Центральные районы',
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

    /**
     * Geography, stated truthfully.
     *
     * The old line promised "{regions} областей" while the number behind it
     * counted 12 viloyats + the Republic of Karakalpakstan + the city of
     * Tashkent. "Регион" is the word that covers all three, and the second-
     * level unit is a "район или город", not a district alone.
     *
     * `geoSublineActive` is the honest variant: how many places actually have
     * listings, not how many sit in the dropdown.
     */
    geoHeadline: 'Без посредников и комиссии — напрямую от собственника',
    geoSubheadline: 'Комиссия 0%. Вы общаетесь с владельцем сами.',
    geoSubline:
      'Проверенное жильё в {regions} регионах и {districts} районах и городах Узбекистана.',
    geoSublineActive:
      'Сейчас активные объявления есть в {regions} регионах и {districts} районах и городах.',
    regionsLabel: 'Регионы',
    regionsHint: '12 областей, Республика Каракалпакстан и город Ташкент',
    districtsLabel: 'Районы и города',
    districtsHint: 'Районы и города внутри регионов',
    regionsWithListings: 'Регионы с объявлениями',
    regionsWithListingsHint: 'Регионы, где есть хотя бы одно активное объявление',
    districtsWithListings: 'Районы и города с объявлениями',
    districtsWithListingsHint: 'Районы и города, где есть хотя бы одно активное объявление',
    coverageTitle: 'Охват',
    coverageSubtitle: 'Показаны места, где реально есть объявления, а не весь справочник.',
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
    regionLabel: 'Регион',
    districtLabel: 'Район или город',
    metroLabel: 'Станция метро',
    roomsLabel: 'Количество комнат',
    audienceLabel: 'Для кого',
    priceLabel: 'Цена за месяц (сум)',
    priceMinPlaceholder: 'от — 1 000 000',
    priceMaxPlaceholder: 'до — 10 000 000',
    priceAny: 'Цена не важна',
    areaLabel: 'Минимальная площадь (м²)',
    areaPlaceholder: 'Например: 40',
    sortLabel: 'Сортировка',
    amenitiesLabel: 'Удобства',
    amenitiesHint: 'Показываем жильё, где есть все выбранные удобства.',
    advancedShow: 'Дополнительные параметры',
    advancedHide: 'Скрыть дополнительные параметры',
    reset: 'Сбросить параметры',
    resultsHint: 'Условиям соответствуют {count} объявлений',
  },
} as const;
