"""Floating-point noise is not a revision (owner's decision, 2026-10-07, #334).

Restaging recomputes a figure from the same release with its sums in a different order,
and the trigger recorded any difference at all: 6,774 rows by 2026-10-07, none moving a
figure by more than one part in a billion, while the smallest real revision held moved
one by 1.8 parts per million. So:

- `revision_is_noise(old, new)`: true when both values are present and differ by at most
  1e-9 of the larger. A withdrawal (a null on either side) is never noise.
- The trigger stops recording noise.
- `fact_revision_shown`, a view without the noise, is what `/changes` reads. The rows
  already recorded stay in `fact_revision`, which is append-only: hidden, not deleted.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NOISE = """
CREATE OR REPLACE FUNCTION revision_is_noise(old_value double precision,
                                             new_value double precision)
RETURNS boolean AS $$
    SELECT old_value IS NOT NULL AND new_value IS NOT NULL
       AND abs(new_value - old_value)
           <= 1e-9 * greatest(abs(old_value), abs(new_value))
$$ LANGUAGE sql IMMUTABLE;
"""

_RECORD_REVISION = """
CREATE OR REPLACE FUNCTION record_fact_revision() RETURNS trigger AS $$
BEGIN
    -- IS DISTINCT FROM keeps a withdrawal; `revision_is_noise` drops a recomputation
    -- of the same figure that differs only in its last digits (migration 0032).
    IF NEW.value IS DISTINCT FROM OLD.value
       AND NOT revision_is_noise(OLD.value, NEW.value) THEN
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

_PREVIOUS = """
CREATE OR REPLACE FUNCTION record_fact_revision() RETURNS trigger AS $$
BEGIN
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

_VIEW = """
CREATE VIEW fact_revision_shown AS
SELECT * FROM fact_revision WHERE NOT revision_is_noise(old_value, new_value);
"""


def upgrade() -> None:
    op.execute(_NOISE)
    op.execute(_RECORD_REVISION)
    op.execute(_VIEW)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS fact_revision_shown")
    op.execute(_PREVIOUS)
    op.execute(
        "DROP FUNCTION IF EXISTS revision_is_noise(double precision, double precision)"
    )
