/** Шапка, нижняя навигация, футер и глобальные системные сообщения. */
export const layout = {
  nav: {
    home: 'Главная',
    listings: 'Объявления',
    map: 'Карта',
    favorites: 'Избранное',
    chat: 'Сообщения',
    profile: 'Профиль',
    myListings: 'Мои объявления',
    createListing: 'Разместить объявление',
    verification: 'Подтверждение',
    referral: 'Пригласить друга',
    studentProgram: 'Программа для студентов',
    ecosystem: 'Экосистема',
    admin: 'Управление',
    help: 'Помощь',
    search: 'Поиск',
    more: 'Ещё',
    settings: 'Настройки',
    notifications: 'Уведомления',
    support: 'Поддержка',
  },

  header: {
    createListingCta: 'Разместить объявление',
    savedCount: 'Избранное ({count})',
    loginOrRegister: 'Войти / Регистрация',
    openMenu: 'Открыть меню',
    closeMenu: 'Закрыть меню',
    // The header drawer is a Sheet now, so it has a real heading instead of
    // an unlabelled panel that a screen reader announced as “dialog”.
    menuTitle: 'Меню',
    menuSubtitle: 'Разделы, категории и ваш аккаунт',
    drawerCategories: 'Категории',
    drawerQuickLinks: 'Быстрые ссылки',
    drawerSettings: 'Настройки',
    skipToContent: 'Перейти к основному содержимому',
    // The accessible name of the primary <nav> in the middle of the bar —
    // the four section links themselves, which are visible text and need no
    // eyebrow. Distinct from `categories.chooseSection`, which heads the ten
    // category tiles inside the browse panel that nav's last control opens.
    browseSections: 'Разделы',
    // The bar carries one glyph for both preferences now, so its label has to
    // name both; neither `common.language.label` nor `common.theme.label`
    // describes what pressing it opens.
    settingsAria: 'Язык и оформление',
    // Not `nav.profile`: the avatar opens a menu, it no longer navigates to
    // the profile page, and calling it "Профиль" would lie to a screen reader.
    accountAria: 'Меню аккаунта',
    mapSearchAria: 'Искать на карте',
    backAria: 'Вернуться назад',
  },

  categories: {
    label: 'Категории',
    chooseSection: 'Выберите раздел',
    popularDistricts: 'Популярные районы',
    roommate: {
      title: 'Подселение',
      description: 'Сосед для студентов и арендаторов',
    },
    student: {
      title: 'Для студентов',
      description: 'Недорогое жильё рядом с вузом',
    },
    family: {
      title: 'Для семьи',
      description: 'Уютное жильё от 2 комнат',
    },
    metro: {
      title: 'Рядом с метро',
      description: '10 минут пешком до станции',
    },
    budget: {
      title: 'Недорого',
      description: 'До 3 млн сум',
    },
    premium: {
      title: 'Высокое доверие',
      description: 'От проверенных собственников',
    },
    qizlarga: {
      title: 'Для девушек',
      description: 'Комнаты и подселение только для девушек',
    },
    komfort: {
      title: 'Комфорт',
      description: 'Мебель, кондиционер, стиральная машина и интернет',
    },
    center: {
      title: 'В центре',
      description: 'Жильё в центральных районах города',
    },
    hovli: {
      title: 'Свой дом',
      description: 'Дома с двором — отдельный вход и собственный участок',
    },
  },

  sidebar: {
    guestTitle: 'Добро пожаловать',
    guestSubtitle: 'Войдите, чтобы размещать объявления и напрямую связываться с авторами объявлений',
    level: 'Уровень {level}',
    xpPoints: '{count} XP',
    xpToNext: 'До следующего уровня {count} XP',
    settings: 'Настройки',
  },

  footer: {
    about: 'О платформе',
    aboutText:
      'Uyiz — площадка объявлений об аренде жилья в Узбекистане. '
      + 'Размещение бесплатное, связь с автором объявления напрямую.',
    forTenants: 'Арендаторам',
    forOwners: 'Собственникам',
    company: 'Компания',
    legal: 'Правовая информация',
    terms: 'Условия использования',
    privacy: 'Политика конфиденциальности',
    safety: 'Правила безопасности',
    guides: 'Руководства',
    contact: 'Контакты',
    support: 'Поддержка',
    faq: 'Частые вопросы',
    followUs: 'Мы в соцсетях',
    rights: '© {year} Uyiz. Все права защищены.',
    madeIn: 'Сделано в Узбекистане',
    // The helpline is a separate group from the `support` link above it: that
    // one goes to a page, this one is the number somebody can dial now. It is
    // `supportBlock` rather than `support` because `support` is already the
    // footer's link label and the footer still renders it.
    supportBlock: {
      title: 'Нужна помощь?',
      // The row's own call to action. It is a word, not an icon, because the
      // row is a `tel:` link and nothing else on it says what pressing does.
      call: 'Позвонить',
      phoneAria: 'Позвонить по номеру {phone}',
      hours: 'Ежедневно 09:00 – 21:00',
    },
  },

  splash: {
    loading: 'Загружаем объявления и карту...',
  },

  toast: {
    listingCreated: 'Объявление успешно размещено!',
    listingUpdated: 'Объявление изменено.',
    listingDeleted: 'Объявление удалено.',
    favoriteAdded: 'Добавлено в избранное.',
    favoriteRemoved: 'Удалено из избранного.',
    roleSwitched: 'Роль изменена на «{role}».',
    avatarUpdated: 'Фото профиля обновлено.',
    languageChanged: 'Язык изменён.',
    themeChanged: 'Оформление изменено.',
    copiedLink: 'Ссылка скопирована.',
    xpEarned: '+{amount} XP — {reason}',
    welcomeOwner: 'Добро пожаловать! Теперь вы можете размещать объявления.',
    welcomeStudent: 'Добро пожаловать! Выбирайте свою квартиру.',
    sessionExpired: 'Сессия истекла. Войдите снова.',
  },

  offline: {
    title: 'Нет подключения к интернету',
    body: 'Проверьте соединение — страница обновится автоматически.',
  },
} as const;
