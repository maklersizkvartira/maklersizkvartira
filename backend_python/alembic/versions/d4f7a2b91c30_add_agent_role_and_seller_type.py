"""add agent role and per-listing seller type

Two columns and no data change. The AGENT role itself needs no migration —
``users.role`` is a VARCHAR precisely so that adding a value is a deploy and
not a locking ALTER TYPE — but the account's agency and the listing's
"published by" flag are new storage.

``listings.seller_type`` is backfilled to OWNER for everything that already
exists, which is what those rows meant: until now the platform had no way to
say anything else.

Revision ID: d4f7a2b91c30
Revises: c8e4f0a1b2c3
Create Date: 2026-09-02
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'd4f7a2b91c30'
down_revision = 'c8e4f0a1b2c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('agency_name', sa.String(length=120), nullable=True),
    )

    # Added with a server default so the column can be NOT NULL without a
    # second pass over an already-populated table.
    op.add_column(
        'listings',
        sa.Column(
            'seller_type',
            sa.String(length=10),
            nullable=False,
            server_default='OWNER',
        ),
    )
    op.add_column(
        'listings',
        sa.Column('agency_name', sa.String(length=120), nullable=True),
    )
    op.create_index('ix_listings_seller_type', 'listings', ['seller_type'])

    # The default belongs in the model, not in the schema: leaving it here
    # would let an insert that forgets the column succeed silently.
    op.alter_column('listings', 'seller_type', server_default=None)


def downgrade() -> None:
    op.drop_index('ix_listings_seller_type', table_name='listings')
    op.drop_column('listings', 'agency_name')
    op.drop_column('listings', 'seller_type')
    op.drop_column('users', 'agency_name')
