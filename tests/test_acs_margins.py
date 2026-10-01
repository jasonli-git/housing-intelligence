"""ACS margins of error, checked against a second implementation (Milestone 28).

The margins are worked out in SQL macros (`dbt/macros/acs_margins.sql`). These tests
work the same Census formulas out again in plain Python from the landed files and
compare every staged row, so a slip in either shows as a disagreement. Skipped when
nothing is staged.
"""

from __future__ import annotations

import math
from pathlib import Path

import duckdb
import pytest

from hip.config import get_settings

SPECIAL = {"-222222222", "-333333333", "-666666666", "-888888888", "-999999999"}


def _margin(raw: str | None) -> float | None:
    """The published margin, as the macro reads it: codes to NULL, controlled to 0."""
    if raw in (None, ""):
        return None
    if raw == "-555555555":
        return 0.0
    if raw in SPECIAL or str(raw).startswith("-"):
        return None
    return float(raw)


def _share_margin(x: float, y: float, mx: float | None, my: float | None) -> float | None:
    """The Census's approximation for a share X / Y where X is a subset of Y."""
    if y <= 0 or mx is None or my is None:
        return None
    p = x / y
    under = mx**2 - p**2 * my**2
    return math.sqrt(under if under >= 0 else mx**2 + p**2 * my**2) / y


@pytest.fixture(scope="module")
def con() -> duckdb.DuckDBPyConnection:
    settings = get_settings()
    path = settings.duckdb_path
    if not Path(path).exists():
        pytest.skip("no DuckDB warehouse; run `hip stage`")
    connection = duckdb.connect(str(path), read_only=True)
    tables = {
        r[0]
        for r in connection.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'main_staging'"
        ).fetchall()
    }
    if not {"stg_census_acs", "stg_census_acs_housing"} <= tables:
        pytest.skip("ACS is not staged")
    return connection


def _raw(con: duckdb.DuckDBPyConnection, layer: str) -> list[dict[str, str]]:
    parquet = get_settings().parquet_dir / "census_acs" / "2024" / f"{layer}_NJ.parquet"
    if not parquet.exists():
        pytest.skip(f"no landed {parquet.name}")
    cursor = con.execute(f"SELECT * FROM read_parquet('{parquet}')")
    names = [d[0] for d in cursor.description]
    return [dict(zip(names, row, strict=True)) for row in cursor.fetchall()]


def _staged(con: duckdb.DuckDBPyConnection, table: str, metric: str) -> dict[str, tuple]:
    return {
        geoid: (value, margin)
        for geoid, value, margin in con.execute(
            f"SELECT geoid, value, margin_of_error FROM main_staging.{table} "
            "WHERE metric_id = ? AND period_end = DATE '2024-12-31' AND level = 'county'",
            [metric],
        ).fetchall()
    }


def test_renter_cost_burden_and_its_margin_match_the_census_formulas(con) -> None:  # type: ignore[no-untyped-def]
    staged = _staged(con, "stg_census_acs", "acs_renter_cost_burden")
    checked = 0
    for row in _raw(con, "county"):
        geoid = row["state"] + row["county"]
        parts = [float(row[f"B25070_0{n}E"]) for n in ("07", "08", "09", "10")]
        margins = [_margin(row[f"B25070_0{n}M"]) for n in ("07", "08", "09", "10")]
        burdened = sum(parts)
        # Households whose burden was not computed are out of the denominator.
        computed = float(row["B25070_001E"]) - float(row["B25070_011E"])
        m_total, m_not = _margin(row["B25070_001M"]), _margin(row["B25070_011M"])
        m_burdened = (
            None if None in margins else math.sqrt(sum(m**2 for m in margins))  # type: ignore[operator]
        )
        m_computed = (
            None if None in (m_total, m_not) else math.sqrt(m_total**2 + m_not**2)  # type: ignore[operator]
        )
        value, margin = staged[geoid]
        assert value == pytest.approx(burdened / computed)
        assert margin == pytest.approx(
            _share_margin(burdened, computed, m_burdened, m_computed)
        )
        checked += 1
    assert checked == 21


def test_shares_of_the_housing_stock_match_the_census_formulas(con) -> None:  # type: ignore[no-untyped-def]
    vacancy = _staged(con, "stg_census_acs_housing", "acs_vacancy_rate")
    owned = _staged(con, "stg_census_acs_housing", "acs_homeownership_rate")
    for row in _raw(con, "housing_county"):
        geoid = row["state"] + row["county"]
        units, vacant = float(row["B25002_001E"]), float(row["B25002_003E"])
        occupied, owners = float(row["B25003_001E"]), float(row["B25003_002E"])
        assert vacancy[geoid][1] == pytest.approx(
            _share_margin(
                vacant, units, _margin(row["B25002_003M"]), _margin(row["B25002_001M"])
            )
        )
        assert owned[geoid][1] == pytest.approx(
            _share_margin(
                owners, occupied, _margin(row["B25003_002M"]), _margin(row["B25003_001M"])
            )
        )


