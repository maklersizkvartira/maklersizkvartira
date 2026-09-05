"""widen users.phone so a first-time Google sign-in can create the account

`POST /auth/google` writes `google:{sub}` into `users.phone` as a placeholder
for an account that has not given a real number yet. A Google `sub` is a
21-digit string, so that value is 28 characters, and the column was
`VARCHAR(20)` — sized for the phone numbers it was named after and never
revisited when the second kind of value was added.

So every first-ever Google sign-in raised

    (psycopg.errors.StringDataRightTruncation)
    value too long for type character varying(20)

and answered 500. Not some Google sign-ins: every one that had to create an
account, which is every new visitor arriving that way. Signing in again
afterwards could not help, because the account was never created the first
time.

64 rather than 20: it holds `google:` plus a `sub` several times longer than
Google actually issues. `varchar(n)` in Postgres is a constraint, not an
allocation — a widening writes no rows and stores nothing extra.

Revision ID: d4e91c7a25b8
Revises: c3f7a1b62d94
Create Date: 2026-09-05
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'd4e91c7a25b8'
down_revision = 'c3f7a1b62d94'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'users',
        'phone',
        existing_type=sa.String(length=20),
        type_=sa.String(length=64),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Narrowing again would truncate any `google:` placeholder already stored,
    # and the unique index makes that a collision rather than a silent trim.
    op.alter_column(
        'users',
        'phone',
        existing_type=sa.String(length=64),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
