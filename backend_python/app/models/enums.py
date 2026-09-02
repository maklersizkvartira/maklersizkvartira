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
    #: A professional — a realtor, or somebody running an agency — publishing
    #: on behalf of the people who own the property. They were forced to sign
    #: up as OWNER and then describe themselves in the listing text, which is
    #: both a lie the platform made them tell and information a buyer has a
    #: right to see before they call.
    AGENT = "AGENT"
    MODERATOR = "MODERATOR"
    ADMIN = "ADMIN"
    #: Full access to every user-side capability at once. Exists so the people
    #: building the platform can exercise owner flows, staff views and
    #: moderation paths from one account instead of juggling several.
    DEVELOPER = "DEVELOPER"


#: Roles a self-service signup may request. Everything else is admin-granted —
#: DEVELOPER deliberately among them, so nobody can register into it.
SIGNUP_ROLES = {UserRole.STUDENT, UserRole.OWNER, UserRole.AGENT}
#: Roles that see staff-only material: listings that are pending, rejected or
#: otherwise not public yet.
STAFF_ROLES = {UserRole.MODERATOR, UserRole.ADMIN, UserRole.DEVELOPER}
#: Roles that bypass ownership checks — they may edit or remove any listing.
FULL_ACCESS_ROLES = {UserRole.ADMIN, UserRole.DEVELOPER}
#: Roles allowed to publish listings.
PUBLISHER_ROLES = {UserRole.OWNER, UserRole.AGENT, UserRole.DEVELOPER}

#: Column values, not enum members: ``User.role`` stores the raw string.
SIGNUP_ROLE_VALUES = frozenset(r.value for r in SIGNUP_ROLES)
STAFF_ROLE_VALUES = frozenset(r.value for r in STAFF_ROLES)
FULL_ACCESS_ROLE_VALUES = frozenset(r.value for r in FULL_ACCESS_ROLES)
PUBLISHER_ROLE_VALUES = frozenset(r.value for r in PUBLISHER_ROLES)


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


class SellerType(StrEnum):
    """Who is publishing *this* listing, as opposed to what the account is.

    Kept per listing rather than read off ``User.role`` because the two really
    do come apart: an agent letting out a flat they own themselves posts as
    OWNER, and an owner who has handed one property to an agency does not stop
    being an owner. The person calling about the flat wants to know which of
    the two will pick up, and the account's role cannot tell them.
    """

    OWNER = "OWNER"
    AGENT = "AGENT"


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
    #: The request never came back — a timeout or a dropped connection. The
    #: provider may well have accepted and delivered it, so this is not FAILED:
    #: treating it as one invalidated codes that had already reached the
    #: handset, and told the user nothing had been sent while they were holding
    #: the SMS. It is not QUEUED either, because QUEUED is the placeholder every
    #: ledger row starts life with, and a row still reading QUEUED after a send
    #: means the process died mid-attempt — a different thing worth telling
    #: apart. Stored as a plain string (``sms_logs.status`` is a VARCHAR, not a
    #: Postgres enum), so no migration is needed to start writing it.
    UNKNOWN = "UNKNOWN"


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
    #: Retired from the complaint picker: professional agents are welcome on
    #: the platform, so "this is a broker" is no longer a complaint. The value
    #: stays so historical rows still validate on read.
    BROKER = "BROKER"
    FAKE_LISTING = "FAKE_LISTING"
    FAKE_PHOTOS = "FAKE_PHOTOS"
    WRONG_PRICE = "WRONG_PRICE"
    SPAM = "SPAM"
    HARASSMENT = "HARASSMENT"
    OTHER = "OTHER"


class ReportStatus(StrEnum):
    """What a moderator decided about a complaint.

    The two closing values are not interchangeable, because a listing's
    reliability percentage is computed from them:

    * ``RESOLVED`` means the admin CONFIRMED the complaint. Every confirmed
      report costs the listing reliability points.
    * ``REJECTED`` means the complaint was dismissed. It costs nothing, and
      moving a report back out of ``RESOLVED`` restores the points.
    """

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


class TopRequestStatus(StrEnum):
    """Lifecycle of an owner's request for the promoted ("Top") rail.

    Deliberately the same three values as ``VerificationStatus``: the admin
    panel's status pill, its status filter and the ``.upper()`` comparison in
    the list endpoint then behave identically on both queues.
    """

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
    LISTING_TOP_REQUESTED = "LISTING_TOP_REQUESTED"
    # Deprecated: no longer written by any code path. Publication runs no
    # automated check at all now. Kept so historical audit rows still resolve
    # to a name in the admin feed.
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
    #: Distinct from ADMIN_LISTING_FEATURED, which stays the action for a
    #: promotion an admin applied with no request behind it.
    ADMIN_TOP_APPROVED = "ADMIN_TOP_APPROVED"
    ADMIN_TOP_REJECTED = "ADMIN_TOP_REJECTED"
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
