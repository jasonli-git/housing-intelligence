"""A figure a release no longer gives is withdrawn, and the withdrawal is recorded
(Milestone 34, ARCHITECTURE #284).

`load_facts` upserted and never deleted, so a figure the staging models stopped
producing from a release stayed in the warehouse for good. Milestone 34 found it the
first time it mattered: 186 ACS medians that were the bound of an open-ended bracket
("$250,000 or more" stored as 250,001) are no longer staged, and every one was still
published. The loader now deletes them, and this trigger writes each deletion to
`fact_revision` as a revision to nothing — `new_value` NULL, the case migration 0013 left
room for — so `/changes` shows the figure leaving rather than the figure vanishing.

And `method_changes` says why, so the page does not read the withdrawals as the Census
revising its figures.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_RECORD_WITHDRAWAL = """
CREATE OR REPLACE FUNCTION record_fact_withdrawal() RETURNS trigger AS $$
BEGIN
    INSERT INTO fact_revision (
        region_id, metric_id, period_start,
        old_value, new_value, old_release_id, new_release_id
    ) VALUES (
        OLD.region_id, OLD.metric_id, OLD.period_start,
        OLD.value, NULL, OLD.release_id, NULL
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
"""

_TRIGGER = """
CREATE TRIGGER fact_metric_observation_withdrawn
AFTER DELETE ON fact_metric_observation
FOR EACH ROW EXECUTE FUNCTION record_fact_withdrawal();
"""

_NOTE = (
    "This site stopped showing a median that falls in the Census's open-ended top or "
    "bottom bracket: the Census prints the bracket's bound there, such as $250,001 for "
    "an income of $250,000 or more, and the bound is not a median. The Census's figures "
    "did not change."
)

_MEDIANS = ("acs_median_hh_income", "acs_median_gross_rent", "acs_median_home_value")


def upgrade() -> None:
    op.execute(_RECORD_WITHDRAWAL)
    op.execute(_TRIGGER)
    for metric_id in _MEDIANS:
        op.execute(
            sa.text(
                "INSERT INTO method_changes (changed_on, metric_id, note) "
                "VALUES (DATE '2026-10-01', :metric_id, :note) ON CONFLICT DO NOTHING"
            ).bindparams(metric_id=metric_id, note=_NOTE)
        )


def downgrade() -> None:
    for metric_id in _MEDIANS:
        op.execute(
            sa.text(
                "DELETE FROM method_changes "
                "WHERE changed_on = DATE '2026-10-01' AND metric_id = :metric_id"
            ).bindparams(metric_id=metric_id)
        )
    op.execute(
        "DROP TRIGGER IF EXISTS fact_metric_observation_withdrawn "
        "ON fact_metric_observation"
    )
    op.execute("DROP FUNCTION IF EXISTS record_fact_withdrawal()")
