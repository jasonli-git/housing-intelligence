"""Baseline: PostGIS extension only.

No tables. Milestone 1 adds `regions` and the rest of the schema on top of this, so the
migration mechanism is proven before the schema arrives.

Revision ID: 0001
Revises:
Create Date: 2026-08-10
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # regions.geom is GEOMETRY(MultiPolygon, 4269); the extension must exist first.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")


def downgrade() -> None:
    # Deliberately not dropped: other schemas in the same database may depend on it,
    # and dropping an extension is not the kind of thing a downgrade should do quietly.
    pass
