"""Shared schema base classes and envelope types.

The wire format is camelCase because the existing React client already types
listings as ``viewsCount`` / ``aiCheckStatus`` / ``depositPrice``. Python code
stays snake_case; Pydantic's alias generator bridges the two, and requests are
accepted in either casing (``populate_by_name``).
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Generic, TypeVar

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from pydantic.alias_generators import to_camel

T = TypeVar("T")


def _stringify_ip(value: Any) -> Any:
    """psycopg returns INET columns as ipaddress objects, not strings."""
    return None if value is None else str(value)


#: An INET column rendered as a plain string on the wire.
IPStr = Annotated[str | None, BeforeValidator(_stringify_ip)]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        str_strip_whitespace=True,
        # Reject unknown keys so a client cannot smuggle extra fields into a
        # model that is later fed to the ORM (mass-assignment).
        extra="forbid",
    )


class ORMCamelModel(CamelModel):
    """Response model read from ORM objects; tolerant of extra attributes."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="ignore",
    )


class Envelope(ORMCamelModel, Generic[T]):
    status: str = "success"
    data: T | None = None


class MessageResponse(CamelModel):
    status: str = "success"
    code: str | None = None
    message: str | None = None


class ErrorResponse(CamelModel):
    status: str = "error"
    code: str
    message: str
    field: str | None = None
    params: dict[str, Any] | None = None


class PageMeta(CamelModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


class Page(ORMCamelModel, Generic[T]):
    status: str = "success"
    data: list[T] = Field(default_factory=list)
    meta: PageMeta


class PaginationParams(CamelModel):
    page: int = Field(default=1, ge=1, le=10_000)
    page_size: int = Field(default=24, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def build_page_meta(page: int, page_size: int, total: int) -> PageMeta:
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 0
    return PageMeta(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_next=page * page_size < total,
        has_previous=page > 1,
    )


class TimestampedOut(ORMCamelModel):
    created_at: datetime
    updated_at: datetime
