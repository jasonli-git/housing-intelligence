"""The staging gate, entirely in memory; no warehouse or publisher involved."""

import json
from pathlib import Path

import duckdb
import pytest

from hip.geography.matching import OBSERVATION_TABLE, REJECT_TABLE, _norm
from hip.validate.gate import MIN_COVERAGE, VALUE_BOUNDS, run_checks, write_report


@pytest.fixture
def con():
    with duckdb.connect() as c:
        c.execute("CREATE TABLE stg_regions(geoid VARCHAR, level VARCHAR)")
        c.execute(f"CREATE TABLE {REJECT_TABLE}(name VARCHAR)")
        c.execute(f"""CREATE TABLE {OBSERVATION_TABLE} (
            geoid VARCHAR, level VARCHAR, metric_id VARCHAR,
            period_start DATE, value DOUBLE)""")
        for level in MIN_COVERAGE:
            c.execute("INSERT INTO stg_regions VALUES (?, ?)", [level, level])
            c.execute(
                f"INSERT INTO {OBSERVATION_TABLE} "
                "VALUES (?, ?, 'acs_population', ?, 100)",
                [level, level, "2025-01-01"],
            )
        assert run_checks(c).passed
        yield c


def refused(con, name, detail):
    report = run_checks(con)
    assert not report.passed
    failed = {check.name: check for check in report.failures()}
    assert name in failed
    assert detail in failed[name].detail
    return failed[name]


def test_empty_staging_is_refused(con):
    con.execute(f"DELETE FROM {OBSERVATION_TABLE}")
    refused(con, "observations_present", "nothing staged")


def test_duplicate_region_metric_month_is_refused(con):
    con.execute(f"INSERT INTO {OBSERVATION_TABLE} SELECT * FROM {OBSERVATION_TABLE}")
    assert refused(con, "no_duplicate_observations", "one value per").count == 3


def test_normalized_distinct_municipalities_cannot_load_as_one(con):
    # Reproduce the old join output, not today's matcher (which now rejects it).
    # Real distinct places: Egg Harbor City and Egg Harbor Township. Both suffixes
    # normalize to the same name; a former name-only join assigned one region twice.
    names = con.execute(
        f"SELECT {_norm('name')} FROM (VALUES ('Egg Harbor City'), "
        "('Egg Harbor Township')) source(name)"
    ).fetchall()
    assert names == [("egg harbor",), ("egg harbor",)]
    for value in (300000, 450000):
        con.execute(
            f"INSERT INTO {OBSERVATION_TABLE} VALUES "
            "('municipality', 'municipality', 'zhvi_sfr', '2025-01-01', ?)",
            [value],
        )
    assert refused(con, "no_duplicate_observations", "one value per").count == 1


def test_key_includes_level_metric_and_period(con):
    con.execute(f"""INSERT INTO {OBSERVATION_TABLE} VALUES
        ('county', 'county', 'zhvi_sfr', '2025-01-01', 300000),
        ('county', 'county', 'zhvi_sfr', '2025-02-01', 300000)""")
    assert run_checks(con).passed


def test_orphan_refused_even_when_geoid_exists_at_another_level(con):
    con.execute(f"""INSERT INTO {OBSERVATION_TABLE} VALUES
        ('county', 'zip', 'acs_population', '2025-01-01', 100)""")
    refused(con, "every_observation_has_a_region", "does not exist")


def test_national_observations_do_not_need_a_tiger_region(con):
    con.execute(f"""INSERT INTO {OBSERVATION_TABLE} VALUES
        ('US', 'nation', 'mortgage_rate_30y', '2025-01-01', 6)""")
    assert run_checks(con).passed


