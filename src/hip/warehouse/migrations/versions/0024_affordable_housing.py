"""Affordable housing records, keeping each programme and release distinct."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "affordable_housing_records",
        sa.Column(
            "region_id", sa.Integer(), sa.ForeignKey("regions.region_id"), nullable=False
        ),
        sa.Column("source_id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("record_id", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("snapshot", sa.Date(), nullable=False),
        sa.Column(
            "release_id",
            sa.Integer(),
            sa.ForeignKey("source_releases.release_id"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("source_id", "kind", "record_id"),
    )
    op.create_index("ix_ah_region", "affordable_housing_records", ["region_id"])


def downgrade() -> None:
    op.drop_table("affordable_housing_records")
