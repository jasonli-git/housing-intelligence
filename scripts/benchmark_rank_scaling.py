"""Measure one real cohort at 1x/2x/7x; project 7x from the first two timings.

Synthetic replicas are in memory only. This does not ingest another state's data.
"""

import json
from math import log
from statistics import median
from time import perf_counter

from sqlalchemy import text

from hip.analytics.rank_ranges import significance_counts
from hip.warehouse.db import get_engine


def main() -> None:
    with get_engine().connect() as conn:
        base = [
            (float(v), float(m) if m is not None else None)
            for v, m in conn.execute(
                text("""SELECT -value, margin_of_error FROM region_rankings
                 WHERE metric_id='acs_population' AND level='zip'
                   AND basis='value' AND "window"='latest' ORDER BY region_id""")
            )
        ]
    timings = {}
    for factor in (1, 2, 7):
        values = [(v + i * abs(v) * 0.001, m) for i in range(factor) for v, m in base]
        samples = []
        for _ in range(5):
            start = perf_counter()
            assert significance_counts(values) is not None
            samples.append(perf_counter() - start)
        timings[factor] = {
            "regions": len(values),
            "seconds": median(samples),
            "samples": samples,
        }
    exponent = log(timings[2]["seconds"] / timings[1]["seconds"]) / log(2)
    print(
        json.dumps(
            {
                "cohort": "ACS population ZIP value/latest",
                "timings": timings,
                "empirical_exponent_1x_2x": exponent,
                "projected_7x_seconds": timings[1]["seconds"] * 7**exponent,
                "limits": "Counting only; no database IO; synthetic similar-distribution "
                "replicas, not all seven states or a worst-case guarantee.",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
