"""The signing chain in app/core/r2.py, checked against AWS's own example.

These are the only tests in this suite that need no database and no app: the
module is pure arithmetic over strings. That is deliberate — a signature is
either byte-identical to what the far end computes or the upload fails, so it
is worth pinning to a published vector rather than to our own output.
"""

from __future__ import annotations

import datetime as dt

import pytest

from app.core.r2 import ALLOWED_IMAGE_TYPES, KEY_RE, new_key, signed_put


def test_matches_aws_published_presigned_example() -> None:
    """AWS's "Signature Calculation for Presigned URL" worked example.

    Virtual-hosted, us-east-1, host the only signed header. If this passes,
    every step of the chain is right: canonical request, the sorted and
    percent-encoded query, the scope string and the four-stage signing key.
    Getting any one of them wrong changes the final hex.
    """
    url = signed_put(
        account_id="unused",
        access_key="AKIAIOSFODNN7EXAMPLE",
        secret_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        bucket="",
        key="test.txt",
        content_type="",
        content_length=-1,
        expires_in=86400,
        now=dt.datetime(2013, 5, 24, tzinfo=dt.timezone.utc),
        method="GET",
        host="examplebucket.s3.amazonaws.com",
        region="us-east-1",
    )
    assert url.endswith(
        "X-Amz-Signature="
        "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
    )


def _r2_url(**overrides: object) -> str:
    kwargs: dict = {
        "account_id": "acct",
        "access_key": "AKID",
        "secret_key": "SECRET",
        "bucket": "uyiz-public",
        "key": "listings/x/y.jpg",
        "content_type": "image/jpeg",
        "content_length": 1000,
        "expires_in": 600,
        "now": dt.datetime(2026, 9, 3, tzinfo=dt.timezone.utc),
    }
    kwargs.update(overrides)
    return signed_put(**kwargs)  # type: ignore[arg-type]


def test_type_and_length_are_both_signed() -> None:
    """The two limits that make a signed URL not a blank cheque.

    Both appear in SignedHeaders, so R2 recomputes the signature over the
    values the browser actually sent and rejects the PUT if either differs.
    """
    url = _r2_url()
    assert "content-length%3Bcontent-type%3Bhost" in url


@pytest.mark.parametrize(
    "field, value",
    [
        ("content_length", 1001),
        ("content_type", "image/png"),
        ("key", "listings/x/other.jpg"),
        ("bucket", "uyiz-private"),
    ],
)
def test_signature_changes_with_every_signed_input(field: str, value: object) -> None:
    """A URL signed for one upload cannot be reused for a different one.

    Size, type, object and bucket each move the signature. Without this, a URL
    minted for a 1KB JPEG would accept a 400MB file, or one destined for the
    public bucket could be pointed at the private one.
    """
    assert _r2_url() != _r2_url(**{field: value})


def test_url_is_path_style_on_the_account_host() -> None:
    """R2 addresses buckets by path, not as a subdomain."""
    assert _r2_url().startswith(
        "https://acct.r2.cloudflarestorage.com/uyiz-public/listings/x/y.jpg?"
    )


def test_credential_slashes_are_escaped() -> None:
    """The scope inside X-Amz-Credential contains slashes.

    Left unescaped the signature still computes here and is rejected at the
    far end, which is the worst kind of bug to find: it only shows up against
    the real service.
    """
    assert "%2F" in _r2_url()
    assert "X-Amz-Credential=AKID%2F20260903%2Fauto%2Fs3%2Faws4_request" in _r2_url()


@pytest.mark.parametrize("content_type", sorted(ALLOWED_IMAGE_TYPES))
def test_new_key_shape(content_type: str) -> None:
    """Keys are unguessable and match the pattern the server will accept back."""
    key = new_key("listings", "6f1b8b1e-0000-4000-8000-000000000000", content_type)
    assert KEY_RE.match(key), key
    assert key.endswith("." + ALLOWED_IMAGE_TYPES[content_type])


def test_new_keys_do_not_repeat() -> None:
    """Two uploads by one account in one request must not collide.

    They would silently overwrite each other in the bucket, and the listing
    would show the same photo twice with no error anywhere.
    """
    owner = "6f1b8b1e-0000-4000-8000-000000000000"
    keys = {new_key("listings", owner, "image/jpeg") for _ in range(200)}
    assert len(keys) == 200
