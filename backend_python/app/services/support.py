"""The support desk's shared pieces: the welcome, and who wrote what.

Used by the customer's router and the admin's, which serialise the same
thread and must name the same operators on it.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AdminUser
from app.schemas.chat import SupportMessageOut

SUPPORT_WELCOME = {
    "uz": "Assalomu alaykum! Uyiz qo‘llab-quvvatlash xizmatiga xush kelibsiz. Qanday yordam bera olamiz?",
    "ru": "Здравствуйте! Вы обратились в службу поддержки Uyiz. Чем можем помочь?",
    "en": "Hello! You have reached Uyiz support. How can we help?",
}


async def name_operators(db: AsyncSession, messages: list[SupportMessageOut]) -> None:
    """Put the operator's name on every ADMIN message that a person wrote.

    One query for the whole thread: the ids on ADMIN messages are admin
    ids, except on the seeded welcome, where the column holds the customer's
    id and the lookup simply finds nobody.
    """
    admin_ids = {m.sender_id for m in messages if m.sender_type == "ADMIN"}
    if not admin_ids:
        return
    rows = (
        await db.execute(
            select(AdminUser.id, AdminUser.full_name, AdminUser.username).where(AdminUser.id.in_(admin_ids))
        )
    ).all()
    names = {row.id: (row.full_name or row.username or "").strip() or None for row in rows}
    for m in messages:
        if m.sender_type == "ADMIN":
            m.sender_name = names.get(m.sender_id)

