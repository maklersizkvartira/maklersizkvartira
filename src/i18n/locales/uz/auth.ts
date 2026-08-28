/**
 * Registration, verification, sign-in and password management.
 *
 * The flow the copy describes: name + phone + password -> SMS code ->
 * verification screen -> account created.
 */
export const auth = {
  tabs: {
    login: 'Kirish',
    register: 'Ro‘yxatdan o‘tish',
  },

  role: {
    question: 'Avval kim ekanligingizni tanlang',
    hint: 'Buni keyinroq profilingizdan o‘zgartirishingiz mumkin.',
    owner: {
      title: 'Men uy egasiman',
      description: 'Kvartiramni maklersiz, to‘g‘ridan-to‘g‘ri ijaraga bermoqchiman',
    },
    student: {
      title: 'Kvartira izlayapman',
      description: 'Oila, talaba yoki sheriklikka uy qidiryapman',
    },
    change: 'Rolni o‘zgartirish',
    selected: '{role} sifatida ro‘yxatdan o‘tyapsiz',
  },

  fields: {
    name: 'Ismingiz',
    namePlaceholder: 'Masalan: Dilshod Karimov',
    nameHint: 'Uy egalari haqiqiy ismga ko‘proq ishonadi.',
    phone: 'Telefon raqamingiz',
    phonePlaceholder: '+998 90 123 45 67',
    phoneHint: 'Tasdiqlash kodi shu raqamga yuboriladi.',
    password: 'Parol',
    passwordPlaceholder: 'Kamida 8 ta belgi',
    confirmPassword: 'Parolni takrorlang',
    confirmPlaceholder: 'Parolni qayta kiriting',
    currentPassword: 'Joriy parol',
    newPassword: 'Yangi parol',
    code: 'SMS tasdiqlash kodi',
    codePlaceholder: '______',
    showPassword: 'Parolni ko‘rsatish',
    hidePassword: 'Parolni yashirish',
    rememberMe: 'Meni eslab qol',
  },

  strength: {
    label: 'Parol kuchi',
    veryWeak: 'Juda kuchsiz',
    weak: 'Kuchsiz',
    fair: 'O‘rtacha',
    good: 'Yaxshi',
    strong: 'Kuchli',
    hint: 'Harflar, raqamlar va belgilarni aralashtiring.',
  },

  login: {
    title: 'Hisobingizga kiring',
    subtitle: 'Telefon raqamingiz va parolingiz bilan',
    submit: 'Kirish',
    submitting: 'Kirilmoqda...',
    forgotPassword: 'Parolni unutdingizmi?',
    noAccount: 'Hisobingiz yo‘qmi?',
    createOne: 'Ro‘yxatdan o‘ting',
    orDivider: 'yoki',
    withGoogle: 'Google orqali kirish',
  },

  register: {
    title: 'Yangi hisob yarating',
    subtitle: 'Bir daqiqada ro‘yxatdan o‘ting — komissiyasiz',
    submit: 'Davom etish',
    submitting: 'Kod yuborilmoqda...',
    haveAccount: 'Hisobingiz bormi?',
    signInInstead: 'Kirish',
    terms:
      'Ro‘yxatdan o‘tish orqali siz Foydalanish shartlari va Maxfiylik siyosatiga rozilik bildirasiz.',
    stepOf: '{current}-qadam / {total}',
    steps: {
      details: 'Ma’lumotlaringiz',
      verify: 'Tasdiqlash',
      done: 'Tayyor',
    },
  },

  verify: {
    title: 'Telefon raqamingizni tasdiqlang',
    subtitle: '{phone} raqamiga 6 xonali kod yubordik',
    submit: 'Tasdiqlash va yakunlash',
    submitting: 'Tekshirilmoqda...',
    resend: 'Kodni qayta yuborish',
    resendIn: 'Qayta yuborish — {seconds} soniyadan so‘ng',
    resent: 'Yangi kod yuborildi',
    changePhone: 'Raqamni o‘zgartirish',
    expiresIn: 'Kod {minutes} daqiqa amal qiladi',
    attemptsLeft: 'Yana {count} ta urinish qoldi',
    devCode: 'Test rejimi — kod: {code}',
    pasteHint: 'Kodni to‘liq joylashtirishingiz ham mumkin.',
  },

  forgot: {
    title: 'Parolni tiklash',
    subtitle: 'Telefon raqamingizni kiriting — SMS orqali kod yuboramiz',
    submit: 'Kod yuborish',
    backToLogin: 'Kirish sahifasiga qaytish',
    codeSent: 'Agar bu raqam ro‘yxatdan o‘tgan bo‘lsa, kod yuborildi.',
  },

  reset: {
    title: 'Yangi parol o‘rnating',
    subtitle: 'SMS kodni kiriting va yangi parol tanlang',
    submit: 'Parolni yangilash',
    success: 'Parol yangilandi. Endi yangi parol bilan kiring.',
    // One fused screen became three: phone, then the SMS code, then the new
    // password twice. Each step needs its own heading, and the code step
    // needs a way to say the code was wrong without blaming the password.
    codeTitle: 'SMS kodni kiriting',
    codeSubtitle: '{phone} raqamiga yuborilgan 6 xonali kodni kiriting.',
    passwordTitle: 'Yangi parol tanlang',
    passwordSubtitle: 'Parolni ikki marta kiriting — birini boshqasi tasdiqlaydi.',
    continue: 'Davom etish',
    codeInvalid: 'Kod noto‘g‘ri yoki muddati tugagan. Yangi kod so‘rang.',
    stepOf: '{current}-qadam / {total}',
  },

  changePassword: {
    title: 'Parolni o‘zgartirish',
    submit: 'Parolni o‘zgartirish',
    success: 'Parol o‘zgartirildi. Boshqa qurilmalardan chiqarildingiz.',
    warning: 'Parolni o‘zgartirsangiz, barcha boshqa qurilmalardan chiqasiz.',
  },

  success: {
    badge: 'Muvaffaqiyatli!',
    registered: 'Xush kelibsiz, {name}!',
    registeredBody:
      'Hisobingiz yaratildi va telefon raqamingiz tasdiqlandi. Endi maklersiz kvartira izlashingiz mumkin.',
    loggedIn: 'Xush kelibsiz, {name}',
    loggedInBody: 'Tizimga muvaffaqiyatli kirdingiz.',
    welcomeTitle: 'Xush kelibsiz, {name}!',
    welcomeThanks:
      'MaklersizUy loyihasidan ro‘yxatdan o‘tganingiz va bizni tanlaganingiz uchun rahmat.',
    welcomeDismiss: 'Davom etish uchun bosing',
    redirecting: 'Yo‘naltirilmoqda...',
  },

  logout: {
    title: 'Chiqishni tasdiqlang',
    body: 'Hisobingizdan chiqmoqchimisiz?',
    confirm: 'Ha, chiqish',
    allDevices: 'Barcha qurilmalardan chiqish',
    success: 'Tizimdan chiqdingiz.',
  },

  reregister: {
    title: 'Hisobingizni yangilang',
    body:
      'Xavfsizlik yangilanishi sababli hisobingizga yangi parol o‘rnatish kerak. '
      + 'Xuddi shu telefon raqami bilan qayta ro‘yxatdan o‘ting — e’lonlaringiz va ma’lumotlaringiz saqlanib qoladi.',
    cta: 'Qayta ro‘yxatdan o‘tish',
  },

  guard: {
    title: 'Bu bo‘lim uchun tizimga kiring',
    body: 'E’lon joylash va uy egalari bilan bog‘lanish uchun hisobingizga kiring.',
    cta: 'Kirish yoki ro‘yxatdan o‘tish',
  },

  errors: {
    nameRequired: 'Ismingizni kiriting.',
    nameTooShort: 'Ism kamida 2 ta harfdan iborat bo‘lsin.',
    nameHasDigits: 'Ismda raqam bo‘lmasligi kerak.',
    phoneRequired: 'Telefon raqamingizni kiriting.',
    phoneInvalid: 'Telefon raqami noto‘g‘ri. Masalan: +998 90 123 45 67',
    passwordRequired: 'Parolni kiriting.',
    passwordTooShort: 'Parol kamida {min} ta belgidan iborat bo‘lsin.',
    passwordTooSimple: 'Parol juda oddiy. Harf va raqamlarni birga ishlating.',
    passwordMismatch: 'Parollar mos kelmadi.',
    codeRequired: 'Tasdiqlash kodini kiriting.',
    codeIncomplete: 'Kodni to‘liq kiriting.',
    roleRequired: 'Avval rolni tanlang.',
    googleDomain:
      'Google orqali kirish bu manzil uchun sozlanmagan. Telefon raqami bilan kiring yoki administratorga xabar bering.',
    googleDisabled: 'Google orqali kirish hozircha o‘chirilgan.',
    googlePopupBlocked: 'Brauzer oynani blokladi. Pop-up oynalarga ruxsat bering.',
    googleUnavailable: 'Google xizmati hozir ishlamayapti. Telefon raqami bilan kiring.',
    googleOtherAccount: 'Bu email allaqachon boshqa usulda ro‘yxatdan o‘tgan. Telefon raqami bilan kiring.',
    termsRequired: 'Davom etish uchun shartlarga rozilik bildiring.',
  },
} as const;
