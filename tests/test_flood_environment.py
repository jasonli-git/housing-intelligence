"""Flood and environmental exposure (Milestone 40, ARCHITECTURE #301-#304).

The readers of publishers' layers — ArcGIS services, OpenFEMA, Envirofacts and a file
inside ECHO's zip — against stub publishers, and the staging models rendered and run in
DuckDB, as dbt would, on places small enough to work out by hand: a block half in a
flood zone, a town FEMA's digital map does not reach, a contaminated site of each kind.
No network.
"""

from __future__ import annotations

import io
import json
import math
import zipfile
from pathlib import Path
from typing import Any

import duckdb
import httpx
import jinja2
import pytest

from hip.config import REPO_ROOT
from hip.sources.arcgis import ArcGisAdapter, ArcGisLayer
from hip.sources.base import SourceError
from hip.sources.epa_sdwis import zip_member
from hip.sources.fema import NfipClaimsAdapter
from hip.sources.njdep import KcslAdapter
from hip.sources.registry import IMPLEMENTED, METRIC_SOURCES

MODELS = REPO_ROOT / "dbt" / "models" / "staging"


# --- Readers ---------------------------------------------------------------------------


class _Layer(ArcGisAdapter):
    source_id = "test_layer"
    LAYERS = {
        "rows": ArcGisLayer(url="https://x/0", fields=("OBJECTID",), minimum=3, batch=4)
    }


def _arcgis(ids: list[int], *, cap: int | None = None) -> httpx.MockTransport:
    """A layer of `ids`; a query for more than `cap` rows answers truncated."""

    def handle(request: httpx.Request) -> httpx.Response:
        form = dict(httpx.QueryParams(request.content.decode()))
        if form.get("returnIdsOnly") == "true":
            return httpx.Response(200, json={"objectIds": list(reversed(ids))})
        asked = [int(i) for i in form["objectIds"].split(",")]
        if cap is not None and len(asked) > cap:
            features = [{"properties": {"OBJECTID": i}} for i in asked[:cap]]
            return httpx.Response(
                200, json={"features": features, "exceededTransferLimit": True}
            )
        features = [
            {
                "properties": {"OBJECTID": i},
                "geometry": {"type": "Point", "coordinates": [0, 0]},
            }
            for i in asked
        ]
        return httpx.Response(200, json={"features": features})

    return httpx.MockTransport(handle)


def _read(
    adapter: ArcGisAdapter, transport: httpx.MockTransport, tmp_path: Path
) -> list[dict]:
    adapter._client = lambda: httpx.Client(transport=transport)  # type: ignore[method-assign]
    out = tmp_path / "rows.ndjson"
    adapter._fetch_bytes(adapter.refs()[0], out)
    return [json.loads(line) for line in out.read_text().splitlines()]


def test_a_layer_is_read_by_id_in_batches_with_its_geometry_as_geojson(
    tmp_path: Path,
) -> None:
    rows = _read(_Layer(), _arcgis([9, 2, 40, 7, 13]), tmp_path)
    assert [r["OBJECTID"] for r in rows] == [2, 7, 9, 13, 40]
    assert json.loads(rows[0]["geometry"]) == {"type": "Point", "coordinates": [0, 0]}


def test_a_truncated_batch_is_split_and_asked_again(tmp_path: Path) -> None:
    rows = _read(_Layer(), _arcgis(list(range(1, 9)), cap=2), tmp_path)
    assert [r["OBJECTID"] for r in rows] == list(range(1, 9))


def test_a_layer_reading_under_its_floor_is_refused(tmp_path: Path) -> None:
    with pytest.raises(SourceError, match="the layer has changed"):
        _read(_Layer(), _arcgis([1, 2]), tmp_path)


def test_no_contaminated_site_is_read_with_its_name_or_street() -> None:
    """The list includes houses with a leaking heating-oil tank (#303)."""
    fields = set(KcslAdapter.LAYERS["sites"].fields)
    assert not fields & {
        "PI_NAME",
        "ADDRESS",
        "PI_NUMBER",
        "X_COORDINATE",
        "Y_COORDINATE",
    }


