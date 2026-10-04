"""Carry reported return-to-compliance dates, not inferred current water safety."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("water_systems", sa.Column("resolved_violations", sa.Integer()))
    op.add_column("water_systems", sa.Column("latest_return_to_compliance", sa.Date()))
    op.create_check_constraint(
        "water_resolution_count",
        "water_systems",
        "resolved_violations IS NULL OR (resolved_violations >= 0 "
        "AND resolved_violations <= violations)",
    )


def downgrade() -> None:
    op.drop_constraint("water_resolution_count", "water_systems")
    op.drop_column("water_systems", "latest_return_to_compliance")
    op.drop_column("water_systems", "resolved_violations")
