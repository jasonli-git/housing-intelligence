"""Snapshot/timing evidence in scratch tables only; never rebuild public analytics.

Run --reference-only before editing compute.py, then run without it afterwards.
The JSON stores every ranking column, so equality is row-for-row, not just a count.
"""

import argparse
import hashlib
import json
from pathlib import Path
from time import perf_counter

from sqlalchemy import text
from tests.warehouse_scratch import scratch_warehouse

from hip.analytics.compute import _rank_ranges
from hip.warehouse.db import get_engine

REFERENCE = (
    Path(__file__).resolve().parents[1] / "tests/fixtures/rank_ranges_reference.sql"
)


def rows(conn: object) -> list:
    return [
        list(row)
        for row in conn.execute(
            text(  # type: ignore[attr-defined]
                "SELECT * FROM region_rankings "
                'ORDER BY metric_id,level,basis,"window",region_id'
            )
        )
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference-only", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--baseline", type=Path)
    args = parser.parse_args()
    with scratch_warehouse(get_engine()) as engine:
        with engine.begin() as conn:
            conn.execute(
                text("INSERT INTO region_rankings SELECT * FROM public.region_rankings")
            )
            before = rows(conn)
            start = perf_counter()
            if args.reference_only:
                updated = conn.execute(text(REFERENCE.read_text())).rowcount
            else:
                updated = _rank_ranges(conn)
            elapsed = perf_counter() - start
            after = rows(conn)
        baseline = (
            json.loads(args.baseline.read_text())["rows"] if args.baseline else before
        )
        evidence = {
            "seconds": elapsed,
            "updated": updated,
            "row_count": len(after),
            "equal_before": before == after,
            "equal_baseline": baseline == after,
            "sha256": hashlib.sha256(json.dumps(after).encode()).hexdigest(),
            "rows": after,
        }
        args.output.write_text(json.dumps(evidence))
        print(json.dumps({k: v for k, v in evidence.items() if k != "rows"}), flush=True)
        assert evidence["equal_baseline"], "Rank-range rows differ; evidence retained"


if __name__ == "__main__":
    main()
