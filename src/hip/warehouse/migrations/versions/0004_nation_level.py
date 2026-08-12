"""Add the `nation` region level and the synthetic US region.

FRED's mortgage rate is national and has no regional breakdown, but every fact needs a
region. Adding a level plus one region keeps national series in the same fact table,
with the same endpoints and provenance, instead of a parallel table every cross-level
query would have to union (ARCHITECTURE #30).

The US region has no boundary, which makes `regions.geom` nullable for the first time.

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Postgres refuses to use a new enum value in the transaction that added it, and
    # Alembic wraps each migration in one. The escape is to commit around the ALTER
    # TYPE itself: the first COMMIT closes Alembic's transaction, the second closes the
    # one the ALTER TYPE lands in, so the value is durable before anything inserts it.
    # A single COMMIT is not enough — SQLAlchemy opens a new transaction immediately.
    op.execute("COMMIT")
    op.execute("ALTER TYPE region_level ADD VALUE IF NOT EXISTS 'nation'")
    op.execute("COMMIT")

    op.alter_column("regions", "geom", nullable=True)

    # The constraint must admit a parentless nation *before* the row is inserted.
    op.drop_constraint("ck_regions_parent_by_level", "regions", type_="check")
    op.create_check_constraint(
        "ck_regions_parent_by_level",
        "regions",
        "(level IN ('zip', 'state', 'nation') AND parent_id IS NULL) "
        "OR (level NOT IN ('zip', 'state', 'nation') AND parent_id IS NOT NULL)",
    )

    op.execute(
        """
        INSERT INTO regions (geoid, level, name, state_code, parent_id, geom)
        VALUES ('US', 'nation', 'United States', 'US', NULL, NULL)
        ON CONFLICT (level, geoid) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM regions WHERE level = 'nation'")
    op.drop_constraint("ck_regions_parent_by_level", "regions", type_="check")
    op.create_check_constraint(
        "ck_regions_parent_by_level",
        "regions",
        "(level = 'zip' AND parent_id IS NULL) "
        "OR (level = 'state' AND parent_id IS NULL) "
        "OR (level NOT IN ('zip', 'state') AND parent_id IS NOT NULL)",
    )
    op.alter_column("regions", "geom", nullable=False)
    # The enum value is left in place: Postgres cannot drop one, and recreating the
    # type would require rewriting every column that uses it.
    sa.Enum(name="region_level")
