/**
 * Раздел объявлений — главная витрина платформы.
 */
export const listings = {
  page: {
    title: 'Объявления',
    subtitle: 'Прямой контакт — размещение бесплатно',
    metaTitle: 'Квартиры в аренду — Uyiz',
    resultCount: 'Найдено объявлений: {count}',
    resultCountFiltered: 'По фильтру: {count} объявлений',
    searchPlaceholder: 'Поиск по району, метро или ключевому слову',
    view: {
      grid: 'Плиткой',
      list: 'Списком',
      map: 'На карте',
    },
  },

  /**
   * The filter bar and the filter sheet.
   *
   * Separate from `common.filters` on purpose: those are the words a filter
   * is called anywhere in the app, these are the ones the listings surface
   * puts on its own chips, its sort menu and its "show results" button.
   */
  filters: {
    title: 'Фильтры',
    subtitle: 'Настройте поиск под себя',
    openAria: 'Открыть фильтры',
    closeAria: 'Закрыть фильтры',
    activeCount: 'Активных фильтров: {count}',
    activeNone: 'Фильтры не выбраны',
    clearAll: 'Очистить всё',
    clearOne: 'Убрать фильтр «{label}»',
    apply: 'Применить',
    showResults: 'Показать {count} объявлений',
    showResultsNone: 'Подходящих объявлений нет',
    more: 'Больше фильтров',
    less: 'Свернуть фильтры',

    quickLabel: 'Быстрые фильтры',
    quick: {
      all: 'Все',
      roommate: 'Подселение',
      student: 'Студентам',
      family: 'Семьям',
      metro: 'Рядом с метро',
      budget: 'Недорого',
      premium: 'Высокое доверие',
      qizlarga: 'Для девушек',
      komfort: 'Комфорт',
      center: 'В центре',
      hovli: 'Свой дом',
      verified: 'Проверенные',
      noDeposit: 'Без залога',
      newest: 'Самые новые',
      petsAllowed: 'Можно с животными',
    },

    priceTitle: 'Цена за месяц',
    minPrice: 'Минимальная цена (сум)',
    maxPrice: 'Максимальная цена (сум)',
    minPricePlaceholder: '1 000 000',
    maxPricePlaceholder: '10 000 000',
    priceHint: 'Оставьте пустым, чтобы не ограничивать цену.',

    areaTitle: 'Площадь',
    minArea: 'Минимальная площадь (м²)',
    maxArea: 'Максимальная площадь (м²)',
    minAreaPlaceholder: '30',
    maxAreaPlaceholder: '120',

    roomsTitle: 'Количество комнат',
    amenitiesTitle: 'Удобства',
    locationTitle: 'Расположение',

    sortBy: 'Сортировка',
    sort: {
      recommended: 'Рекомендуемые',
      newest: 'Сначала новые',
      priceLow: 'Сначала дешёвые',
      priceHigh: 'Сначала дорогие',
      trust: 'По рейтингу доверия',
      areaLarge: 'Сначала большие',
      popular: 'Популярные',
    },
  },

  featured: {
    title: 'Рекомендуемые объявления',
    subtitle: 'Самые надёжные и популярные предложения',
    badge: 'Реклама',
    vipTitle: 'VIP объявления',
    topBadge: 'Топ',
    empty: 'Пока нет рекомендуемых объявлений',
  },

  card: {
    perMonth: 'в месяц',
    deposit: 'Залог: {amount}',
    noDeposit: 'Без залога',
    utilitiesIncluded: 'Коммунальные включены',
    roomsAndArea: '{rooms} комн. · {area} м²',
    floor: 'Этаж {floor} из {total}',
    metro: '{station} — {minutes} мин.',
    university: 'До {name} {minutes} мин.',
    viewsCount: '{count} просмотров',
    postedAgo: 'Размещено {time}',
    roommateSpots: 'Мест для подселения: {count}',
    contactOwner: 'Связаться с собственником',
    showPhone: 'Показать номер',
    phoneHidden: 'Войдите, чтобы увидеть номер',
    saveListing: 'Сохранить',
    savedListing: 'Сохранено',
    shareListing: 'Поделиться',
    shareText: '{title} — {price}. На Uyiz!',
    // The card's closing chip and the price block on the detail page. It says
    // what the platform actually guarantees — you reach whoever published the
    // listing yourself — rather than making a promise about their fee.
    directContact: 'Прямой контакт',
    // The card carousel. Dots are buttons, so each one needs a name a screen
    // reader can read; the live region reads the position after a swipe.
    photoCarousel: '{title} — фото объявления',
    photoDot: 'Перейти к фото {index}',
    photoPosition: '{current} / {total}',
    photoNext: 'Следующее фото',
    photoPrev: 'Предыдущее фото',
    photoNone: 'Фото нет',
    photoCount: '{count} фото',
  },

  detail: {
    aboutTitle: 'Об объявлении',
    amenitiesTitle: 'Удобства',
    locationTitle: 'Расположение',
    ownerTitle: 'Собственник',
    safetyTitle: 'Безопасность',
    similarTitle: 'Похожие объявления',
    priceTitle: 'Цена и условия',
    memberSince: 'На сайте с {date}',
    ownerListings: 'Объявлений: {count}',
    contactHours: 'Время для звонков: {time}',
    reportListing: 'Объявление кажется подозрительным?',
    backToList: 'Вернуться к списку объявлений',
    imageOf: '{current} / {total}',
    notFoundTitle: 'Объявление не найдено',
    notFoundBody: 'Возможно, оно удалено или ссылка неверна.',
    districtNamed: 'район {name}',
    floorLabel: 'Этаж',
    showImage: 'Показать фото {index}',
    photoOf: '{title} — фото {index}',
    viewOnMap: 'Показать на карте',
    ownerRentals: 'Успешных сделок: {count}',
    utilitiesExcluded: 'Коммунальные оплачиваются отдельно',

    /**
     * The reliability figure, said plainly.
     *
     * It is not a machine's opinion of the listing: every listing starts at
     * 100 and the only thing that moves the number is an administrator
     * confirming a complaint about it. These four strings are the whole
     * explanation the reader gets, so they must not imply any other check.
     */
    trustTitle: 'Уровень надёжности',
    trustSubtitle: 'Рассчитывается по подтверждённым жалобам',
    trustExplainer:
      'Каждое объявление начинается со 100 баллов. Балл снижается только '
      + 'после того, как администратор подтвердит жалобу.',
    trustNoComplaints: 'По этому объявлению нет подтверждённых жалоб.',
    trustHasComplaints: 'По этому объявлению есть подтверждённые жалобы.',
    /** Hover text for the score chip on the card and in the page heading. */
    trustTooltip: 'Надёжность: {score}/100. Снижается только после подтверждённой жалобы.',
    landAreaLabel: 'Площадь участка',
    landAreaValue: '{value} соток',
    /**
     * The owner chip in the sidebar shows the USER's score, which still rises
     * on verification — a different rule from the listing figure above, so it
     * gets its own label rather than borrowing one that mentions complaints.
     */
    ownerTrustScore: 'Доверие владельцу: {score}',
    ownerToolbar: 'Вы владелец этого объявления',
    confirmDelete: 'Удалить объявление безвозвратно?',
    amenityAvailable: 'есть',
    amenityUnavailable: 'нет',
    chatUnavailable: 'Чат временно недоступен. Свяжитесь с собственником по телефону.',
    phoneUnavailable: 'Собственник скрыл номер. Используйте другой способ связи.',
    telegramContact: 'Написать в Telegram',
  },

  amenities: {
    furnished: 'С мебелью',
    parking: 'Парковка',
    internet: 'Интернет',
    airConditioning: 'Кондиционер',
    washingMachine: 'Стиральная машина',
    petsAllowed: 'Можно с животными',
    utilitiesIncluded: 'Коммунальные услуги',
    virtualTour: '3D-тур',
  },

  propertyType: {
    apartment: 'Квартира',
    house: 'Дом / Коттедж',
    room: 'Комната',
    studio: 'Студия',
    dormitory: 'Общежитие',
    land: 'Земельный участок',
    commercial: 'Коммерческая недвижимость',
  },

  seller: {
    ownerLabel: 'Собственник',
    agentLabel: 'Агент по недвижимости',
    ownerBadge: 'От собственника',
    agentBadge: 'Через агента',
    agency: 'Агентство: {name}',
    filterLabel: 'Кто разместил',
    filterAll: 'Все',
    filterOwner: 'Только собственники',
    filterAgent: 'Агенты',
    contactAgent: 'Связаться с агентом',
    trustAgent: 'Доверие агенту: {score}',
    phoneUnavailableAgent: 'Агент скрыл номер. Используйте другой способ связи.',
  },

  empty: {
    title: 'По этим условиям объявлений не найдено',
    body: 'Попробуйте расширить фильтры или выберите другой район.',
    cta: 'Сбросить фильтры',
    noListingsTitle: 'Объявлений пока нет',
    noListingsBody: 'Разместите объявление первым — это совершенно бесплатно.',
    noListingsCta: 'Разместить объявление',
  },

  safety: {
    title: 'Правила безопасной аренды',
    tip1: 'Не переводите деньги заранее, не посмотрев квартиру.',
    tip2: 'Отдавайте залог только после подписания договора.',
    tip3: 'Попросите у собственника документ (кадастр или паспорт).',
    tip4: 'Заранее письменно согласуйте все условия оплаты.',
    reportCta: 'Сообщить о подозрительном объявлении',
  },

  report: {
    title: 'Отправить жалобу',
    subtitle: 'Выберите, что именно не так',
    reasonLabel: 'Причина',
    // No "this is a broker listing" reason: professional agents publish here
    // too, so it is not something to complain about — and a confirmed report
    // now costs the listing real reliability points.
    reasons: {
      scam: 'Мошенничество',
      fakeListing: 'Поддельное объявление',
      fakePhotos: 'Фото от другой квартиры',
      wrongPrice: 'Неверная цена',
      spam: 'Спам',
      harassment: 'Некорректное поведение',
      other: 'Другая причина',
    },
    detailsLabel: 'Дополнительный комментарий',
    detailsPlaceholder: 'Кратко опишите, что произошло...',
    submit: 'Отправить жалобу',
    success: 'Ваша жалоба принята. Мы рассмотрим её в ближайшее время.',
  },
} as const;
