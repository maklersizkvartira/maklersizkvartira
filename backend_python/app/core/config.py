"""Application settings.

Every secret comes from the environment. Nothing security-relevant has a
usable default: in production the app refuses to start rather than run with
a guessable key.
"""

from __future__ import annotations

import base64
import secrets
from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "staging", "production", "test"]


def _pad_b64(value: str) -> str:
    return value + "=" * (-len(value) % 4)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # -- Runtime -------------------------------------------------------------
    ENVIRONMENT: Environment = "development"
    APP_NAME: str = "Maklersiz.uz API"
    API_PREFIX: str = "/api/v1"
    PORT: int = 5000
    LOG_LEVEL: str = "INFO"
    # Number of reverse proxies in front of the app. Controls how far back in
    # X-Forwarded-For the real client IP is read from. Railway/Vercel = 1.
    TRUSTED_PROXY_COUNT: int = 1

    # -- Database ------------------------------------------------------------
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/maklersiz"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE_SECONDS: int = 1800
    DB_ECHO: bool = False

    # -- JWT / sessions ------------------------------------------------------
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MINUTES: int = 15
    REFRESH_TOKEN_TTL_DAYS: int = 30
    ADMIN_ACCESS_TOKEN_TTL_MINUTES: int = 30
    ADMIN_REFRESH_TOKEN_TTL_DAYS: int = 1

    # -- Password reveal (admin) ---------------------------------------------
    # Passwords are ALWAYS verified against the Argon2id hash. This key only
    # decrypts a separate AES-256-GCM copy so the admin panel can reveal a
    # password on demand. Kept out of the database on purpose: a stolen DB
    # dump alone cannot reveal anything without this key.
    PASSWORD_REVEAL_KEY: str = ""
    PASSWORD_REVEAL_ENABLED: bool = True

    # -- CORS ----------------------------------------------------------------
    # Explicit allowlist. Never "*" together with credentials.
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"

    # -- Auth policy ---------------------------------------------------------
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_MAX_LENGTH: int = 128
    MAX_FAILED_LOGINS: int = 5
    LOCKOUT_MINUTES: int = 15

    # -- OTP policy ----------------------------------------------------------
    OTP_LENGTH: int = 6
    OTP_TTL_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    OTP_MAX_PER_PHONE_PER_DAY: int = 10
    # In non-production the generated code is returned in the API response so
    # the flow is testable without burning SMS credits. Never true in prod.
    OTP_DEBUG_RETURN_CODE: bool = False

    # -- Rate limits ---------------------------------------------------------
    RATE_LIMIT_GLOBAL_PER_MINUTE: int = 240
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10
    RATE_LIMIT_OTP_PER_HOUR: int = 12
    RATE_LIMIT_LISTING_CREATE_PER_HOUR: int = 5
    RATE_LIMIT_AI_PER_DAY: int = 10

    # -- Uploads / body size -------------------------------------------------
    MAX_REQUEST_BYTES: int = 6 * 1024 * 1024
    MAX_IMAGES_PER_LISTING: int = 12

    # -- External services ---------------------------------------------------
    DEVSMS_API_TOKEN: str = ""
    DEVSMS_API_URL: str = "https://devsms.uz/api"
    DEVSMS_SENDER: str = "4546"
    SMS_ENABLED: bool = True

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_GROUP_ID: str = ""

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    GEMINI_API_KEY: str = ""

    # Required to verify Firebase ID tokens on /auth/google. Empty disables
    # Google sign-in rather than accepting unverified identities.
    FIREBASE_PROJECT_ID: str = ""

    # UZS per 1 USD, served to the client so the rate is not hardcoded in
    # three separate frontend files.
    USD_TO_UZS_RATE: float = 12700.0

    # -- Bootstrap admin -----------------------------------------------------
    # Used once by scripts/create_admin.py; not read at request time.
    BOOTSTRAP_ADMIN_USERNAME: str = ""
    BOOTSTRAP_ADMIN_PASSWORD: str = ""

    # -- Derived -------------------------------------------------------------
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def reveal_key_bytes(self) -> bytes | None:
        if not self.PASSWORD_REVEAL_KEY:
            return None
        raw = base64.urlsafe_b64decode(_pad_b64(self.PASSWORD_REVEAL_KEY))
        return raw if len(raw) == 32 else None

    # -- Validation ----------------------------------------------------------
    @model_validator(mode="before")
    @classmethod
    def _database_url_from_parts(cls, data):
        """Assemble DATABASE_URL from PG* variables when it is unusable.

        Railway defines the Postgres service's own DATABASE_URL as a template
        over PGUSER/POSTGRES_PASSWORD/RAILWAY_PRIVATE_DOMAIN/PGDATABASE. If the
        reference in the API service is blank or mistyped it arrives empty, or
        still literally containing "${{...}}". The PG* parts are injected
        whenever the two services are linked, so they are the reliable source.
        """
        if not isinstance(data, dict):
            return data

        import os

        current = str(data.get("DATABASE_URL") or "").strip().strip('"').strip("'")
        usable = current and "${{" not in current and "://" in current
        if usable:
            return data

        def pick(*names: str) -> str:
            for name in names:
                value = (data.get(name) or os.environ.get(name) or "").strip()
                if value and "${{" not in value:
                    return value
            return ""

        host = pick("PGHOST", "RAILWAY_PRIVATE_DOMAIN", "POSTGRES_HOST")
        user = pick("PGUSER", "POSTGRES_USER")
        password = pick("PGPASSWORD", "POSTGRES_PASSWORD")
        database = pick("PGDATABASE", "POSTGRES_DB")
        port = pick("PGPORT", "POSTGRES_PORT") or "5432"

        if host and user and password:
            from urllib.parse import quote

            data = dict(data)
            data["DATABASE_URL"] = (
                f"postgresql://{quote(user, safe='')}:{quote(password, safe='')}"
                f"@{host}:{port}/{database or 'railway'}"
            )
        elif current:
            # Nothing to assemble from; drop the unusable value so the missing
            # -variable report names DATABASE_URL instead of a parse error.
            data = dict(data)
            data.pop("DATABASE_URL", None)
        return data

    @model_validator(mode="before")
    @classmethod
    def _blank_means_unset(cls, data):
        """Treat an empty variable as absent.

        A dashboard variable that exists with an empty value is the most
        common misconfiguration, and letting "" reach a Literal or an int
        field produces a validation traceback instead of a usable message.
        """
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if not (isinstance(v, str) and not v.strip())}
        return data

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalise_db_url(cls, v: str) -> str:
        """Accept the plain postgres URL Railway hands out and upgrade it to
        the async psycopg driver SQLAlchemy needs."""
        v = v.strip().strip('"').strip("'")
        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    @field_validator("PASSWORD_REVEAL_KEY")
    @classmethod
    def _check_reveal_key(cls, v: str) -> str:
        if not v:
            return v
        try:
            raw = base64.urlsafe_b64decode(_pad_b64(v))
        except Exception as exc:  # noqa: BLE001
            raise ValueError("PASSWORD_REVEAL_KEY must be base64-encoded") from exc
        if len(raw) != 32:
            raise ValueError(
                "PASSWORD_REVEAL_KEY must decode to exactly 32 bytes (AES-256)"
            )
        return v

    @field_validator("JWT_SECRET")
    @classmethod
    def _check_jwt_secret(cls, v: str) -> str:
        if v and len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return v

    def _looks_like_production(self) -> bool:
        """Heuristic for "this is a real deployment, not a laptop"."""
        url = self.DATABASE_URL
        local = ("localhost" in url) or ("127.0.0.1" in url) or ("host.docker.internal" in url)
        return not local and bool(url) and "postgres" in url

    @model_validator(mode="after")
    def _production_guards(self) -> "Settings":
        # A deployment that forgets ENVIRONMENT must not silently fall back to
        # development behaviour. If the platform looks like production (a real
        # DATABASE_URL is configured and no explicit override is set), treat it
        # as production and enforce the guards.
        if self.ENVIRONMENT == "development" and self._looks_like_production():
            self.ENVIRONMENT = "production"

        if self.ENVIRONMENT in ("development", "test"):
            # Ephemeral dev secrets: every restart invalidates old tokens,
            # which is exactly what we want locally.
            if not self.JWT_SECRET:
                self.JWT_SECRET = secrets.token_urlsafe(48)
            if not self.PASSWORD_REVEAL_KEY:
                self.PASSWORD_REVEAL_KEY = base64.urlsafe_b64encode(
                    secrets.token_bytes(32)
                ).decode()
            if not self.DEVSMS_API_TOKEN:
                self.OTP_DEBUG_RETURN_CODE = True
            return self

        missing: list[str] = []
        if not self.JWT_SECRET:
            missing.append("JWT_SECRET")
        if not self.DATABASE_URL or "localhost" in self.DATABASE_URL:
            missing.append("DATABASE_URL")
        if self.PASSWORD_REVEAL_ENABLED and not self.PASSWORD_REVEAL_KEY:
            missing.append("PASSWORD_REVEAL_KEY")
        if missing:
            raise ValueError(
                "Refusing to start in production without: " + ", ".join(missing)
            )
        if self.OTP_DEBUG_RETURN_CODE:
            raise ValueError("OTP_DEBUG_RETURN_CODE must be false in production")
        if "*" in self.cors_origin_list:
            raise ValueError("CORS_ORIGINS may not contain '*' in production")
        return self


class ConfigurationError(RuntimeError):
    """Raised when the environment cannot produce a usable configuration."""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def load_settings_or_report() -> tuple[Settings | None, list[str]]:
    """Return settings, or the list of human-readable problems.

    Used by the preflight check so a misconfigured deploy prints what to fix
    rather than a pydantic traceback.
    """
    from pydantic import ValidationError

    try:
        return Settings(), []
    except ValidationError as exc:
        problems: list[str] = []
        for error in exc.errors():
            field = ".".join(str(p) for p in error.get("loc", ())) or "(config)"
            message = str(error.get("msg", "")).replace("Value error, ", "")
            problems.append(f"{field}: {message}")
        return None, problems
    except Exception as exc:  # noqa: BLE001
        return None, [str(exc)]


def __getattr__(name: str) -> object:
    """Build the settings singleton on first access, not at import.

    Importing this module used to construct Settings immediately, so a bad
    environment raised inside the import machinery — before any code could
    catch it and explain which variable was wrong. Deferring it lets
    scripts.preflight import `load_settings_or_report` safely and report the
    problem in readable form.

    `from app.core.config import settings` still works and still yields the
    same cached instance, because get_settings() is lru_cached.
    """
    if name == "settings":
        return get_settings()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
