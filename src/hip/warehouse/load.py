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


@dataclass(frozen=True)
class MetricRecord:
    metric_id: str
    label: str
    unit: str
    frequency: str
    direction: str
    description: str
    source_id: str


@dataclass(frozen=True)
class FactLoadResult:
    observations: int
    by_metric: dict[str, int]
    rejects: int


_INSERT_FACT = text(
    """
    INSERT INTO fact_metric_observation
        (region_id, metric_id, period_start, period_end, value, release_id, match_method)
    SELECT r.region_id, :metric_id, :period_start, :period_end, :value,
           :release_id, :match_method
    FROM regions r
    WHERE r.level = CAST(:level AS region_level) AND r.geoid = :geoid
    ON CONFLICT (region_id, metric_id, period_start) DO UPDATE SET
        period_end   = EXCLUDED.period_end,
        value        = EXCLUDED.value,
        release_id   = EXCLUDED.release_id,
        match_method = EXCLUDED.match_method
    """
)


def load_facts(
    engine: Engine,
    duckdb_path: Path,
    *,
    metrics: Sequence[MetricRecord],
    sources: Sequence[SourceRecord],
    releases: Sequence[ReleaseProvenance],
    observation_table: str = "stg_metric_observation",
    reject_table: str = "stg_match_reject",
) -> FactLoadResult:
    """Load staged observations into the warehouse in one transaction.

    Values are upserted on (region, metric, period), so re-running after a Zillow
    revision updates history in place rather than accumulating duplicates.

    Each fact points at the release for its own (source, layer): a county value and a
    ZIP value come from different files, and attributing both to one release would make
    the provenance a lie.
    """
    with duckdb_session(duckdb_path) as duck:
        rows = duck.execute(
            f"""
            SELECT geoid, level, metric_id, period_start, period_end, value,
                   source_id, layer, match_method, release_vintage
            FROM {observation_table}
            """
        ).fetchall()
        rejects = duck.execute(
            f"""
            SELECT source_id, layer, region_name, county_name, observations, reason
            FROM {reject_table}
            """
        ).fetchall()

    by_metric: dict[str, int] = {}
    with engine.begin() as conn:
        _upsert_sources(conn, sources)
        _insert_releases(conn, releases)
        _upsert_metrics(conn, metrics)
        release_index = _release_ids(conn, releases)

        # Resolution order, most precise first. Vintage matters more than layer: a
        # value attributed to the wrong *year* of a source misstates when it was
        # measured, while a value attributed to the wrong layer of the right vintage
        # only loses which file within that release carried it.
        #
        # `(source, layer)` alone was the only key until Milestone 7, and it is not
        # unique for a source publishing several vintages — ACS has ten releases across
        # five vintages, HUD 107 — so all but one collapsed and every year's value cited
        # the survivor (ARCHITECTURE #47, #53).
        by_layer_vintage = {(s, la, v): r for (s, la, v), r in release_index.items()}
        by_vintage: dict[tuple[str, str], int] = {}
        by_layer: dict[tuple[str, str], int] = {}
        any_release: dict[str, int] = {}
        for (src, layer_name, vintage), rid in release_index.items():
            by_vintage.setdefault((src, vintage), rid)
            by_layer.setdefault((src, layer_name), rid)
            any_release.setdefault(src, rid)

        payload = []
        for (
            geoid,
            level,
            metric_id,
            start,
            end,
            value,
            source_id,
            layer,
            method,
            vintage,
        ) in rows:
            source = str(source_id)
            release_id = (
                by_layer_vintage.get((source, str(layer), str(vintage)))
                or by_vintage.get((source, str(vintage)))
                or by_layer.get((source, str(layer)))
                or any_release.get(source)
            )
            if release_id is None:
                continue
            payload.append(
                {
                    "geoid": geoid,
                    "level": level,
                    "metric_id": metric_id,
                    "period_start": start,
                    "period_end": end,
                    "value": float(value),
                    "release_id": release_id,
                    "match_method": method,
                }
            )
            by_metric[str(metric_id)] = by_metric.get(str(metric_id), 0) + 1

        for start_index in range(0, len(payload), BATCH):
            conn.execute(_INSERT_FACT, payload[start_index : start_index + BATCH])

        _replace_rejects(conn, rejects)

    return FactLoadResult(
        observations=len(payload), by_metric=by_metric, rejects=len(rejects)
    )


