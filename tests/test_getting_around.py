"""Getting around (Milestone 45, ARCHITECTURE #313-#314).

The two readers — LODES's files by state, the National Transit Map's stops — and the
staging models rendered and run in DuckDB, as dbt would, on places small enough to work
out by hand: a town whose residents work in New York City, Philadelphia and at home, a
place too small to publish, and two blocks a measured walk from a station. No network.
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
from hip.sources.bts_ntm import BOX, TransitStopsAdapter
from hip.sources.census_lodes import MISSING, STATES, LodesAdapter
from hip.sources.registry import IMPLEMENTED, METRIC_SOURCES

MODELS = REPO_ROOT / "dbt" / "models" / "staging"


# --- Readers ---------------------------------------------------------------------------


def test_lodes_reads_new_jerseys_main_file_and_every_other_states_auxiliary_file() -> (
    None
):
    refs = LodesAdapter().refs("2023")
    layers = {r.layer: r for r in refs}
    assert layers["od_main"].url.endswith("/nj/od/nj_od_main_JT00_2023.csv.gz")
    assert layers["xwalk"].url.endswith("/nj/nj_xwalk.csv.gz")
    aux = {r.layer.removeprefix("od_aux_") for r in refs if r.layer.startswith("od_aux_")}
    # Every state but New Jersey itself and the two LODES 2023 has no records for.
    assert aux == set(STATES) - {"NJ"} - set(MISSING["2023"])
    assert layers["od_aux_NY"].url.endswith("/ny/od/ny_od_aux_JT00_2023.csv.gz")
    # One layer per state, never a scope: the warehouse keys a release without scope.
    assert len(layers) == len(refs)
    assert all(r.scope is None for r in refs)


def test_lodes_discovers_a_newer_year_when_new_jerseys_file_appears() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200 if "_2024." in str(request.url) else 404)

    adapter = LodesAdapter()
    adapter.probe_transport = httpx.MockTransport(handle)
    assert adapter.discover(date(2026, 12, 20)).newest == "2024"


def test_transit_stops_are_read_for_a_box_around_new_jersey_without_geometry() -> None:
    layer = TransitStopsAdapter.LAYERS["stops"]
    assert layer.where == BOX and not layer.geometry
    assert {"stop_lat", "stop_lon", "stop_type_text", "location_type"} <= set(
        layer.fields
    )


def test_both_sources_are_fetched_and_cited() -> None:
    for source_id in ("census_lodes", "bts_ntm"):
        assert source_id in IMPLEMENTED and source_id in METRIC_SOURCES


# --- Staging models -----------------------------------------------------------------


def _run(con: duckdb.DuckDBPyConnection, model: str, parquet: Path) -> None:
    """Render a staging model as dbt would and create it as a table of the same name."""
    sql = (
        jinja2.Environment()
        .from_string((MODELS / f"{model}.sql").read_text())
        .render(
            config=lambda **_: "",
            ref=lambda name: name,
            var=lambda name: str(parquet),
        )
    )
    con.execute(f"CREATE OR REPLACE TABLE {model} AS {sql}")


def _write(
    con: duckdb.DuckDBPyConnection, path: Path, rows: list[dict[str, Any]]
) -> None:
    """Rows to Parquet with every column text, as LODES lands (`all_varchar`)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = list(rows[0])
    values = ", ".join(
        "(" + ", ".join("NULL" if r[c] is None else f"'{r[c]}'" for c in columns) + ")"
        for r in rows
    )
    con.execute(
        f"COPY (SELECT * FROM (VALUES {values}) AS t({', '.join(columns)})) "
        f"TO '{path}' (FORMAT PARQUET)"
    )


@pytest.fixture
def con() -> duckdb.DuckDBPyConnection:
    connection = duckdb.connect()
    connection.execute("LOAD spatial")
    return connection


# Two Hudson County towns' blocks, and one in Pine Valley, Camden County.
TOWN_A = "3401700001"
TOWN_B = "3401700002"
TINY = "3400772240"
A1, A2, B1, P1 = (
    "340170001001000",
    "340170001001001",
    "340170002001000",
    "340070003001000",
)
MANHATTAN = "360610001001000"
PHILADELPHIA = "421010001001000"
UPSTATE = "360010001001000"
OHIO = "390010001001000"


def _lodes_world(con: duckdb.DuckDBPyConnection, tmp_path: Path) -> None:
    """Town A's residents hold 400 jobs: 100 at home, 50 in town B, 150 in Manhattan,
    60 in Philadelphia, 30 upstate and 10 in Ohio. Pine Valley's hold 5."""
    root = tmp_path / "census_lodes" / "2023"
    _write(
        con,
        root / "xwalk.parquet",
        [
            {"tabblk2020": A1, "cty": "34017", "ctycsub": TOWN_A, "zcta": "07030"},
            {"tabblk2020": A2, "cty": "34017", "ctycsub": TOWN_A, "zcta": "07030"},
            {"tabblk2020": B1, "cty": "34017", "ctycsub": TOWN_B, "zcta": "07307"},
            {"tabblk2020": P1, "cty": "34007", "ctycsub": TINY, "zcta": "99999"},
        ],
    )
    od = lambda h, w, n: {"w_geocode": w, "h_geocode": h, "S000": str(n)}  # noqa: E731
    _write(
        con, root / "od_main.parquet", [od(A1, A2, 100), od(A1, B1, 50), od(P1, P1, 5)]
    )
    _write(
        con,
        root / "od_aux_NY.parquet",
        # A resident of Connecticut working in Manhattan is in New York's file, not ours.
        [
            od(A1, MANHATTAN, 150),
            od(A2, UPSTATE, 30),
            od("090010001001000", MANHATTAN, 999),
        ],
    )
    _write(con, root / "od_aux_PA.parquet", [od(A2, PHILADELPHIA, 60)])
    _write(con, root / "od_aux_OH.parquet", [od(A1, OHIO, 10)])
    for model in ("stg_lodes_jobs", "stg_work_flows", "stg_work_destinations"):
        _run(con, model, tmp_path)


