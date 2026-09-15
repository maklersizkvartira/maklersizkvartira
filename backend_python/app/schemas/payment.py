"""Payment and user balance / wallet schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel, ORMCamelModel


class CreateTopUpRequest(CamelModel):
    amount: float = Field(ge=1000, le=100_000_000, description="Amount in UZS")
    return_url: str | None = None
    gateway: str | None = "click"


class CreateTopUpResponse(CamelModel):
    status: str = "success"
    transaction_id: uuid.UUID
    amount: float
    click_url: str | None = None
    click_card_url: str | None = None
    payme_url: str | None = None


class WalletTransactionOut(ORMCamelModel):
    id: uuid.UUID
    type: str
    amount: float
    balance_after: float
    description: str
    reference_id: uuid.UUID | None = None
    created_at: datetime


class WalletInfoResponse(CamelModel):
    balance: float
    is_verified: bool
    transactions: list[WalletTransactionOut]


class BuyServiceRequest(CamelModel):
    service_type: Literal["VERIFIED_BADGE", "TOP_LISTING", "VIP_LISTING"]
    listing_id: uuid.UUID | None = None


class BuyServiceResponse(CamelModel):
    status: str = "success"
    message: str
    balance_after: float
