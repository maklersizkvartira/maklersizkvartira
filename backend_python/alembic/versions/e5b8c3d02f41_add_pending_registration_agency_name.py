"""add the agency name column d4f7a2b91c30 left off pending_registrations

d4f7a2b91c30 added ``agency_name`` to the ORM model for ``PendingRegistration``
but only wrote the column onto ``users`` and ``listings``. SQLAlchemy names
every mapped column in its SELECT, so from the moment that deploy went out,
*every* call to /auth/register raised UndefinedColumn and answered 500 — not
only agent signups. Nobody could create an account for about fifteen hours.

The column is nullable and nothing reads it before it is written, so adding it
is enough on its own: no backfill, and rows that were never created have
nothing to repair.

Revision ID: e5b8c3d02f41
Revises: d4f7a2b91c30
Create Date: 2026-09-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'e5b8c3d02f41'
down_revision = 'd4f7a2b91c30'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'pending_registrations',
        sa.Column('agency_name', sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('pending_registrations', 'agency_name')
