"""M47 source contracts and public geography, without publisher requests."""

import json
from datetime import date
from pathlib import Path
from typing import Any
from unittest.mock import Mock

import duckdb
import httpx
import jinja2
import pytest

from hip.api.routers.community import CommunityRecord, community, health_inventory
from hip.config import REPO_ROOT
from hip.publish import _plan
from hip.sources import community as sources
from hip.sources.base import ReleaseRef, SourceError
from hip.sources.community import (
    CrimeAdapter,
    PlacesAdapter,
    SchoolPerformanceAdapter,
    percent,
)
from hip.warehouse.community import validate_payload


@pytest.mark.parametrize(
    "raw", ["", "*", "<10%", ">95%", "Fewer than 10 valid scores", "N/A"]
)
def test_suppression_is_not_zero(raw: str) -> None:
    assert percent(raw) is None


@pytest.mark.parametrize("raw", ["NaN", "inf", "-1%", "101%", "new suppression token"])
def test_unknown_or_impossible_percent_fails(raw: str) -> None:
    with pytest.raises(SourceError):
        percent(raw)


def test_zero_percent_is_real_zero() -> None:
    assert percent("0%") == 0


def test_school_discovery_reads_offered_not_future_script_years() -> None:
    a = SchoolPerformanceAdapter()
    a.probe_transport = httpx.MockTransport(
        lambda r: httpx.Response(200, text='<option value="2025-2026">2025</option>')
    )
    assert a.discover(date(2026, 10, 7)).newest == "2025-2026"
    assert a.refs()[0].vintage == "2025-2026"


def test_school_selects_year_all_students_and_preserves_quality_notes(
    monkeypatch: Any,
) -> None:
    identity = {"CountyCode": "01", "DistrictCode": "0010", "DistrictName": "A district"}

    def worksheet(path: Path, sheet: str, required: set[str]) -> list[dict[str, str]]:
        if sheet == "HeaderContact":
            return [identity]
        if sheet == "Data Quality Notes":
            return [{**identity, "Data Quailty Note": "Attendance data incomplete"}]
        column = (
            "ChronicAbsenteeismRate_District"
            if sheet == "ChronicAbsenteeismTrends"
            else "MetExceededExpectations_District"
        )
        return [
            {**identity, "SchoolYear": year, "StudentGroup": group, column: value}
            for year, group, value in [
                ("2024-25", "All Students", "<10%"),
                ("2023-24", "All Students", "99%"),
                ("2024-25", "A subgroup", "80%"),
            ]
        ]

    monkeypatch.setattr(sources, "worksheet", worksheet)
    monkeypatch.setattr(SchoolPerformanceAdapter, "minimum", 1)
    result = SchoolPerformanceAdapter.xlsx_records(
        Path("unused"), SchoolPerformanceAdapter().refs()[0]
    )
    p = json.loads(str(result[0]["payload"]))
    assert len(p["indicators"]) == 3
    assert all(i["value"] is None and i["suppression"] == "<10%" for i in p["indicators"])
    assert p["notes"] == ["Attendance data incomplete"]


def crime_rows(months: str = "12", total: str = "0") -> list[tuple[int, dict[str, str]]]:
    return [
        (1, {"B": "INDEX CRIMES BY COUNTY FOR JAN - 2023 TO DEC - 2023"}),
        (
            4,
            dict(
                zip(
                    "ABCDEFGHIJKL",
                    [
                        "ORINumber",
                        "Agency",
                        "Population",
                        "Murder",
                        "Rape",
                        "Robbery",
                        "Assault",
                        "Burglary",
                        "Larceny",
                        "Auto Theft",
                        "Total",
                        "Months",
                    ],
                    strict=True,
                )
            ),
        ),
        (6, {"A": "NJ0225500", "B": "DEPT OF CORRECTIONS", "C": "0"}),
        (
            7,
            {
                "B": "Number of Offenses",
                **{c: "0" for c in "DEFGHIJ"},
                "K": total,
                "L": months,
            },
        ),
    ]