def test_a_median_carries_its_published_margin_and_a_code_is_never_a_number(con) -> None:  # type: ignore[no-untyped-def]
    staged = {
        geoid: margin
        for geoid, margin in con.execute(
            "SELECT geoid, margin_of_error FROM main_staging.stg_census_acs "
            "WHERE metric_id = 'acs_median_gross_rent' AND period_end = DATE '2024-12-31'"
        ).fetchall()
    }
    coded = 0
    for row in _raw(con, "cousub"):
        if row["county subdivision"] == "00000":
            continue
        geoid = row["state"] + row["county"] + row["county subdivision"]
        coded += row["B25064_001M"] in SPECIAL
        if geoid not in staged:
            continue  # suppressed, or since Milestone 34 an open-ended bracket's bound
        assert staged[geoid] == _margin(row["B25064_001M"])
    # Small towns' rents carry the Census's codes, and none of them became a number.
    assert coded > 0


def _staged_at(
    con: duckdb.DuckDBPyConnection, table: str, metric: str, level: str
) -> dict[str, tuple]:
    return {
        geoid: (value, margin)
        for geoid, value, margin in con.execute(
            f"SELECT geoid, value, margin_of_error FROM main_staging.{table} "
            "WHERE metric_id = ? AND period_end = DATE '2024-12-31' AND level = ?",
            [metric, level],
        ).fetchall()
    }


def _sum(row: dict[str, str], cells: list[str]) -> tuple[float, float | None]:
    """A sum of estimates and its margin: the square root of the summed squares."""
    margins = [_margin(row[f"{c}M"]) for c in cells]
    total = sum(float(row[f"{c}E"]) for c in cells)
    if any(m is None for m in margins):
        return total, None
    return total, math.sqrt(sum(m**2 for m in margins))  # type: ignore[operator]


def _tables_staged(con: duckdb.DuckDBPyConnection) -> None:
    tables = {
        r[0]
        for r in con.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'main_staging'"
        ).fetchall()
    }
    if not {"stg_census_acs_homes", "stg_census_acs_people"} <= tables:
        pytest.skip("Milestone 34's ACS tables are not staged")


def test_the_rental_vacancy_rate_is_the_censuss_and_so_is_its_margin(con) -> None:  # type: ignore[no-untyped-def]
    """Milestone 34: homes for rent over every home renting or for rent, at the ZCTA."""
    _tables_staged(con)
    staged = _staged_at(con, "stg_census_acs_homes", "acs_rental_vacancy_rate", "zip")
    checked = 0
    for row in _raw(con, "vacancy_zcta"):
        geoid = row["zip code tabulation area"]
        if geoid not in staged:
            continue
        x, mx = _sum(row, ["B25004_002"])
        y, my = _sum(row, ["B25003_003", "B25004_003", "B25004_002"])
        value, margin = staged[geoid]
        assert value == pytest.approx(x / y)
        expected = None if mx is None or my is None else _share_margin(x, y, mx, my)
        assert margin == pytest.approx(expected)
        checked += 1
    assert checked > 500


def test_the_mean_commute_and_its_ratio_margin(con) -> None:  # type: ignore[no-untyped-def]
    """Aggregate minutes over commuters is not a share, so its margin is the ratio form:
    sqrt(MOE_X^2 + R^2 * MOE_Y^2) / Y."""
    _tables_staged(con)
    staged = _staged_at(
        con, "stg_census_acs_people", "acs_mean_commute_minutes", "county"
    )
    for row in _raw(con, "people_county"):
        geoid = row["state"] + row["county"]
        x, mx = _sum(row, ["B08013_001"])
        y, my = _sum(row, ["B08303_001"])
        value, margin = staged[geoid]
        assert value == pytest.approx(x / y)
        assert 15 < value < 60  # minutes each way, for a whole county
        assert margin == pytest.approx(math.sqrt(mx**2 + (x / y) ** 2 * my**2) / y)  # type: ignore[operator]


def test_a_median_in_an_open_ended_bracket_is_no_median(con) -> None:  # type: ignore[no-untyped-def]
    """Owner costs top out at "$4,000 or more": the Census prints the bound with the code
    -333333333 for its margin, and the bound must not be staged as a median."""
    _tables_staged(con)
    staged = _staged_at(con, "stg_census_acs_homes", "acs_owner_costs_mortgage", "zip")
    open_ended = 0
    for row in _raw(con, "rent_zcta"):
        geoid = row["zip code tabulation area"]
        if row["B25088_002M"] == "-333333333":
            assert geoid not in staged
            open_ended += 1
        elif geoid in staged:
            assert staged[geoid][1] == _margin(row["B25088_002M"])
    assert open_ended > 0


def test_the_older_medians_drop_an_open_ended_bound_too(con) -> None:  # type: ignore[no-untyped-def]
    """Milestone 34 found 109 municipal figures that were a bracket's bound — $250,001 of
    income, $2,000,001 of home value — staged as medians. None is staged now."""
    staged = {
        (metric, geoid)
        for metric, geoid in con.execute(
            "SELECT metric_id, geoid FROM main_staging.stg_census_acs "
            "WHERE period_end = DATE '2024-12-31' AND level = 'municipality'"
        ).fetchall()
    }
    bounds = 0
    for row in _raw(con, "cousub"):
        geoid = row["state"] + row["county"] + row["county subdivision"]
        for metric, variable in (
            ("acs_median_hh_income", "B19013_001"),
            ("acs_median_gross_rent", "B25064_001"),
            ("acs_median_home_value", "B25077_001"),
        ):
            if row[f"{variable}M"] == "-333333333":
                assert (metric, geoid) not in staged
                bounds += 1
    assert bounds > 0
