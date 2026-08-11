"""Region derivation and crosswalk construction.

Runs the real SQL against a synthetic state built from scratch, so the 635MB TIGER
download is not a prerequisite for testing the logic that consumes it. Coordinates sit
in southern New Jersey's actual lon/lat range so the EPSG:5070 reprojection in the
crosswalk is exercised where it is valid, not somewhere off West Africa.

Geography of the fixture — a 2x1 degree state split into two counties, each split into
two municipalities:

    lat 40 ┌─────────────┬─────────────┐
           │   muni A    │   muni C    │
    lat 39.5├────────────┼─────────────┤   county 1 = left, county 2 = right
           │   muni B    │   muni D    │
    lat 39 └─────────────┴─────────────┘
         lon -75      lon -74.5     lon -74
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import pytest

from hip.config import GeographyScope
from hip.duck import duckdb_session
from hip.geography.crosswalk import CROSSWALK_TABLE, build_crosswalk
from hip.geography.regions import STAGING_TABLE, build_regions

VINTAGE = "2025"


def _box(lon0: float, lat0: float, lon1: float, lat1: float) -> str:
    return (
        f"POLYGON(({lon0} {lat0}, {lon1} {lat0}, {lon1} {lat1}, "
        f"{lon0} {lat1}, {lon0} {lat0}))"
    )


def _write(con: duckdb.DuckDBPyConnection, path: Path, select: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY ({select}) TO '{path}' (FORMAT PARQUET)")


@pytest.fixture
def parquet_dir(tmp_path: Path) -> Path:
    """Build a synthetic TIGER tier with the exact column names the real files use."""
    root = tmp_path / "parquet"
    base = root / "census_tiger" / VINTAGE

    def wkb(geom: str) -> str:
        return f"ST_AsWKB(ST_Multi(ST_GeomFromText('{geom}')))"

    with duckdb_session(spatial=True) as con:
        _write(
            con,
            base / "state.parquet",
            f"SELECT '99' AS GEOID, 'ZZ' AS STUSPS, 'Teststate' AS NAME, "
            f"{wkb(_box(-75, 39, -74, 40))} AS geom_wkb",
        )
        _write(
            con,
            base / "county.parquet",
            f"""
            SELECT '99001' AS GEOID, 'Left' AS NAME, '99' AS STATEFP,
                   {wkb(_box(-75, 39, -74.5, 40))} AS geom_wkb
            UNION ALL
            SELECT '99002', 'Right', '99', {wkb(_box(-74.5, 39, -74, 40))}
            UNION ALL
            -- A county in a state that is not in scope must be excluded.
            SELECT '88001', 'Elsewhere', '88', {wkb(_box(-80, 39, -79, 40))}
            """,
        )
        _write(
            con,
            base / "cousub_ZZ.parquet",
            f"""
            SELECT '9900110000' AS GEOID, 'Muni A' AS NAME, '99' AS STATEFP,
                   '001' AS COUNTYFP, '10000' AS COUSUBFP,
                   {wkb(_box(-75, 39.5, -74.5, 40))} AS geom_wkb
            UNION ALL
            SELECT '9900120000', 'Muni B', '99', '001', '20000',
                   {wkb(_box(-75, 39, -74.5, 39.5))}
            UNION ALL
            SELECT '9900230000', 'Muni C', '99', '002', '30000',
                   {wkb(_box(-74.5, 39.5, -74, 40))}
            UNION ALL
            SELECT '9900240000', 'Muni D', '99', '002', '40000',
                   {wkb(_box(-74.5, 39, -74, 39.5))}
            UNION ALL
            -- Water / "county subdivisions not defined": must be filtered out.
            SELECT '9900100000', 'County subdivisions not defined', '99', '001',
                   '00000', {wkb(_box(-75, 39, -74, 40))}
            """,
        )
        _write(
            con,
            base / "tract_ZZ.parquet",
            f"""
            SELECT '99001000100' AS GEOID, 'Census Tract 1' AS NAMELSAD,
                   '99' AS STATEFP, '001' AS COUNTYFP,
                   {wkb(_box(-75, 39, -74.5, 39.25))} AS geom_wkb
            UNION ALL
            SELECT '99002000200', 'Census Tract 2', '99', '002',
                   {wkb(_box(-74.5, 39, -74, 39.25))}
            """,
        )
        _write(
            con,
            base / "zcta.parquet",
            f"""
            -- Wholly inside Muni A.
            SELECT '10001' AS GEOID20,
                   {wkb(_box(-74.9, 39.6, -74.7, 39.8))} AS geom_wkb
            UNION ALL
            -- Straddles the county line: 50/50 between Muni A and Muni C.
            SELECT '10002', {wkb(_box(-74.6, 39.6, -74.4, 39.8))}
            UNION ALL
            -- Entirely outside the state.
            SELECT '10003', {wkb(_box(-73, 39, -72, 40))}
            UNION ALL
            -- Shares only the western border line: intersects, but with zero area.
            SELECT '10004', {wkb(_box(-75.5, 39.2, -75, 39.4))}
            """,
        )
    return root


@pytest.fixture
def scope() -> GeographyScope:
    return GeographyScope(
        states=["ZZ"],
        levels=["state", "county", "municipality", "zip", "tract"],
        municipality_id_system="census_mcd",
    )


@pytest.fixture
def con(parquet_dir: Path, scope: GeographyScope) -> duckdb.DuckDBPyConnection:
    connection = duckdb.connect()
    connection.execute("INSTALL spatial")
    connection.execute("LOAD spatial")
    build_regions(connection, parquet_dir=parquet_dir, vintage=VINTAGE, scope=scope)
    return connection


def _levels(con: duckdb.DuckDBPyConnection) -> dict[str, int]:
    rows = con.execute(
        f"SELECT level, count(*) FROM {STAGING_TABLE} GROUP BY 1"
    ).fetchall()
    return {str(level): int(n) for level, n in rows}


def test_derives_every_level(con: duckdb.DuckDBPyConnection) -> None:
    assert _levels(con) == {
        "state": 1,
        "county": 2,
        "municipality": 4,
        "tract": 2,
        "zip": 2,
    }


def test_undefined_county_subdivisions_are_excluded(
    con: duckdb.DuckDBPyConnection,
) -> None:
    """COUSUBFP '00000' is water and undefined area, not a municipality."""
    names = con.execute(
        f"SELECT name FROM {STAGING_TABLE} WHERE level = 'municipality'"
    ).fetchall()

    assert not any("not defined" in str(n[0]) for n in names)


def test_out_of_scope_states_are_excluded(con: duckdb.DuckDBPyConnection) -> None:
    assert con.execute(
        f"SELECT count(*) FROM {STAGING_TABLE} WHERE geoid = '88001'"
    ).fetchone() == (0,)


def test_zctas_touching_only_the_border_are_excluded(
    con: duckdb.DuckDBPyConnection,
) -> None:
    """Sharing a boundary line is not overlap; those ZIPs belong to the other state."""
    zips = {
        row[0]
        for row in con.execute(
            f"SELECT geoid FROM {STAGING_TABLE} WHERE level = 'zip'"
        ).fetchall()
    }

    assert zips == {"10001", "10002"}
    assert "10004" not in zips, "zero-area border touch must not create an NJ ZIP"
    assert "10003" not in zips


def test_municipalities_and_tracts_are_siblings_under_county(
    con: duckdb.DuckDBPyConnection,
) -> None:
    """Tracts nest in counties, not municipalities — a tract may cross municipal lines."""
    rows = dict(
        con.execute(
            f"SELECT level, any_value(parent_level) FROM {STAGING_TABLE} "
            f"WHERE level IN ('municipality', 'tract') GROUP BY 1"
        ).fetchall()
    )

    assert rows == {"municipality": "county", "tract": "county"}


def test_parent_geoids_point_at_real_regions(con: duckdb.DuckDBPyConnection) -> None:
    orphans = con.execute(
        f"""
        SELECT count(*) FROM {STAGING_TABLE} c
        WHERE c.parent_geoid IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM {STAGING_TABLE} p
              WHERE p.geoid = c.parent_geoid AND p.level = c.parent_level
          )
        """
    ).fetchone()

    assert orphans == (0,)


def test_zips_and_states_carry_no_parent(con: duckdb.DuckDBPyConnection) -> None:
    assert con.execute(
        f"SELECT count(*) FROM {STAGING_TABLE} "
        f"WHERE level IN ('zip', 'state') AND parent_geoid IS NOT NULL"
    ).fetchone() == (0,)


def test_missing_level_fails_loudly(parquet_dir: Path, scope: GeographyScope) -> None:
    """A silently-empty level would load fine and return an empty API response."""
    (parquet_dir / "census_tiger" / VINTAGE / "tract_ZZ.parquet").unlink()
    empty = GeographyScope(
        states=["ZZ"], levels=["tract"], municipality_id_system="census_mcd"
    )

    with duckdb_session(spatial=True) as connection, pytest.raises(Exception) as exc:
        build_regions(connection, parquet_dir=parquet_dir, vintage=VINTAGE, scope=empty)

    assert "tract" in str(exc.value).lower()


def test_crosswalk_weights_sum_to_one_per_target_level(
    con: duckdb.DuckDBPyConnection,
) -> None:
    build_crosswalk(con)

    worst = con.execute(
        f"""
        SELECT COALESCE(MAX(ABS(total - 1.0)), 0) FROM (
            SELECT from_geoid, to_level, SUM(weight) AS total
            FROM {CROSSWALK_TABLE} GROUP BY 1, 2
        )
        """
    ).fetchone()

    assert worst is not None and worst[0] < 1e-9


def test_contained_zip_allocates_entirely_to_one_municipality(
    con: duckdb.DuckDBPyConnection,
) -> None:
    build_crosswalk(con)

    rows = con.execute(
        f"""
        SELECT to_geoid, weight FROM {CROSSWALK_TABLE}
        WHERE from_geoid = '10001' AND to_level = 'municipality'
        """
    ).fetchall()

    assert len(rows) == 1
    assert rows[0][0] == "9900110000"  # Muni A
    assert rows[0][1] == pytest.approx(1.0)


def test_straddling_zip_splits_between_municipalities(
    con: duckdb.DuckDBPyConnection,
) -> None:
    """The fixture ZIP is centred on the county line, so the split is roughly even.

    Tolerance is 2%, not exact. ST_Transform moves vertices without densifying edges,
    so reprojecting a four-corner box into Albers turns straight lon/lat edges into
    chords and shifts the computed area by about 1%. Real TIGER polygons carry hundreds
    of vertices, where the same effect is negligible — this is a property of the fixture,
    not of the crosswalk.
    """
    build_crosswalk(con)

    rows = dict(
        con.execute(
            f"""
            SELECT to_geoid, weight FROM {CROSSWALK_TABLE}
            WHERE from_geoid = '10002' AND to_level = 'municipality'
            """
        ).fetchall()
    )

    assert set(rows) == {"9900110000", "9900230000"}  # Muni A and Muni C
    assert rows["9900110000"] == pytest.approx(0.5, abs=0.02)
    assert rows["9900230000"] == pytest.approx(0.5, abs=0.02)


def test_crosswalk_covers_every_zip(con: duckdb.DuckDBPyConnection) -> None:
    """A ZIP with no allocation is a region no metric could ever reach."""
    build_crosswalk(con)

    unreachable = con.execute(
        f"""
        SELECT count(*) FROM {STAGING_TABLE} r
        WHERE r.level = 'zip'
          AND NOT EXISTS (
              SELECT 1 FROM {CROSSWALK_TABLE} c WHERE c.from_geoid = r.geoid
          )
        """
    ).fetchone()

    assert unreachable == (0,)
