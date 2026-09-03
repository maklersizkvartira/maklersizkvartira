"""Hand the browser a URL it may upload one image to.

This endpoint moves no bytes. It answers with signed URLs and the browser
talks to R2 directly, which is the difference between a hundred people
uploading photos at once and a hundred people queueing behind one container's
memory. See app/core/r2.py for what the signature pins down.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core import r2
from app.core.config import settings
from app.core.deps import CurrentUser
from app.core.errors import ServiceUnavailable
from app.core.rate_limit import enforce
from app.schemas.upload import (
    SignedUpload,
    UploadPurpose,
    UploadRequest,
    UploadResponse,
)

router = APIRouter(prefix="/uploads", tags=["uploads"])

#: Which bucket and key prefix each purpose writes to.
#:
#: VERIFICATION goes to the private bucket and gets no public URL back. A
#: passport scan readable by anyone holding a link is the same as a public one:
#: links leak into chat logs, screenshots and analytics referrers.
_DESTINATIONS: dict[UploadPurpose, tuple[str, str, bool]] = {
    UploadPurpose.LISTING: (settings.R2_PUBLIC_BUCKET, "listings", True),
    UploadPurpose.AVATAR: (settings.R2_PUBLIC_BUCKET, "avatars", True),
    UploadPurpose.VERIFICATION: (settings.R2_PRIVATE_BUCKET, "documents", False),
}


@router.post("/sign", response_model=UploadResponse, summary="Sign image uploads")
async def sign_uploads(
    payload: UploadRequest, user: CurrentUser
) -> UploadResponse:
    """Mint one signed PUT URL per file.

    Signing is free and instant — it is HMAC over a string — so the rate limit
    here is not about cost. It is about a signed URL being a capability: each
    one is permission to write an object into our bucket, and an unbounded
    loop against this route is an unbounded number of objects we pay to store.
    """
    if not settings.r2_configured:
        # Deliberately not a 500. The API is healthy; one capability is not
        # configured, and the client should say "uploads are unavailable"
        # rather than "something broke".
        raise ServiceUnavailable("storage_unavailable")

    await enforce("upload_sign", str(user.id), cost=len(payload.files))

    bucket, prefix, public = _DESTINATIONS[payload.purpose]
    uploads: list[SignedUpload] = []
    for item in payload.files:
        key = r2.new_key(prefix, str(user.id), item.content_type)
        uploads.append(
            SignedUpload(
                upload_url=r2.signed_put(
                    account_id=settings.R2_ACCOUNT_ID,
                    access_key=settings.R2_ACCESS_KEY_ID,
                    secret_key=settings.R2_SECRET_ACCESS_KEY,
                    bucket=bucket,
                    key=key,
                    content_type=item.content_type,
                    content_length=item.size,
                    expires_in=settings.R2_UPLOAD_EXPIRY_SECONDS,
                ),
                public_url=(
                    f"{settings.R2_PUBLIC_BASE_URL.rstrip('/')}/{key}" if public else ""
                ),
                key=key,
            )
        )

    return UploadResponse(
        uploads=uploads, expires_in=settings.R2_UPLOAD_EXPIRY_SECONDS
    )
