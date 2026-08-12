"""Allocation weights between geographies that do not nest.

ZIP Code Tabulation Areas are approximations of mail routes. They cross municipal and
county lines and belong to no hierarchy, so a ZIP-level value can only be expressed at
another level by allocating it. This module computes those allocation weights once, so
every downstream metric allocates the same way and the method travels with the data.

Two methods, in preference order. **HUD residential-address ratios** are used wherever
HUD covers the ZIP: they weight by the share of a ZIP's dwellings in each target, which
is what a household-based measure should be allocated on. **Area weighting** is the
fallback, computed here from the geometry, and it assumes a metric is spread evenly
across a ZIP's surface — which counts a golf course like a subdivision.

``method`` records which was used for every row. It cannot record *both* for one pair:
`region_crosswalk` is keyed on (from_region_id, to_region_id), so HUD supersedes area
rather than sitting beside it.
"""

from __future__ import annotations

from dataclasses import dataclass

import duckdb

# NAD83 / Conus Albers. Equal-area, so intersection ratios are true area ratios.
# Computing on raw 4269 degrees would make a degree of longitude shrink with latitude
# and quietly bias every weight.
EQUAL_AREA_CRS = "EPSG:5070"
SOURCE_CRS = "EPSG:4269"

# Boundary lines drawn independently never align perfectly; intersections below this
# share are cartographic slivers, not real overlap. Dropped, then weights renormalized.
SLIVER_THRESHOLD = 0.001

CROSSWALK_TABLE = "stg_region_crosswalk"


@dataclass(frozen=True)
class CrosswalkCounts:
    rows: int
    sources: int
    max_weight_error: float


def build_crosswalk(
    con: duckdb.DuckDBPyConnection, *, staging_table: str = "stg_regions"
) -> CrosswalkCounts:
    """Build ZIP → municipality and ZIP → county weights from ``stg_regions``."""
    con.execute(
        f"""
        CREATE OR REPLACE TEMP TABLE xw_geo AS
        SELECT geoid, level,
               ST_Transform(ST_GeomFromWKB(geom_wkb),
                            '{SOURCE_CRS}', '{EQUAL_AREA_CRS}') AS g
        FROM {staging_table}
        WHERE level IN ('zip', 'municipality', 'county')
        """
    )

    con.execute(f"DROP TABLE IF EXISTS {CROSSWALK_TABLE}")
    con.execute(
        f"""
        CREATE TABLE {CROSSWALK_TABLE} AS
        WITH pairs AS (
            SELECT z.geoid AS from_geoid,
                   'zip'   AS from_level,
                   t.geoid AS to_geoid,
                   t.level AS to_level,
                   ST_Area(ST_Intersection(z.g, t.g)) AS inter_area
            FROM xw_geo z
            JOIN xw_geo t
              ON t.level <> 'zip'
             AND ST_Intersects(z.g, t.g)
            WHERE z.level = 'zip'
        ),
        shares AS (
            SELECT *,
                   inter_area / NULLIF(
                       SUM(inter_area) OVER (PARTITION BY from_geoid, to_level), 0
                   ) AS raw_weight
            FROM pairs
            WHERE inter_area > 0
        ),
        kept AS (
            SELECT * FROM shares WHERE raw_weight >= {SLIVER_THRESHOLD}
        )
        SELECT from_geoid, from_level, to_geoid, to_level,
               raw_weight / SUM(raw_weight) OVER (PARTITION BY from_geoid, to_level)
                   AS weight,
               'area' AS method
        FROM kept
        """
    )

    stats = con.execute(
        f"""
        WITH totals AS (
            SELECT from_geoid, to_level, SUM(weight) AS total
            FROM {CROSSWALK_TABLE} GROUP BY 1, 2
        )
        SELECT (SELECT count(*) FROM {CROSSWALK_TABLE}),
               (SELECT count(DISTINCT from_geoid) FROM {CROSSWALK_TABLE}),
               COALESCE(MAX(ABS(total - 1.0)), 0)
        FROM totals
        """
    ).fetchone()

    if stats is None:  # aggregate over an empty table still returns a row
        raise ValueError("crosswalk statistics query returned nothing")

    counts = CrosswalkCounts(
        rows=int(stats[0]), sources=int(stats[1]), max_weight_error=float(stats[2])
    )
    if counts.max_weight_error > 1e-9:
        raise ValueError(
            f"crosswalk weights do not sum to 1.0 per (from_geoid, to_level); "
            f"worst error {counts.max_weight_error}. Allocation would leak or "
            f"double-count values."
        )
    return counts


def apply_hud_weights(
    con: duckdb.DuckDBPyConnection,
    *,
    staging_schema: str,
    model: str = "stg_hud_crosswalk",
) -> tuple[int, int]:
    """Supersede area weights with HUD residential-address weights where available.

    Area weighting assumes a metric is spread evenly across a ZIP's surface, which is
    wrong for housing: it counts a golf course like a subdivision. HUD publishes the
    share of each ZIP's *residential addresses* per target geography, which is what a
    household-based measure should be allocated on.

    Superseding rather than coexisting is forced by the schema: `region_crosswalk` is
    keyed on (from_region_id, to_region_id), so a pair can hold exactly one method.
    ARCHITECTURE #26 anticipated both methods living side by side; the primary key does
    not allow it. Area weights survive only for ZIPs HUD does not cover, and `method`
    still records which was used for every row.

    Returns (HUD rows, total rows) — the caller cannot reuse the count from
    ``build_crosswalk``, which was measured before this ran.
    """
    con.execute(
        f"""
        DELETE FROM {CROSSWALK_TABLE}
        WHERE EXISTS (
            SELECT 1 FROM {staging_schema}.{model} h
            WHERE h.from_geoid = {CROSSWALK_TABLE}.from_geoid
              AND h.to_level = {CROSSWALK_TABLE}.to_level
        )
        """
    )

    con.execute(
        f"""
        INSERT INTO {CROSSWALK_TABLE}
        SELECT from_geoid, from_level, to_geoid, to_level,
               raw_weight / SUM(raw_weight) OVER (PARTITION BY from_geoid, to_level),
               method
        FROM {staging_schema}.{model} h
        -- Only targets that exist in scope; HUD covers geographies we do not load.
        WHERE EXISTS (
            SELECT 1 FROM stg_regions r
            WHERE r.geoid = h.to_geoid AND r.level = h.to_level
        )
        AND EXISTS (
            SELECT 1 FROM stg_regions z
            WHERE z.geoid = h.from_geoid AND z.level = 'zip'
        )
        """
    )
    row = con.execute(
        f"""
        SELECT count(*) FILTER (WHERE method = 'hud_res_ratio'), count(*)
        FROM {CROSSWALK_TABLE}
        """
    ).fetchone()
    return (int(row[0]), int(row[1])) if row else (0, 0)
