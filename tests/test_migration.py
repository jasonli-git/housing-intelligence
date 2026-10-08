"""Migration-driven demand (Milestone 50, ARCHITECTURE #332-#333).

The IRS reader's requests and discovery against a stubbed publisher, and the two staging
models rendered and run in DuckDB, as dbt would, over files in the IRS's own published
shape — header, summary rows, an "Other flows" remainder and a suppressed cell — landed
the way `land_csv` lands them. A publisher changing the files' shape fails here rather
than in a pipeline run (TODO, "Unit tests for the source adapters"). No network.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import duckdb
import httpx
import jinja2
import pytest

from hip.config import REPO_ROOT
from hip.sources.irs_migration import PAIRS, MigrationAdapter, year_pairs

MODELS = REPO_ROOT / "dbt" / "models" / "staging"

# The IRS's own headers, which name a file's two years y1 and y2.
INFLOW = (
    "y2_statefips,y2_countyfips,y1_statefips,y1_countyfips,y1_state,y1_countyname,"
    "n1,n2,agi\n"
    """34,017,96,000,NJ,Hudson County Total Migration-US and Foreign,1000,1500,100000
34,017,97,000,NJ,Hudson County Total Migration-US,900,1350,90000
34,017,34,017,NJ,Hudson County Non-migrants,9000,18000,720000
34,017,36,061,NY,New York County,300,400,45000
34,017,34,003,NJ,Bergen County,200,300,16000
34,017,59,000,DS,Other flows - Different State,100,150,9000
34,017,34,013,NJ,Essex County,-1,-1,-1
"""
)

OUTFLOW = (
    "y1_statefips,y1_countyfips,y2_statefips,y2_countyfips,y2_state,y2_countyname,"
    "n1,n2,agi\n"
    """34,017,96,000,NJ,Hudson County Total Migration-US and Foreign,1200,2000,132000
34,017,34,017,NJ,Hudson County Non-migrants,9000,18000,720000
34,017,34,003,NJ,Bergen County,500,900,60000
34,017,36,061,NY,New York County,250,300,40000
"""
)


# --- The reader ------------------------------------------------------------------------


def test_each_pair_is_two_files_named_by_its_years() -> None:
    refs = MigrationAdapter().refs("2223")
    assert [(r.layer, r.url.rsplit("/", 1)[1]) for r in refs] == [
        ("inflow", "countyinflow2223.csv"),
        ("outflow", "countyoutflow2223.csv"),
    ]
    assert year_pairs("2223") == [(22, 23), (21, 22), (20, 21), (19, 20), (18, 19)]
    assert len(year_pairs("2223")) == PAIRS


def test_a_pair_is_newest_only_when_both_its_files_exist() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        # 2023-2024's inflow is out and its outflow is not: not yet a pair.
        found = "2223" in url or url.endswith("countyinflow2324.csv")
        return httpx.Response(200 if found else 404)

    adapter = MigrationAdapter()
    adapter.newest = "2223"
    adapter.probe_transport = httpx.MockTransport(handle)
    assert adapter.discover(date(2026, 10, 7)).newest == "2223"


# --- Staging --------------------------------------------------------------------------


def _land(text: str, path: Path) -> None:
    """As `land_csv` does: DuckDB's inference over the whole file, latin-1."""
    path.parent.mkdir(parents=True, exist_ok=True)
    csv = path.with_suffix(".csv")
    csv.write_text(text)
    duckdb.connect().execute(
        f"COPY (SELECT * FROM read_csv('{csv}', header=true, sample_size=-1, "
        f"encoding='latin-1')) TO '{path}' (FORMAT PARQUET)"
    )


def _run(con: duckdb.DuckDBPyConnection, model: str, parquet: Path) -> None:
    variables = {"parquet_dir": str(parquet), "state_fips": "'34'"}
    sql = (
        jinja2.Environment()
        .from_string((MODELS / f"{model}.sql").read_text())
        .render(config=lambda **_: "", var=lambda name: variables[name])
    )
    con.execute(f"CREATE OR REPLACE TABLE {model} AS {sql}")


@pytest.fixture
def con(tmp_path: Path) -> duckdb.DuckDBPyConnection:
    _land(INFLOW, tmp_path / "irs_migration" / "2223" / "inflow.parquet")
    _land(OUTFLOW, tmp_path / "irs_migration" / "2223" / "outflow.parquet")
    connection = duckdb.connect()
    for model in ("stg_irs_migration", "stg_migration_flows"):
        _run(connection, model, tmp_path)
    return connection


def test_a_county_s_moves_come_from_the_irs_summary_rows(con) -> None:
    figures = dict(
        con.execute(
            "SELECT metric_id, value FROM stg_irs_migration WHERE geoid = '34017'"
        ).fetchall()
    )
    assert figures["irs_inflow_returns"] == 1000
    assert figures["irs_outflow_returns"] == 1200
    assert figures["net_migration_returns"] == -200
    # Per 1,000 of the returns filed there the year before: 9,000 stayed, 1,200 left.
    assert figures["irs_net_migration_per_1000"] == pytest.approx(-200 * 1000 / 10_200)
    # AGI is published in thousands: $100,000 a return arriving, $80,000 staying.
    assert figures["irs_inflow_agi_per_return"] == pytest.approx(100_000)
    assert figures["irs_outflow_agi_per_return"] == pytest.approx(110_000)
    assert figures["irs_nonmigrant_agi_per_return"] == pytest.approx(80_000)
    assert figures["irs_arrival_income_ratio"] == pytest.approx(1.25)


def test_the_moves_land_in_the_pair_s_second_year_citing_their_file(con) -> None:
    rows = con.execute(
        "SELECT DISTINCT period_start, period_end, release_vintage FROM stg_irs_migration"
    ).fetchall()
    assert rows == [(date(2023, 1, 1), date(2023, 12, 31), "2223")]
    layers = dict(
        con.execute("SELECT metric_id, release_layer FROM stg_irs_migration").fetchall()
    )
    assert layers["irs_outflow_returns"] == "outflow"
    assert layers["irs_inflow_returns"] == "inflow"


def test_origins_and_destinations_are_counties_never_summaries_or_suppressed(
    con,
) -> None:
    flows = con.execute(
        """
        SELECT direction, rank, other_name, returns, agi_per_return, share
        FROM stg_migration_flows ORDER BY direction, rank
        """
    ).fetchall()
    assert flows == [
        ("in", 1, "New York County, NY", 300, pytest.approx(150_000), 0.3),
        ("in", 2, "Bergen County, NJ", 200, pytest.approx(80_000), 0.2),
        ("out", 1, "Bergen County, NJ", 500, pytest.approx(120_000), 500 / 1200),
        ("out", 2, "New York County, NY", 250, pytest.approx(160_000), 250 / 1200),
    ]
