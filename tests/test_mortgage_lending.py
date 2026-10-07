"""Mortgage lending (Milestone 48, ARCHITECTURE #324-#326).

The two readers — HMDA by year, FHA's limits fixed-width — and the staging models
rendered and run in DuckDB, as dbt would, on loans small enough to work out by hand: a
county's tracts, a town that holds part of one, refinances that must not count, and a
place below the floor. No network.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

import duckdb
import httpx
import jinja2
import pytest

from hip.config import REPO_ROOT
from hip.sources.hmda import YEARS, HmdaAdapter
from hip.sources.hud_limits import FIELDS, HudFhaLimitsAdapter
from hip.sources.registry import IMPLEMENTED, METRIC_SOURCES

MODELS = REPO_ROOT / "dbt" / "models" / "staging"


# --- Readers ---------------------------------------------------------------------------


def test_hmda_reads_five_years_of_new_jersey_one_layer_each() -> None:
    refs = HmdaAdapter().refs()
    assert [r.vintage for r in refs] == [str(y) for y in range(2025 - YEARS + 1, 2026)]
    assert refs[-1].layer == "nj_2025"
    assert refs[-1].url.endswith("/view/csv?states=NJ&years=2025")
    assert HmdaAdapter.filename(refs[-1]) == "hmda_nj_2025.csv"


def test_hmda_discovers_a_year_the_browser_counts() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        count = 1 if "years=2026" in str(request.url) else 0
        return httpx.Response(200, json={"aggregations": [{"count": count}]})

    adapter = HmdaAdapter()
    adapter.probe_transport = httpx.MockTransport(handle)
    assert adapter.discover(date(2027, 4, 1)).newest == "2026"


def test_fha_limits_are_read_by_hud_s_published_layout() -> None:
    ref = HudFhaLimitsAdapter().refs("2026")[0]
    assert ref.url.endswith("/cy2026-forward-limits.txt")
    fields = {name: (start, length) for name, start, length in FIELDS}
    # From the CHUMS file description: one-unit limit at 074-080, county at 104-106.
    assert fields["limit_1_unit"] == (74, 7)
    assert fields["county_fips"] == (104, 3)
    for source_id in ("ffiec_hmda", "hud_fha_limits"):
        assert source_id in IMPLEMENTED and source_id in METRIC_SOURCES


# --- Staging models -----------------------------------------------------------------


def _run(con: duckdb.DuckDBPyConnection, model: str, parquet: Path) -> None:
    sql = (
        jinja2.Environment()
        .from_string((MODELS / f"{model}.sql").read_text())
        .render(
            config=lambda **_: "", ref=lambda name: name, var=lambda name: str(parquet)
        )
    )
    con.execute(f"CREATE OR REPLACE TABLE {model} AS {sql}")


def _write(
    con: duckdb.DuckDBPyConnection, path: Path, rows: list[dict[str, Any]]
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = list(rows[0])
    values = ", ".join("(" + ", ".join(f"'{r[c]}'" for c in columns) + ")" for r in rows)
    quoted = ", ".join(f'"{c}"' for c in columns)
    con.execute(
        f"COPY (SELECT * FROM (VALUES {values}) AS t({quoted})) TO '{path}' "
        "(FORMAT PARQUET)"
    )


@pytest.fixture
def con() -> duckdb.DuckDBPyConnection:
    return duckdb.connect()


TRACT_A, TRACT_B = "34017000100", "34017000200"
TOWN = "3401700001"


def loan(
    tract: str,
    *,
    action: str = "1",
    rate: str = "6.5",
    purpose: str = "1",
    loan_type: str = "1",
    reason: str = "10",
) -> dict[str, str]:
    return {
        "activity_year": "2025",
        "census_tract": tract,
        "action_taken": action,
        "loan_type": loan_type,
        "loan_purpose": purpose,
        "lien_status": "1",
        "occupancy_type": "1",
        "derived_dwelling_category": "Single Family (1-4 Units):Site-Built",
        "business_or_commercial_purpose": "2",
        "reverse_mortgage": "2",
        "open-end_line_of_credit": "2",
        "interest_rate": rate,
        "loan_amount": "405000",
        "loan_to_value_ratio": "80",
        "total_loan_costs": "7000",
        "income": "150",
        "denial_reason-1": reason,
    }


def _world(con: duckdb.DuckDBPyConnection, tmp_path: Path) -> None:
    """Tract A: 40 loans at 6% and 20 at 7%, 10 denied for debt-to-income, and 50
    refinances that must not count. Tract B: 20 loans at 5%. The town holds half of
    tract A's homes and none of B's."""
    rows = (
        [loan(TRACT_A, rate="6.0") for _ in range(40)]
        + [loan(TRACT_A, rate="7.0", loan_type="2") for _ in range(20)]
        + [loan(TRACT_A, action="3", reason="1") for _ in range(10)]
        + [loan(TRACT_A, purpose="31") for _ in range(50)]
        + [loan(TRACT_B, rate="5.0") for _ in range(20)]
    )
    _write(con, tmp_path / "ffiec_hmda" / "2025" / "nj_2025.parquet", rows)
    con.execute(
        f"""
        CREATE OR REPLACE TABLE stg_block_homes AS
        SELECT * FROM (VALUES
            ('{TRACT_A}1000', '{TOWN}', '07030', 100),
            ('{TRACT_A}1001', '3401700002', '07030', 100),
            ('{TRACT_B}1000', '3401700002', '07307', 100)
        ) AS b(block_geoid, municipality_geoid, zcta_geoid, homes)
        """
    )
    for model in ("stg_hmda_loans", "stg_hmda_lending"):
        _run(con, model, tmp_path)


def _figures(con: duckdb.DuckDBPyConnection, geoid: str) -> dict[str, tuple[float, str]]:
    return {
        m: (v, method)
        for m, v, method in con.execute(
            "SELECT metric_id, value, match_method FROM stg_hmda_lending WHERE geoid = ?",
            [geoid],
        ).fetchall()
    }


def test_a_county_counts_its_tracts_purchases_exactly_and_no_refinance(
    con, tmp_path: Path
) -> None:
    _world(con, tmp_path)
    county = _figures(con, "34017")
    assert county["hmda_purchase_loans"] == (80, "fips")
    # Weighted median of 20 at 5%, 40 at 6%, 20 at 7%.
    assert county["hmda_median_rate"][0] == 6.0
    assert county["hmda_fha_share"][0] == pytest.approx(20 / 80)
    assert county["hmda_denial_rate"][0] == pytest.approx(10 / 90)


def test_a_town_is_estimated_from_its_share_of_each_tracts_homes(
    con, tmp_path: Path
) -> None:
    _world(con, tmp_path)
    town = _figures(con, TOWN)
    # Half of tract A's 60 loans; tract B none.
    assert town["hmda_purchase_loans"] == (30, "tract_homes")
    assert town["hmda_median_rate"][0] == 6.0
    # Its 5 weighted denials are under the 20 a reason share needs.
    assert "hmda_denial_dti_share" not in town


def test_a_place_with_under_thirty_loans_gets_no_loan_figures(
    con, tmp_path: Path
) -> None:
    _world(con, tmp_path)
    # ZIP 07307 holds only tract B's 20 loans.
    assert _figures(con, "07307") == {}
