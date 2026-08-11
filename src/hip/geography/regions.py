"""Derive the region spine from landed TIGER Parquet.

Produces one staging table, ``stg_regions``, holding every in-scope geography at every
level with its parent expressed as a *geoid*, not an id. Surrogate ``region_id`` values
are assigned by Postgres on insert, so the parent link can only be resolved after the
load — carrying ``parent_geoid`` through the staging tier is what makes that possible
without a second pass over the source files.

Hierarchy, as Census actually defines it:

    state → county → municipality
                  └→ tract

Tracts nest within *counties*, not municipalities, and a tract may straddle municipal
boundaries. ZCTAs nest in nothing at all — they are mail routes — so they carry no
parent and reach other levels only through ``region_crosswalk``.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import duckdb

from hip.config import GeographyScope

# TIGER layer -> the region level it produces.
LEVEL_BY_LAYER = {
    "state": "state",
    "county": "county",
    "cousub": "municipality",
    "tract": "tract",
    "zcta": "zip",
}

STAGING_TABLE = "stg_regions"


@dataclass(frozen=True)
class RegionCounts:
    """What the derivation produced, per level. The numbers a test asserts on."""

    by_level: dict[str, int]

    @property
    def total(self) -> int:
        return sum(self.by_level.values())


def _parquet(parquet_dir: Path, vintage: str, layer: str, scope: str | None) -> str:
    name = f"{layer}_{scope}" if scope else layer
    return str(parquet_dir / "census_tiger" / vintage / f"{name}.parquet")


def build_regions(
    con: duckdb.DuckDBPyConnection,
    *,
    parquet_dir: Path,
    vintage: str,
    scope: GeographyScope,
) -> RegionCounts:
    """Build ``stg_regions`` in the given DuckDB connection. Idempotent."""
    states = list(scope.states)
    state_list = ", ".join(f"'{s}'" for s in states)

    # Registered as views so the heavy ZCTA file is never materialized in full.
    con.execute(
        f"CREATE OR REPLACE VIEW src_state AS "
        f"SELECT * FROM read_parquet('{_parquet(parquet_dir, vintage, 'state', None)}')"
    )
    con.execute(
        f"CREATE OR REPLACE VIEW src_county AS "
        f"SELECT * FROM read_parquet('{_parquet(parquet_dir, vintage, 'county', None)}')"
    )
    con.execute(
        f"CREATE OR REPLACE VIEW src_zcta AS "
        f"SELECT * FROM read_parquet('{_parquet(parquet_dir, vintage, 'zcta', None)}')"
    )
    cousub_files = ", ".join(
        f"'{_parquet(parquet_dir, vintage, 'cousub', s)}'" for s in states
    )
    tract_files = ", ".join(
        f"'{_parquet(parquet_dir, vintage, 'tract', s)}'" for s in states
    )
    con.execute(
        f"CREATE OR REPLACE VIEW src_cousub AS "
        f"SELECT * FROM read_parquet([{cousub_files}])"
    )
    con.execute(
        f"CREATE OR REPLACE VIEW src_tract AS SELECT * FROM read_parquet([{tract_files}])"
    )

    # In-scope states only. Everything else joins through this, so scope is applied
    # exactly once rather than repeated per level (#14).
    con.execute(
        f"""
        CREATE OR REPLACE TEMP TABLE scope_state AS
        SELECT GEOID AS statefp, STUSPS AS state_code, NAME AS name, geom_wkb
        FROM src_state
        WHERE STUSPS IN ({state_list})
        """
    )

    con.execute(f"DROP TABLE IF EXISTS {STAGING_TABLE}")
    con.execute(
        f"""
        CREATE TABLE {STAGING_TABLE} (
            geoid        VARCHAR NOT NULL,
            level        VARCHAR NOT NULL,
            name         VARCHAR NOT NULL,
            state_code   VARCHAR NOT NULL,
            parent_geoid VARCHAR,
            parent_level VARCHAR,
            geom_wkb     BLOB    NOT NULL
        )
        """
    )

    con.execute(
        f"""
        INSERT INTO {STAGING_TABLE}
        SELECT statefp, 'state', name, state_code, NULL, NULL, geom_wkb
        FROM scope_state
        """
    )

    con.execute(
        f"""
        INSERT INTO {STAGING_TABLE}
        SELECT c.GEOID, 'county', c.NAME, s.state_code, s.statefp, 'state', c.geom_wkb
        FROM src_county c
        JOIN scope_state s ON c.STATEFP = s.statefp
        """
    )

    # COUSUBFP '00000' marks water and "county subdivisions not defined" records
    # (CLASSFP 'Z9'). Excluding them yields exactly the state's municipality count.
    con.execute(
        f"""
        INSERT INTO {STAGING_TABLE}
        SELECT m.GEOID, 'municipality', m.NAME, s.state_code,
               m.STATEFP || m.COUNTYFP, 'county', m.geom_wkb
        FROM src_cousub m
        JOIN scope_state s ON m.STATEFP = s.statefp
        WHERE m.COUSUBFP <> '00000'
        """
    )

    con.execute(
        f"""
        INSERT INTO {STAGING_TABLE}
        SELECT t.GEOID, 'tract', t.NAMELSAD, s.state_code,
               t.STATEFP || t.COUNTYFP, 'county', t.geom_wkb
        FROM src_tract t
        JOIN scope_state s ON t.STATEFP = s.statefp
        """
    )

    _insert_zctas(con)

    rows = con.execute(
        f"SELECT level, count(*) FROM {STAGING_TABLE} GROUP BY 1"
    ).fetchall()
    counts = RegionCounts(by_level={str(level): int(n) for level, n in rows})
    _assert_scoped_levels(counts, scope)
    return counts


def _insert_zctas(con: duckdb.DuckDBPyConnection) -> None:
    """ZCTAs intersecting an in-scope state, attributed to the state they overlap most.

    The national ZCTA file covers every state, and ZCTAs cross state lines. Assigning
    each to its majority-overlap state keeps `state_code` meaningful without pretending
    the boundary is clean — the minority slice stays reachable through the crosswalk.

    Overlap must have positive *area*. ``ST_Intersects`` is true for geometries that
    merely share a boundary line, which across the Delaware and Hudson pulls in ~57
    Pennsylvania and New York ZCTAs that touch New Jersey without covering any of it.
    Those are not NJ ZIPs, and admitting them would put regions in the warehouse that no
    crosswalk row could ever reference.
    """
    con.execute(
        """
        CREATE OR REPLACE TEMP TABLE zcta_overlap AS
        WITH candidates AS (
            SELECT z.GEOID20 AS geoid,
                   s.state_code,
                   ST_Area(ST_Intersection(
                       ST_GeomFromWKB(z.geom_wkb), ST_GeomFromWKB(s.geom_wkb))) AS overlap
            FROM src_zcta z
            JOIN scope_state s
              ON ST_Intersects(ST_GeomFromWKB(z.geom_wkb), ST_GeomFromWKB(s.geom_wkb))
        )
        SELECT * FROM candidates WHERE overlap > 0
        """
    )
    con.execute(
        f"""
        INSERT INTO {STAGING_TABLE}
        SELECT z.GEOID20, 'zip', z.GEOID20, best.state_code, NULL, NULL, z.geom_wkb
        FROM src_zcta z
        JOIN (
            SELECT geoid, state_code,
                   row_number() OVER (PARTITION BY geoid ORDER BY overlap DESC) AS rn
            FROM zcta_overlap
        ) best ON best.geoid = z.GEOID20 AND best.rn = 1
        """
    )


def _assert_scoped_levels(counts: RegionCounts, scope: GeographyScope) -> None:
    """Every configured level must have produced rows.

    A silently-empty level is the failure mode that matters here: the load would
    succeed, the API would return an empty list, and nothing would look broken.
    """
    missing = [level for level in scope.levels if not counts.by_level.get(level)]
    if missing:
        raise ValueError(
            f"no regions derived for configured level(s): {', '.join(missing)}. "
            f"Got {counts.by_level}. Check that `hip land` ran for every TIGER layer."
        )
