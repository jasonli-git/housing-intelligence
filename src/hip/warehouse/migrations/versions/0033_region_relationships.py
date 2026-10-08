"""Relationship facts (Milestone 51, #336).

One row per region and relationship: a closed set of kinds a reading may narrate,
computed by `hip analyze` from facts already held, so a model can state a connection
between figures only where one exists as a fact. `figures` holds each number with its
role, metric, unit and margin; `causal` says whether causal wording may describe it,
which only a ratio split into its two sides allows.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0033"
down_revision: str | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "region_relationships",
        sa.Column(
            "region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        # "ratio_split:price_to_income", "outpaced:acs_median_gross_rent".
        sa.Column("relation_id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("figures", postgresql.JSONB(), nullable=False),
        # "faster", "slower" or "indistinguishable", for an `outpaced` relationship.
        sa.Column("direction", sa.Text(), nullable=True),
        sa.Column("causal", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("region_id", "relation_id"),
        sa.CheckConstraint(
            "kind IN ('ratio_split', 'outpaced', 'supply_and_moves')",
            name="region_relationship_kind",
        ),
    )


def downgrade() -> None:
    op.drop_table("region_relationships")
