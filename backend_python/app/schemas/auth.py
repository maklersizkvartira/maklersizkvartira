"""Authentication request/response schemas.

The registration flow is deliberately three steps:

    POST /auth/register        name + phone + password  -> SMS sent
    POST /auth/verify-code     phone + code             -> account created, tokens
    POST /auth/login           phone + password         -> tokens

Nothing is written to ``users`` until the SMS code is confirmed.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator

from app.core.errors import DEFAULT_LANGUAGE
from app.core.phone import InvalidPhoneError, normalise_phone
from app.core.security import PasswordPolicyError, normalise_password, validate_password
from app.models.enums import (
    Language,
    OtpPurpose,
    ThemePreference,
    UserRole,
    VerificationDocumentType,
)
from app.schemas.common import CamelModel, IPStr, ORMCamelModel

PhoneStr = Annotated[str, Field(min_length=7, max_length=24, examples=["+998 90 123 45 67"])]
PasswordStr = Annotated[str, Field(min_length=1, max_length=128)]
NameStr = Annotated[str, Field(min_length=2, max_length=120, examples=["Dilshod Karimov"])]


def _validate_phone(value: str) -> str:
    try:
        return normalise_phone(value)
    except InvalidPhoneError as exc:
        raise ValueError(exc.code) from exc


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
class RegisterRequest(CamelModel):
    name: NameStr
    phone: PhoneStr
    password: PasswordStr
    confirm_password: str | None = None
    role: Literal[UserRole.STUDENT, UserRole.OWNER] = UserRole.STUDENT
    language: Language = Language.UZ

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        cleaned = " ".join(v.split())
        if len(cleaned) < 2:
            raise ValueError("validation_error")
        # Letters (any script), spaces, apostrophes and hyphens only.
        if any(ch.isdigit() for ch in cleaned):
            raise ValueError("validation_error")
        return cleaned

    @model_validator(mode="after")
    def _passwords(self) -> "RegisterRequest":
        if self.confirm_password is not None and self.password != self.confirm_password:
            raise ValueError("password_mismatch")
        try:
            self.password = validate_password(
                self.password, phone=self.phone, name=self.name
            )
        except PasswordPolicyError as exc:
            raise ValueError(exc.code) from exc
        return self


class RegisterResponse(CamelModel):
    status: str = "pending_verification"
    message: str
    phone: str
    #: Seconds until a resend is permitted.
    resend_after: int
    expires_in: int
    #: Populated only outside production, so the flow is testable without SMS.
    debug_code: str | None = None


class VerifyCodeRequest(CamelModel):
    phone: PhoneStr
    code: Annotated[str, Field(min_length=4, max_length=8)]
    purpose: OtpPurpose = OtpPurpose.REGISTER

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("code")
    @classmethod
    def _code(cls, v: str) -> str:
        digits = "".join(ch for ch in v if ch.isdigit())
        if not digits:
            raise ValueError("otp_invalid")
        return digits


class ResendCodeRequest(CamelModel):
    phone: PhoneStr
    purpose: OtpPurpose = OtpPurpose.REGISTER

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_phone(v)


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
class LoginRequest(CamelModel):
    phone: PhoneStr
    password: PasswordStr

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        # Only normalised here - never policy-checked, or the error message
        # would tell an attacker their guess was well-formed.
        return normalise_password(v)


class AdminLoginRequest(CamelModel):
    username: Annotated[str, Field(min_length=3, max_length=64)]
    password: PasswordStr

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        return v.strip().lower()


class RefreshRequest(CamelModel):
    refresh_token: str = Field(min_length=10, max_length=512)


class LogoutRequest(CamelModel):
    refresh_token: str | None = None
    all_devices: bool = False


# ---------------------------------------------------------------------------
# Password management
# ---------------------------------------------------------------------------
class ForgotPasswordRequest(CamelModel):
    phone: PhoneStr

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_phone(v)


class ResetPasswordRequest(CamelModel):
    phone: PhoneStr
    code: Annotated[str, Field(min_length=4, max_length=8)]
    new_password: PasswordStr
    confirm_password: str | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_phone(v)

    @model_validator(mode="after")
    def _passwords(self) -> "ResetPasswordRequest":
        if self.confirm_password is not None and self.new_password != self.confirm_password:
            raise ValueError("password_mismatch")
        try:
            self.new_password = validate_password(self.new_password, phone=self.phone)
        except PasswordPolicyError as exc:
            raise ValueError(exc.code) from exc
        return self


class ChangePasswordRequest(CamelModel):
    current_password: PasswordStr
    new_password: PasswordStr
    confirm_password: str | None = None

    @model_validator(mode="after")
    def _passwords(self) -> "ChangePasswordRequest":
        if self.confirm_password is not None and self.new_password != self.confirm_password:
            raise ValueError("password_mismatch")
        try:
            self.new_password = validate_password(self.new_password)
        except PasswordPolicyError as exc:
            raise ValueError(exc.code) from exc
        return self


class PasswordStrengthRequest(CamelModel):
    password: str = Field(max_length=256)


class PasswordStrengthResponse(CamelModel):
    score: int
    acceptable: bool
    code: str | None = None
    message: str | None = None


# ---------------------------------------------------------------------------
# Google
# ---------------------------------------------------------------------------
class GoogleAuthRequest(CamelModel):
    id_token: str = Field(min_length=16, max_length=4096)
    role: Literal[UserRole.STUDENT, UserRole.OWNER] = UserRole.STUDENT
    language: Language = Language.UZ


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
class SubmitVerificationRequest(CamelModel):
    target_level: Annotated[int, Field(ge=2, le=5)] = 2
    document_type: VerificationDocumentType = VerificationDocumentType.PASSPORT
    document_url: str | None = Field(default=None, max_length=500_000)
    selfie_url: str | None = Field(default=None, max_length=500_000)

    @field_validator("document_url", "selfie_url")
    @classmethod
    def _image(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if v.startswith("https://") or (
            v.startswith("data:image/") and ";base64," in v[:64]
        ):
            return v
        raise ValueError("validation_error")


class UpdateProfileRequest(CamelModel):
    name: NameStr | None = None
    avatar: str | None = Field(default=None, max_length=500_000)
    role: Literal[UserRole.STUDENT, UserRole.OWNER] | None = None
    language: Language | None = None
    theme: ThemePreference | None = None

    @field_validator("avatar")
    @classmethod
    def _avatar(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        # Only https URLs or inline images - never javascript:/data:text/html.
        if v.startswith("https://"):
            return v
        if v.startswith("data:image/") and ";base64," in v[:64]:
            return v
        raise ValueError("validation_error")


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------
class UserOut(ORMCamelModel):
    id: uuid.UUID
    name: str
    phone: str
    email: str | None = None
    avatar: str | None = None
    role: str
    status: str
    trust_score: int
    verification_level: int
    is_verified: bool
    xp_points: int
    language: str
    theme: str
    referral_code: str | None = None
    must_change_password: bool = False
    phone_verified_at: datetime | None = None
    last_login_at: datetime | None = None
    created_at: datetime


class AdminOut(ORMCamelModel):
    id: uuid.UUID
    username: str
    full_name: str
    email: str | None = None
    role: str
    language: str
    theme: str
    must_change_password: bool
    last_login_at: datetime | None = None


class TokenResponse(CamelModel):
    status: str = "success"
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserOut | None = None
    admin: AdminOut | None = None
    #: Duplicated as ``token`` for the older client code path.
    token: str | None = None

    @model_validator(mode="after")
    def _mirror(self) -> "TokenResponse":
        self.token = self.access_token
        return self


class MeResponse(CamelModel):
    status: str = "success"
    user: UserOut


class SessionOut(ORMCamelModel):
    id: uuid.UUID
    created_at: datetime
    expires_at: datetime
    ip: IPStr = None
    user_agent: str | None = None
    current: bool = False


class LanguageOut(CamelModel):
    code: str
    label_native: str
    label_en: str


SUPPORTED_LANGUAGE_LIST = [
    LanguageOut(code="uz", label_native="O'zbekcha", label_en="Uzbek"),
    LanguageOut(code="ru", label_native="Русский", label_en="Russian"),
    LanguageOut(code="en", label_native="English", label_en="English"),
]

__all__ = [name for name in dir() if name.endswith(("Request", "Response", "Out"))] + [
    "DEFAULT_LANGUAGE",
    "SUPPORTED_LANGUAGE_LIST",
]
