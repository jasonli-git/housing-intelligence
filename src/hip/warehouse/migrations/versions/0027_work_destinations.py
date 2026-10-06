"""Where each place's residents work, as a short list (Milestone 45, #313).

A list rather than metrics, as `water_systems` is: a page names where its residents'
jobs are, and no page ranks or charts a destination. One row per region and rank, the
ten destinations holding the most jobs, citing the LODES release they were counted from.
A destination in New Jersey is a municipality, kept as its region; out of state it is a
name ("New York City", "Elsewhere in Pennsylvania").
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "work_destinations",
        sa.Column(
            "region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rank", sa.SmallInteger(), nullable=False),
        # The municipality, for a destination in New Jersey; null out of state.
        sa.Column(
            "destination_region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("destination_name", sa.Text(), nullable=False),
        sa.Column("jobs", sa.Integer(), nullable=False),
        sa.Column("share", sa.Float(), nullable=False),
        # Every job the region's residents hold, the share's denominator.
        sa.Column("total_jobs", sa.Integer(), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column(
            "release_id",
            sa.Integer(),
            sa.ForeignKey("source_releases.release_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("region_id", "rank"),
        sa.CheckConstraint("share >= 0 AND share <= 1", name="work_destination_share"),
    )


def downgrade() -> None:
    op.drop_table("work_destinations")
