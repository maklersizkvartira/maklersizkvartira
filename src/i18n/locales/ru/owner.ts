/**
 * Owner surfaces: create listing wizard, edit modal, my listings.
 *
 * Russian strings. The key shape mirrors the Uzbek file exactly — the
 * compiler rejects a missing, renamed or extra key.
 */
export const owner = {
  gate: {
    signInTitle: 'Сначала войдите',
    signInBody: 'Чтобы разместить объявление, войдите как собственник жилья.',
    studentTitle: 'Студент не может размещать объявления',
    studentBody:
      'Этот раздел только для собственников. Вы можете искать и смотреть квартиры.',
    browseCta: 'Смотреть квартиры',
    switchToOwner: 'Перейти в режим собственника',
    switchFailed: 'Не удалось сменить роль. Попробуйте ещё раз.',
    myListingsTitle: 'Только для собственников',
    myListingsBody:
      'Чтобы видеть свои объявления и статистику, войдите как собственник жилья.',
  },

  create: {
    breadcrumb: 'Разместить объявление',
    title: 'Размещение объявления',
    subtitle:
      '3 простых шага — объявление готово за 3 минуты. Размещение бесплатное.',
    stepCounter: 'Шаг {current} из {total}',
    stepBadge: 'Шаг {step}',
    errorsTitle: 'Пожалуйста, исправьте следующие поля:',

    steps: {
      detailsTitle: '1. О жилье',
      detailsHint: 'Категория, комнаты, площадь, цена',
      locationTitle: '2. Адрес',
      locationHint: 'Где находится жильё?',
      photosTitle: '3. Фото и контакты',
      photosHint: 'Минимум 1 фото и контакты',
    },

    next: {
      toLocation: 'Далее: адрес и локация',
      toDetails: 'Далее: о жилье',
      toPhotos: 'Далее: фото и контакты',
    },

    seller: {
      heading: 'От чьего имени вы размещаете?',
      subheading: 'Ищущие будут знать, кто ответит на звонок.',
      owner: 'Собственник',
      ownerHint: 'Это моё жильё',
      agent: 'Агент по недвижимости',
      agentHint: 'От имени собственника',
      agencyLabel: 'Название агентства',
      agencyPlaceholder: 'Например: Zamin Realty',
      agencyHint: 'Необязательно — если работаете самостоятельно, оставьте пустым.',
      agentLocked:
        'Чтобы размещать как агент, выберите роль «Агент по недвижимости» в профиле.',
      agentLockedCta: 'Перейти в профиль',
    },

    location: {
      heading: 'Адрес и расположение',
      subheading: 'В каком районе и на какой улице находится квартира?',
      regionLabel: 'Область / город',
      districtLabel: 'Район',
      addressLabel: 'Улица и ориентир (точный адрес)',
      addressPlaceholder:
        'Например: проспект Мустакиллик, дом 14 (ориентир: метро Мирзо-Улугбек)',
      gpsTitle: 'Определить местоположение автоматически',
      gpsHint: 'Одно нажатие — область, район и улица заполнятся сами.',
      gpsDetect: 'Определить по GPS',
      gpsDetecting: 'Определяем...',
      gpsDetected: 'GPS определён',
      gpsFound: 'Адрес по GPS найден: {region}, {district}, {address}',
      gpsCoordinates: 'Координаты GPS определены: {latitude}, {longitude}',
      // The Geolocation API reports three different failures and the button
      // used to call all of them "permission denied", which sent people to
      // the browser settings to fix a timeout they could have fixed by
      // stepping outside.
      gpsDenied: 'Доступ к GPS не разрешён. Разрешите его в настройках браузера или введите адрес.',
      gpsTimeout: 'GPS не ответил. Выйдите на открытое место и повторите или введите адрес.',
      gpsUnavailable: 'Не удалось определить местоположение. Возможно, слабый сигнал.',
      gpsPrompt: 'Браузер запрашивает доступ к геолокации — нажмите «Разрешить».',
      gpsSearching: 'Ищем местоположение...',
      gpsSuccess: 'Местоположение определено.',
      gpsUnsupported: 'Ваше устройство не поддерживает GPS.',
      metroLabel: 'Ближайшая станция метро',
      metroNone: 'Нет (метро далеко)',
      metroOption: 'станция {station}',
      metroChoose: 'Выбрать станцию',
      metroSearch: 'Введите название станции...',
      metroNoMatch: 'Такая станция не найдена',
      metroMinutesLabel: 'Пешком до метро (минут)',
    },

    details: {
      heading: 'Данные о жилье и аренде',
      subheading: 'Количество комнат, ежемесячная цена и удобства',
      rentalTypeLabel: 'Тип аренды',
      whole: 'Вся квартира',
      roommate: 'Подселение',
      roommateHeading: 'Условия подселения',
      roommateGenderLabel: 'Для кого подселение?',
      roommateGenderAny: 'Не имеет значения',
      roommateGenderBoys: 'Только для парней',
      roommateGenderGirls: 'Только для девушек',
      roommateSpotsLabel: 'Сколько соседей нужно?',
      roommateSpotsOption: '{count} соседа',
      roommateSpotsPlus: '{count}+ соседей',
      titleLabel: 'Заголовок объявления',
      titlePlaceholder: 'Например: уютная 2-комнатная квартира в Юнусабаде, 4-й квартал',
      descriptionLabel: 'Подробное описание',
      descriptionPlaceholder:
        'Опишите условия, состояние ремонта и соседей...',
      priceLabel: 'Цена в месяц (сум)',
      priceApprox: '≈ {amount} / в месяц',
      depositLabel: 'Сумма депозита (сум)',
      areaLabel: 'Площадь (м²)',
      floorLabel: 'Этаж',
      totalFloorsLabel: 'Всего этажей',
      amenitiesLabel: 'Имеющиеся условия и удобства',
      // These fields start empty now. A seeded number reads as an answer, and
      // people published it unchanged; a placeholder reads as an example.
      pricePlaceholder: 'Например: 4 000 000',
      depositPlaceholder: 'Если залога нет — 0',
      areaPlaceholder: 'Например: 54',
      floorPlaceholder: 'Например: 3',
      totalFloorsPlaceholder: 'Например: 9',
      roomsPlaceholder: 'Например: 2',
    },

    /**
     * One label per amenity key the form toggles.
     *
     * `listings.amenities.*` describes an amenity on a published listing
     * («Можно с животными»); these are the words on the wizard's own
     * checkboxes, keyed exactly as the form's state is.
     */
    amenities: {
      furnished: 'С мебелью',
      utilities: 'Коммунальные включены в цену',
      airConditioning: 'Кондиционер',
      washingMachine: 'Стиральная машина',
      internet: 'Интернет / Wi-Fi',
      parking: 'Парковка',
      pets: 'Можно с животными',
    },

    photos: {
      heading: 'Фотографии квартиры',
      subheading: 'Загрузите минимум 1 качественное фото — больше фото, больше арендаторов.',
      dropTitle: 'Нажмите, чтобы загрузить фотографии',
      dropBody: 'Выберите фото с телефона или из галереи (JPG, PNG, WEBP).',
      dropCta: 'Выбрать файлы (загружено: {count})',
      uploadedTitle: 'Ваши загруженные фотографии',
      coverBadge: 'Главное фото',
      imageAlt: 'Фото {index}',
      removeImage: 'Удалить фото {index}',
      emptyHint: 'Нужно минимум 1 фото. Нажмите на область выше и выберите фото.',
      limitNotice: 'Можно загрузить не более {max} фотографий.',
      limitReached: 'Достигнут предел фотографий: {max}.',
      sizeNotice: 'Загруженный объём: {size} МБ из {max} МБ.',
      readFailed: 'Некоторые файлы не удалось прочитать. Выберите другие фото.',
      tooLarge: 'Файл слишком большой. Выберите изображение поменьше.',
      uploadFailed: 'Не удалось загрузить фото. Проверьте связь и повторите.',
      uploading: 'Загрузка… {done}/{total}',
      // Said once, before the upload, instead of only as an error afterwards.
      countAndSizeHint: '{min}–{max} фотографий, суммарно до {size} МБ.',
      remainingHint: 'Можно добавить ещё {count} фото.',
    },

    contact: {
      heading: 'Контактные данные',
      subheading: 'Как арендаторы свяжутся с вами?',
      phoneLabel: 'Ваш номер телефона',
      phoneHint: 'Номер берётся из вашего профиля. Изменить его можно в профиле.',
      phoneMissing: 'В вашем профиле нет номера телефона.',
      telegramLabel: 'Имя пользователя в Telegram',
      telegramPlaceholder: '@username',
      telegramHint: 'Начните с @. Только латинские буквы, цифры и подчёркивание.',
      timeLabel: 'Удобное время для связи',
      timePlaceholder: 'Ежедневно 09:00 – 21:00',
    },

    /**
     * The Top promotion, offered on the last step.
     *
     * Nothing here may promise a position that has not been granted: the
     * request is free, it goes to the admins, and the listing moves only
     * after they approve it. Publication never waits for any of that.
     */
    top: {
      title: 'Поднимите объявление в Топ',
      body:
        'Объявление в Топе стоит в самом начале списка — его видит в несколько раз больше арендаторов.',
      free: 'Бесплатно',
      howItWorks:
        'Запрос рассматривают администраторы. Объявление поднимется только после их подтверждения.',
      daysLabel: 'На какой срок?',
      daysOption: '{count} дней',
      noteLabel: 'Комментарий администраторам',
      notePlaceholder: 'Например: квартиру нужно сдать срочно',
      cta: 'Запросить Топ',
      selected: 'Запрос на Топ выбран',
      selectedBody:
        'Запрос уйдёт сразу после публикации объявления. На саму публикацию это никак не влияет.',
      cancel: 'Отменить',
      sentTitle: 'Запрос на Топ отправлен',
      sentBody:
        'Запрос отправлен администраторам. После подтверждения объявление поднимется в начало списка — до этого оно показывается как обычно.',
      failedTitle: 'Объявление опубликовано, запрос на Топ не отправлен',
      failedBody:
        'Объявление уже на сайте. Запросить Топ можно ещё раз в разделе «Мои объявления».',
      sentCta: 'Мои объявления',
    },

    /**
     * Draft persistence.
     *
     * The wizard is three steps long and a mis-tapped back gesture used to
     * empty all three, so the answers are kept and the exit is confirmed.
     */
    draft: {
      restored: 'Сохранённый черновик восстановлен.',
      restoredAt: 'Восстановлен черновик от {time}.',
      photosDropped:
        'При сохранении черновика фотографии не поместились — их нужно загрузить заново.',
      discard: 'Удалить черновик',
      discarded: 'Черновик удалён.',
      saved: 'Черновик сохранён',
      confirmLeaveTitle: 'Выйти, не завершив объявление?',
      confirmLeaveBody:
        'Введённые данные сохранятся как черновик, и вы продолжите с этого же места.',
      stay: 'Остаться',
      leave: 'Выйти',
    },

    submit: 'Опубликовать объявление',
    submitting: 'Отправляем...',
    submitFailed: 'Не удалось отправить объявление. Проверьте соединение и попробуйте снова.',

    rules: {
      title: 'Правила хорошего объявления',
      subtitle: 'Рекомендации для быстрой и надёжной аренды',
      photos: 'Размещайте настоящие фотографии — снимки из интернета отклоняются.',
      price: 'Укажите точную ежемесячную цену.',
      address: 'Напишите адрес с ориентиром — арендатор быстрее вас найдёт.',
      terms: 'Чётко опишите условия по депозиту и коммунальным платежам.',
      freeTitle: '100% бесплатное размещение',
      freeBody:
        'Размещение объявления полностью бесплатно. Арендаторы связываются напрямую с тем, кто разместил объявление.',
      badgeTitle: 'Значок проверенного собственника',
      badgeCta: 'Получить значок доверия',
    },

    validation: {
      address: 'Укажите улицу и точный адрес.',
      metroMinutes: 'Расстояние до метро должно быть от 1 до 60 минут.',
      title: 'Заголовок должен содержать минимум 8 символов.',
      description: 'Описание должно содержать минимум 20 символов.',
      price: 'Укажите корректную ежемесячную цену.',
      deposit: 'Депозит должен быть равен 0 или больше.',
      area: 'Укажите корректную площадь.',
      floor: 'Этаж должен быть от 1 до общего количества этажей.',
      images: 'Загрузите минимум 1 настоящую фотографию.',
      imagesTooLarge:
        'Объём фотографий — {size} МБ, что превышает предел ({max} МБ). Загрузите меньше фото или уменьшите их.',
      phone: 'Добавьте в профиль действующий номер телефона.',
      telegram: 'Неверное имя пользователя Telegram. Например: @dilshod_karimov',
      limitReached: 'Достигнут лимит активных объявлений ({max}). Сначала удалите одно из старых.',
    },
  },

  edit: {
    title: 'Редактирование объявления',
    subtitle: 'Измените данные и сохраните',
    saveFailed: 'Не удалось сохранить изменения.',
  },

  my: {
    title: 'Мои объявления и статистика',
    subtitle:
      'Следите за тем, сколько человек посмотрели, сохранили объявление и связались с вами.',
    createCta: 'Разместить новое объявление',
    listTitle: 'Статистика по каждому объявлению ({count})',

    stats: {
      views: 'Всего просмотров',
      viewsHint: 'Посмотрели ваши объявления',
      favorites: 'Сохранения',
      favoritesHint: 'Добавили в избранное',
      contacts: 'Хотели позвонить',
      contactsHint: 'Открыли ваш номер',
      messages: 'Хотели написать',
      messagesHint: 'Начали с вами чат',
      listings: 'Активные объявления',
      listingsHint: 'Размещённые сейчас объявления',
    },

    metrics: {
      views: 'Просмотры',
      viewsHint: 'Открыли страницу',
      favorites: 'Сохранили',
      favoritesHint: 'Добавили в избранное',
      contacts: 'Звонки',
      contactsHint: 'Открыли номер',
      messages: 'Сообщения',
      messagesHint: 'Написали в чат',
      conversion: 'Конверсия: {rate}%',
      conversionHint: 'Отношение обращений к просмотрам',
    },

    empty: {
      title: 'Вы ещё не размещали объявлений',
      body: 'Разместите свою квартиру совершенно бесплатно.',
      cta: 'Разместить объявление',
    },

    error: {
      title: 'Не удалось загрузить объявления',
      body: 'Нет связи с сервером. Попробуйте ещё раз.',
    },

    districtLabel: 'район {district}',
    deleteConfirm: 'Удалить это объявление? Отменить действие будет невозможно.',
    openListing: 'Открыть объявление',

    /**
     * What an administrator wrote when they warned about or took down this
     * listing. With the publish-time check gone this note is the owner's only
     * explanation, so it is printed in full rather than summarised, and only
     * ever on their own listings - the API sends it to nobody else.
     */
    moderationNote: 'Комментарий администратора: {note}',

    /**
     * The Top state of one listing, on its own row.
     *
     * A listing whose request is waiting or already granted is not offered
     * the button again — the state line is the whole answer there.
     */
    top: {
      title: 'Топ-объявление',
      body: 'Запрос бесплатный. После подтверждения администраторами объявление поднимется в начало списка.',
      badge: 'ТОП',
      cta: 'Запросить Топ',
      pending: 'Запрос на Топ отправлен — администраторы его рассматривают.',
      active: 'Топ активен — объявление стоит в начале списка.',
      activeUntil: 'Топ активен — объявление стоит в начале списка до {date}.',
      rejected: 'Запрос на Топ отклонён. Вы можете отправить его снова.',
      send: 'Отправить запрос',
      sending: 'Отправляем...',
      alreadyPending: 'Запрос по этому объявлению уже отправлен.',
      notPublic: 'В Топ можно поднять только опубликованное объявление.',
      failed: 'Не удалось отправить запрос. Попробуйте позже.',
    },
  },

  /**
   * The account-wide statistics panel.
   *
   * Distinct from `owner.my.stats`, which labels the tiles on one listing's
   * row: these count every listing the owner has, moderation states included.
   */
  stats: {
    title: 'Мои объявления и статистика',
    subtitle: 'Сводные показатели по всем вашим объявлениям.',
    totalListings: 'Всего объявлений',
    approved: 'Одобрено',
    pending: 'На проверке',
    rejected: 'Отклонено',
    views: 'Просмотры',
    favorites: 'В избранном',
    contacts: 'Запросы контактов',
    avgTrust: 'Средний рейтинг доверия',
    empty: 'Для статистики пока нет данных — разместите первое объявление.',
    emptyCta: 'Разместить объявление',
  },
} as const;
