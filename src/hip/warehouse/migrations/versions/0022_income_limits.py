"""HUD's income limits in full: every band and household size (Milestone 35, #285).

The metric `hud_income_limit_80` is one number per county-year, the four-person 80%
line. A reader's household is not always four people, and the income check sized to it
needs all 24 of HUD's lines a county-year: 30%, 50% and 80% of area median income for
households of one to eight. A table of their own rather than 24 metrics, because no page
ranks or charts them and the catalog would carry 24 rows a reader never asked for.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "income_limits",
        sa.Column(
            "region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        # HUD's fiscal year: limits take effect in the spring, April or so, of it.
        sa.Column("fiscal_year", sa.SmallInteger(), nullable=False),
        # Percent of area median income: 30 (extremely low), 50 (very low), 80 (low).
        sa.Column("band", sa.SmallInteger(), nullable=False),
        sa.Column("household_size", sa.SmallInteger(), nullable=False),
        sa.Column("income_limit", sa.Float(), nullable=False),
        # HUD's area median family income, for a family of four, as published with them.
        sa.Column("median_income", sa.Float(), nullable=True),
        sa.Column(
            "release_id",
            sa.Integer(),
            sa.ForeignKey("source_releases.release_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("region_id", "fiscal_year", "band", "household_size"),
        sa.CheckConstraint("band IN (30, 50, 80)", name="ck_income_limits_band"),
        sa.CheckConstraint(
            "household_size BETWEEN 1 AND 8", name="ck_income_limits_household_size"
        ),
    )


def downgrade() -> None:
    op.drop_table("income_limits")
