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
  },

  header: {
    createListingCta: '+ Разместить объявление',
    savedCount: 'Избранное ({count})',
    loginCta: 'Войти',
    registerCta: 'Регистрация',
    loginOrRegister: 'Войти / Регистрация',
    searchPlaceholder: 'Поиск...',
    openMenu: 'Открыть меню',
    closeMenu: 'Закрыть меню',
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
  },

  sidebar: {
    guestTitle: 'Добро пожаловать',
    guestSubtitle: 'Войдите, чтобы размещать объявления и напрямую связываться с собственниками',
    level: 'Уровень {level}',
    xpPoints: '{count} XP',
    xpToNext: 'До следующего уровня {count} XP',
    settings: 'Настройки',
  },

  footer: {
    about: 'О платформе',
    aboutText:
      'Maklersiz Uy — платформа для поиска аренды жилья в Узбекистане напрямую '
      + 'у собственника, без посредников. Комиссия 0%.',
    forTenants: 'Арендаторам',
    forOwners: 'Собственникам',
    company: 'Компания',
    legal: 'Правовая информация',
    terms: 'Условия использования',
    privacy: 'Политика конфиденциальности',
    safety: 'Правила безопасности',
    contact: 'Контакты',
    support: 'Поддержка',
    faq: 'Частые вопросы',
    followUs: 'Мы в соцсетях',
    rights: '© {year} Maklersiz Uy. Все права защищены.',
    madeIn: 'Сделано в Узбекистане',
  },

  splash: {
    loading: 'Загружаем объявления и карту...',
  },

  toast: {
    listingCreated: 'Объявление успешно размещено!',
    listingUpdated: 'Объявление изменено.',
    listingDeleted: 'Объявление удалено.',
    listingRejected: 'Объявление не прошло модерацию.',
    favoriteAdded: 'Добавлено в избранное.',
    favoriteRemoved: 'Удалено из избранного.',
    roleSwitched: 'Роль изменена на «{role}».',
    avatarUpdated: 'Фото профиля обновлено.',
    languageChanged: 'Язык изменён.',
    themeChanged: 'Оформление изменено.',
    copiedLink: 'Ссылка скопирована.',
    xpEarned: '+{amount} XP — {reason}',
    welcomeOwner: 'Добро пожаловать! Теперь вы можете размещать объявления.',
    welcomeStudent: 'Добро пожаловать! Выбирайте квартиру без посредников.',
    sessionExpired: 'Сессия истекла. Войдите снова.',
  },

  offline: {
    title: 'Нет подключения к интернету',
    body: 'Проверьте соединение — страница обновится автоматически.',
  },
} as const;
