"""Somewhere like here, but cheaper (Milestone 46, #317).

One row per comparable town at rank 0, holding its own figures and the basis the page
states, then a row per match, nearest first, holding the match's figures as compared.
Rebuilt whole by `hip analyze`; `distance` is kept to audit the order and never shown.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "similar_places",
        sa.Column(
            "region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        # 0 is the town itself; 1 to 5 its matches, nearest first.
        sa.Column("rank", sa.SmallInteger(), nullable=False),
        sa.Column(
            "place_region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("distance", sa.Float(), nullable=True),
        sa.Column("figures", postgresql.JSONB(), nullable=False),
        # The measures, limits and periods compared on; on the rank-0 row only.
        sa.Column("basis", postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("region_id", "rank"),
    )


def downgrade() -> None:
    op.drop_table("similar_places")
