"""Presigned upload URLs for Cloudflare R2.

R2 speaks the S3 API, so an upload is authorised the way S3 authorises one:
the server signs a URL with its secret, hands the URL to the browser, and the
browser PUTs the bytes straight to storage. The image never travels through
this process. That is the whole point — a listing with ten photos is ~3MB of
upload, and routing that through one Railway container is how a site with a
hundred simultaneous users stops answering.

Signing is a local HMAC chain over a canonical description of the request.
There is no network call here and no state, so the entire module is testable
offline — ``tests/test_r2_signing.py`` runs AWS's own published example
through it and compares signatures byte for byte.

Written by hand rather than with boto3 on purpose: botocore is ~90MB
installed, this file is the only thing in the project that would use it, and
the Docker image is rebuilt on every deploy. The algorithm is fixed and
published; the dependency is not worth carrying for one function.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import re
import secrets
from urllib.parse import quote

#: R2 has no regions in the S3 sense — every bucket signs as "auto".
REGION = "auto"
SERVICE = "s3"
ALGORITHM = "AWS4-HMAC-SHA256"

#: The body is not hashed. Hashing it would mean the browser reading the whole
#: file into memory to compute a digest before it may start uploading, and the
#: value would have to be known here, before the file exists.
UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD"

#: What a browser may PUT into the public bucket, and nothing else.
#:
#: This list is a security control, not a convenience. The public bucket is
#: served from img.uyiz.uz — a subdomain of the site — so an object stored as
#: text/html and fetched by a visitor would be same-site scripting with our own
#: certificate on it. Content-Type is part of the signature (see `signed_put`),
#: so a browser cannot upload one type against a URL signed for another.
ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

#: Object keys this module will produce, and the only shape it will accept
#: back. Anchored, so nothing with a path traversal or a leading slash passes.
KEY_RE = re.compile(r"^[a-z]+/[0-9a-f-]{36}/[0-9a-f]{32}\.(jpg|png|webp)$")


def _sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def _hmac(key: bytes, message: str) -> bytes:
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(secret: str, datestamp: str, region: str, service: str) -> bytes:
    """The four-step derivation that scopes a signature to one day and service.

    Each step keys the next, so a signature is unusable outside the date,
    region and service it was derived for — which is what makes a leaked
    signature expire on its own rather than becoming a permanent credential.
    """
    key = _hmac(f"AWS4{secret}".encode("utf-8"), datestamp)
    key = _hmac(key, region)
    key = _hmac(key, service)
    return _hmac(key, "aws4_request")


def _quote_path(value: str) -> str:
    """Percent-encode a path, leaving separators intact.

    S3 canonicalisation encodes each segment but not the ``/`` between them.
    `safe` is spelled out rather than left at its default because urllib's
    default also leaves other characters alone in some versions.
    """
    return quote(value, safe="/~")


def _quote_param(value: str) -> str:
    """Percent-encode a query key or value, separators included.

    Unlike the path, a ``/`` inside a query value must become ``%2F`` — the
    credential parameter contains three of them, and getting this wrong
    produces a signature that is wrong only for requests that happen to
    include a slash, which is every single one of them.
    """
    return quote(value, safe="~")


def signed_put(
    *,
    account_id: str,
    access_key: str,
    secret_key: str,
    bucket: str,
    key: str,
    content_type: str,
    content_length: int,
    expires_in: int,
    now: dt.datetime | None = None,
    method: str = "PUT",
    extra_signed_headers: dict[str, str] | None = None,
    host: str | None = None,
    region: str = REGION,
) -> str:
    """A URL the browser may PUT exactly one object to, once, soon.

    ``content_type`` and ``content_length`` are both signed, which is what
    stops a signed URL from being a blank cheque:

    * the type is fixed, so a URL issued for a JPEG cannot receive an HTML
      document — see ALLOWED_IMAGE_TYPES for why that matters on img.uyiz.uz;
    * the length is fixed, so a URL issued for a 400KB photo cannot receive a
      400MB file. A browser sets Content-Length itself from the blob it sends
      and cannot be scripted to lie about it, so a body of any other size
      fails the signature check at R2 rather than filling the bucket.

    Neither check costs a round trip: both are decided by R2 before a byte of
    the body is stored.

    ``host`` and ``region`` exist so the signature chain can be checked against
    AWS's own published example, which is virtual-hosted and in us-east-1.
    Production never passes them: R2 is path-style on one host, in "auto".
    """
    now = now or dt.datetime.now(dt.timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    datestamp = now.strftime("%Y%m%d")

    host = host or f"{account_id}.r2.cloudflarestorage.com"
    canonical_uri = _quote_path(f"/{bucket}/{key}" if bucket else f"/{key}")

    headers = {"host": host}
    if content_type:
        headers["content-type"] = content_type
    if content_length >= 0:
        headers["content-length"] = str(content_length)
    headers.update(extra_signed_headers or {})

    signed_headers = ";".join(sorted(headers))
    canonical_headers = "".join(
        f"{name}:{headers[name].strip()}\n" for name in sorted(headers)
    )

    scope = f"{datestamp}/{region}/{SERVICE}/aws4_request"
    params = {
        "X-Amz-Algorithm": ALGORITHM,
        "X-Amz-Credential": f"{access_key}/{scope}",
        "X-Amz-Date": amz_date,
        "X-Amz-Expires": str(expires_in),
        "X-Amz-SignedHeaders": signed_headers,
    }
    canonical_query = "&".join(
        f"{_quote_param(name)}={_quote_param(params[name])}" for name in sorted(params)
    )

    canonical_request = "\n".join(
        [
            method,
            canonical_uri,
            canonical_query,
            canonical_headers,
            signed_headers,
            UNSIGNED_PAYLOAD,
        ]
    )
    string_to_sign = "\n".join(
        [ALGORITHM, amz_date, scope, _sha256_hex(canonical_request)]
    )
    signature = hmac.new(
        _signing_key(secret_key, datestamp, region, SERVICE),
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return f"https://{host}{canonical_uri}?{canonical_query}&X-Amz-Signature={signature}"


def new_key(prefix: str, owner_id: str, content_type: str) -> str:
    """Where one upload will live.

    The random half is not decoration. Objects in the public bucket are served
    to anyone who knows the URL, so a guessable key — a sequence number, a
    filename, a hash of the user id — would let somebody walk the bucket and
    read documents that were never linked. 128 bits of ``token_hex`` is not
    walkable.

    The owner id in the path is for humans and for cleanup: an orphaned upload
    can be traced to the account that made it without opening the object.
    """
    extension = ALLOWED_IMAGE_TYPES[content_type]
    return f"{prefix}/{owner_id}/{secrets.token_hex(16)}.{extension}"