def load_region_identifiers(
    engine: Engine, duckdb_path: Path, *, staging_table: str = "stg_nj_municipal_codes"
) -> int:
    """Populate `region_identifiers` from a staged (identifier, geoid, scheme) model.

    Upserted on `(region_id, scheme)`, so re-running is a no-op and a corrected code
    replaces the old one rather than accumulating a second row for the same scheme.
    Returns 0 when the model has not been staged, which is a legitimate state — the
    geography spine loads without any NJ-specific source present.
    """
    with duckdb_session(duckdb_path) as duck:
        staged = {
            row[0]
            for row in duck.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'main_staging'"
            ).fetchall()
        }
        if staging_table not in staged:
            return 0
        rows = duck.execute(
            f"SELECT identifier, geoid, scheme FROM main_staging.{staging_table}"
        ).fetchall()

    if not rows:
        return 0

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO region_identifiers (region_id, scheme, identifier)
                SELECT r.region_id, :scheme, :identifier
                FROM regions r
                WHERE r.level = 'municipality' AND r.geoid = :geoid
                ON CONFLICT (region_id, scheme) DO UPDATE SET
                    identifier = EXCLUDED.identifier
                """
            ),
            [
                {"identifier": identifier, "geoid": geoid, "scheme": scheme}
                for identifier, geoid, scheme in rows
            ],
        )
    return len(rows)


def _release_ids(
    conn: Any, releases: Sequence[ReleaseProvenance]
) -> dict[tuple[str, str, str], int]:
    """Map (source_id, layer, vintage) to the release row just inserted for it.

    Keyed on all three because two of them are not enough: `(source, layer)` collapses
    a source's vintages onto one release, which is the defect ARCHITECTURE #47 records.
    """
    if not releases:
        return {}
    rows = conn.execute(
        text(
            """
            SELECT source_id, layer, vintage, release_id FROM source_releases
            WHERE (source_id, layer, vintage, file_sha256) IN (
                SELECT unnest(CAST(:sources AS text[])),
                       unnest(CAST(:layers AS text[])),
                       unnest(CAST(:vintages AS text[])),
                       unnest(CAST(:hashes AS text[]))
            )
            """
        ),
        {
            "sources": [r.source_id for r in releases],
            "layers": [r.layer for r in releases],
            "vintages": [r.vintage for r in releases],
            "hashes": [r.file_sha256 for r in releases],
        },
    ).fetchall()
    return {
        (str(s), str(layer), str(vintage)): int(rid) for s, layer, vintage, rid in rows
    }


def _upsert_metrics(conn: Any, metrics: Sequence[MetricRecord]) -> None:
    if not metrics:
        return
    conn.execute(
        text(
            """
            INSERT INTO metrics
                (metric_id, label, unit, frequency, direction, description, source_id)
            VALUES
                (:metric_id, :label, :unit, :frequency, :direction, :description,
                 :source_id)
            ON CONFLICT (metric_id) DO UPDATE SET
                label = EXCLUDED.label, unit = EXCLUDED.unit,
                frequency = EXCLUDED.frequency, direction = EXCLUDED.direction,
                description = EXCLUDED.description, source_id = EXCLUDED.source_id
            """
        ),
        [m.__dict__ for m in metrics],
    )


def _replace_rejects(conn: Any, rows: Sequence[tuple[Any, ...]]) -> None:
    """Rebuilt wholesale — it describes the current release, not an accumulating log."""
    conn.execute(text("DELETE FROM source_match_reject"))
    if not rows:
        return
    conn.execute(
        text(
            """
            INSERT INTO source_match_reject
                (source_id, layer, region_name, county_name, observations, reason)
            VALUES (:source_id, :layer, :region_name, :county_name, :observations,
                    :reason)
            """
        ),
        [
            {
                "source_id": r[0],
                "layer": r[1],
                "region_name": r[2],
                "county_name": r[3],
                "observations": int(r[4]),
                "reason": r[5],
            }
            for r in rows
        ],
    )


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
