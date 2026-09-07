"""record whether a captured lead actually reached the team

`capture_lead` writes the four `lead_*` columns and then hands the lead to
Telegram. When that send fails there was nowhere to say so: the row looked
exactly like a delivered one, the visitor had already been told the team would
be in touch, and nobody was paged. That is the production failure this whole
workstream started from, turned into a silent false promise (L-FIX-1).

`lead_delivered` is nullable on purpose, and the three states are the point:

    NULL   no lead was captured on this session at all
    TRUE   Telegram accepted the send; the team has it
    FALSE  the lead exists here and nowhere else — a human has to act on it

A two-state boolean would have had to answer "not delivered" for every session
that never captured anything, which is exactly the noise that would make the
panel's warning pill unreadable. Nothing is backfilled: the sessions that
already carry a lead were sent before this column existed and there is no
record of how those sends went, so NULL — "we do not know" — is the honest
value for them, and the pill only fires on FALSE.

No default and no server_default. The column is written by the same statement
that writes `lead_captured_at`, so a row that has a lead always has a verdict
alongside it, and adding a nullable column to Postgres rewrites no rows.

Revision ID: f4a1c8e02d73
Revises: e7b3d5c81f42
Create Date: 2026-09-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'f4a1c8e02d73'
down_revision = 'e7b3d5c81f42'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('ai_sessions', sa.Column('lead_delivered', sa.Boolean(), nullable=True))


def downgrade() -> None:
    # Dropping this loses the only record that a lead was never delivered.
    # There is nowhere else to put it, so a downgrade past this revision
    # accepts that those leads go back to looking like every other one.
    op.drop_column('ai_sessions', 'lead_delivered')
