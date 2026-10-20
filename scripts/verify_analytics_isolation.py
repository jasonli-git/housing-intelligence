"""Run tests with a serving API and prove the public analytics rows did not change.

Usage: uv run python scripts/verify_analytics_isolation.py [command ...]
Start `make api` first. Writes evidence to stdout; subprocess output stays on stderr.
"""

import json
import subprocess
import sys
from threading import Event, Thread
from urllib.request import urlopen

from sqlalchemy import text

from hip.warehouse.db import get_engine


def snapshot() -> dict[str, object]:
    with get_engine().connect() as conn:
        return {
            table: dict(
                conn.execute(
                    text(
                        "SELECT count(*) AS rows, "
                        "md5(string_agg(digest, '' ORDER BY digest)) "
                        f"AS checksum FROM (SELECT md5(row_to_json(t)::text) AS digest "
                        f"FROM public.{table} t) rows"
                    )
                )
                .mappings()
                .one()
            )
            for table in ("fact_metric_change", "region_rankings")
        }


def main() -> int:
    stop = Event()
    responses: list[int] = []
    errors: list[str] = []

    def check() -> None:
        try:
            with urlopen(
                "http://localhost:8000/rankings?metric_id=zhvi_sfr&limit=1", timeout=5
            ) as response:
                assert json.load(response)["items"]
                responses.append(response.status)
        except Exception as exc:
            errors.append(str(exc))

    def watch() -> None:
        while not stop.wait(0.5):
            check()

    check()
    if errors:
        raise RuntimeError(f"API must be serving before testing: {errors}")
    before = snapshot()
    watcher = Thread(target=watch, daemon=True)
    watcher.start()
    try:
        result = subprocess.run(sys.argv[1:] or ["make", "test-all"], stdout=sys.stderr)
    finally:
        stop.set()
        watcher.join()
    after = snapshot()
    print(
        json.dumps(
            {
                "before": before,
                "after": after,
                "unchanged": before == after,
                "api_successes": len(responses),
                "api_errors": errors,
                "test_exit": result.returncode,
            },
            indent=2,
        )
    )
    return int(result.returncode != 0 or before != after or bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
