"""The median the Census publishes only in brackets (Milestone 33), interpolated by the
`bracket_median` dbt macro. Rendered and run in DuckDB, as dbt would, on brackets whose
median can be worked out by hand."""

from __future__ import annotations

import duckdb
import jinja2
import pytest

from hip.config import REPO_ROOT

MACROS = (REPO_ROOT / "dbt" / "macros" / "acs_margins.sql").read_text()


def _median(counts: list[float], bounds: list[int]) -> float | None:
    expression = (
        jinja2.Environment()
        .from_string(MACROS + "{{ bracket_median('b', bounds) }}")
        .render(bounds=bounds)
    )
    columns = ", ".join(f"{c}::double AS b{i}" for i, c in enumerate(counts))
    row = duckdb.sql(f"SELECT {expression.strip()} FROM (SELECT {columns})").fetchone()
    return None if row is None else row[0]


def test_the_median_is_interpolated_within_its_bracket() -> None:
    # 100 households: 10 under $100, 30 at $100–299, 60 at $300 or more. The 50th sits
    # 10 into the 30 in the second bracket, a third of its $200 width past $100.
    assert _median([10, 30, 60], [0, 100, 300]) is None  # the middle one is in the top
    assert _median([10, 60, 30], [0, 100, 300]) == pytest.approx(100 + 40 / 60 * 200)


def test_a_median_in_the_lowest_bracket_counts_from_zero() -> None:
    assert _median([80, 10, 10], [0, 100, 300]) == pytest.approx(50 / 80 * 100)


def test_a_median_in_the_open_top_bracket_is_not_given() -> None:
    """$750 or more has no upper bound to interpolate to; its lower bound would read as a
    figure the survey does not give."""
    assert _median([10, 10, 80], [0, 250, 750]) is None


def test_no_households_counted_gives_no_median() -> None:
    assert _median([0, 0, 0], [0, 100, 300]) is None
