"""An unresolved source geography names its state (Milestone 63).

Zillow's "Somerset" in "Somerset County" is a place in New Jersey and another in
Pennsylvania, and each can go unmatched for its own reason. Name and county alone made
the two one row, and the second broke `uq_match_reject`.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0039"
down_revision: str | None = "0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "source_match_reject", sa.Column("state_code", sa.Text(), nullable=True)
    )
    op.drop_constraint("uq_match_reject", "source_match_reject", type_="unique")
    op.create_unique_constraint(
        "uq_match_reject",
        "source_match_reject",
        ["source_id", "layer", "region_name", "county_name", "state_code"],
    )


def downgrade() -> None:
    op.execute("DELETE FROM source_match_reject")
    op.drop_constraint("uq_match_reject", "source_match_reject", type_="unique")
    op.create_unique_constraint(
        "uq_match_reject",
        "source_match_reject",
        ["source_id", "layer", "region_name", "county_name"],
    )
    op.drop_column("source_match_reject", "state_code")