def test_claims_are_paged_until_the_count_and_a_short_read_is_refused(
    tmp_path: Path,
) -> None:
    total = 150_001
    asked: list[int] = []

    def handle(request: httpx.Request) -> httpx.Response:
        skip = int(request.url.params["$skip"])
        asked.append(skip)
        rows = [
            {"id": i, "yearOfLoss": 2012} for i in range(skip, min(skip + 10_000, total))
        ]
        return httpx.Response(
            200, json={"metadata": {"count": total}, "NfipClaims": rows}
        )

    adapter = NfipClaimsAdapter()
    adapter._client = lambda: httpx.Client(transport=httpx.MockTransport(handle))  # type: ignore[method-assign]
    out = tmp_path / "claims.ndjson"
    adapter._fetch_bytes(adapter.refs()[0], out)
    assert len(out.read_text().splitlines()) == total
    assert asked[:3] == [0, 10_000, 20_000]

    def short(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"metadata": {"count": total}, "NfipClaims": []})

    adapter._client = lambda: httpx.Client(transport=httpx.MockTransport(short))  # type: ignore[method-assign]
    with pytest.raises(SourceError, match="claims"):
        adapter._fetch_bytes(adapter.refs()[0], out)


def test_one_file_is_read_out_of_a_remote_zip_by_byte_range() -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SDWA_BIG.csv", "x" * 50_000)
        archive.writestr("SDWA_REF_CODE_VALUES.csv", "VALUE_TYPE,VALUE_CODE\nA,1\n")
    body = buffer.getvalue()
    ranges: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        if request.method == "HEAD":
            return httpx.Response(200, headers={"content-length": str(len(body))})
        span = request.headers["range"].removeprefix("bytes=")
        ranges.append(span)
        start, end = (int(n) for n in span.split("-"))
        return httpx.Response(206, content=body[start : end + 1])

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        data = zip_member(client, "https://x/a.zip", "SDWA_REF_CODE_VALUES.csv")
    assert data == b"VALUE_TYPE,VALUE_CODE\nA,1\n"
    # The big member is never transferred.
    assert all(int(b) - int(a) < 50_000 for a, b in (r.split("-") for r in ranges))


def test_every_m40_source_is_fetched_and_every_cited_one_is_loaded() -> None:
    cited = {
        "fema_nfhl",
        "njdep_cafe",
        "fema_nfip_claims",
        "njdep_kcsl",
        "njdep_water_areas",
        "epa_sdwis",
    }
    assert cited <= set(METRIC_SOURCES)
    # Blocks only weigh the others; they are fetched, never cited by a figure.
    assert "census_blocks" in IMPLEMENTED and "census_blocks" not in METRIC_SOURCES


# --- Staging models -----------------------------------------------------------------


def _run(
    con: duckdb.DuckDBPyConnection, model: str, parquet: Path, years: int = 2026
) -> None:
    """Render a staging model as dbt would and create it as a table of the same name."""
    sql = (
        jinja2.Environment()
        .from_string((MODELS / f"{model}.sql").read_text())
        .render(
            config=lambda **_: "",
            ref=lambda name: name,
            var=lambda name: (
                str(parquet)
                if name == "parquet_dir"
                else {
                    s: years
                    for s in (
                        "fema_nfhl",
                        "njdep_cafe",
                        "njdep_kcsl",
                        "njdep_water_areas",
                        "epa_sdwis",
                    )
                }
            ),
        )
    )
    con.execute(f"CREATE OR REPLACE TABLE {model} AS {sql}")


def _square(x: float, y: float, size: float = 1.0) -> str:
    return f"ST_MakeEnvelope({x}, {y}, {x + size}, {y + size})"