@pytest.mark.parametrize("metric", VALUE_BOUNDS)
@pytest.mark.parametrize("side", ["low", "high"])
def test_every_range_inclusive_boundary_and_absolute_tolerance(con, metric, side):
    low, high = VALUE_BOUNDS[metric]
    boundary = low if side == "low" else high
    bad = low - 1 if side == "low" else high + 1
    con.execute(
        f"INSERT INTO {OBSERVATION_TABLE} "
        "SELECT 'US', 'nation', ?, DATE '2020-01-01' + i::INTEGER, ? "
        "FROM range(6) r(i)",
        [metric, boundary],
    )
    assert run_checks(con).passed
    con.execute(
        f"UPDATE {OBSERVATION_TABLE} SET value=? WHERE metric_id=? AND level='nation' "
        "AND period_start < DATE '2020-01-06'",
        [bad, metric],
    )
    assert run_checks(con).passed, "five suspect values are tolerated"
    con.execute(
        f"UPDATE {OBSERVATION_TABLE} SET value=? WHERE metric_id=? AND level='nation'",
        [bad, metric],
    )
    assert refused(con, f"{metric}_within_range", "tolerance 5").count == 6


def test_range_share_tolerance_scales_with_metric_not_whole_load(con):
    con.execute(f"""INSERT INTO {OBSERVATION_TABLE}
        SELECT 'US', 'nation', 'zhvi_sfr', DATE '1990-01-01' + i::INTEGER,
               CASE WHEN i < 6 THEN 0 ELSE 300000 END FROM range(6000) r(i)""")
    assert run_checks(con).passed  # six of 6,000, rather than the absolute five
    con.execute(f"""UPDATE {OBSERVATION_TABLE} SET value=0
        WHERE metric_id='zhvi_sfr' AND period_start=DATE '1990-01-07'""")
    refused(con, "zhvi_sfr_within_range", "tolerance 6")


@pytest.mark.parametrize("level,floor", MIN_COVERAGE.items())
def test_coverage_floor_exactly_passes_then_collapse_is_refused(con, level, floor):
    con.execute("DELETE FROM stg_regions WHERE level=?", [level])
    con.execute(f"DELETE FROM {OBSERVATION_TABLE} WHERE level=?", [level])
    for i in range(10):
        con.execute("INSERT INTO stg_regions VALUES (?, ?)", [str(i), level])
        if i < int(floor * 10):
            con.execute(
                f"INSERT INTO {OBSERVATION_TABLE} "
                "VALUES (?, ?, 'acs_population', ?, 100)",
                [str(i), level, "2025-01-01"],
            )
    assert run_checks(con).passed
    # Extra months must not inflate the number of covered regions.
    con.execute(
        f"INSERT INTO {OBSERVATION_TABLE} SELECT geoid, level, metric_id, "
        f"DATE '2025-02-01', value FROM {OBSERVATION_TABLE} WHERE level=?",
        [level],
    )
    con.execute(f"DELETE FROM {OBSERVATION_TABLE} WHERE level=? AND geoid='0'", [level])
    refused(con, f"{level}_coverage", "floor")


@pytest.mark.parametrize("level", MIN_COVERAGE)
def test_missing_region_level_is_a_coverage_failure(con, level):
    con.execute("DELETE FROM stg_regions WHERE level=?", [level])
    con.execute(f"DELETE FROM {OBSERVATION_TABLE} WHERE level=?", [level])
    refused(con, f"{level}_coverage", "0/0")


def test_rejects_are_informational_and_reports_persist_failures(con, tmp_path: Path):
    con.execute(f"INSERT INTO {REJECT_TABLE} VALUES ('unmatched CDP')")
    report = run_checks(con)
    assert report.passed
    check = next(c for c in report.checks if c.name == "unresolved_geographies_recorded")
    assert check.passed and check.count == 1
    assert "source_match_reject" in check.detail
    assert report.failures() == []
    con.execute(f"DELETE FROM {OBSERVATION_TABLE}")
    report = run_checks(con)
    path = write_report(report, tmp_path / "reports")
    saved = json.loads(path.read_text())
    assert saved["passed"] is False and saved["observations"] == 0
    assert any(
        c["name"] == "observations_present" and not c["passed"] for c in saved["checks"]
    )


def test_custom_region_table(con):
    con.execute("ALTER TABLE stg_regions RENAME TO custom_regions")
    assert run_checks(con, regions_table="custom_regions").passed
