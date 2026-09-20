"""Record it when a published figure changes, instead of overwriting it silently.

`fact_metric_observation` is keyed on `(region_id, metric_id, period_start)` and the
loader upserts, so a publisher revising a month it has already published replaces the
old value with no record that anything moved. Zillow does exactly this — it restates
recent months as more sales settle — and the only trace was the superseded file under
`data/raw/`, which nothing read and Milestone 29's own retention rule would eventually
delete.

That was survivable while acquisition was manual and rare. Milestone 29 makes refresh
routine, which turns "a figure quietly changed" from a theoretical concern into a
monthly one, and the platform's whole claim is that a figure can be traced. A number
that used to be different, with nothing saying so, is the one kind of provenance gap
that cannot be reconstructed after the fact.

**A trigger rather than loader code**, because the guarantee should not depend on which
path wrote the row. `load_facts` upserts today; a backfill, a correction, or a future
loader would each have to remember. The trigger fires on any UPDATE that actually moves
the value — `IS DISTINCT FROM` so a re-run over unchanged data writes nothing, which is
the common case and must stay cheap.

This records; it does not present. A view of revisions on the site would be Milestone 28
or later, and is deliberately not built here.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_RECORD_REVISION = """
CREATE OR REPLACE FUNCTION record_fact_revision() RETURNS trigger AS $$
BEGIN
    -- The guard that keeps an unchanged re-run free: a refresh over data that has
    -- not moved upserts every row and must write no revisions at all.
    --
    -- IS DISTINCT FROM rather than <> is defensive. `value` is NOT NULL today, so the
    -- two agree on every value the column can hold; <> would be null against null and
    -- silently skip a withdrawal the day that constraint is relaxed.
    IF NEW.value IS DISTINCT FROM OLD.value THEN
        INSERT INTO fact_revision (
            region_id, metric_id, period_start,
            old_value, new_value, old_release_id, new_release_id
        ) VALUES (
            OLD.region_id, OLD.metric_id, OLD.period_start,
            OLD.value, NEW.value, OLD.release_id, NEW.release_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

_TRIGGER = """
CREATE TRIGGER fact_metric_observation_revised
AFTER UPDATE ON fact_metric_observation
FOR EACH ROW EXECUTE FUNCTION record_fact_revision();
"""


def upgrade() -> None:
    op.create_table(
        "fact_revision",
        sa.Column("revision_id", sa.BigInteger(), primary_key=True, autoincrement=True),
        # No foreign key to regions or metrics on purpose: this is a historical record,
        # and it has to survive a region or metric being removed. What it describes
        # already happened.
        sa.Column("region_id", sa.Integer(), nullable=False),
        sa.Column("metric_id", sa.Text(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        # Nullable because a value can be revised to or from nothing.
        sa.Column("old_value", sa.Float(), nullable=True),
        sa.Column("new_value", sa.Float(), nullable=True),
        # Which release said each, so a revision names both sides of its own provenance.
        sa.Column("old_release_id", sa.Integer(), nullable=True),
        sa.Column("new_release_id", sa.Integer(), nullable=True),
        sa.Column(
            "revised_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    # The question this table is asked: "has this figure moved, and when?"
    op.create_index(
        "ix_fact_revision_figure",
        "fact_revision",
        ["region_id", "metric_id", "period_start"],
    )
    op.execute(_RECORD_REVISION)
    op.execute(_TRIGGER)


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER IF EXISTS fact_metric_observation_revised "
        "ON fact_metric_observation"
    )
    op.execute("DROP FUNCTION IF EXISTS record_fact_revision()")
    op.drop_index("ix_fact_revision_figure", table_name="fact_revision")
    op.drop_table("fact_revision")
