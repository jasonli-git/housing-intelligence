"""Dated manual LIHTC releases cannot steal a newer vintage or invent availability."""

import json
from datetime import date
from pathlib import Path

import duckdb
import httpx
import jinja2
import pytest

from hip.config import REPO_ROOT, load_geography
from hip.landing.tabular import land_xlsx_records
from hip.sources.base import SourceError
from hip.sources.hud_assistance import HudLihtcAdapter
from hip.sources.registry import build_adapter
from tests.test_affordable_housing import workbook


def bulk(path: Path, records: list[dict[str, str]]) -> Path:
    fields = list(HudLihtcAdapter.FIELDS) + ["contact"]
    cols = [chr(65 + i) for i in range(len(fields))]
    return workbook(
        path,
        "Data",
        {
            1: dict(zip(cols, fields, strict=True)),
            **{
                i + 2: {
                    col: record.get(field, "")
                    for col, field in zip(cols, fields, strict=True)
                }
                for i, record in enumerate(records)
            },
        },
    )


def test_only_nj_program_fields_land_and_unknowns_remain_unknown(tmp_path: Path) -> None:
    a = HudLihtcAdapter()
    path = bulk(
        tmp_path / "bulk.xlsx",
        [
            {
                "hud_id": "NJA20240001",
                "proj_st": "NJ",
                "n_units": "0",
                "li_units": ".",
                "yr_pis": "8888",
                "nonprog": "1",
                "contact": "private",
            },
            {"hud_id": "NYA20240001", "proj_st": "NY", "n_units": "10"},
        ],
    )
    rows = a.xlsx_records(path, a.refs()[0])
    assert len(rows) == 1
    assert rows[0]["n_units"] == 0 and rows[0]["li_units"] is None
    assert rows[0]["yr_pis"] == "8888" and rows[0]["nonprog"] == "1"
    assert rows[0]["coverage_through"] == 2024
    assert "contact" not in rows[0]


def test_duplicates_and_header_drift_fail_before_landing(tmp_path: Path) -> None:
    a = HudLihtcAdapter()
    path = bulk(tmp_path / "bulk.xlsx", [{"hud_id": "same", "proj_st": "NJ"}] * 2)
    with pytest.raises(SourceError, match="duplicate"):
        a.xlsx_records(path, a.refs()[0])
    path = workbook(tmp_path / "wrong.xlsx", "Data", {1: {"A": "different"}})
    with pytest.raises(SourceError, match="header changed"):
        a.xlsx_records(path, a.refs()[0])


def test_discovery_uses_completed_coverage_not_announced_next_release() -> None:
    a = HudLihtcAdapter()
    a.probe_transport = httpx.MockTransport(
        lambda _: httpx.Response(
            200,
            text=(
                "Projects placed in service between 1987 and 2024. "
                "2025 data will be added in spring 2027."
            ),
        )
    )
    assert a.discover(date(2026, 10, 4)).newest == "2024"
    a.probe_transport = httpx.MockTransport(
        lambda _: httpx.Response(
            200, text=("Projects placed in service between 1987 and 2025.")
        )
    )
    assert a.discover(date(2027, 4, 1)).newest == "2025"
    a.probe_transport = httpx.MockTransport(
        lambda _: httpx.Response(200, text="Bot check")
    )
    assert a.discover(date(2027, 4, 1)).outcome == "unreachable"


