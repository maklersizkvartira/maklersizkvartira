"""Async SQLAlchemy engine, session factory and FastAPI dependency."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import NoReturn

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core import platform as _platform  # noqa: F401  (sets the Windows event-loop policy)
from app.core.config import settings

_platform.configure_event_loop()

engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=settings.DB_POOL_RECYCLE_SECONDS,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Request-scoped session.

    Commits on success, rolls back on any exception, always closes. Routes
    therefore never have to write try/except/rollback themselves.
    """
    session = SessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


@asynccontextmanager
async def session_scope() -> AsyncGenerator[AsyncSession, None]:
    """Standalone session for scripts and background tasks."""
    session = SessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def dispose_engine() -> None:
    await engine.dispose()


async def commit_then_raise(session: AsyncSession, error: BaseException) -> NoReturn:
    """Persist what has been written so far, then raise ``error``.

    Failure paths still have to record state: a failed login increments a
    lockout counter, a wrong OTP burns an attempt, a replayed refresh token
    revokes its family. Because ``get_db`` rolls back on any exception, those
    writes would otherwise be discarded by the very error they describe -
    which is how brute-force protection silently becomes a no-op.
    """
    try:
        await session.commit()
    except SQLAlchemyError:
        await session.rollback()
    raise error
