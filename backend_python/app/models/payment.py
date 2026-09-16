"""Payment models for Click gateway and user balance/wallet tracking."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.listing import Listing
    from app.models.user import User


class PaymentTransaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """External payment records (e.g. from Click)."""

    __tablename__ = "payment_transactions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), default="CLICK", nullable=False)
    
    # Internal status: PENDING, SUCCESS, FAILED, CANCELLED
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False, index=True)
    
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="UZS", nullable=False)
    
    # What this payment is for: TOPUP, VERIFIED_BADGE, TOP_LISTING, VIP_LISTING
    service_type: Mapped[str] = mapped_column(String(64), default="TOPUP", nullable=False)
    listing_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("listings.id", ondelete="SET NULL"), nullable=True
    )

    # Click specific parameters
    click_trans_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    click_paydoc_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    merchant_prepare_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    
    # Payme specific parameters
    payme_trans_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    payme_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    payme_perform_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    payme_cancel_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    payme_state: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payme_reason: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    error_code: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Masked card number (e.g. 8600 **** 1234)
    card_pan: Mapped[str | None] = mapped_column(String(32), nullable=True)

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(lazy="joined")
    listing: Mapped["Listing | None"] = relationship(lazy="joined")

    __table_args__ = (
        Index("ix_payment_transactions_user_status", "user_id", "status"),
        Index("ix_payment_transactions_provider_click", "provider", "click_trans_id"),
        Index("ix_payment_transactions_provider_payme", "provider", "payme_trans_id"),
    )


class ClickPaymentLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Raw audit log of all Click Prepare and Complete requests/responses."""

    __tablename__ = "click_payment_logs"

    action: Mapped[str] = mapped_column(String(32), nullable=False)  # 'PREPARE' or 'COMPLETE'
    click_trans_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    service_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    merchant_trans_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_code: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    raw_request: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    raw_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    client_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)


class PaymePaymentLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Raw audit log of all Payme JSON-RPC 2.0 requests/responses."""

    __tablename__ = "payme_payment_logs"

    method: Mapped[str] = mapped_column(String(64), nullable=False)
    payme_trans_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    account_param: Mapped[str | None] = mapped_column(String(128), nullable=True)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    raw_request: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    raw_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    client_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)


class WalletTransaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User balance history: credits (topups) and debits (purchases)."""

    __tablename__ = "wallet_transactions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # TOPUP, PURCHASE_VERIFIED, PURCHASE_TOP, PURCHASE_VIP, REFUND
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    
    # Positive for additions (+), negative for spending (-)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    balance_after: Mapped[float] = mapped_column(Float, nullable=False)
    
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    user: Mapped["User"] = relationship(lazy="joined")

    __table_args__ = (
        Index("ix_wallet_transactions_user_created", "user_id", "created_at"),
    )