def test_new_release_requires_new_manual_file_not_old_cached_bytes(
    tmp_path: Path,
) -> None:
    a = HudLihtcAdapter()
    ref = a.refs()[0]
    raw = tmp_path / "raw"
    path = a.manual_path(ref, raw)
    path.parent.mkdir(parents=True)
    bulk(path, [{"hud_id": "NJA20240001", "proj_st": "NJ"}])
    first = a.fetch(ref, raw_dir=raw)
    assert a.fetch(ref, raw_dir=raw).sha256 == first.sha256
    a.newest = "2025"
    assert a.filename(a.refs()[0]) == "LIHTCPUB_2025.xlsx"
    with pytest.raises(SourceError, match="downloaded by hand"):
        a.fetch(a.refs()[0], raw_dir=raw)
    newer = a.manual_path(a.refs()[0], raw)
    bulk(newer, [{"hud_id": "NJA20250001", "proj_st": "NJ"}])
    a.fetch(a.refs()[0], raw_dir=raw)
    rebuilt = build_adapter(a.source_id, load_geography(), raw_dir=raw)
    assert rebuilt.refs()[0].vintage == "2025"
    assert rebuilt.fetch(rebuilt.refs()[0], raw_dir=raw, cached_only=True).from_cache


def test_staging_uses_latest_release_and_verified_place_relationships(
    tmp_path: Path,
) -> None:
    a = HudLihtcAdapter()
    parquet = tmp_path / "parquet"
    for year, items in (
        ("2024", [{"hud_id": "old", "proj_st": "NJ", "n_units": "5"}]),
        (
            "2025",
            [
                {
                    "hud_id": "exact",
                    "proj_st": "NJ",
                    "cnty2020": "1",
                    "place2020": "100",
                    "yr_pis": "2026",
                    "nonprog": "1",
                    "n_units": "5",
                },
                {
                    "hud_id": "ambiguous",
                    "proj_st": "NJ",
                    "cnty2020": "1",
                    "place2020": "200",
                    "yr_pis": "8888",
                },
                {
                    "hud_id": "cdp",
                    "proj_st": "NJ",
                    "cnty2020": "1",
                    "place2020": "300",
                    "yr_pis": "9999",
                },
                {"hud_id": "unlocated", "proj_st": "NJ", "cnty2020": "."},
            ],
        ),
    ):
        ref = a.refs(year)[0]
        path = a.manual_path(ref, tmp_path / "raw")
        path.parent.mkdir(parents=True, exist_ok=True)
        bulk(path, items)
        land_xlsx_records(
            a.fetch(ref, raw_dir=tmp_path / "raw"), type(a), parquet_dir=parquet
        )
    bps = parquet / "census_permits/2025"
    bps.mkdir(parents=True)
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE permits AS SELECT * FROM (VALUES "
        "('34','001','00100','00100'), ('34','001','00200','00200'), "
        "('34','001','00200','00400'), ('34','001','00000','00300')) "
        "p(column01,column03,column05,column06)"
    )
    con.execute("COPY permits TO ? (FORMAT PARQUET)", [str(bps / "place_NE.parquet")])
    con.execute("CREATE TABLE stg_nj_municipal_codes AS SELECT '3400100100' AS geoid")
    query = (
        jinja2.Environment()
        .from_string(
            (REPO_ROOT / "dbt/models/staging/stg_hud_lihtc_records.sql").read_text()
        )
        .render(
            config=lambda **_: "",
            ref=lambda name: name,
            var=lambda name: str(parquet),
            release_vintage=lambda: (
                "regexp_extract(filename, '/([^/]+)/[^/]+[.]parquet$', 1)"
            ),
        )
    )
    result = {r[1]: r for r in con.execute(query).fetchall()}
    assert set(result) == {"exact", "ambiguous", "cdp", "unlocated"}
    assert result["exact"][2:4] == ("3400100100", "municipality")
    assert result["ambiguous"][2:4] == ("34001", "county")
    assert result["cdp"][2:4] == ("34001", "county")
    assert result["unlocated"][2:4] == ("34", "state")
    p = json.loads(result["exact"][5])
    assert p["service_year_status"] == "after coverage year"
    assert p["no_longer_monitored"] is True
    assert "earliest_controls_end" not in p
    assert json.loads(result["ambiguous"][5])["placed_in_service"] is None
    assert json.loads(result["cdp"][5])["no_longer_monitored"] is None
    assert all(r[6] == date(2025, 12, 31) and r[8] == "2025" for r in result.values())
