"""The community water systems serving each town and ZIP code (Milestone 40, #304).

A list rather than metrics, as `income_limits` is: a page names who supplies its water
and what EPA has recorded against each, and no page ranks or charts a system. One row
per region and system, citing the SDWIS release its violations were counted from.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "water_systems",
        sa.Column(
            "region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        # EPA's public water system id, which NJDEP's service areas also carry.
        sa.Column("pwsid", sa.String(9), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        # Estimated from 2020's homes by block: how many of the region's it serves.
        sa.Column("homes", sa.Float(), nullable=False),
        sa.Column("share_of_homes", sa.Float(), nullable=False),
        # Health-based violations whose period began in [first_year, last_year].
        sa.Column("violations", sa.Integer(), nullable=False),
        sa.Column("first_year", sa.SmallInteger(), nullable=False),
        sa.Column("last_year", sa.SmallInteger(), nullable=False),
        sa.Column("latest_violation", sa.Date(), nullable=True),
        sa.Column("latest_violation_what", sa.Text(), nullable=True),
        sa.Column("violation_kinds", sa.Text(), nullable=True),
        sa.Column(
            "release_id",
            sa.Integer(),
            sa.ForeignKey("source_releases.release_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("region_id", "pwsid"),
    )


def downgrade() -> None:
    op.drop_table("water_systems")
