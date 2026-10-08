"""Revisions carry their margins, and dangling release pointers are cleared (#350).

Two corrections to `fact_revision`, found in review and kept in TODO until now:

- **Margins** (#246). The trigger recorded a revised survey figure's old and new values
  but not their margins, so `/changes` showed a revised ACS figure bare, against SPEC
  principle 12. `old_margin` and `new_margin` now record both sides from here on; rows
  written before this have none, and the page says so rather than guessing.
- **Dangling pointers** (M29). 2,936 rows — `price_to_income`, `rent_to_income` and
  `price_to_ami`, all derived — named an analyze run's release that a pruning step
  deleted before #199 protected them. An integer that resolves to nothing reads as a
  working reference, so the id is cleared and `old_release_pruned` says why. The
  values and the rows stay: the table is append-only in what it records, and what was
  lost is which computation produced the earlier value, not which publisher did.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0036"
down_revision: str | None = "0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_RECORD_REVISION = """
CREATE OR REPLACE FUNCTION record_fact_revision() RETURNS trigger AS $$
BEGIN
    -- IS DISTINCT FROM keeps a withdrawal; `revision_is_noise` drops a recomputation
    -- of the same figure that differs only in its last digits (migration 0032). The
    -- margins ride along so a revised survey figure keeps them (migration 0036).
    IF NEW.value IS DISTINCT FROM OLD.value
       AND NOT revision_is_noise(OLD.value, NEW.value) THEN
        INSERT INTO fact_revision (
            region_id, metric_id, period_start,
            old_value, new_value, old_release_id, new_release_id,
            old_margin, new_margin
        ) VALUES (
            OLD.region_id, OLD.metric_id, OLD.period_start,
            OLD.value, NEW.value, OLD.release_id, NEW.release_id,
            OLD.margin_of_error, NEW.margin_of_error
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

_PREVIOUS = """
CREATE OR REPLACE FUNCTION record_fact_revision() RETURNS trigger AS $$
BEGIN
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

_VIEW = """
CREATE VIEW fact_revision_shown AS
SELECT * FROM fact_revision WHERE NOT revision_is_noise(old_value, new_value);
"""


def upgrade() -> None:
    # The view is `SELECT *`, fixed to the columns that existed when it was made.
    op.execute("DROP VIEW fact_revision_shown")
    op.execute(
        "ALTER TABLE fact_revision "
        "ADD COLUMN old_margin double precision, "
        "ADD COLUMN new_margin double precision, "
        "ADD COLUMN old_release_pruned boolean NOT NULL DEFAULT false"
    )
    op.execute(
        """
        UPDATE fact_revision r
        SET old_release_id = NULL, old_release_pruned = true
        WHERE r.old_release_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM source_releases s WHERE s.release_id = r.old_release_id
          )
        """
    )
    op.execute(_RECORD_REVISION)
    op.execute(_VIEW)


def downgrade() -> None:
    op.execute("DROP VIEW fact_revision_shown")
    op.execute(_PREVIOUS)
    # The cleared ids are not restored: what they named no longer exists.
    op.execute(
        "ALTER TABLE fact_revision DROP COLUMN old_margin, DROP COLUMN new_margin, "
        "DROP COLUMN old_release_pruned"
    )
    op.execute(_VIEW)
