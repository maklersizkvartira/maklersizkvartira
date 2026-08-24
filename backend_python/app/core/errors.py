"""Typed API errors with localised messages.

Every failure carries a stable machine-readable ``code``. The human message
is looked up per request language, so the frontend can either show the
server's text directly or translate the code itself.

Messages never leak internals: no stack traces, no SQL, no "user not found"
where that would let an attacker enumerate accounts.
"""

from __future__ import annotations

from typing import Any

from fastapi import status

Language = str  # "uz" | "ru" | "en"
DEFAULT_LANGUAGE = "uz"
SUPPORTED_LANGUAGES = ("uz", "ru", "en")

# ---------------------------------------------------------------------------
# code -> {uz, ru, en}
# ---------------------------------------------------------------------------
MESSAGES: dict[str, dict[str, str]] = {
    # -- Generic ------------------------------------------------------------
    "internal_error": {
        "uz": "Serverda kutilmagan xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
        "ru": "Произошла непредвиденная ошибка сервера. Повторите попытку позже.",
        "en": "An unexpected server error occurred. Please try again shortly.",
    },
    "not_found": {
        "uz": "So'ralgan ma'lumot topilmadi.",
        "ru": "Запрашиваемые данные не найдены.",
        "en": "The requested resource was not found.",
    },
    "validation_error": {
        "uz": "Kiritilgan ma'lumotlar noto'g'ri. Iltimos, tekshirib qaytadan yuboring.",
        "ru": "Введённые данные некорректны. Проверьте и отправьте снова.",
        "en": "The submitted data is invalid. Please check it and try again.",
    },
    "rate_limited": {
        "uz": "Juda ko'p so'rov yuborildi. Iltimos, biroz kuting.",
        "ru": "Слишком много запросов. Пожалуйста, подождите немного.",
        "en": "Too many requests. Please wait a moment.",
    },
    "payload_too_large": {
        "uz": "Yuborilgan ma'lumot hajmi juda katta.",
        "ru": "Размер отправленных данных слишком велик.",
        "en": "The submitted payload is too large.",
    },
    "forbidden": {
        "uz": "Bu amalni bajarishga ruxsatingiz yo'q.",
        "ru": "У вас нет прав на это действие.",
        "en": "You do not have permission to perform this action.",
    },
    "service_unavailable": {
        "uz": "Xizmat vaqtincha ishlamayapti. Birozdan so'ng urinib ko'ring.",
        "ru": "Сервис временно недоступен. Попробуйте позже.",
        "en": "The service is temporarily unavailable. Please try again later.",
    },
    # -- Authentication -----------------------------------------------------
    "unauthorized": {
        "uz": "Avval tizimga kiring.",
        "ru": "Пожалуйста, войдите в систему.",
        "en": "Please sign in first.",
    },
    "token_expired": {
        "uz": "Sessiya muddati tugadi. Qaytadan kiring.",
        "ru": "Срок действия сессии истёк. Войдите снова.",
        "en": "Your session has expired. Please sign in again.",
    },
    "token_invalid": {
        "uz": "Sessiya yaroqsiz. Qaytadan kiring.",
        "ru": "Недействительная сессия. Войдите снова.",
        "en": "Your session is invalid. Please sign in again.",
    },
    "refresh_invalid": {
        "uz": "Sessiyani yangilab bo'lmadi. Qaytadan kiring.",
        "ru": "Не удалось обновить сессию. Войдите снова.",
        "en": "Could not refresh your session. Please sign in again.",
    },
    "refresh_reused": {
        "uz": "Xavfsizlik sababli barcha qurilmalardan chiqarildingiz. Qaytadan kiring.",
        "ru": "В целях безопасности вы вышли на всех устройствах. Войдите снова.",
        "en": "For your security you were signed out everywhere. Please sign in again.",
    },
    "invalid_credentials": {
        "uz": "Telefon raqami yoki parol noto'g'ri.",
        "ru": "Неверный номер телефона или пароль.",
        "en": "Incorrect phone number or password.",
    },
    "account_locked": {
        "uz": "Hisob vaqtincha bloklandi. {minutes} daqiqadan so'ng qayta urinib ko'ring.",
        "ru": "Аккаунт временно заблокирован. Повторите через {minutes} мин.",
        "en": "Account temporarily locked. Try again in {minutes} minutes.",
    },
    "account_suspended": {
        "uz": "Hisobingiz to'xtatilgan. Qo'llab-quvvatlash xizmatiga murojaat qiling.",
        "ru": "Ваш аккаунт приостановлен. Обратитесь в поддержку.",
        "en": "Your account is suspended. Please contact support.",
    },
    "account_banned": {
        "uz": "Hisobingiz bloklangan.",
        "ru": "Ваш аккаунт заблокирован.",
        "en": "Your account has been banned.",
    },
    "account_not_verified": {
        "uz": "Telefon raqamingiz tasdiqlanmagan. SMS kodni kiriting.",
        "ru": "Номер телефона не подтверждён. Введите код из SMS.",
        "en": "Your phone number is not verified. Please enter the SMS code.",
    },
    "reregistration_required": {
        "uz": "Xavfsizlik yangilanishi sababli hisobingizni qayta ro'yxatdan o'tkazing.",
        "ru": "Из-за обновления безопасности пройдите регистрацию заново.",
        "en": "Because of a security upgrade, please register your account again.",
    },
    "phone_already_registered": {
        "uz": "Bu telefon raqami allaqachon ro'yxatdan o'tgan. Kirish bo'limidan foydalaning.",
        "ru": "Этот номер уже зарегистрирован. Воспользуйтесь входом.",
        "en": "This phone number is already registered. Please sign in instead.",
    },
    "password_mismatch": {
        "uz": "Parollar mos kelmadi.",
        "ru": "Пароли не совпадают.",
        "en": "The passwords do not match.",
    },
    "current_password_invalid": {
        "uz": "Joriy parol noto'g'ri.",
        "ru": "Текущий пароль неверен.",
        "en": "Your current password is incorrect.",
    },
    # -- Password policy ----------------------------------------------------
    "password_too_short": {
        "uz": "Parol kamida {min} ta belgidan iborat bo'lishi kerak.",
        "ru": "Пароль должен содержать не менее {min} символов.",
        "en": "The password must be at least {min} characters long.",
    },
    "password_too_long": {
        "uz": "Parol juda uzun.",
        "ru": "Пароль слишком длинный.",
        "en": "The password is too long.",
    },
    "password_too_simple": {
        "uz": "Parol juda oddiy. Harf va raqamlarni birga ishlating.",
        "ru": "Пароль слишком простой. Используйте буквы и цифры.",
        "en": "The password is too simple. Combine letters and numbers.",
    },
    "password_too_common": {
        "uz": "Bu parol juda keng tarqalgan. Boshqa parol tanlang.",
        "ru": "Этот пароль слишком распространён. Выберите другой.",
        "en": "That password is too common. Please choose another.",
    },
    "password_contains_phone": {
        "uz": "Parol telefon raqamingizni o'z ichiga olmasligi kerak.",
        "ru": "Пароль не должен содержать ваш номер телефона.",
        "en": "The password must not contain your phone number.",
    },
    "password_contains_name": {
        "uz": "Parol ismingizni o'z ichiga olmasligi kerak.",
        "ru": "Пароль не должен содержать ваше имя.",
        "en": "The password must not contain your name.",
    },
    "password_repeated_character": {
        "uz": "Parol faqat bir xil belgidan iborat bo'lmasligi kerak.",
        "ru": "Пароль не может состоять из одного повторяющегося символа.",
        "en": "The password cannot be a single repeated character.",
    },
    "password_whitespace": {
        "uz": "Parol boshida yoki oxirida bo'sh joy bo'lmasligi kerak.",
        "ru": "Пароль не должен начинаться или заканчиваться пробелом.",
        "en": "The password must not start or end with a space.",
    },
    # -- Phone --------------------------------------------------------------
    "phone_required": {
        "uz": "Telefon raqamingizni kiriting.",
        "ru": "Введите номер телефона.",
        "en": "Please enter your phone number.",
    },
    "phone_invalid": {
        "uz": "Telefon raqami noto'g'ri.",
        "ru": "Некорректный номер телефона.",
        "en": "That phone number is not valid.",
    },
    "phone_invalid_length": {
        "uz": "Telefon raqami to'liq emas. Masalan: +998 90 123 45 67",
        "ru": "Номер телефона неполный. Например: +998 90 123 45 67",
        "en": "The phone number is incomplete. Example: +998 90 123 45 67",
    },
    "phone_unknown_operator": {
        "uz": "Bunday operator kodi mavjud emas.",
        "ru": "Такой код оператора не существует.",
        "en": "That operator code does not exist.",
    },
    # -- OTP ----------------------------------------------------------------
    "otp_not_found": {
        "uz": "Kod yuborilmagan yoki muddati tugagan. Yangi kod so'rang.",
        "ru": "Код не отправлен или истёк. Запросите новый.",
        "en": "No code was sent, or it has expired. Request a new one.",
    },
    "otp_expired": {
        "uz": "Kodning amal qilish muddati tugadi. Yangi kod so'rang.",
        "ru": "Срок действия кода истёк. Запросите новый.",
        "en": "The code has expired. Please request a new one.",
    },
    "otp_invalid": {
        "uz": "Tasdiqlash kodi noto'g'ri. Yana {remaining} ta urinish qoldi.",
        "ru": "Неверный код подтверждения. Осталось попыток: {remaining}.",
        "en": "Incorrect verification code. {remaining} attempts remaining.",
    },
    "otp_too_many_attempts": {
        "uz": "Juda ko'p noto'g'ri urinish. Yangi kod so'rang.",
        "ru": "Слишком много неверных попыток. Запросите новый код.",
        "en": "Too many incorrect attempts. Please request a new code.",
    },
    "otp_cooldown": {
        "uz": "Yangi kodni {seconds} soniyadan so'ng so'rashingiz mumkin.",
        "ru": "Новый код можно запросить через {seconds} сек.",
        "en": "You can request a new code in {seconds} seconds.",
    },
    "otp_daily_limit": {
        "uz": "Bugun uchun SMS limiti tugadi. Ertaga qayta urinib ko'ring.",
        "ru": "Дневной лимит SMS исчерпан. Попробуйте завтра.",
        "en": "The daily SMS limit has been reached. Please try again tomorrow.",
    },
    "sms_send_failed": {
        "uz": "SMS yuborishda xatolik. Iltimos, qayta urinib ko'ring.",
        "ru": "Не удалось отправить SMS. Попробуйте ещё раз.",
        "en": "Could not send the SMS. Please try again.",
    },
    "registration_not_found": {
        "uz": "Ro'yxatdan o'tish jarayoni topilmadi. Qaytadan boshlang.",
        "ru": "Процесс регистрации не найден. Начните заново.",
        "en": "No registration in progress. Please start again.",
    },
    # -- Listings -----------------------------------------------------------
    "listing_not_found": {
        "uz": "E'lon topilmadi yoki o'chirilgan.",
        "ru": "Объявление не найдено или удалено.",
        "en": "That listing was not found or has been removed.",
    },
    "listing_forbidden": {
        "uz": "Bu e'lon sizga tegishli emas.",
        "ru": "Это объявление вам не принадлежит.",
        "en": "This listing does not belong to you.",
    },
    "listing_rejected_by_ai": {
        "uz": "E'lon moderatsiyadan o'tmadi: maklerlik yoki firibgarlik belgilari aniqlandi.",
        "ru": "Объявление не прошло модерацию: признаки посредничества или мошенничества.",
        "en": "The listing failed moderation: broker or fraud signals were detected.",
    },
    "listing_limit_reached": {
        "uz": "Bir soatda faqat {limit} ta e'lon joylashingiz mumkin.",
        "ru": "В час можно разместить не более {limit} объявлений.",
        "en": "You may post at most {limit} listings per hour.",
    },
    "owner_role_required": {
        "uz": "E'lon joylash uchun 'Uy egasi' rolini tanlang.",
        "ru": "Чтобы разместить объявление, выберите роль «Владелец».",
        "en": "Switch to the Owner role to post a listing.",
    },
    "too_many_images": {
        "uz": "Bitta e'longa eng ko'pi {limit} ta rasm yuklash mumkin.",
        "ru": "К одному объявлению можно приложить не более {limit} фото.",
        "en": "A listing may include at most {limit} images.",
    },
    # -- Admin --------------------------------------------------------------
    "admin_unauthorized": {
        "uz": "Admin paneliga kirish uchun avtorizatsiyadan o'ting.",
        "ru": "Авторизуйтесь для доступа к админ-панели.",
        "en": "Sign in to access the admin panel.",
    },
    "admin_forbidden": {
        "uz": "Bu amal uchun yetarli huquqingiz yo'q.",
        "ru": "Недостаточно прав для этого действия.",
        "en": "You do not have sufficient privileges for this action.",
    },
    "admin_ip_not_allowed": {
        "uz": "Bu IP manzildan admin paneliga kirish taqiqlangan.",
        "ru": "Доступ в админ-панель с этого IP запрещён.",
        "en": "Admin access is not allowed from this IP address.",
    },
    "password_reveal_disabled": {
        "uz": "Parolni ko'rsatish funksiyasi o'chirilgan.",
        "ru": "Функция показа пароля отключена.",
        "en": "The password reveal feature is disabled.",
    },
    "password_reveal_unavailable": {
        "uz": "Bu foydalanuvchi uchun parol saqlanmagan.",
        "ru": "Для этого пользователя пароль не сохранён.",
        "en": "No recoverable password is stored for this user.",
    },
    "cannot_modify_self": {
        "uz": "O'z hisobingizga bu amalni qo'llay olmaysiz.",
        "ru": "Вы не можете применить это действие к своему аккаунту.",
        "en": "You cannot apply this action to your own account.",
    },
    # -- AI -----------------------------------------------------------------
    "ai_daily_limit": {
        "uz": "Bugungi {limit} ta bepul Shield AI so'rovingiz tugadi. Ertaga yangilanadi.",
        "ru": "Дневной лимит {limit} бесплатных запросов Shield AI исчерпан. Обновится завтра.",
        "en": "You have used all {limit} free Shield AI requests for today. Resets tomorrow.",
    },
    "ai_message_required": {
        "uz": "Xabar matnini kiriting.",
        "ru": "Введите текст сообщения.",
        "en": "Please enter a message.",
    },
}