@pytest.mark.parametrize("months", ["0", "8", "12"])
def test_crime_keeps_reporting_and_uses_chapter_not_ori(
    monkeypatch: Any, months: str
) -> None:
    monkeypatch.setattr(sources, "sheets", lambda path: ["Mercer", "State Police"])
    monkeypatch.setattr(sources, "rows", lambda path, sheet: iter(crime_rows(months)))
    monkeypatch.setattr(CrimeAdapter, "minimum", 1)
    result = CrimeAdapter.xlsx_records(Path("unused"), CrimeAdapter().refs()[0])
    p = json.loads(str(result[0]["payload"]))
    assert result[0]["entity_id"] == "county:34021"
    assert p["months_reported"] == int(months)
    assert p["complete"] == (months == "12")


def test_crime_inconsistent_counts_fail(monkeypatch: Any) -> None:
    monkeypatch.setattr(sources, "sheets", lambda path: ["Mercer"])
    monkeypatch.setattr(sources, "rows", lambda path, sheet: iter(crime_rows(total="1")))
    with pytest.raises(SourceError, match="Invalid crime"):
        CrimeAdapter.xlsx_records(Path("unused"), CrimeAdapter().refs()[0])


def cdc_row() -> dict[str, str]:
    return dict(
        locationid="34001",
        year="2023",
        measureid="GHLTH",
        measure="Fair or poor health among adults",
        datavaluetypeid="CrdPrv",
        data_value_unit="%",
        data_value="12",
        low_confidence_limit="10",
        high_confidence_limit="14",
    )


def test_cdc_fetch_count_checks_and_records_release(
    monkeypatch: Any, tmp_path: Path
) -> None:
    calls = []

    def respond(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if "/api/views/" in request.url.path:
            return httpx.Response(200, json={"name": "PLACES County Data, 2025 release"})
        if "$select" in request.url.params:
            return httpx.Response(200, json=[{"n": "63"}])
        return httpx.Response(
            200,
            json=[
                {**cdc_row(), "locationid": f"34{i:03d}", "measureid": measure}
                for i in range(1, 42, 2)
                for measure in sorted(sources.HEALTH_MEASURES)
            ],
        )

    a = PlacesAdapter()
    monkeypatch.setattr(
        a, "_client", lambda: httpx.Client(transport=httpx.MockTransport(respond))
    )
    path = tmp_path / "cdc.json"
    a._fetch_bytes(a.refs()[0], path)
    result = a.xlsx_records(path, a.refs()[0])
    p = json.loads(str(result[0]["payload"]))
    assert len(result) == 63
    assert p["year"] == 2023 and p["release"] == "2025" and p["confidence"] == 95
    assert all("stateabbr='NJ'" in r.url.params.get("$where", "") for r in calls[1:])


def test_cdc_truncated_page_fails(monkeypatch: Any, tmp_path: Path) -> None:
    def respond(r: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"name": "PLACES County Data, 2025 release"}
            if "/api/views/" in r.url.path
            else [{"n": "63"}]
            if "$select" in r.url.params
            else [cdc_row()],
        )

    a = PlacesAdapter()
    monkeypatch.setattr(
        a, "_client", lambda: httpx.Client(transport=httpx.MockTransport(respond))
    )
    with pytest.raises(SourceError, match="truncated"):
        a._fetch_bytes(a.refs()[0], tmp_path / "no.json")


@pytest.mark.parametrize(
    "overrides",
    [
        {"data_value": "NaN"},
        {"low_confidence_limit": "13"},
        {"data_value_unit": "count"},
        {"locationid": "1"},
    ],
)
def test_cdc_invalid_measurement_fails(tmp_path: Path, overrides: dict[str, str]) -> None:
    path = tmp_path / "bad.json"
    path.write_text(
        json.dumps(
            {
                "release_name": "PLACES County Data, 2025 release",
                "data": [{**cdc_row(), **overrides}],
            }
        )
    )
    with pytest.raises(SourceError):
        PlacesAdapter.xlsx_records(
            path, ReleaseRef("cdc_places", "county", "current", "unused")
        )


