"""String enums shared by models, schemas and the admin panel.

Stored as VARCHAR rather than native PostgreSQL enums so that adding a value
is a code change, not a locking migration.
"""

from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    STUDENT = "STUDENT"
    TENANT = "TENANT"
    OWNER = "OWNER"
    MODERATOR = "MODERATOR"
    ADMIN = "ADMIN"


#: Roles a self-service signup may request. Everything else is admin-granted.
SIGNUP_ROLES = {UserRole.STUDENT, UserRole.OWNER}
#: Roles that may reach the admin API.
STAFF_ROLES = {UserRole.MODERATOR, UserRole.ADMIN}


class UserStatus(StrEnum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    BANNED = "BANNED"
    #: Legacy account carried over from the old backend. It has no password,
    #: so it cannot log in until the owner re-registers on the same phone.
    REGISTRATION_REQUIRED = "REGISTRATION_REQUIRED"


class AdminRole(StrEnum):
    MODERATOR = "MODERATOR"
    ADMIN = "ADMIN"
    SUPERADMIN = "SUPERADMIN"


class Language(StrEnum):
    UZ = "uz"
    RU = "ru"
    EN = "en"


class ThemePreference(StrEnum):
    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


class ListingStatus(StrEnum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    WARNING = "WARNING"
    REJECTED = "REJECTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ARCHIVED = "ARCHIVED"


class PropertyType(StrEnum):
    APARTMENT = "APARTMENT"
    HOUSE = "HOUSE"
    ROOM = "ROOM"
    STUDIO = "STUDIO"
    DORMITORY = "DORMITORY"


class RoommateGender(StrEnum):
    BOYS = "BOYS"
    GIRLS = "GIRLS"
    ANY = "ANY"


class OtpPurpose(StrEnum):
    REGISTER = "REGISTER"
    LOGIN = "LOGIN"
    PASSWORD_RESET = "PASSWORD_RESET"
    PHONE_CHANGE = "PHONE_CHANGE"


class SmsStatus(StrEnum):
    QUEUED = "QUEUED"
    SENT = "SENT"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class ActorType(StrEnum):
    USER = "USER"
    ADMIN = "ADMIN"
    SYSTEM = "SYSTEM"
    ANONYMOUS = "ANONYMOUS"


class AuditSeverity(StrEnum):
    INFO = "INFO"
    NOTICE = "NOTICE"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class ReportReason(StrEnum):
    SCAM = "SCAM"
    BROKER = "BROKER"
    FAKE_LISTING = "FAKE_LISTING"
    FAKE_PHOTOS = "FAKE_PHOTOS"
    WRONG_PRICE = "WRONG_PRICE"
    SPAM = "SPAM"
    HARASSMENT = "HARASSMENT"
    OTHER = "OTHER"


class ReportStatus(StrEnum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"


class ReportPriority(StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class VerificationDocumentType(StrEnum):
    PASSPORT = "PASSPORT"
    ID_CARD = "ID_CARD"
    CADASTRE = "CADASTRE"
    SELFIE_LIVENESS = "SELFIE_LIVENESS"


class VerificationStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class AuditAction(StrEnum):
    """Every state change worth showing in the admin activity feed.

    Keep the names stable: the admin panel filters and translates on them.
    """

    # -- Authentication ---------------------------------------------------
    AUTH_REGISTER_STARTED = "AUTH_REGISTER_STARTED"
    AUTH_REGISTER_COMPLETED = "AUTH_REGISTER_COMPLETED"
    AUTH_REGISTER_BLOCKED = "AUTH_REGISTER_BLOCKED"
    AUTH_OTP_SENT = "AUTH_OTP_SENT"
    AUTH_OTP_VERIFIED = "AUTH_OTP_VERIFIED"
    AUTH_OTP_FAILED = "AUTH_OTP_FAILED"
    AUTH_OTP_RESENT = "AUTH_OTP_RESENT"
    AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS"
    AUTH_LOGIN_FAILED = "AUTH_LOGIN_FAILED"
    AUTH_LOGIN_LOCKED = "AUTH_LOGIN_LOCKED"
    AUTH_LOGOUT = "AUTH_LOGOUT"
    AUTH_TOKEN_REFRESHED = "AUTH_TOKEN_REFRESHED"
    AUTH_TOKEN_REUSE_DETECTED = "AUTH_TOKEN_REUSE_DETECTED"
    AUTH_PASSWORD_CHANGED = "AUTH_PASSWORD_CHANGED"
    AUTH_PASSWORD_RESET_REQUESTED = "AUTH_PASSWORD_RESET_REQUESTED"
    AUTH_PASSWORD_RESET_COMPLETED = "AUTH_PASSWORD_RESET_COMPLETED"
    AUTH_GOOGLE_LOGIN = "AUTH_GOOGLE_LOGIN"

    # -- Profile ----------------------------------------------------------
    USER_PROFILE_UPDATED = "USER_PROFILE_UPDATED"
    USER_AVATAR_UPDATED = "USER_AVATAR_UPDATED"
    USER_ROLE_SWITCHED = "USER_ROLE_SWITCHED"
    USER_LANGUAGE_CHANGED = "USER_LANGUAGE_CHANGED"
    USER_THEME_CHANGED = "USER_THEME_CHANGED"
    USER_DELETED_SELF = "USER_DELETED_SELF"

    # -- Listings ---------------------------------------------------------
    LISTING_CREATED = "LISTING_CREATED"
    LISTING_UPDATED = "LISTING_UPDATED"
    LISTING_DELETED = "LISTING_DELETED"
    LISTING_VIEWED = "LISTING_VIEWED"
    LISTING_FAVORITED = "LISTING_FAVORITED"
    LISTING_UNFAVORITED = "LISTING_UNFAVORITED"
    LISTING_CONTACTED = "LISTING_CONTACTED"
    LISTING_REPORTED = "LISTING_REPORTED"
    LISTING_AI_APPROVED = "LISTING_AI_APPROVED"
    LISTING_AI_REJECTED = "LISTING_AI_REJECTED"

    # -- Admin ------------------------------------------------------------
    ADMIN_LOGIN_SUCCESS = "ADMIN_LOGIN_SUCCESS"
    ADMIN_LOGIN_FAILED = "ADMIN_LOGIN_FAILED"
    ADMIN_LOGOUT = "ADMIN_LOGOUT"
    ADMIN_USER_UPDATED = "ADMIN_USER_UPDATED"
    ADMIN_USER_SUSPENDED = "ADMIN_USER_SUSPENDED"
    ADMIN_USER_REACTIVATED = "ADMIN_USER_REACTIVATED"
    ADMIN_USER_DELETED = "ADMIN_USER_DELETED"
    ADMIN_USER_PASSWORD_REVEALED = "ADMIN_USER_PASSWORD_REVEALED"
    ADMIN_USER_PASSWORD_RESET = "ADMIN_USER_PASSWORD_RESET"
    ADMIN_USER_SESSIONS_REVOKED = "ADMIN_USER_SESSIONS_REVOKED"
    ADMIN_LISTING_STATUS_CHANGED = "ADMIN_LISTING_STATUS_CHANGED"
    ADMIN_LISTING_FEATURED = "ADMIN_LISTING_FEATURED"
    ADMIN_LISTING_DELETED = "ADMIN_LISTING_DELETED"
    ADMIN_REPORT_RESOLVED = "ADMIN_REPORT_RESOLVED"
    ADMIN_VERIFICATION_REVIEWED = "ADMIN_VERIFICATION_REVIEWED"
    ADMIN_SETTINGS_CHANGED = "ADMIN_SETTINGS_CHANGED"
    ADMIN_ACCOUNT_CREATED = "ADMIN_ACCOUNT_CREATED"
    ADMIN_EXPORT = "ADMIN_EXPORT"

    # -- AI / messaging ---------------------------------------------------
    AI_CHAT_MESSAGE = "AI_CHAT_MESSAGE"
    AI_CHAT_CLOSED = "AI_CHAT_CLOSED"
    AI_LIMIT_REACHED = "AI_LIMIT_REACHED"
    SMS_SENT = "SMS_SENT"
    SMS_FAILED = "SMS_FAILED"
    TELEGRAM_NOTIFIED = "TELEGRAM_NOTIFIED"

    # -- Security ---------------------------------------------------------
    SECURITY_RATE_LIMITED = "SECURITY_RATE_LIMITED"
    SECURITY_FORBIDDEN = "SECURITY_FORBIDDEN"
    SECURITY_SUSPICIOUS_INPUT = "SECURITY_SUSPICIOUS_INPUT"
