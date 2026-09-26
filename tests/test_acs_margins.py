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
        if geoid not in staged:
            continue  # the estimate itself was suppressed
        assert staged[geoid] == _margin(row["B25064_001M"])
        coded += row["B25064_001M"] in SPECIAL
    # Small towns' rents carry the Census's codes, and none of them became a number.
    assert coded > 0
