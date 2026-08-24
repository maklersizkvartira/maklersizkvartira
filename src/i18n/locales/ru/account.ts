/**
 * Profile and account settings.
 *
 * Russian strings. Keys mirror `locales/uz/account.ts` exactly — the Uzbek
 * file is the source of truth for the key shape.
 */
export const account = {
  page: {
    title: 'Настройки аккаунта',
    subtitle: 'Данные профиля, безопасность и настройки приложения.',
  },

  profile: {
    title: 'Данные профиля',
    avatarAlt: '{name} — фото профиля',
    avatarChange: 'Изменить фото профиля',
    avatarBadge: 'Фото',
    avatarHint: 'JPG или PNG, до {size} МБ.',
    avatarTooLarge: 'Размер фото не должен превышать {size} МБ.',
    avatarWrongType: 'Загрузить можно только изображение.',
    avatarReadFailed: 'Не удалось прочитать файл. Выберите другой.',
    badgeOwner: 'Профиль собственника',
    badgeStudent: 'Профиль студента',
    captionOwner: 'Ваше фото видят арендаторы в вашем объявлении.',
    captionStudent: 'Ваше фото видит собственник в переписке.',
    nameSaved: 'Имя обновлено.',
    phone: 'Номер телефона',
    phoneLocked: 'Номер телефона — идентификатор вашего аккаунта, изменить его нельзя.',
    memberSince: 'Дата регистрации',
    trustScore: 'Рейтинг доверия',
    verificationLevel: 'Уровень подтверждения',
    xpPoints: 'Баллы XP',
    verified: 'Аккаунт подтверждён',
    notVerified: 'Аккаунт не подтверждён',
    verify: 'Подтвердить аккаунт',
  },

  role: {
    title: 'Ваша роль в системе',
    subtitle: 'Роль можно сменить в любой момент.',
    owner: {
      title: 'Собственник',
      description: 'Размещать объявления',
    },
    student: {
      title: 'Студент',
      description: 'Искать квартиру',
    },
    active: 'Текущая роль',
    switching: 'Меняем роль...',
    switchFailed: 'Не удалось сменить роль.',
    createListing: '+ Разместить новое объявление',
  },

  preferences: {
    title: 'Настройки приложения',
    languageHint: 'Выбранный язык сохраняется в аккаунте и применяется на всех устройствах.',
    themeHint: '«Как в системе» следует настройке вашего устройства.',
  },

  security: {
    title: 'Безопасность',
    passwordTitle: 'Пароль',
    passwordDescription: 'Время от времени обновляйте пароль.',
    passwordNeverShown: 'Пароль не сохраняется в браузере и нигде не показывается.',
  },

  sessions: {
    title: 'Активные сеансы',
    subtitle: 'Устройства, с которых выполнен вход в аккаунт.',
    count: 'Активных сеансов: {count}',
    device: 'Устройство',
    ip: 'IP-адрес',
    started: 'Время входа',
    expires: 'Действует до',
    unknownDevice: 'Неизвестное устройство',
    unknownIp: 'IP не определён',
    empty: 'Активных сеансов не найдено.',
    loadFailed: 'Не удалось загрузить список сеансов.',
    reload: 'Обновить список',
  },

  signOut: {
    title: 'Выход из аккаунта',
    thisDevice: 'Выйти на этом устройстве',
    allDevices: 'Выйти на всех устройствах',
    allDevicesHint:
      'Сеансы завершатся на всех устройствах, и в следующий раз потребуется войти заново.',
    confirmAll: 'Выйти на всех устройствах?',
    failed: 'При выходе произошла ошибка.',
  },
} as const;
