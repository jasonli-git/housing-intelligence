"""HMDA's weighted medians computed exactly (Milestone 51, #338).

Summed as doubles row by row, a weighted median sitting exactly at half the weight
resolved by the order rows arrived in, so it could flip between two values on a reload
over unchanged files. Summed in exact decimals over every tied value at once, 66
medians settled on one value on 2026-10-07: `/changes` says this site recomputed them,
not that the FFIEC revised its data (#284's mechanism, migration 0017).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0034"
down_revision: str | None = "0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

METRICS = (
    "hmda_median_rate",
    "hmda_median_loan_amount",
    "hmda_median_ltv",
    "hmda_median_loan_costs",
    "hmda_median_income",
)

NOTE = (
    "This site made how it computes this median exact: where the loans divided evenly "
    "at the middle, the figure could fall on either of two values depending on the "
    "order the records were read in, and now always falls on the same one. The "
    "lenders' records did not change."
)


def upgrade() -> None:
    for metric_id in METRICS:
        op.execute(
            f"INSERT INTO method_changes (changed_on, metric_id, note) VALUES "
            f"(DATE '2026-10-07', '{metric_id}', '{NOTE.replace(chr(39), chr(39) * 2)}')"
        )


def downgrade() -> None:
    op.execute(
        "DELETE FROM method_changes WHERE changed_on = DATE '2026-10-07' "
        "AND metric_id LIKE 'hmda_median_%'"
    )
