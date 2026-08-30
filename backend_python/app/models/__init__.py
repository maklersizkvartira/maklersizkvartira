"""SQLAlchemy models.

Importing this package registers every table on ``Base.metadata``, which is
what Alembic autogenerate reflects against.
"""

from app.models.ai import AIMessage, AISession
from app.models.analytics import SmsLog, TrafficEvent
from app.models.audit import AuditLog
from app.models.auth import LoginAttempt, OtpCode, PendingRegistration, RefreshToken
from app.models.base import Base
from app.models.chat import ChatMessage, Conversation
from app.models.listing import Favorite, Listing, TopRequest
from app.models.moderation import Report, VerificationRequest
from app.models.settings import SystemSetting
from app.models.user import AdminUser, User

__all__ = [
    "AIMessage",
    "AISession",
    "AdminUser",
    "AuditLog",
    "Base",
    "Favorite",
    "Listing",
    "LoginAttempt",
    "OtpCode",
    "PendingRegistration",
    "RefreshToken",
    "Report",
    "SmsLog",
    "SystemSetting",
    "TopRequest",
    "TrafficEvent",
    "User",
    "VerificationRequest",
]
