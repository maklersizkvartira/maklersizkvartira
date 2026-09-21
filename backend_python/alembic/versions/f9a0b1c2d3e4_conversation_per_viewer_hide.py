"""Per-viewer chat hiding.

A conversation belongs to two people, and "delete" used to be a real DELETE:
the row went, `chat_messages` cascaded, and the other party's copy of the
negotiation went with it. These two columns record which side hid the thread;
the row is removed only once both have.

Additive and nullable, so existing rows keep their current meaning: nobody has
hidden anything yet.

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-09-21
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "f9a0b1c2d3e4"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {
        row[0]
        for row in bind.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'conversations'"
            )
        )
    }
    if "deleted_by_user_at" not in existing:
        op.add_column(
            "conversations",
            sa.Column("deleted_by_user_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "deleted_by_owner_at" not in existing:
        op.add_column(
            "conversations",
            sa.Column("deleted_by_owner_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("conversations", "deleted_by_owner_at")
    op.drop_column("conversations", "deleted_by_user_at")
