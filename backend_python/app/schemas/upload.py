"""Request and response shapes for signed uploads."""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated

from pydantic import Field, field_validator

from app.core.config import settings
from app.core.r2 import ALLOWED_IMAGE_TYPES
from app.schemas.common import CamelModel


class UploadPurpose(StrEnum):
    """What the file is for, which decides where it lands.

    Not a free-form path. The client says what it is uploading and the server
    chooses the bucket and prefix — letting the client name its own object key
    is how a public bucket ends up with somebody else's key overwritten, or a
    passport scan written into the world-readable one.
    """

    LISTING = "LISTING"
    AVATAR = "AVATAR"
    VERIFICATION = "VERIFICATION"


class UploadRequestItem(CamelModel):
    content_type: str
    #: The browser knows this before it uploads, and it is signed into the URL,
    #: so a file of any other size is refused by R2 itself. Declared rather
    #: than measured because there is nothing to measure yet.
    size: Annotated[int, Field(gt=0)]

    @field_validator("content_type")
    @classmethod
    def _type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ALLOWED_IMAGE_TYPES:
            raise ValueError("unsupported_image_type")
        return v

    @field_validator("size")
    @classmethod
    def _size(cls, v: int) -> int:
        if v > settings.MAX_IMAGE_BYTES:
            raise ValueError("image_too_large")
        return v


class UploadRequest(CamelModel):
    purpose: UploadPurpose
    #: One round trip for a whole listing's photos. The cap matches the
    #: per-listing image limit so a single call cannot mint more signed URLs
    #: than a listing could ever use.
    files: list[UploadRequestItem] = Field(min_length=1)

    @field_validator("files")
    @classmethod
    def _files(cls, v: list[UploadRequestItem]) -> list[UploadRequestItem]:
        if len(v) > settings.MAX_IMAGES_PER_LISTING:
            raise ValueError("too_many_images")
        return v


class SignedUpload(CamelModel):
    #: PUT the bytes here, with exactly the Content-Type that was requested.
    upload_url: str
    #: Where the object will be readable once the PUT succeeds. Empty for a
    #: private upload — those are never readable by URL alone.
    public_url: str
    key: str


class UploadResponse(CamelModel):
    uploads: list[SignedUpload]
    expires_in: int
