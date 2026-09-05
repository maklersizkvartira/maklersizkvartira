"""let a listing say whether the property is for rent or for sale

Everything here was built for renting: the price is a monthly one, there is a
deposit, there is a question about who pays the utilities. Selling shares none
of that — the money changes hands once — so a sale listing sitting in the same
list as rentals reads as an absurdly expensive flat, and the price filter,
which is a range of monthly rents, throws it away or drowns in it.

The column is what tells the two apart. Every row that exists is a rental, so
the backfill is not a guess: RENT is what they all were, and the server default
keeps it true for anything inserted outside the ORM.

The index leads with `deal_type` because that is now the first thing every
catalogue query asks, and following it with the status and creation date makes
it the whole of the default query — one deal type, approved, newest first —
rather than a filter applied after the rows are read.

Revision ID: c3f7a1b62d94
Revises: b8d2e4f1a350
Create Date: 2026-09-05
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'c3f7a1b62d94'
down_revision = 'b8d2e4f1a350'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'listings',
        sa.Column(
            'deal_type',
            sa.String(length=10),
            nullable=False,
            server_default='RENT',
        ),
    )
    op.create_index(
        'ix_listings_deal_status_created',
        'listings',
        ['deal_type', 'status', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_listings_deal_status_created', table_name='listings')
    op.drop_column('listings', 'deal_type')
