"""add the land area column the create form has been sending all along

The listing form gained a "Yer maydoni (sotix)" field for houses, land and
commercial property, and the detail page renders it — but nothing was ever
added on this side. `CamelModel` sets `extra="forbid"`, deliberately, so the
API answered every one of those submissions with

    422  {"code": "validation_error", "field": "landArea"}

which made publishing impossible for exactly the three property types the
field exists for, and possible for the rest.

Nullable and unconstrained here: a plot is measured in sotix, a flat has none,
and the range check belongs in the schema where the rest of them live.

Revision ID: a7c14e9d3b60
Revises: e5b8c3d02f41
Create Date: 2026-09-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'a7c14e9d3b60'
down_revision = 'e5b8c3d02f41'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('land_area', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('listings', 'land_area')
