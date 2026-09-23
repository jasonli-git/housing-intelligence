"""Remove MOD-IV figures dated by their parcel map instead of their tax year.

Until Milestone 26 every MOD-IV figure was dated by `PCL_PBDATE`, the day a county last
republished its parcel shapes, because the layer carries no tax-year field. So one town's
2024 tax bill read "Jun 2026" and another's "Oct 2023". Staging now dates them by the tax
year NJOGIS joined the composite to, read from its metadata at acquisition.

The loader upserts on `(region_id, metric_id, period_start)`, so the corrected rows arrive
*beside* the old ones rather than in place of them — and the old ones, dated 2025 and
2026, would stay the "latest" and hide the corrected 2024 figures on every page. This
removes them once. It targets their shape exactly: the old rows are a single day, start
equal to end, while a tax year spans January to December. So it cannot touch a corrected
row, and it leaves every future tax year to accumulate as history.

Nothing is lost that cannot be rebuilt: the values are in the raw tier and reload with
their corrected dates. `fact_revision` references figures by value, not by key, and has no
trigger on DELETE, so the revision history is unaffected.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM fact_metric_observation
        WHERE left(metric_id, 6) = 'modiv_'
          AND period_start = period_end
        """
    )


def downgrade() -> None:
    # The removed rows were the same values with wrong dates. Reloading under an older
    # checkout restores them; there is nothing a downgrade could put back that is true.
    pass
