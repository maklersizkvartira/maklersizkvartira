/**
 * Регистрация, подтверждение номера, вход и управление паролем.
 *
 * Порядок шагов, который описывают эти строки: имя + телефон + пароль -> SMS-код ->
 * экран подтверждения -> аккаунт создан.
 */
export const auth = {
  tabs: {
    login: 'Войти',
    register: 'Регистрация',
  },

  role: {
    question: 'Сначала выберите, кто вы',
    hint: 'Это можно изменить позже в профиле.',
    owner: {
      title: 'Я владелец жилья',
      description: 'Хочу сдать свою квартиру напрямую, без посредников',
    },
    student: {
      title: 'Ищу квартиру',
      description: 'Ищу жильё для семьи, для студента или подселение',
    },
    change: 'Изменить роль',
    selected: 'Вы регистрируетесь как {role}',
  },

  fields: {
    name: 'Ваше имя',
    namePlaceholder: 'Например: Дилшод Каримов',
    nameHint: 'Владельцы больше доверяют настоящему имени.',
    phone: 'Ваш номер телефона',
    phonePlaceholder: '+998 90 123 45 67',
    phoneHint: 'Код подтверждения придёт на этот номер.',
    password: 'Пароль',
    passwordPlaceholder: 'Минимум 8 символов',
    confirmPassword: 'Повторите пароль',
    confirmPlaceholder: 'Введите пароль ещё раз',
    currentPassword: 'Текущий пароль',
    newPassword: 'Новый пароль',
    code: 'SMS-код подтверждения',
    codePlaceholder: '______',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    rememberMe: 'Запомнить меня',
  },

  strength: {
    label: 'Надёжность пароля',
    veryWeak: 'Очень слабый',
    weak: 'Слабый',
    fair: 'Средний',
    good: 'Хороший',
    strong: 'Надёжный',
    hint: 'Смешивайте буквы, цифры и символы.',
  },

  login: {
    title: 'Вход в аккаунт',
    subtitle: 'По номеру телефона и паролю',
    submit: 'Войти',
    submitting: 'Выполняется вход...',
    forgotPassword: 'Забыли пароль?',
    noAccount: 'Нет аккаунта?',
    createOne: 'Зарегистрируйтесь',
    orDivider: 'или',
    withGoogle: 'Войти через Google',
  },

  register: {
    title: 'Создайте новый аккаунт',
    subtitle: 'Регистрация за минуту — без комиссии',
    submit: 'Продолжить',
    submitting: 'Отправляем код...',
    haveAccount: 'Уже есть аккаунт?',
    signInInstead: 'Войти',
    terms:
      'Регистрируясь, вы соглашаетесь с Условиями использования и Политикой конфиденциальности.',
    stepOf: 'Шаг {current} / {total}',
    steps: {
      details: 'Ваши данные',
      verify: 'Подтверждение',
      done: 'Готово',
    },
  },

  verify: {
    title: 'Подтвердите номер телефона',
    subtitle: 'Мы отправили 6-значный код на номер {phone}',
    submit: 'Подтвердить и завершить',
    submitting: 'Проверяем...',
    resend: 'Отправить код повторно',
    resendIn: 'Отправить повторно — через {seconds} сек.',
    resent: 'Новый код отправлен',
    changePhone: 'Изменить номер',
    expiresIn: 'Код действителен {minutes} мин.',
    attemptsLeft: 'Осталось попыток: {count}',
    devCode: 'Тестовый режим — код: {code}',
    pasteHint: 'Код можно вставить целиком.',
  },

  forgot: {
    title: 'Восстановление пароля',
    subtitle: 'Введите номер телефона — мы отправим код по SMS',
    submit: 'Отправить код',
    backToLogin: 'Вернуться ко входу',
    codeSent: 'Если этот номер зарегистрирован, код отправлен.',
  },

  reset: {
    title: 'Задайте новый пароль',
    subtitle: 'Введите код из SMS и выберите новый пароль',
    submit: 'Обновить пароль',
    success: 'Пароль обновлён. Теперь войдите с новым паролем.',
    // One fused screen became three: phone, then the SMS code, then the new
    // password twice. Each step needs its own heading, and the code step
    // needs a way to say the code was wrong without blaming the password.
    codeTitle: 'Введите код из SMS',
    codeSubtitle: 'Введите 6-значный код, отправленный на номер {phone}.',
    passwordTitle: 'Выберите новый пароль',
    passwordSubtitle: 'Введите пароль дважды — второй раз подтверждает первый.',
    continue: 'Продолжить',
    codeInvalid: 'Код неверный или истёк. Запросите новый код.',
    stepOf: 'Шаг {current} из {total}',
  },

  changePassword: {
    title: 'Смена пароля',
    submit: 'Изменить пароль',
    success: 'Пароль изменён. Вы вышли из аккаунта на других устройствах.',
    warning: 'После смены пароля вы выйдете из аккаунта на всех других устройствах.',
  },

  success: {
    badge: 'Готово!',
    registered: 'Добро пожаловать, {name}!',
    registeredBody:
      'Аккаунт создан, номер телефона подтверждён. Теперь вы можете искать квартиру без посредников.',
    loggedIn: 'Добро пожаловать, {name}',
    loggedInBody: 'Вы успешно вошли в систему.',
    welcomeTitle: 'Добро пожаловать, {name}!',
    welcomeThanks:
      'Спасибо, что зарегистрировались в MaklersizUy и выбрали нас.',
    welcomeDismiss: 'Нажмите, чтобы продолжить',
    redirecting: 'Перенаправляем...',
  },

  logout: {
    title: 'Подтвердите выход',
    body: 'Выйти из аккаунта?',
    confirm: 'Да, выйти',
    allDevices: 'Выйти на всех устройствах',
    success: 'Вы вышли из системы.',
  },

  reregister: {
    title: 'Обновите аккаунт',
    body:
      'Из-за обновления системы безопасности нужно задать новый пароль. '
      + 'Пройдите регистрацию заново с тем же номером телефона — ваши объявления и данные сохранятся.',
    cta: 'Пройти регистрацию заново',
  },

  guard: {
    title: 'Войдите, чтобы открыть этот раздел',
    body: 'Войдите в аккаунт, чтобы размещать объявления и связываться с владельцами.',
    cta: 'Войти или зарегистрироваться',
  },

  errors: {
    nameRequired: 'Введите ваше имя.',
    nameTooShort: 'Имя должно содержать не менее 2 букв.',
    nameHasDigits: 'В имени не должно быть цифр.',
    phoneRequired: 'Введите номер телефона.',
    phoneInvalid: 'Неверный номер телефона. Например: +998 90 123 45 67',
    passwordRequired: 'Введите пароль.',
    passwordTooShort: 'Пароль должен содержать не менее {min} символов.',
    passwordTooSimple: 'Пароль слишком простой. Используйте буквы вместе с цифрами.',
    passwordMismatch: 'Пароли не совпадают.',
    codeRequired: 'Введите код подтверждения.',
    codeIncomplete: 'Введите код полностью.',
    roleRequired: 'Сначала выберите роль.',
    googleDomain:
      'Вход через Google не настроен для этого адреса. Войдите по номеру телефона.',
    googleDisabled: 'Вход через Google временно отключён.',
    googlePopupBlocked: 'Браузер заблокировал окно. Разрешите всплывающие окна.',
    googleUnavailable: 'Сервис Google сейчас недоступен. Войдите по номеру телефона.',
    googleOtherAccount: 'Этот email уже зарегистрирован другим способом.',
    termsRequired: 'Чтобы продолжить, примите условия.',
  },
} as const;
