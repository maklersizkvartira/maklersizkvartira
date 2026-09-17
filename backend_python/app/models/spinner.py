"""Models for Omad Spinner, Coin Rewards, and Cash Withdrawals."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class SpinHistory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Logs every fortune wheel spin made by a user."""

    __tablename__ = "spin_history"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: "FREE" or "PAID"
    spin_type: Mapped[str] = mapped_column(String(20), default="FREE", nullable=False)
    #: Sector index (0 to 7) on the wheel
    sector_index: Mapped[int] = mapped_column(Integer, nullable=False)
    #: "COINS", "VIP_DAYS", "TOP_DAYS"
    prize_type: Mapped[str] = mapped_column(String(30), default="COINS", nullable=False)
    coins_won: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    meta_info: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class CoinWithdrawalRequest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User requests real UZS payout to their Uzcard / Humo card using coins."""

    __tablename__ = "coin_withdrawal_requests"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: 16-digit card number (8600... or 9860...)
    card_number: Mapped[str] = mapped_column(String(32), nullable=False)
    card_holder: Mapped[str | None] = mapped_column(String(120), nullable=True)
    amount_uzs: Mapped[float] = mapped_column(Float, nullable=False)
    coins_spent: Mapped[int] = mapped_column(Integer, nullable=False)
    #: "PENDING", "APPROVED", "REJECTED"
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False, index=True)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class CoinExchangeTransaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Exchanges coins for on-site Uyiz balance or VIP/TOP listing promotions."""

    __tablename__ = "coin_exchange_transactions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: "BALANCE", "VIP_LISTING", "TOP_LISTING"
    exchange_type: Mapped[str] = mapped_column(String(30), nullable=False)
    coins_spent: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_uzs: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    listing_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