@pytest.mark.parametrize(
    "kind,payload",
    [
        ("unknown", {}),
        ("health_estimate", {"confidence": 90}),
        ("school_area", {"approximate_share": 1.1, "district_type": "unified"}),
        ("crime_agency", {"months_reported": 0, "complete": True}),
    ],
)
def test_loader_refuses_invalid_components(kind: str, payload: dict[str, object]) -> None:
    with pytest.raises(ValueError):
        validate_payload(kind, payload)


def row(kind: str, entity: str, key: str, payload: dict[str, Any]) -> dict[str, Any]:
    return dict(
        source_id="test",
        kind=kind,
        entity_id=entity,
        record_id=key,
        payload=payload,
        snapshot=None,
        release_id=1,
        release_layer="test",
        vintage="2025",
        file_sha256="sha",
        fetched_at="2026-10-07T00:00:00Z",
    )


@pytest.mark.parametrize(
    "level,geoid,county,expected",
    [("municipality", "3402160900", "34021", "county"), ("zip", "08540", None, "zip")],
)
def test_api_geography_explicit_no_zip_county_fallback(
    monkeypatch: Any, level: str, geoid: str, county: str | None, expected: str
) -> None:
    from hip.api.routers import community as api

    session = Mock()
    session.execute.return_value.mappings.return_value.first.return_value = dict(
        level=level,
        geoid=geoid,
        name="Princeton",
        county_geoid=county,
        county_name="Mercer",
    )
    local = [
        CommunityRecord(**row("health_estimate", "county:34021", "GHLTH", {})),
        CommunityRecord(**row("health_estimate", "zip:08540", "GHLTH", {})),
        CommunityRecord(**row("crime_agency", "county:34021", "ori", {})),
    ]
    monkeypatch.setattr(
        api,
        "records_for",
        lambda s, entities: [r for r in local if r.entity_id in entities],
    )
    response = community(1, session)
    assert response.health_level == expected
    assert len(response.crime) == (1 if county else 0)
    assert len(response.health) == 1


def test_community_is_in_static_publish_plan() -> None:
    assert dict(_plan([12], []))["/regions/12/community"] == "regions/12/community.json"
    assert (
        dict(_plan([12], []))["/community/health/tract"] == "community/health/tract.json"
    )


@pytest.mark.parametrize("level", ["county", "tract", "zip"])
def test_health_inventory_export_keeps_exact_geography_and_provenance(level: str) -> None:
    session = Mock()
    entity = f"{level}:34001000100"
    session.execute.return_value.mappings.return_value = [
        row("health_estimate", entity, "GHLTH", {"confidence": 95})
    ]
    result = health_inventory(level, session)  # type: ignore[arg-type]
    assert result[0].entity_id == entity and result[0].file_sha256 == "sha"
    assert session.execute.call_args.args[1] == {"prefix": f"{level}:%"}


def test_staging_carries_the_landed_stamp_without_newline(tmp_path: Path) -> None:
    path = tmp_path / "nj_school_performance" / "2024-2025" / "districts.parquet"
    path.parent.mkdir(parents=True)
    sha = "a" * 64
    with duckdb.connect() as c:
        c.execute(
            """COPY (SELECT 'school_performance' AS kind,'district:01-0010' AS entity_id,
            '01-0010' AS record_id,'{}' AS payload,'2025-06-30' AS snapshot)
            TO ? (FORMAT PARQUET)""",
            [str(path)],
        )
        path.with_suffix(".parquet.src").write_text(sha + "\n")
        sql = (
            REPO_ROOT / "dbt/models/staging/stg_nj_school_performance_records.sql"
        ).read_text()
        rendered = (
            jinja2.Environment()
            .from_string(sql)
            .render(
                config=lambda **kwargs: "",
                var=lambda name: str(tmp_path),
                release_vintage=lambda: (
                    "regexp_extract(filename, '/([^/]+)/[^/]+\\.parquet$',1)"
                ),
            )
        )
        assert c.execute(rendered).fetchone()[-1] == sha
