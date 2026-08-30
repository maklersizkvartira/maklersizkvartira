"""Password hashing, reversible password storage, and opaque-token hashing.

Two independent representations of a password are stored:

1. ``password_hash`` - Argon2id. This is the ONLY thing authentication ever
   consults. It is one-way; nothing can turn it back into a password.

2. ``password_secret`` - AES-256-GCM ciphertext of the same password, so the
   admin panel can reveal it on request (an explicit product requirement).
   The key lives in the ``PASSWORD_REVEAL_KEY`` environment variable, never
   in the database, so a stolen database dump on its own reveals nothing.
   Every reveal is authenticated, authorised and written to the audit log.

Removing the reveal feature later is a one-line config change
(``PASSWORD_REVEAL_ENABLED=false``) plus clearing the column; authentication
is unaffected because it never reads that column.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import unicodedata

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from argon2.low_level import Type
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

# OWASP-recommended Argon2id parameters (m=64 MiB, t=3, p=4).
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)

#: Associated data bound into every AES-GCM ciphertext. It is not secret; it
#: ties a ciphertext to the purpose it was produced for, so a blob lifted from
#: this column cannot be decrypted as anything else.
_AAD = b"uyiz.uz/password/v1"

#: The same binding under the previous brand. Every ``password_secret`` written
#: before the rename was sealed with it, and AES-GCM authenticates the AAD — so
#: decrypting one of those rows with the new value fails, ``decrypt_secret``
#: swallows the failure and the admin panel silently reveals nothing. Reads
#: therefore fall back to it; writes never use it, so a password re-encrypted
#: after the rename carries the new binding. Delete this once no row predating
#: the rename is left (every account has changed its password since).
_LEGACY_AAD = b"maklersiz.uz/password/v1"


# ---------------------------------------------------------------------------
# Argon2id
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, stored_hash: str | None) -> bool:
    """Constant-time-ish password check.

    When no hash is stored we still run a verification against a dummy hash so
    that "user does not exist" and "wrong password" take the same time and
    cannot be told apart by an attacker enumerating phone numbers.
    """
    if not stored_hash:
        _dummy_verify()
        return False
    try:
        return _hasher.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    try:
        return _hasher.check_needs_rehash(stored_hash)
    except InvalidHashError:
        return True


_DUMMY_HASH = _hasher.hash("uyiz-timing-equaliser")


def _dummy_verify() -> None:
    try:
        _hasher.verify(_DUMMY_HASH, "not-the-password")
    except Exception:  # noqa: BLE001 - intentionally ignored, timing only
        pass


# ---------------------------------------------------------------------------
# AES-256-GCM reversible copy (admin reveal)
# ---------------------------------------------------------------------------
def encrypt_secret(plaintext: str) -> str | None:
    """Encrypt a password for later admin reveal.

    Returns ``None`` when the reveal feature is disabled or unconfigured, in
    which case the caller simply stores nothing - authentication still works.
    """
    key = settings.reveal_key_bytes
    if not settings.PASSWORD_REVEAL_ENABLED or key is None:
        return None
    nonce = secrets.token_bytes(12)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), _AAD)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def decrypt_secret(token: str | None) -> str | None:
    key = settings.reveal_key_bytes
    if not token or key is None:
        return None
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii"))
    except Exception:  # noqa: BLE001 - not base64 at all
        return None
    nonce, ciphertext = raw[:12], raw[12:]
    # Newest binding first, then the pre-rename one. Trying both costs a single
    # extra AES-GCM open on a row that has not been re-encrypted yet, and is
    # what keeps "reveal password" working for accounts created before the
    # rename; see _LEGACY_AAD.
    for aad in (_AAD, _LEGACY_AAD):
        try:
            return AESGCM(key).decrypt(nonce, ciphertext, aad).decode("utf-8")
        except Exception:  # noqa: BLE001 - wrong key, wrong AAD or tampered
            continue
    return None


# ---------------------------------------------------------------------------
# Opaque tokens (refresh tokens, OTP codes, reset tokens)
# ---------------------------------------------------------------------------
def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """SHA-256 of an opaque high-entropy token.

    A fast hash is correct here (unlike for passwords): these tokens carry 256
    bits of entropy, so there is nothing to brute-force, and refresh/OTP
    lookups happen on every request.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def tokens_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)


def generate_numeric_code(length: int) -> str:
    """Cryptographically random numeric OTP, uniformly distributed."""
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


# ---------------------------------------------------------------------------
# Password policy
# ---------------------------------------------------------------------------
# Rejected outright: the passwords attackers try first.
_COMMON_PASSWORDS = {
    "12345678", "123456789", "1234567890", "password", "password1", "qwerty123",
    "11111111", "00000000", "iloveyou", "admin123", "welcome1", "abc12345",
    "parol123", "maklersiz", "toshkent1", "uzbekistan", "qwertyui", "asdfghjk",
    "1q2w3e4r", "zxcvbnm1", "letmein1", "monkey12", "dragon12", "sunshine",
    # Both brand names, because people pick the site's own name either way and
    # the old one stays guessable for as long as anyone remembers it. Compared
    # against password.lower(), so every entry has to stay lowercase.
    "uyiz1234", "uyiz2025", "uyiz2026", "uyizuyiz",
}


class PasswordPolicyError(ValueError):
    """Raised with a machine-readable ``code`` the API turns into a message."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def normalise_password(password: str) -> str:
    """NFKC-normalise so visually identical passwords hash identically."""
    return unicodedata.normalize("NFKC", password)


def validate_password(password: str, *, phone: str = "", name: str = "") -> str:
    """Validate and return the normalised password, or raise PasswordPolicyError."""
    password = normalise_password(password)

    if len(password) < settings.PASSWORD_MIN_LENGTH:
        raise PasswordPolicyError("password_too_short")
    if len(password) > settings.PASSWORD_MAX_LENGTH:
        raise PasswordPolicyError("password_too_long")
    if password != password.strip():
        raise PasswordPolicyError("password_whitespace")

    classes = sum(
        bool(re.search(pattern, password))
        for pattern in (r"[a-z]", r"[A-Z]", r"\d", r"[^\w\s]")
    )
    if classes < 2:
        raise PasswordPolicyError("password_too_simple")

    lowered = password.lower()
    if lowered in _COMMON_PASSWORDS:
        raise PasswordPolicyError("password_too_common")

    # A password must not simply be the user's own phone number or name.
    digits = re.sub(r"\D", "", phone)
    if digits and len(digits) >= 7 and digits[-7:] in re.sub(r"\D", "", password):
        raise PasswordPolicyError("password_contains_phone")
    if name:
        for part in name.split():
            if len(part) >= 4 and part.lower() in lowered:
                raise PasswordPolicyError("password_contains_name")

    if re.fullmatch(r"(.)\1*", password):
        raise PasswordPolicyError("password_repeated_character")

    return password


def password_strength(password: str) -> int:
    """0-100 score, mirrored by the strength meter in the frontend."""
    if not password:
        return 0
    score = min(len(password) * 4, 40)
    if re.search(r"[a-z]", password):
        score += 10
    if re.search(r"[A-Z]", password):
        score += 15
    if re.search(r"\d", password):
        score += 15
    if re.search(r"[^\w\s]", password):
        score += 20
    if len(set(password)) < len(password) / 2:
        score -= 15
    if password.lower() in _COMMON_PASSWORDS:
        score = min(score, 10)
    return max(0, min(100, score))