def _shares(con: duckdb.DuckDBPyConnection, geoid: str) -> dict[str, float]:
    return dict(
        con.execute(
            "SELECT metric_id, value FROM stg_work_flows WHERE geoid = ?", [geoid]
        ).fetchall()
    )


def test_work_shares_count_every_states_jobs_and_add_to_one(con, tmp_path: Path) -> None:
    _lodes_world(con, tmp_path)
    town = _shares(con, TOWN_A)
    assert town["lodes_resident_jobs"] == 400
    assert town["lodes_work_same_town_share"] == pytest.approx(100 / 400)
    assert town["lodes_work_home_county_share"] == pytest.approx(150 / 400)
    assert town["lodes_work_nyc_share"] == pytest.approx(150 / 400)
    assert town["lodes_work_pennsylvania_share"] == pytest.approx(60 / 400)
    # Upstate New York and Ohio: outside New Jersey, New York City and Pennsylvania.
    assert town["lodes_work_other_state_share"] == pytest.approx(40 / 400)
    parts = (
        "lodes_work_home_county_share",
        "lodes_work_other_nj_share",
        "lodes_work_nyc_share",
        "lodes_work_pennsylvania_share",
        "lodes_work_other_state_share",
    )
    assert sum(town[p] for p in parts) == pytest.approx(1)
    # The own-town share is a town's alone; a county's residents have no "own town".
    assert "lodes_work_same_town_share" not in _shares(con, "34017")


def test_a_place_holding_under_100_jobs_gets_its_count_and_no_shares(
    con, tmp_path: Path
) -> None:
    _lodes_world(con, tmp_path)
    assert _shares(con, TINY) == {"lodes_resident_jobs": 5}
    # LODES's "no ZCTA" block is no ZIP code at all.
    assert _shares(con, "99999") == {}


def test_destinations_group_new_york_city_and_drop_the_smallest(
    con, tmp_path: Path
) -> None:
    _lodes_world(con, tmp_path)
    rows = con.execute(
        "SELECT destination_geoid, destination_name, jobs, share FROM "
        "stg_work_destinations WHERE geoid = ? ORDER BY rank",
        [TOWN_A],
    ).fetchall()
    assert rows == [
        (None, "New York City", 150, pytest.approx(150 / 400)),
        (TOWN_A, None, 100, pytest.approx(100 / 400)),
        (None, "Philadelphia", 60, pytest.approx(60 / 400)),
        (TOWN_B, None, 50, pytest.approx(50 / 400)),
        (None, "Elsewhere in New York", 30, pytest.approx(30 / 400)),
        # Ohio's 10 jobs are under the 20 a destination needs to be listed.
    ]


def _transit_world(con: duckdb.DuckDBPyConnection, tmp_path: Path) -> None:
    """Two blocks of 100 and 300 homes in one town, a kilometre apart. A train stop is
    300m from block A; a bus stop is 300m from block B. A ferry landing and a station
    entrance sit on block B and count for nothing."""
    con.execute(
        """
        CREATE OR REPLACE TABLE stg_block_homes AS
        SELECT * FROM (VALUES
            ('340170001001000', '34017', '3401700001', '07030', 100,
             ST_Point(-74.0300, 40.7400)),
            ('340170001001001', '34017', '3401700001', '07030', 300,
             ST_Point(-74.0182, 40.7400))
        ) AS b(block_geoid, county_geoid, municipality_geoid, zcta_geoid, homes, point)
        """
    )
    stop = lambda lon, lat, kind, loc="Null": {  # noqa: E731
        "ntd_id": "20080",
        "stop_id": f"{lon}{lat}{kind}",
        "location_type": loc,
        "stop_type_text": kind,
        "stop_lat": str(lat),
        "stop_lon": str(lon),
        "download_date": "2026-03-09",
    }
    _write(
        con,
        tmp_path / "bts_ntm" / "current" / "stops.parquet",
        [
            stop(-74.0300, 40.7427, '"Rail"'),
            stop(-74.0182, 40.7427, '"Bus"'),
            stop(-74.0182, 40.7400, '"Ferry"'),
            stop(-74.0182, 40.7401, '"Subway, Metro"', loc="2"),
        ],
    )
    for model in ("stg_transit_stops", "stg_transit_blocks", "stg_transit_access"):
        _run(con, model, tmp_path)


def test_homes_near_transit_are_weighed_by_block_and_dated_by_the_compile(
    con, tmp_path: Path
) -> None:
    _transit_world(con, tmp_path)
    rows = con.execute(
        "SELECT metric_id, value, period_end FROM stg_transit_access WHERE geoid = ?",
        ["3401700001"],
    ).fetchall()
    shares = {m: v for m, v, _ in rows}
    # 300m is inside half a mile (805m) and a quarter mile (402m).
    assert shares["transit_rail_homes_share"] == pytest.approx(100 / 400)
    assert shares["transit_bus_homes_share"] == pytest.approx(300 / 400)
    assert shares["transit_any_homes_share"] == pytest.approx(1.0)
    assert {p for _, _, p in rows} == {date(2026, 12, 31)}


def test_a_ferry_landing_and_a_station_entrance_are_not_stops(
    con, tmp_path: Path
) -> None:
    _transit_world(con, tmp_path)
    kinds = con.execute(
        "SELECT stop_type_text FROM stg_transit_stops ORDER BY 1"
    ).fetchall()
    assert kinds == [('"Bus"',), ('"Rail"',)]
