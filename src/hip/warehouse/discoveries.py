"""Load `Discovery` (Milestone 26) into `source_discoveries`, for the API to read.

`Discovery` has lived only on the acquiring machine's disk since it was written —
`data/raw/<source>/releases.json`. That was enough while nothing but the pipeline
needed it; Milestone 27's freshness page is read by the API, which may import
`warehouse` and `packets` and nothing else from the pipeline (ARCHITECTURE #6,
`tests/test_module_boundaries.py`), so a raw-file read is exactly the access that
boundary forbids. This is the `load` stage's job for the same reason every other
pipeline-produced fact crosses into Postgres there rather than being read around.
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

from sqlalchemy import Engine, text

from hip.sources.base import read_discovery


def load_discoveries(engine: Engine, raw_dir: Path, source_ids: Iterable[str]) -> int:
    """Upsert each source's current `Discovery` record. Returns how many were written.

    One row per source — a history of past checks was never the point, only "what does
    a refresh currently believe right now". A source with no record (`read_discovery`
    returns `None`: never implemented `discover`, like `census_tiger`'s deliberate pin,
    or a damaged file `read_discovery` chose not to crash on) is skipped rather than
    written as a row of nulls pretending to know something; the freshness page reads
    the *absence* of a row as its own status.
    """
    rows = []
    for source_id in source_ids:
        discovery = read_discovery(raw_dir, source_id)
        if discovery is None:
            continue
        rows.append(
            {
                "source_id": discovery.source_id,
                "newest": discovery.newest,
                "checked_at": discovery.checked_at,
                "outcome": discovery.outcome,
                "published": discovery.published,
                "pending": discovery.pending,
                "pending_from": discovery.pending_from,
                "pending_reason": discovery.pending_reason,
            }
        )
    if not rows:
        return 0
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO source_discoveries
                    (source_id, newest, checked_at, outcome, published, pending,
                     pending_from, pending_reason, loaded_at)
                VALUES
                    (:source_id, :newest, :checked_at, :outcome, :published, :pending,
                     :pending_from, :pending_reason, now())
                ON CONFLICT (source_id) DO UPDATE SET
                    newest = EXCLUDED.newest, checked_at = EXCLUDED.checked_at,
                    outcome = EXCLUDED.outcome, published = EXCLUDED.published,
                    pending = EXCLUDED.pending, pending_from = EXCLUDED.pending_from,
                    pending_reason = EXCLUDED.pending_reason, loaded_at = now()
                """
            ),
            rows,
        )
    return len(rows)