def resolve_language(candidate: str | None) -> str:
    if not candidate:
        return DEFAULT_LANGUAGE
    lang = candidate.strip().lower()[:2]
    return lang if lang in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def parse_accept_language(header: str | None) -> str:
    """Pick the best supported language from an ``Accept-Language`` header."""
    if not header:
        return DEFAULT_LANGUAGE
    best_lang, best_q = DEFAULT_LANGUAGE, -1.0
    for part in header.split(","):
        piece = part.strip()
        if not piece:
            continue
        tag, _, params = piece.partition(";")
        quality = 1.0
        if params.startswith("q="):
            try:
                quality = float(params[2:])
            except ValueError:
                quality = 0.0
        code = tag.strip().lower()[:2]
        if code in SUPPORTED_LANGUAGES and quality > best_q:
            best_lang, best_q = code, quality
    return best_lang if best_q >= 0 else DEFAULT_LANGUAGE


def translate(code: str, language: str = DEFAULT_LANGUAGE, **params: Any) -> str:
    entry = MESSAGES.get(code)
    language = resolve_language(language)
    if not entry:
        return code
    template = entry.get(language) or entry.get(DEFAULT_LANGUAGE) or code
    if not params:
        return template
    try:
        return template.format(**params)
    except (KeyError, IndexError):
        return template


class APIError(Exception):
    """Base class for every deliberate API failure."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "validation_error"

    def __init__(
        self,
        code: str | None = None,
        *,
        status_code: int | None = None,
        params: dict[str, Any] | None = None,
        field: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.params = params or {}
        self.field = field
        self.headers = headers
        super().__init__(self.code)

    def message(self, language: str = DEFAULT_LANGUAGE) -> str:
        return translate(self.code, language, **self.params)

    def to_payload(self, language: str = DEFAULT_LANGUAGE) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "status": "error",
            "code": self.code,
            "message": self.message(language),
        }
        if self.field:
            payload["field"] = self.field
        if self.params:
            payload["params"] = self.params
        return payload


class BadRequest(APIError):
    status_code = status.HTTP_400_BAD_REQUEST


class Unauthorized(APIError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"


class Forbidden(APIError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class NotFound(APIError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class Conflict(APIError):
    status_code = status.HTTP_409_CONFLICT


class TooManyRequests(APIError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"


class ServiceUnavailable(APIError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "service_unavailable"
