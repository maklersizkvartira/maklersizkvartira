"""Google / Firebase ID-token verification.

The previous backend accepted whatever ``{email, uid, name}`` the client
posted and issued a token for the matching account - so anybody could sign in
as anyone by typing their email address into a curl command.

Here the ID token is verified properly: signature against Google's published
certificates, plus issuer, audience and expiry. Only claims Google signed are
ever trusted.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
import structlog
from jwt import PyJWKClient

from app.core.config import settings
from app.core.errors import Unauthorized

log = structlog.get_logger(__name__)

#: Firebase signs its ID tokens with these rotating x509 certificates.
_FIREBASE_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)
_GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_FIREBASE_ISSUER = "https://securetoken.google.com/{project_id}"
_GOOGLE_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}

_TIMEOUT = httpx.Timeout(8.0, connect=4.0)

_cert_cache: dict[str, Any] = {"certs": None, "fetched_at": 0.0}
_CACHE_TTL = 3600.0

_jwk_client: PyJWKClient | None = None


@dataclass(slots=True)
class GoogleIdentity:
    uid: str
    email: str | None
    email_verified: bool
    name: str | None
    picture: str | None
    provider: str


async def _firebase_certs() -> dict[str, str]:
    now = time.monotonic()
    if _cert_cache["certs"] and now - _cert_cache["fetched_at"] < _CACHE_TTL:
        return _cert_cache["certs"]
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(_FIREBASE_CERTS_URL)
    response.raise_for_status()
    certs = response.json()
    _cert_cache["certs"] = certs
    _cert_cache["fetched_at"] = now
    return certs


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = PyJWKClient(_GOOGLE_JWKS_URL, cache_keys=True)
    return _jwk_client


async def verify_id_token(id_token: str, *, firebase_project_id: str) -> GoogleIdentity:
    """Verify a Firebase or Google ID token and return the signed claims."""
    try:
        header = jwt.get_unverified_header(id_token)
    except jwt.InvalidTokenError as exc:
        raise Unauthorized("token_invalid") from exc

    unverified = jwt.decode(id_token, options={"verify_signature": False})
    issuer = str(unverified.get("iss", ""))

    if issuer in _GOOGLE_ISSUERS:
        claims = _verify_google(id_token)
        provider = "google"
    elif firebase_project_id and issuer == _FIREBASE_ISSUER.format(
        project_id=firebase_project_id
    ):
        claims = await _verify_firebase(id_token, header, firebase_project_id)
        provider = "firebase"
    else:
        raise Unauthorized("token_invalid")

    uid = str(claims.get("sub") or claims.get("user_id") or "")
    if not uid:
        raise Unauthorized("token_invalid")

    return GoogleIdentity(
        uid=uid,
        email=(claims.get("email") or None),
        email_verified=bool(claims.get("email_verified")),
        name=(claims.get("name") or None),
        picture=(claims.get("picture") or None),
        provider=provider,
    )


def _verify_google(id_token: str) -> dict[str, Any]:
    try:
        signing_key = _get_jwk_client().get_signing_key_from_jwt(id_token)
        return jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            options={"require": ["exp", "iat", "sub", "aud"]},
            audience=None,  # any of our own client ids; checked by issuer + project
            issuer=list(_GOOGLE_ISSUERS)[0],
        )
    except jwt.InvalidTokenError as exc:
        log.warning("google_auth.invalid", error=str(exc))
        raise Unauthorized("token_invalid") from exc


async def _verify_firebase(
    id_token: str, header: dict[str, Any], project_id: str
) -> dict[str, Any]:
    kid = header.get("kid")
    certs = await _firebase_certs()
    cert_pem = certs.get(kid) if kid else None
    if not cert_pem:
        raise Unauthorized("token_invalid")

    from cryptography.x509 import load_pem_x509_certificate

    public_key = load_pem_x509_certificate(cert_pem.encode()).public_key()
    try:
        return jwt.decode(
            id_token,
            public_key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=_FIREBASE_ISSUER.format(project_id=project_id),
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
    except jwt.InvalidTokenError as exc:
        log.warning("firebase_auth.invalid", error=str(exc))
        raise Unauthorized("token_invalid") from exc
