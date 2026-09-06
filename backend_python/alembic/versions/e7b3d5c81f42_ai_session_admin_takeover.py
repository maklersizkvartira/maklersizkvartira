"""let a moderator take an AI conversation over, and let the AI record a lead

Two things the assistant could not do before, and both of them needed a place
to write to on the session row rather than in the transcript.

A takeover is the answer to the visitor who is stuck, or angry, or asking for
a person. `taken_over_by` is the switch: while it is set the assistant
endpoint stores the visitor's turn and returns without calling the model, so
nobody is ever answered by a human and a machine in the same breath. It points
at `admin_users` with ON DELETE SET NULL because a moderator leaving the
company must not take a visitor's conversation with them — the thread reverts
to the AI instead of failing a foreign key. `taken_over_at` is deliberately
left behind on release, so a thread that a person once handled still says so.
`admin_read_at` is the read mark the unread count is measured from; NULL means
nothing has been read, which is why the count query coalesces it to epoch.

The four `lead_*` columns are what the new `capture_lead` tool writes when a
visitor asks to be contacted. They sit on the session because the admin list
filters and sorts on them, and finding a phone number by re-reading every
message is not a list query.

`ai_messages.role` grows from 12 to 20 characters. "admin" already fits; the
widening is headroom for the next value, and `env.py` runs with
`compare_type=True`, so the model and the column have to agree either way.
`varchar(n)` in Postgres is a constraint, not an allocation — widening it
writes no rows.

The foreign key is named explicitly. `op.create_foreign_key` does not get the
metadata naming convention applied to it the way `create_table` does, and an
unnamed constraint here would come back as drift on the very next
`alembic check`. The string is exactly what NAMING_CONVENTION["fk"] produces.

Revision ID: e7b3d5c81f42
Revises: d4e91c7a25b8
Create Date: 2026-09-06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'e7b3d5c81f42'
down_revision = 'd4e91c7a25b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('ai_sessions', sa.Column('taken_over_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('ai_sessions', sa.Column('taken_over_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('ai_sessions', sa.Column('admin_read_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('ai_sessions', sa.Column('lead_name', sa.String(length=120), nullable=True))
    op.add_column('ai_sessions', sa.Column('lead_phone', sa.String(length=32), nullable=True))
    op.add_column('ai_sessions', sa.Column('lead_note', sa.String(length=400), nullable=True))
    op.add_column('ai_sessions', sa.Column('lead_captured_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        op.f('fk_ai_sessions_taken_over_by_admin_users'),
        'ai_sessions', 'admin_users', ['taken_over_by'], ['id'], ondelete='SET NULL',
    )
    op.create_index(op.f('ix_ai_sessions_taken_over_by'), 'ai_sessions', ['taken_over_by'], unique=False)
    op.alter_column('ai_messages', 'role',
                    existing_type=sa.String(length=12), type_=sa.String(length=20),
                    existing_nullable=False)


def downgrade() -> None:
    # Narrowing `role` back to 12 would truncate any value longer than that,
    # so it goes first, while the only values in the column are still the
    # short ones this revision shipped with.
    op.alter_column('ai_messages', 'role',
                    existing_type=sa.String(length=20), type_=sa.String(length=12),
                    existing_nullable=False)
    op.drop_index(op.f('ix_ai_sessions_taken_over_by'), table_name='ai_sessions')
    op.drop_constraint(op.f('fk_ai_sessions_taken_over_by_admin_users'), 'ai_sessions', type_='foreignkey')
    op.drop_column('ai_sessions', 'lead_captured_at')
    op.drop_column('ai_sessions', 'lead_note')
    op.drop_column('ai_sessions', 'lead_phone')
    op.drop_column('ai_sessions', 'lead_name')
    op.drop_column('ai_sessions', 'admin_read_at')
    op.drop_column('ai_sessions', 'taken_over_at')
    op.drop_column('ai_sessions', 'taken_over_by')