def _geojson(con: duckdb.DuckDBPyConnection, geometry: str) -> str:
    row = con.execute(f"SELECT ST_AsGeoJSON({geometry})").fetchone()
    assert row is not None
    return str(row[0])


def _write(
    con: duckdb.DuckDBPyConnection, path: Path, rows: list[dict[str, Any]]
) -> None:
    """Rows to Parquet through NDJSON, as `land_ndjson` lands a layer."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = path.with_suffix(".ndjson")
    lines.write_text("\n".join(json.dumps(r) for r in rows))
    con.execute(
        f"COPY (SELECT * FROM read_json_auto('{lines}')) TO '{path}' (FORMAT PARQUET)"
    )


@pytest.fixture
def con() -> duckdb.DuckDBPyConnection:
    connection = duckdb.connect()
    connection.execute("LOAD spatial")
    return connection


def _flood_world(
    con: duckdb.DuckDBPyConnection, tmp_path: Path, *, covered: bool
) -> None:
    """Two blocks of 100 homes each in one town in Ocean County: block A half in FEMA's
    1% zone, block B in minimal hazard. Uncovered, block B is outside every polygon."""
    con.execute(
        f"""
        CREATE OR REPLACE TABLE stg_block_homes AS
        SELECT * FROM (VALUES
            ('340290001001000', '34029', '340290001001', '3402900001', '08000', 100,
             {_square(0, 0)}),
            ('340290001001001', '34029', '340290001001', '3402900001', '08000', 100,
             {_square(1, 0)})
        ) AS b(block_geoid, county_geoid, block_group_geoid, municipality_geoid,
               zcta_geoid, homes, geom)
        """
    )
    zones = [
        {
            "FLD_ZONE": "AE",
            "ZONE_SUBTY": None,
            "SFHA_TF": "T",
            "geometry": _geojson(con, "ST_MakeEnvelope(0, 0, 0.5, 1)"),
        },
        {
            "FLD_ZONE": "X",
            "ZONE_SUBTY": "AREA OF MINIMAL FLOOD HAZARD",
            "SFHA_TF": "F",
            "geometry": _geojson(con, "ST_MakeEnvelope(0.5, 0, 1, 1)"),
        },
    ]
    if covered:
        zones.append(
            {
                "FLD_ZONE": "X",
                "ZONE_SUBTY": "AREA OF MINIMAL FLOOD HAZARD",
                "SFHA_TF": "F",
                "geometry": _geojson(con, _square(1, 0)),
            }
        )
    _write(con, tmp_path / "fema_nfhl" / "current" / "zones.parquet", zones)
    _write(
        con,
        tmp_path / "njdep_cafe" / "current" / "tidal.parquet",
        [
            {
                "FLD_ZONE": "VE",
                "COUNTY": "Ocean",
                "geometry": _geojson(con, "ST_MakeEnvelope(0, 0, 0.25, 1)"),
            }
        ],
    )
    for model in ("stg_flood_pieces", "stg_flood_blocks", "stg_flood_exposure"):
        _run(con, model, tmp_path)


def _figures(con: duckdb.DuckDBPyConnection, geoid: str) -> dict[str, float]:
    return dict(
        con.execute(
            "SELECT metric_id, value FROM stg_flood_exposure WHERE geoid = ?", [geoid]
        ).fetchall()
    )


def test_a_share_of_homes_weighs_each_block_by_its_homes(con, tmp_path: Path) -> None:
    _flood_world(con, tmp_path, covered=True)
    town = _figures(con, "3402900001")
    # Half of one of two equal blocks: a quarter of the homes, 50 of 200.
    assert town["fema_flood_homes_share"] == pytest.approx(0.25)
    assert town["fema_flood_homes"] == pytest.approx(50)
    assert town["fema_mapped_homes_share"] == pytest.approx(1.0)
    # Ocean County is one NJDEP mapped: a quarter of block A, an eighth of the homes.
    assert town["njdep_tidal_homes_share"] == pytest.approx(0.125)
    # The state has no tidal figure: NJDEP mapped fourteen counties, not twenty-one.
    assert "njdep_tidal_homes_share" not in _figures(con, "34")


def test_no_zone_share_is_given_where_femas_digital_map_does_not_reach(
    con, tmp_path: Path
) -> None:
    """Morris County on 2026-10-02: an unmapped block would read as dry (#301)."""
    _flood_world(con, tmp_path, covered=False)
    town = _figures(con, "3402900001")
    assert town["fema_mapped_homes_share"] == pytest.approx(0.5)
    assert "fema_flood_homes_share" not in town
    assert "fema_flood_homes" not in town


def test_a_polygon_over_2000_vertices_is_cut_without_losing_area(
    con, tmp_path: Path
) -> None:
    ring = [
        [
            round(0.5 + 0.5 * math.cos(i / 2500 * math.tau), 6),
            round(0.5 + 0.5 * math.sin(i / 2500 * math.tau), 6),
        ]
        for i in range(2500)
    ]
    circle = json.dumps({"type": "Polygon", "coordinates": [ring + ring[:1]]})
    _write(
        con,
        tmp_path / "fema_nfhl" / "current" / "zones.parquet",
        [{"FLD_ZONE": "AE", "ZONE_SUBTY": None, "SFHA_TF": "T", "geometry": circle}],
    )
    _write(
        con,
        tmp_path / "njdep_cafe" / "current" / "tidal.parquet",
        [{"FLD_ZONE": "VE", "COUNTY": "Ocean", "geometry": circle}],
    )
    _run(con, "stg_flood_pieces", tmp_path)
    pieces, most, area = con.execute(
        "SELECT count(*), max(ST_NPoints(geom)), sum(ST_Area(geom)) "
        "FROM stg_flood_pieces WHERE class = 'high'"
    ).fetchone()
    whole = con.execute(f"SELECT ST_Area(ST_GeomFromGeoJSON('{circle}'))").fetchone()[0]
    assert pieces > 1 and most <= 2000
    assert area == pytest.approx(whole, rel=1e-9)


def test_contaminated_sites_are_counted_by_status_with_zero_for_none(
    con, tmp_path: Path
) -> None:
    con.execute(
        "CREATE TABLE stg_nj_municipal_codes AS SELECT * FROM (VALUES "
        "('1501', '3402900001'), ('1502', '3402900002')) AS c(identifier, geoid)"
    )
    point = _geojson(con, "ST_Point(0.5, 0.5)")
    sites = [
        {
            "OBJECTID": i,
            "SITE_ID": i,
            "STATUS": status,
            "COMU_CODE": "1501",
            "STATUS_DT": 0,
            "geometry": point,
        }
        for i, status in enumerate(
            ["Active", "Pending", "Active - Post Rem", "Active - UHOT", "Active - UHOT"]
        )
    ]
    _write(con, tmp_path / "njdep_kcsl" / "current" / "sites.parquet", sites)
    (tmp_path / "census_tiger" / "2025").mkdir(parents=True)
    con.execute(
        f"COPY (SELECT '08000' AS GEOID20, ST_AsWKB({_square(0, 0)}) AS geom_wkb) "
        f"TO '{tmp_path / 'census_tiger' / '2025' / 'zcta.parquet'}' (FORMAT PARQUET)"
    )
    _run(con, "stg_njdep_sites", tmp_path)
    counts = dict(
        con.execute(
            "SELECT geoid || ':' || metric_id, value FROM stg_njdep_sites "
            "WHERE level IN ('municipality', 'zip')"
        ).fetchall()
    )
    assert counts["3402900001:njdep_sites_open"] == 2
    assert counts["3402900001:njdep_sites_post_remedy"] == 1
    assert counts["3402900001:njdep_sites_heating_oil"] == 2
    assert counts["3402900002:njdep_sites_open"] == 0
    assert counts["08000:njdep_sites_heating_oil"] == 2
