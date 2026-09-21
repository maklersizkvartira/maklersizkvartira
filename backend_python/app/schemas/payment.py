"""Payment and user balance / wallet schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel, ORMCamelModel


class CreateTopUpRequest(CamelModel):
    #: Bounded again by settings in the router, where the real limits live;
    #: these only stop nonsense before it reaches a database.
    amount: float = Field(gt=0, le=100_000_000, description="Amount in UZS")
    #: Where the gateway sends the customer afterwards. Only URLs on our own
    #: site are honoured; anything else falls back to the profile page.
    return_url: str | None = Field(default=None, max_length=512)
    gateway: Literal["click", "payme"] = "click"
    # There is deliberately no card field. The card is entered on the
    # gateway's page and never on ours; a client-supplied "card_pan" used to
    # be written to the database verbatim.


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


class TopUpStatusResponse(CamelModel):
    """Where one checkout got to, asked by the person who opened it.

    The site needs this the moment a customer comes back from the gateway's
    page — by pressing Back, by closing the tab, or by paying. Nothing else
    on the account tells the two apart quickly enough: the wallet balance
    only moves once the webhook lands, and a person staring at a sheet that
    still says "redirecting" has no way to know which happened.
    """

    status: str
    amount: float
    balance: float
    paid: bool
