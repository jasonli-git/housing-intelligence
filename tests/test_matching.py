"""Resolving source geography keys to regions.

The fixture encodes the four cases that actually occur in New Jersey, three of which
were found the hard way:

- a plain municipality that matches once normalization strips the legal form
- **Chatham Borough / Chatham Township** — two municipalities sharing a name inside one
  county, which no name+county key can separate
- **Florence / Florence Township** — two *source* rows collapsing onto one key once the
  legal form is stripped. Matching them produced two conflicting values for the same
  month, which the validation gate caught. Real NJ examples of the same shape include
  Boonton vs Boonton Township and Egg Harbor City vs Egg Harbor Township, where the two
  source rows are genuinely different municipalities.
- a census-designated place that is not a municipality at all
"""

from __future__ import annotations

import duckdb
import pytest

from hip.geography.matching import (
    OBSERVATION_TABLE,
    REJECT_TABLE,
    build_observations,
)

STAGING = "main_staging"
MODELS = {"stg_zillow_zhvi": "zhvi_sfr"}


@pytest.fixture
def con() -> duckdb.DuckDBPyConnection:
    c = duckdb.connect()
    c.execute("""
        CREATE TABLE stg_regions (
            geoid VARCHAR, level VARCHAR, name VARCHAR, state_code VARCHAR,
            parent_geoid VARCHAR, parent_level VARCHAR
        )""")
    c.execute("""
        INSERT INTO stg_regions VALUES
          ('34',         'state',        'New Jersey', 'NJ', NULL, NULL),
          ('34021',      'county',       'Mercer',     'NJ', '34', 'state'),
          ('34027',      'county',       'Morris',     'NJ', '34', 'state'),
          ('34005',      'county',       'Burlington', 'NJ', '34', 'state'),
          ('3402119780', 'municipality', 'East Windsor','NJ','34021','county'),
          ('3402712345', 'municipality', 'Chatham',    'NJ', '34027', 'county'),
          ('3402767890', 'municipality', 'Chatham',    'NJ', '34027', 'county'),
          ('3400523400', 'municipality', 'Florence',   'NJ', '34005', 'county'),
          ('08520',      'zip',          '08520',      'NJ', NULL, NULL)
    """)
    c.execute(f"CREATE SCHEMA {STAGING}")
    c.execute(f"""
        CREATE TABLE {STAGING}.stg_zillow_zhvi (
            source_id VARCHAR, layer VARCHAR, region_name VARCHAR,
            fips_key VARCHAR, county_name VARCHAR, state_code VARCHAR,
            period_start DATE, value DOUBLE
        )""")
    jan = "DATE '2025-01-31'"
    rows = [
        ("county", "Mercer County", "'34021'", "NULL", 400000),
        ("county", "Nowhere County", "'99999'", "NULL", 1),
        ("city", "East Windsor", "NULL", "'Mercer County'", 450000),
        ("city", "Chatham", "NULL", "'Morris County'", 900000),
        ("city", "Florence", "NULL", "'Burlington County'", 500000),
        ("city", "Florence Township", "NULL", "'Burlington County'", 800000),
        ("city", "Iselin", "NULL", "'Middlesex County'", 600000),
        ("zip", "08520", "NULL", "'Mercer County'", 470000),
        ("zip", "99999", "NULL", "'Nowhere County'", 1),
    ]
    values = ",\n".join(
        f"('zillow_zhvi','{layer}','{name}',{fips},{county},'NJ',{jan},{value})"
        for layer, name, fips, county, value in rows
    )
    c.execute(f"INSERT INTO main_staging.stg_zillow_zhvi VALUES {values}")
    build_observations(c, staged_models=MODELS, staging_schema=STAGING)
    return c


def _geoids(con: duckdb.DuckDBPyConnection, level: str) -> set[str]:
    return {
        row[0]
        for row in con.execute(
            f"SELECT geoid FROM {OBSERVATION_TABLE} WHERE level = ?", [level]
        ).fetchall()
    }


def _reasons(con: duckdb.DuckDBPyConnection, name: str) -> str:
    row = con.execute(
        f"SELECT reason FROM {REJECT_TABLE} WHERE region_name = ?", [name]
    ).fetchone()
    return str(row[0]) if row else ""


def test_county_matches_on_fips(con: duckdb.DuckDBPyConnection) -> None:
    assert _geoids(con, "county") == {"34021"}


def test_zip_matches_on_code(con: duckdb.DuckDBPyConnection) -> None:
    assert _geoids(con, "zip") == {"08520"}


def test_municipality_matches_after_normalizing(con: duckdb.DuckDBPyConnection) -> None:
    assert "3402119780" in _geoids(con, "municipality")


def test_match_method_is_recorded_per_level(con: duckdb.DuckDBPyConnection) -> None:
    """A consumer must be able to exclude name-matched rows without redoing the join."""
    methods = dict(
        con.execute(
            f"SELECT level, any_value(match_method) FROM {OBSERVATION_TABLE} GROUP BY 1"
        ).fetchall()
    )

    assert methods == {
        "county": "fips",
        "zip": "zip_code",
        "municipality": "name_county",
    }


def test_two_municipalities_sharing_a_name_are_rejected(
    con: duckdb.DuckDBPyConnection,
) -> None:
    """Chatham Borough and Chatham Township — unresolvable, so neither is guessed."""
    assert "3402712345" not in _geoids(con, "municipality")
    assert "3402767890" not in _geoids(con, "municipality")
    assert "multiple municipalities" in _reasons(con, "Chatham")


def test_two_source_rows_collapsing_onto_one_key_are_rejected(
    con: duckdb.DuckDBPyConnection,
) -> None:
    """Only one Florence municipality exists, but Zillow ships two rows for it.

    Without this rejection the loader wrote two different values for the same
    (region, metric, month) and the validation gate blocked the whole release.
    """
    assert "3400523400" not in _geoids(con, "municipality")
    assert "legal form" in _reasons(con, "Florence Township")
    assert "legal form" in _reasons(con, "Florence")


def test_census_designated_places_are_rejected_with_an_explanation(
    con: duckdb.DuckDBPyConnection,
) -> None:
    assert "census-designated place" in _reasons(con, "Iselin")


def test_out_of_scope_geographies_are_rejected(con: duckdb.DuckDBPyConnection) -> None:
    assert "not in scope" in _reasons(con, "Nowhere County")
    assert "no ZCTA in scope" in _reasons(con, "99999")


def test_no_duplicate_observations_are_produced(
    con: duckdb.DuckDBPyConnection,
) -> None:
    """The invariant the warehouse primary key depends on."""
    duplicates = con.execute(
        f"""
        SELECT count(*) FROM (
            SELECT geoid, level, metric_id, period_start
            FROM {OBSERVATION_TABLE} GROUP BY 1,2,3,4 HAVING count(*) > 1
        )
        """
    ).fetchone()

    assert duplicates == (0,)


def test_period_covers_the_whole_month(con: duckdb.DuckDBPyConnection) -> None:
    """Zillow labels a month by its last day; the warehouse stores the span."""
    row = con.execute(
        f"SELECT period_start, period_end FROM {OBSERVATION_TABLE} LIMIT 1"
    ).fetchone()

    assert row is not None
    assert str(row[0]) == "2025-01-01"
    assert str(row[1]) == "2025-01-31"
