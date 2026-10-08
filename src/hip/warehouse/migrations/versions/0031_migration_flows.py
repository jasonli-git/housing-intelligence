"""Where each county's movers came from and went to (Milestone 50, #333).

A list rather than metrics, as `work_destinations` is: one row per county, direction and
rank, the ten counties sending the most tax returns in and the ten receiving the most
out in the IRS's newest year pair. A New Jersey county is kept as its region so the page
can link it; any other is a name ("New York County, NY").
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "migration_flows",
        sa.Column(
            "region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        # 'in': where arrivals lived the year before; 'out': where leavers went.
        sa.Column("direction", sa.Text(), nullable=False),
        sa.Column("rank", sa.SmallInteger(), nullable=False),
        # The county, where it is in New Jersey; null elsewhere.
        sa.Column(
            "other_region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("other_geoid", sa.Text(), nullable=False),
        sa.Column("other_name", sa.Text(), nullable=False),
        sa.Column("returns", sa.Integer(), nullable=False),
        sa.Column("people", sa.Integer(), nullable=False),
        sa.Column("agi_per_return", sa.Float(), nullable=True),
        sa.Column("share", sa.Float(), nullable=False),
        # Every return that moved in that direction, the share's denominator.
        sa.Column("total_returns", sa.Integer(), nullable=False),
        # The year the moves landed in: the pair 2022-2023 is 2023.
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column(
            "release_id",
            sa.Integer(),
            sa.ForeignKey("source_releases.release_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("region_id", "direction", "rank"),
        sa.CheckConstraint("direction IN ('in', 'out')", name="migration_flow_direction"),
        sa.CheckConstraint("share >= 0 AND share <= 1", name="migration_flow_share"),
    )


def downgrade() -> None:
    op.drop_table("migration_flows")
