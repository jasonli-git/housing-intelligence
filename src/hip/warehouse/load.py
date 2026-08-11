"""Load the staged geography spine from DuckDB into PostgreSQL.

One transaction for the whole load (ARCHITECTURE #6, #9): either the warehouse has a
complete, internally consistent geography spine or it has the previous one. There is no
window in which a tract exists but its county does not.

Regions are **upserted on (level, geoid)**, never deleted and reinserted. `region_id` is
a surrogate key that every future fact row will reference, so a reload that reassigned
ids would silently repoint every metric in the warehouse at the wrong place.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, text

from hip.duck import duckdb_session

# Parents must exist before children, because the parent_id lookup happens inline and
# ck_regions_parent_by_level rejects an orphan at insert time rather than after.
LEVEL_ORDER = ("state", "county", "municipality", "tract", "zip")

BATCH = 250


@dataclass(frozen=True)
class ReleaseProvenance:
    """What `source_releases` records for one fetched file."""

    source_id: str
    layer: str
    vintage: str
    fetched_at: datetime
    file_sha256: str
    row_count: int


@dataclass(frozen=True)
class SourceRecord:
    source_id: str
    name: str
    publisher: str
    license: str
    url: str
    cadence: str


@dataclass(frozen=True)
class LoadResult:
    regions_by_level: dict[str, int]
    crosswalk_rows: int
    releases: int

    @property
    def total_regions(self) -> int:
        return sum(self.regions_by_level.values())


_INSERT_REGION = text(
    """
    INSERT INTO regions (geoid, level, name, state_code, parent_id, geom)
    VALUES (
        :geoid, CAST(:level AS region_level), :name, :state_code,
        -- Explicit casts: inside a bare CASE WHEN ... IS NULL, Postgres has no column
        -- context to infer the parameter type from and rejects it as ambiguous.
        -- (Note: never write a colon-prefixed token in these comments — SQLAlchemy's
        -- text() parses bind parameters inside SQL comments too.)
        CASE WHEN CAST(:parent_geoid AS text) IS NULL THEN NULL ELSE (
            SELECT p.region_id FROM regions p
            WHERE p.level = CAST(:parent_level AS region_level)
              AND p.geoid = CAST(:parent_geoid AS text)
        ) END,
        ST_GeomFromWKB(:geom, 4269)
    )
    ON CONFLICT (level, geoid) DO UPDATE SET
        name       = EXCLUDED.name,
        state_code = EXCLUDED.state_code,
        parent_id  = EXCLUDED.parent_id,
        geom       = EXCLUDED.geom
    """
)


def load_geography(
    engine: Engine,
    duckdb_path: Path,
    *,
    sources: Sequence[SourceRecord],
    releases: Sequence[ReleaseProvenance],
    staging_table: str = "stg_regions",
    crosswalk_table: str = "stg_region_crosswalk",
) -> LoadResult:
    """Load staged regions and crosswalks. Idempotent: re-running changes nothing."""
    with duckdb_session(duckdb_path) as duck:
        region_rows = duck.execute(
            f"""
            SELECT geoid, level, name, state_code, parent_geoid, parent_level, geom_wkb
            FROM {staging_table}
            """
        ).fetchall()
        crosswalk_rows = duck.execute(
            f"""
            SELECT from_geoid, from_level, to_geoid, to_level, weight, method
            FROM {crosswalk_table}
            """
        ).fetchall()

    by_level: dict[str, list[tuple[Any, ...]]] = {level: [] for level in LEVEL_ORDER}
    for row in region_rows:
        by_level.setdefault(str(row[1]), []).append(row)

    counts: dict[str, int] = {}
    with engine.begin() as conn:
        _upsert_sources(conn, sources)
        release_count = _insert_releases(conn, releases)

        for level in LEVEL_ORDER:
            rows = by_level.get(level, [])
            if not rows:
                continue
            payload = [
                {
                    "geoid": r[0],
                    "level": r[1],
                    "name": r[2],
                    "state_code": r[3],
                    "parent_geoid": r[4],
                    "parent_level": r[5],
                    "geom": bytes(r[6]),
                }
                for r in rows
            ]
            for start in range(0, len(payload), BATCH):
                conn.execute(_INSERT_REGION, payload[start : start + BATCH])
            counts[level] = len(payload)

        crosswalk_count = _load_crosswalk(conn, crosswalk_rows)

    return LoadResult(
        regions_by_level=counts, crosswalk_rows=crosswalk_count, releases=release_count
    )


def _upsert_sources(conn: Any, sources: Sequence[SourceRecord]) -> None:
    if not sources:
        return
    conn.execute(
        text(
            """
            INSERT INTO sources (source_id, name, publisher, license, url, cadence)
            VALUES (:source_id, :name, :publisher, :license, :url, :cadence)
            ON CONFLICT (source_id) DO UPDATE SET
                name = EXCLUDED.name, publisher = EXCLUDED.publisher,
                license = EXCLUDED.license, url = EXCLUDED.url,
                cadence = EXCLUDED.cadence
            """
        ),
        [s.__dict__ for s in sources],
    )


def _insert_releases(conn: Any, releases: Sequence[ReleaseProvenance]) -> int:
    """Record each fetched file. Unchanged bytes conflict and are skipped (#10)."""
    if not releases:
        return 0
    conn.execute(
        text(
            """
            INSERT INTO source_releases
                (source_id, layer, vintage, fetched_at, file_sha256, row_count)
            VALUES (:source_id, :layer, :vintage, :fetched_at, :file_sha256, :row_count)
            ON CONFLICT (source_id, layer, vintage, file_sha256) DO NOTHING
            """
        ),
        [r.__dict__ for r in releases],
    )
    return len(releases)


def _load_crosswalk(conn: Any, rows: Sequence[tuple[Any, ...]]) -> int:
    """Replace the crosswalk wholesale — it is derived and referenced by nothing."""
    conn.execute(text("DELETE FROM region_crosswalk"))
    if not rows:
        return 0
    payload = [
        {
            "from_geoid": r[0],
            "from_level": r[1],
            "to_geoid": r[2],
            "to_level": r[3],
            "weight": float(r[4]),
            "method": r[5],
        }
        for r in rows
    ]
    statement = text(
        """
        INSERT INTO region_crosswalk (from_region_id, to_region_id, weight, method)
        SELECT f.region_id, t.region_id, :weight, :method
        FROM regions f, regions t
        WHERE f.level = CAST(:from_level AS region_level) AND f.geoid = :from_geoid
          AND t.level = CAST(:to_level   AS region_level) AND t.geoid = :to_geoid
        ON CONFLICT (from_region_id, to_region_id) DO UPDATE SET
            weight = EXCLUDED.weight, method = EXCLUDED.method
        """
    )
    for start in range(0, len(payload), BATCH):
        conn.execute(statement, payload[start : start + BATCH])
    return len(payload)
