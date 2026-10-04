"""Load the staged geography spine from DuckDB into PostgreSQL.

One transaction for the whole load (ARCHITECTURE #6, #9): either the warehouse has a
complete, internally consistent geography spine or it has the previous one. There is no
window in which a tract exists but its county does not.

Regions are **upserted on (level, geoid)**, never deleted and reinserted. `region_id` is
a surrogate key that every future fact row will reference, so a reload that reassigned
ids would silently repoint every metric in the warehouse at the wrong place.
"""

from __future__ import annotations

import json
import math
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, text

from hip.config import Metric, Source, metric_licence
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
    # Human-facing landing page where it differs from the canonical root (#72).
    homepage: str | None
    cadence: str
    # What its terms allow, where they were read and when, and the notices they require
    # the site to display (Milestone 31).
    licence_class: str | None = None
    terms_url: str | None = None
    terms_checked: date | None = None
    terms_note: str | None = None
    notices: list[str] = dataclass_field(default_factory=list)


def source_record(source_id: str, source: Source) -> SourceRecord:
    """The `sources` row for one configured source."""
    return SourceRecord(
        source_id=source_id,
        name=source.name,
        publisher=source.publisher,
        license=source.license,
        url=source.url,
        homepage=source.homepage,
        cadence=source.cadence,
        licence_class=source.licence_class,
        terms_url=source.terms_url,
        terms_checked=source.terms_checked,
        terms_note=source.terms_note,
        notices=list(source.notices),
    )


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
    INSERT INTO regions (geoid, level, name, name_lsad, state_code, parent_id, geom)
    VALUES (
        :geoid, CAST(:level AS region_level), :name, :name_lsad, :state_code,
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
        name_lsad  = EXCLUDED.name_lsad,
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
            SELECT geoid, level, name, name_lsad, state_code,
                   parent_geoid, parent_level, geom_wkb
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
                    "name_lsad": r[3],
                    "state_code": r[4],
                    "parent_geoid": r[5],
                    "parent_level": r[6],
                    "geom": bytes(r[7]),
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
            INSERT INTO sources
                (source_id, name, publisher, license, url, homepage, cadence,
                 licence_class, terms_url, terms_checked, terms_note, notices)
            VALUES
                (:source_id, :name, :publisher, :license, :url, :homepage, :cadence,
                 :licence_class, :terms_url, :terms_checked, :terms_note, :notices)
            ON CONFLICT (source_id) DO UPDATE SET
                name = EXCLUDED.name, publisher = EXCLUDED.publisher,
                homepage = EXCLUDED.homepage,
                license = EXCLUDED.license, url = EXCLUDED.url,
                cadence = EXCLUDED.cadence,
                licence_class = EXCLUDED.licence_class,
                terms_url = EXCLUDED.terms_url,
                terms_checked = EXCLUDED.terms_checked,
                terms_note = EXCLUDED.terms_note,
                notices = EXCLUDED.notices
            """
        ),
        [s.__dict__ for s in sources],
    )


def _insert_releases(conn: Any, releases: Sequence[ReleaseProvenance]) -> int:
    """Record each fetched file. Unchanged bytes conflict and keep their identity (#10).

    The conflict updates `row_count` and nothing else. A release is identified by its
    content, so re-recording one must not move its identity or its `fetched_at` — that
    timestamp is quoted in every analysis packet, and rewriting it on each load would
    move every packet hash for no reason, which is exactly the defect #73 removed from
    the analytics side.

    `row_count` is exempt because it is a *description* of that fixed content rather
    than part of it, and it was wrong until #74: both callers passed the file's byte
    size. Left as `DO NOTHING`, the correction would only ever have reached releases
    fetched after the fix, and the registry would have gone on reporting the national
    ZCTA file as 529,118,424 rows indefinitely.
    """
    if not releases:
        return 0
    conn.execute(
        text(
            """
            INSERT INTO source_releases
                (source_id, layer, vintage, fetched_at, file_sha256, row_count)
            VALUES (:source_id, :layer, :vintage, :fetched_at, :file_sha256, :row_count)
            ON CONFLICT (source_id, layer, vintage, file_sha256) DO UPDATE SET
                row_count = EXCLUDED.row_count
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
    # Its kind (SPEC principle 11), its licence as inherited (#269), and who owns the
    # series where that is not its source (Milestone 31).
    record_type: str | None = None
    licence_class: str | None = None
    originator: str | None = None


def metric_records(
    metrics: Mapping[str, Metric],
    sources: Mapping[str, Source],
    only: set[str] | None = None,
) -> list[MetricRecord]:
    """The `metrics` rows for configured metrics — all of them, or those in `only` —
    each with its licence inherited through its inputs."""
    return [
        MetricRecord(
            metric_id=metric_id,
            label=metric.label,
            unit=metric.unit,
            frequency=metric.frequency,
            direction=metric.direction,
            description=metric.description,
            source_id=metric.source_id,
            record_type=metric.record_type,
            licence_class=metric_licence(metric_id, dict(metrics), dict(sources)),
            originator=metric.originator,
        )
        for metric_id, metric in metrics.items()
        if only is None or metric_id in only
    ]


def sync_registry(
    conn: Any, sources: Mapping[str, Source], metrics: Mapping[str, Metric]
) -> None:
    """Write every configured metric, and every source the site already has or a metric
    needs, as the config now states them — so a change to a licence, a kind or a notice
    reaches the site without reloading any facts.

    A configured source nothing uses is not added: `GET /sources` lists every row as a
    source behind the site, and the NJ parcel boundaries, declared but never fetched,
    would be credited for figures it never supplied. The sources are written before the
    metrics whose foreign key needs them."""
    present = {row[0] for row in conn.execute(text("SELECT source_id FROM sources"))}
    needed = present | {metric.source_id for metric in metrics.values()}
    _upsert_sources(
        conn, [source_record(sid, s) for sid, s in sources.items() if sid in needed]
    )
    _upsert_metrics(conn, metric_records(metrics, sources))


@dataclass(frozen=True)
class FactLoadResult:
    observations: int
    by_metric: dict[str, int]
    rejects: int
    # Figures a loaded release no longer gives, deleted and recorded (migration 0021).
    withdrawn: int = 0


ReleaseKey = tuple[str, str, str]


class ReleaseAttributionError(ValueError):
    """A staged observation has no unique release with its exact provenance key."""


_INSERT_FACT = text(
    """
    INSERT INTO fact_metric_observation
        (region_id, metric_id, period_start, period_end, value, release_id, match_method,
         margin_of_error)
    SELECT r.region_id, :metric_id, :period_start, :period_end, :value,
           :release_id, :match_method, :margin_of_error
    FROM regions r
    WHERE r.level = CAST(:level AS region_level) AND r.geoid = :geoid
    ON CONFLICT (region_id, metric_id, period_start) DO UPDATE SET
        period_end      = EXCLUDED.period_end,
        value           = EXCLUDED.value,
        release_id      = EXCLUDED.release_id,
        match_method    = EXCLUDED.match_method,
        margin_of_error = EXCLUDED.margin_of_error
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

    Each fact points at the release for its exact (source, layer, vintage). Older
    staged vintages may use an existing warehouse release outside the adapters' current
    acquisition window, but an absent or ambiguous exact release aborts the transaction.
    """
    with duckdb_session(duckdb_path) as duck:
        rows = duck.execute(
            f"""
            SELECT geoid, level, metric_id, period_start, period_end, value,
                   source_id, layer, match_method, release_vintage, margin_of_error
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

        needed: Counter[ReleaseKey] = Counter(
            (str(source_id), str(layer), str(vintage))
            for _, _, _, _, _, _, source_id, layer, _, vintage, _ in rows
        )
        missing = set(needed) - set(release_index)
        historical = _historical_release_candidates(conn, missing) if missing else []
        release_index = _resolve_fact_release_ids(release_index, needed, historical)

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
            margin,
        ) in rows:
            release_id = release_index[(str(source_id), str(layer), str(vintage))]
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
                    # A survey's 90% margin of error, or None (Milestone 28).
                    "margin_of_error": None if margin is None else float(margin),
                }
            )
            by_metric[str(metric_id)] = by_metric.get(str(metric_id), 0) + 1

        for start_index in range(0, len(payload), BATCH):
            conn.execute(_INSERT_FACT, payload[start_index : start_index + BATCH])

        withdrawn = _withdraw(conn, payload, {release_index[key] for key in needed})
        _replace_rejects(conn, rejects)

    return FactLoadResult(
        observations=len(payload),
        by_metric=by_metric,
        rejects=len(rejects),
        withdrawn=withdrawn,
    )


def _withdraw(
    conn: Any, payload: Sequence[Mapping[str, object]], loaded: set[int]
) -> int:
    """Delete each figure a loaded release no longer gives (ARCHITECTURE #284).

    A release's file never changes, so what it gives changes only when the staging that
    reads it does — Milestone 34 stopped staging 186 open-bracket bounds as medians. A
    row citing a release this load staged, and absent from what it staged, is therefore
    stale. Releases this load did not stage are left alone: a source skipped or failing
    this run withdraws nothing. The deletion trigger (migration 0021) records each one
    in `fact_revision`.
    """
    if not loaded:
        return 0
    conn.execute(
        text(
            "CREATE TEMP TABLE staged_keys (geoid text, level text, metric_id text, "
            "period_start date) ON COMMIT DROP"
        )
    )
    keys = [
        {
            "geoid": row["geoid"],
            "level": row["level"],
            "metric_id": row["metric_id"],
            "period_start": row["period_start"],
        }
        for row in payload
    ]
    for start_index in range(0, len(keys), 5000):
        conn.execute(
            text(
                "INSERT INTO staged_keys VALUES "
                "(:geoid, :level, :metric_id, :period_start)"
            ),
            keys[start_index : start_index + 5000],
        )
    return int(
        conn.execute(
            text(
                """
                DELETE FROM fact_metric_observation f
                WHERE f.release_id = ANY(:loaded)
                  AND NOT EXISTS (
                      SELECT 1 FROM staged_keys k
                      JOIN regions r
                        ON r.geoid = k.geoid AND r.level = CAST(k.level AS region_level)
                      WHERE r.region_id = f.region_id AND k.metric_id = f.metric_id
                        AND k.period_start = f.period_start
                  )
                """
            ),
            {"loaded": sorted(loaded)},
        ).rowcount
    )


def load_income_limits(
    engine: Engine,
    duckdb_path: Path,
    *,
    staging_table: str = "main_staging.stg_hud_income_limit_lines",
) -> int:
    """Replace `income_limits` from the staged lines (Milestone 35, ARCHITECTURE #285).

    Replaced whole rather than upserted: each line comes from an immutable release, so
    the staged set is the full truth, and a line HUD stopped publishing should leave.
    Each row cites the release it came from, found by its exact (source, layer,
    vintage); a line whose release is not in the warehouse is dropped rather than
    loaded uncited. Returns 0, changing nothing, when the model has not been staged.
    """
    schema, table = staging_table.split(".")
    with duckdb_session(duckdb_path) as duck:
        staged = {
            row[0]
            for row in duck.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
                [schema],
            ).fetchall()
        }
        if table not in staged:
            return 0
        rows = duck.execute(
            f"""
            SELECT geoid, fiscal_year, band, household_size, income_limit,
                   median_income, source_id, release_layer, release_vintage
            FROM {staging_table}
            """
        ).fetchall()

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM income_limits"))
        conn.execute(
            text(
                """
                INSERT INTO income_limits
                    (region_id, fiscal_year, band, household_size, income_limit,
                     median_income, release_id)
                SELECT r.region_id, :fiscal_year, :band, :household_size,
                       :income_limit, :median_income, sr.release_id
                FROM regions r
                JOIN LATERAL (
                    SELECT release_id FROM source_releases
                    WHERE source_id = :source_id AND layer = :layer
                      AND vintage = :vintage
                    ORDER BY fetched_at DESC LIMIT 1
                ) sr ON true
                WHERE r.level = 'county' AND r.geoid = :geoid
                """
            ),
            [
                {
                    "geoid": geoid,
                    "fiscal_year": int(year),
                    "band": int(band),
                    "household_size": int(size),
                    "income_limit": float(limit),
                    "median_income": None if median is None else float(median),
                    "source_id": source_id,
                    "layer": layer,
                    "vintage": vintage,
                }
                for (
                    geoid,
                    year,
                    band,
                    size,
                    limit,
                    median,
                    source_id,
                    layer,
                    vintage,
                ) in rows
            ],
        )
        return int(conn.execute(text("SELECT count(*) FROM income_limits")).scalar_one())


def load_water_systems(
    engine: Engine,
    duckdb_path: Path,
    *,
    staging_table: str = "main_staging.stg_water_systems",
) -> int:
    """Replace `water_systems` from the staged list (Milestone 40, ARCHITECTURE #304).

    Replaced whole, as `income_limits` is. Each row cites the newest SDWIS violations
    release; a region the warehouse does not hold is dropped. Returns 0, changing
    nothing, when the model has not been staged.
    """
    schema, table = staging_table.split(".")
    with duckdb_session(duckdb_path) as duck:
        staged = {
            row[0]
            for row in duck.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
                [schema],
            ).fetchall()
        }
        if table not in staged:
            return 0
        rows = duck.execute(
            f"""
            SELECT geoid, level, pwsid, system_name, homes, share_of_homes, violations,
                   first_year, last_year, latest_violation, latest_violation_what,
                   violation_kinds, release_vintage
            FROM {staging_table}
            """
        ).fetchall()

    keys = (
        "geoid",
        "level",
        "pwsid",
        "name",
        "homes",
        "share",
        "violations",
        "first_year",
        "last_year",
        "latest",
        "latest_what",
        "kinds",
        "vintage",
    )
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM water_systems"))
        conn.execute(
            text(
                """
                INSERT INTO water_systems
                    (region_id, pwsid, name, homes, share_of_homes, violations,
                     first_year, last_year, latest_violation, latest_violation_what,
                     violation_kinds, release_id)
                SELECT r.region_id, :pwsid, :name, :homes, :share, :violations,
                       :first_year, :last_year, :latest, :latest_what, :kinds,
                       sr.release_id
                FROM regions r
                JOIN LATERAL (
                    SELECT release_id FROM source_releases
                    WHERE source_id = 'epa_sdwis' AND layer = 'violations'
                      AND vintage = :vintage
                    ORDER BY fetched_at DESC LIMIT 1
                ) sr ON true
                WHERE r.level = CAST(:level AS region_level) AND r.geoid = :geoid
                """
            ),
            [dict(zip(keys, row, strict=True)) for row in rows],
        )
        return int(conn.execute(text("SELECT count(*) FROM water_systems")).scalar_one())


def load_affordable_housing(
    engine: Engine, duckdb_path: Path, *, releases: Sequence[ReleaseProvenance]
) -> int:
    """Replace each fully staged inventory atomically, refusing uncited/unlocated rows.

    Ancillary inventories do not go through the metric gate. Unlike silently dropping
    an unresolvable property, an invalid row here aborts and preserves the old inventory.
    Missing models leave their source's previously loaded data alone.
    """
    staged_rows: list[tuple[str, list[dict[str, object]]]] = []
    with duckdb_session(duckdb_path) as duck:
        tables = {
            r[0]
            for r in duck.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'main_staging'"
            ).fetchall()
        }
        for source in ("nj_affordable", "hud_assisted", "hud_lihtc"):
            model = f"stg_{source}_records"
            if model not in tables:
                continue
            result = duck.execute(
                "SELECT source_id, record_id, geoid, level, kind, payload, snapshot, "
                f"release_layer, release_vintage FROM main_staging.{model}"
            )
            keys = [c[0] for c in result.description]
            rows = [dict(zip(keys, row, strict=True)) for row in result.fetchall()]
            if not rows or any(not r["geoid"] for r in rows):
                raise ValueError(f"{source}: empty inventory or unmapped municipality")
            for row in rows:
                payload = json.loads(str(row["payload"]))
                for field in (
                    "units",
                    "low_income_units",
                    "present_need",
                    "prospective_need",
                ):
                    value = payload.get(field)
                    if value is not None and (not math.isfinite(value) or value < 0):
                        raise ValueError(f"{source}/{row['record_id']}: invalid {field}")
            staged_rows.append((source, rows))
    loaded = 0
    with engine.begin() as conn:
        # Bind rows to this run's exact content hash, not the most recently fetched
        # version of a mutable URL. A newer failed acquisition must not steal credit
        # for the previous staged file (the same safeguard the metric loader uses).
        release_ids = _release_ids(conn, releases)
        for source, rows in staged_rows:
            for row in rows:
                key = (source, str(row["release_layer"]), str(row["release_vintage"]))
                if key not in release_ids:
                    raise ValueError(
                        f"{source}/{row['record_id']}: missing exact release"
                    )
                row["release_id"] = release_ids[key]
        for source, rows in staged_rows:
            conn.execute(
                text("DELETE FROM affordable_housing_records WHERE source_id = :s"),
                {"s": source},
            )
            for row in rows:
                count = conn.execute(
                    text("""
                    INSERT INTO affordable_housing_records
                        (region_id, source_id, kind, record_id, payload, snapshot,
                         release_id)
                    SELECT r.region_id, :source_id, :kind, :record_id,
                           CAST(:payload AS jsonb), :snapshot, :release_id
                    FROM regions r
                    WHERE r.geoid = :geoid AND r.level = CAST(:level AS region_level)
                """),
                    row,
                ).rowcount
                if count != 1:
                    raise ValueError(
                        f"{source}/{row['record_id']}: missing region or release"
                    )
                loaded += 1
    return loaded


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
) -> dict[ReleaseKey, int]:
    """Map (source_id, layer, vintage) to the release row just inserted for it.

    Keyed on all three because two of them are not enough: `(source, layer)` collapses
    a source's vintages onto one release, which is the defect ARCHITECTURE #47 records.
    """
    if not releases:
        return {}
    duplicated = [
        key
        for key, count in Counter(
            (r.source_id, r.layer, r.vintage) for r in releases
        ).items()
        if count > 1
    ]
    if duplicated:
        raise ReleaseAttributionError(
            f"More than one cached release for the same (source, layer, vintage): "
            f"{sorted(duplicated)[:5]}"
        )
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


def _historical_release_candidates(
    conn: Any, missing: set[ReleaseKey]
) -> list[tuple[str, str, str, int]]:
    """Find exact older releases no longer enumerated by the current adapter window.

    Loading from the existing registry is safe only when one release has the required
    key. If several versions exist, the staged row has no file hash to choose between
    them, and the resolver below fails instead of guessing.
    """
    sources = sorted({source for source, _, _ in missing})
    rows = conn.execute(
        text(
            "SELECT source_id, layer, vintage, release_id FROM source_releases "
            "WHERE source_id = ANY(CAST(:source_ids AS text[]))"
        ),
        {"source_ids": sources},
    ).fetchall()
    return [
        (str(source), str(layer), str(vintage), int(release_id))
        for source, layer, vintage, release_id in rows
        if (str(source), str(layer), str(vintage)) in missing
    ]


def _resolve_fact_release_ids(
    current: Mapping[ReleaseKey, int],
    needed: Mapping[ReleaseKey, int],
    historical: Sequence[tuple[str, str, str, int]],
) -> dict[ReleaseKey, int]:
    """Resolve every staged key exactly, preferring this run's fetched file.

    A source-only or layer-only fallback is never provenance: it can cite another
    survey edition as the file that supplied a row. An error here happens before any
    fact upsert, so `engine.begin()` rolls back the source and metric upserts too.
    """
    resolved = dict(current)
    candidates: dict[ReleaseKey, list[int]] = {}
    for source, layer, vintage, release_id in historical:
        key = (source, layer, vintage)
        if key in needed and key not in resolved:
            candidates.setdefault(key, []).append(release_id)

    problems: list[tuple[ReleaseKey, int, int]] = []
    for key, count in needed.items():
        if key in resolved:
            continue
        matches = candidates.get(key, [])
        if len(matches) == 1:
            resolved[key] = matches[0]
        else:
            problems.append((key, count, len(matches)))

    if problems:
        examples = ", ".join(
            f"{source}/{layer}/{vintage}: {count} rows, {matches} releases"
            for (source, layer, vintage), count, matches in sorted(problems)[:5]
        )
        more = f" (+{len(problems) - 5} more keys)" if len(problems) > 5 else ""
        raise ReleaseAttributionError(
            f"Cannot load {sum(count for _, count, _ in problems)} observations: "
            f"{len(problems)} (source, layer, vintage) keys have no unique exact "
            f"release. {examples}{more}. No facts were written; restore the matching "
            "release or remove stale staged rows."
        )
    return resolved


def _upsert_metrics(conn: Any, metrics: Sequence[MetricRecord]) -> None:
    if not metrics:
        return
    conn.execute(
        text(
            """
            INSERT INTO metrics
                (metric_id, label, unit, frequency, direction, description, source_id,
                 record_type, licence_class, originator)
            VALUES
                (:metric_id, :label, :unit, :frequency, :direction, :description,
                 :source_id, :record_type, :licence_class, :originator)
            ON CONFLICT (metric_id) DO UPDATE SET
                label = EXCLUDED.label, unit = EXCLUDED.unit,
                frequency = EXCLUDED.frequency, direction = EXCLUDED.direction,
                description = EXCLUDED.description, source_id = EXCLUDED.source_id,
                record_type = EXCLUDED.record_type,
                licence_class = EXCLUDED.licence_class,
                originator = EXCLUDED.originator
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
