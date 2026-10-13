"""Exact-release CHAS income cohorts, separate from ranked metric facts."""

import json
import math
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, text

from hip.duck import duckdb_session
from hip.warehouse.load import ReleaseProvenance, _release_ids

FIELDS = (
    "total",
    "total_moe",
    "burdened",
    "burdened_moe",
    "severe",
    "severe_moe",
    "unknown",
    "unknown_moe",
)


def validate_band(row: dict[str, Any]) -> None:
    if row["tenure"] not in ("owner", "renter") or row["band"] not in range(5):
        raise ValueError("housing pressure: invalid cohort")
    if any(not math.isfinite(float(row[key])) or float(row[key]) < 0 for key in FIELDS):
        raise ValueError("housing pressure: invalid count or margin")
    # HUD independently rounds counts to five households. Do not clamp bad rows.
    if (
        row["severe"] > row["burdened"] + 15
        or row["burdened"] + row["unknown"] > row["total"] + 15
    ):
        raise ValueError("housing pressure: counts exceed cohort")
    if (
        row["vintage"] != "2018-2022"
        or row["level"] not in ("county", "municipality")
        or not row["geoid"]
    ):
        raise ValueError("housing pressure: unreviewed period or geography")


def load_housing_pressure(
    engine: Engine, duckdb_path: Path, *, releases: Sequence[ReleaseProvenance]
) -> int:
    with duckdb_session(duckdb_path) as duck:
        exists = duck.execute(
            "SELECT count(*) FROM information_schema.tables "
            "WHERE table_schema='main_staging' AND table_name='stg_housing_pressure'"
        ).fetchone()
        if not exists or not exists[0]:
            return 0
        result = duck.execute("SELECT * FROM main_staging.stg_housing_pressure")
        rows = [
            dict(zip([c[0] for c in result.description], row, strict=True))
            for row in result.fetchall()
        ]
    if not rows:
        raise ValueError("housing pressure: empty staged inventory")
    hashes = {(r.source_id, r.layer, r.vintage): r.file_sha256 for r in releases}
    seen: set[tuple[str, str, str, int]] = set()
    with engine.begin() as conn:
        ids = _release_ids(conn, releases)
        bound = []
        for row in rows:
            validate_band(row)
            key = ("hud_chas_bulk", str(row["release_layer"]), row["vintage"])
            cohort = (row["level"], row["geoid"], row["tenure"], row["band"])
            if cohort in seen or key not in ids or hashes[key] != row["file_sha256"]:
                raise ValueError(
                    "housing pressure: duplicate cohort or missing exact-file attribution"
                )
            seen.add(cohort)
            bound.append(
                {
                    "entity": f"{row['level']}:{row['geoid']}",
                    "record": f"{row['tenure']}:{row['band']}",
                    "payload": json.dumps(
                        {k: row[k] for k in ("tenure", "band", "vintage", *FIELDS)}
                    ),
                    "release": ids[key],
                }
            )
        for level, geoid in {(r["level"], r["geoid"]) for r in rows}:
            if sum(c[0] == level and c[1] == geoid for c in seen) != 10:
                raise ValueError("housing pressure: incomplete tenure/income inventory")
        conn.execute(
            text(
                "DELETE FROM community_records WHERE source_id='hud_chas_bulk' "
                "AND kind='housing_pressure'"
            )
        )
        conn.execute(
            text("""INSERT INTO community_records
            (source_id,kind,entity_id,record_id,payload,snapshot,release_id)
            VALUES('hud_chas_bulk','housing_pressure',:entity,:record,
                   CAST(:payload AS jsonb),'2022-12-31',:release)"""),
            bound,
        )
    return len(bound)
