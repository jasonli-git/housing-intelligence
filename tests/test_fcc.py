"""FCC public summary imports never invent a household or municipal denominator."""

import csv
import io
import json
import zipfile
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from unittest.mock import Mock

import pytest

from hip.api.routers.community import CommunityRecord, community
from hip.config import load_geography
from hip.sources.base import SourceError
from hip.sources.fcc import (
    COUNTIES,
    SERVED_FIELDS,
    SPEEDS,
    TECHNOLOGIES,
    BroadbandLocationsAdapter,
    BroadbandSummaryAdapter,
    vintage_dates,
)
from hip.sources.registry import build_adapter
from hip.warehouse.community import validate_payload


def summary_rows() -> list[dict[str, str]]:
    return [
        {
            "area_data_type": "Total",
            "geography_type": level,
            "geography_id": geoid,
            "geography_desc": "A geography",
            "total_units": "100",
            "biz_res": "R",
            "technology": tech,
            **dict.fromkeys(SPEEDS, "0.75"),
        }
        for level, geoids in (("State", ["34"]), ("County", sorted(COUNTIES)))
        for geoid in geoids
        for tech in sorted(TECHNOLOGIES)
    ]


def archive(path: Path, rows: list[dict[str, str]], *, member: str | None = None) -> Path:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(summary_rows()[0]))
    writer.writeheader()
    writer.writerows(rows)
    ref = BroadbandSummaryAdapter().refs()[0]
    with zipfile.ZipFile(path, "w") as zipped:
        zipped.writestr(
            member or BroadbandSummaryAdapter.filename(ref).replace(".zip", ".csv"),
            buffer.getvalue(),
        )
    return path


def test_summary_selects_total_residential_state_and_all_counties(tmp_path: Path) -> None:
    rows = summary_rows()
    rows.extend(
        [
            {**rows[0], "biz_res": "B"},
            {**rows[0], "area_data_type": "Rural"},
            {**rows[0], "geography_type": "Census Place", "geography_id": "3460900"},
        ]
    )
    ref = BroadbandSummaryAdapter().refs()[0]
    records = BroadbandSummaryAdapter.xlsx_records(
        archive(tmp_path / "fcc.zip", rows), ref
    )
    assert len(records) == 66
    assert {r["entity_id"] for r in records} == {
        "state:34",
        *(f"county:{c}" for c in COUNTIES),
    }
    payload = json.loads(str(records[0]["payload"]))
    assert payload["as_of"] == "2025-12-31" and payload["revision"] == "2026-09-29"
    assert payload["shares"]["speed_100_20"] == 0.75
    assert payload["total_units"] == 100 and "not households" in payload["denominator"]


@pytest.mark.parametrize(
    "scenario",
    [
        "negative",
        "nan",
        "over_one",
        "empty",
        "nonmonotone",
        "zero_units",
        "different_units",
        "duplicate",
        "county_missing",
        "wrong_revision",
    ],
)
def test_bad_summaries_fail_closed(tmp_path: Path, scenario: str) -> None:
    rows = summary_rows()
    if scenario in {"negative", "nan", "over_one", "empty"}:
        rows[0]["speed_100_20"] = {
            "negative": "-0.1",
            "nan": "NaN",
            "over_one": "1.1",
            "empty": "",
        }[scenario]
    elif scenario == "nonmonotone":
        rows[0]["speed_1000_100"] = "0.9"
    elif scenario == "zero_units":
        rows[0]["total_units"] = "0"
    elif scenario == "different_units":
        rows[0]["total_units"] = "200"
    elif scenario == "duplicate":
        rows.append(rows[0])
    elif scenario == "county_missing":
        rows = [r for r in rows if r["geography_id"] != "34001"]
    path = archive(
        tmp_path / "bad.zip",
        rows,
        member="different.csv" if scenario == "wrong_revision" else None,
    )
    with pytest.raises(SourceError):
        BroadbandSummaryAdapter.xlsx_records(path, BroadbandSummaryAdapter().refs()[0])


@pytest.mark.parametrize("scenario", ["unknown_key", "nonmonotone", "bad_date"])
def test_loader_checks_broadband_schema_and_dates(tmp_path: Path, scenario: str) -> None:
    ref = BroadbandSummaryAdapter().refs()[0]
    records = BroadbandSummaryAdapter.xlsx_records(
        archive(tmp_path / "fcc.zip", summary_rows()), ref
    )
    payload = json.loads(str(records[0]["payload"]))
    validate_payload("broadband_summary", payload)
    if scenario == "unknown_key":
        payload["shares"]["unknown"] = payload["shares"].pop("speed_100_20")
    elif scenario == "nonmonotone":
        payload["shares"]["speed_1000_100"] = 0.9
    else:
        payload["as_of"] = "2025-11-30"
    with pytest.raises((ValueError, SourceError)):
        validate_payload("broadband_summary", payload)


@pytest.mark.parametrize(
    "value",
    ["2025", "2025-11-30_2026-09-29", "2025-12-31_2025-09-29", "2025-12-31_2026-99-99"],
)
def test_vintage_names_as_of_and_revision_not_a_download_date(value: str) -> None:
    with pytest.raises(SourceError):
        vintage_dates(value)


def test_manual_source_keeps_last_release_offline_and_registry_reads_new_cache(
    tmp_path: Path,
) -> None:
    adapter = BroadbandSummaryAdapter()
    ref = adapter.refs()[0]
    manual = adapter.manual_path(ref, tmp_path / "raw")
    manual.parent.mkdir(parents=True)
    archive(manual, summary_rows())
    downloaded = adapter.fetch(ref, raw_dir=tmp_path / "raw")
    manual.unlink()
    assert adapter.fetch(ref, raw_dir=tmp_path / "raw").from_cache
    assert downloaded.ref.url == "https://broadbandmap.fcc.gov/data-download"
    newer = adapter.refs("2026-06-30_2026-10-01")[0]
    new_file = adapter.manual_path(newer, tmp_path / "raw")
    new_file.write_bytes(downloaded.path.read_bytes())
    adapter.fetch(newer, raw_dir=tmp_path / "raw")
    rebuilt = build_adapter("fcc_bdc", load_geography(), raw_dir=tmp_path / "raw")
    assert rebuilt.refs()[0].vintage == newer.vintage
    with pytest.raises(SourceError, match="declared period"):
        BroadbandSummaryAdapter.xlsx_records(new_file, newer)


@pytest.mark.parametrize("level", ["county", "municipality", "zip"])
def test_api_never_labels_county_broadband_as_town_or_zip(
    monkeypatch: Any, level: str
) -> None:
    from hip.api.routers import community as api

    county = "34035" if level != "zip" else None
    session = Mock()
    session.execute.return_value.mappings.return_value.first.return_value = dict(
        geoid="34035"
        if level == "county"
        else "3403500001"
        if level == "municipality"
        else "08540",
        level=level,
        name="Somerset County" if level == "county" else "A town",
        county_geoid=county,
        county_name="Somerset County",
    )
    record = CommunityRecord(
        source_id="fcc_bdc",
        kind="broadband_summary",
        entity_id="county:34035",
        record_id="All Wired",
        payload={},
        snapshot="2025-12-31",
        release_id=1,
        release_layer="summary",
        vintage="2025-12-31_2026-09-29",
        file_sha256="a" * 64,
        fetched_at="2026-10-07T00:00:00Z",
    )
    monkeypatch.setattr(
        api,
        "records_for",
        lambda s, entities: [record] if record.entity_id in entities else [],
    )
    response = community(1, session)
    assert len(response.broadband) == (0 if level == "zip" else 1)
    assert response.broadband_level == (None if level == "zip" else "county")
    assert response.broadband_status == (
        "not_matched" if level == "zip" else "published_summary"
    )


def location_archive(path: Path, layer: str, rows: list[list[str]]) -> Path:
    """A served/unserved or fiber file as FCC ships it: one CSV inside a ZIP."""
    ref = next(r for r in BroadbandLocationsAdapter().refs() if r.layer == layer)
    header = (
        list(SERVED_FIELDS)
        if layer == "served"
        else ["frn", "provider_id", "brand_name", "location_id", "technology"]
        + ["max_advertised_download_speed", "max_advertised_upload_speed"]
        + ["low_latency", "business_residential_code", "state_usps", "block_geoid"]
        + ["h3_res8_id"]
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    with zipfile.ZipFile(path, "w") as zipped:
        zipped.writestr(
            BroadbandLocationsAdapter.filename(ref).replace(".zip", ".csv"),
            buffer.getvalue(),
        )
    return path


A, B = "340030174004007", "340373746002010"


def fiber_row(location: str, block: str, brand: str = "Verizon") -> list[str]:
    return ["0001", "131425", brand, location, "50", "2300", "2300", "1", "X", "NJ"] + [
        block,
        "882a1050b1fffff",
    ]


def test_location_files_reduce_to_counts_per_block(
    tmp_path: Path, monkeypatch: Any
) -> None:
    monkeypatch.setattr(BroadbandLocationsAdapter, "minimum", 1)
    served, fiber = BroadbandLocationsAdapter().refs()
    assert BroadbandLocationsAdapter.filename(served) == (
        "bdc_34_fixed_broadband_served_unserved_D25_13oct2026.zip"
    )
    assert BroadbandLocationsAdapter.filename(fiber) == (
        "bdc_34_FibertothePremises_fixed_broadband_D25_13oct2026.zip"
    )
    rows = [
        ["1", A, "h", "1", "1", "1"],
        ["2", A, "h", "1", "0", "1"],
        ["3", B, "h", "1", "0", "0"],
    ]
    assert BroadbandLocationsAdapter.xlsx_records(
        location_archive(tmp_path / "s.zip", "served", rows), served
    ) == [
        {"block": A, "locations": 2, "unserved_wired": 1, "unserved_terrestrial": 0},
        {"block": B, "locations": 1, "unserved_wired": 1, "unserved_terrestrial": 1},
    ]
    # Two providers at one location count it once; a brand with a comma stays one field.
    offers = [fiber_row("1", A), fiber_row("1", A, "Comcast, Inc."), fiber_row("3", B)]
    assert BroadbandLocationsAdapter.xlsx_records(
        location_archive(tmp_path / "f.zip", "fiber", offers), fiber
    ) == [{"block": A, "fiber": 1}, {"block": B, "fiber": 1}]


@pytest.mark.parametrize(
    "layer,rows",
    [
        ("served", [["1", A, "h", "1", "1", "1"], ["1", A, "h", "1", "1", "1"]]),
        ("served", [["1", "360610001001000", "h", "1", "1", "1"]]),
        ("served", [["1", A, "h", "1", "2", "1"]]),
        ("fiber", [fiber_row("1", A)[:4] + ["40"] + fiber_row("1", A)[5:]]),
        ("fiber", [fiber_row("1", A), fiber_row("1", B)]),
    ],
)
def test_location_files_fail_closed(
    tmp_path: Path, monkeypatch: Any, layer: str, rows: list[list[str]]
) -> None:
    monkeypatch.setattr(BroadbandLocationsAdapter, "minimum", 1)
    ref = next(r for r in BroadbandLocationsAdapter().refs() if r.layer == layer)
    with pytest.raises(SourceError):
        BroadbandLocationsAdapter.xlsx_records(
            location_archive(tmp_path / "x.zip", layer, rows), ref
        )


def test_too_few_blocks_is_not_a_new_jersey_file(tmp_path: Path) -> None:
    served = BroadbandLocationsAdapter().refs()[0]
    path = location_archive(tmp_path / "s.zip", "served", [["1", A, "h", "1", "1", "1"]])
    with pytest.raises(SourceError, match="too few blocks"):
        BroadbandLocationsAdapter.xlsx_records(path, served)


def place_payload(**changes: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "locations": 100,
        "fiber": 70,
        "unserved_wired": 3,
        "unserved_terrestrial": 2,
        "unplaced": 0,
        "as_of": "2025-12-31",
        "revision": "2026-10-13",
        "url": "https://broadbandmap.fcc.gov/data-download/nationwide-data",
    }
    return {**payload, **changes}


@pytest.mark.parametrize(
    "changes",
    [{"locations": 0}, {"fiber": 101}, {"unserved_wired": -1}, {"fiber": 1.5}],
)
def test_loader_checks_place_counts(changes: dict[str, object]) -> None:
    validate_payload("broadband_place", place_payload())
    with pytest.raises(ValueError):
        validate_payload("broadband_place", place_payload(**changes))


@pytest.mark.parametrize("level", ["county", "municipality", "zip"])
def test_api_gives_each_place_its_own_location_counts(
    monkeypatch: Any, level: str
) -> None:
    from hip.api.routers import community as api

    geoid = {"county": "34035", "municipality": "3403500001", "zip": "08540"}[level]
    session = Mock()
    session.execute.return_value.mappings.return_value.first.return_value = dict(
        geoid=geoid,
        level=level,
        name="A place",
        county_geoid=None if level == "zip" else "34035",
        county_name="Somerset County",
    )
    own = CommunityRecord(
        source_id="fcc_bdc_locations",
        kind="broadband_place",
        entity_id=f"{level}:{geoid}",
        record_id="locations",
        payload=place_payload(),
        snapshot=date(2025, 12, 31),
        release_id=2,
        release_layer="served",
        vintage="2025-12-31_2026-10-13",
        file_sha256="b" * 64,
        fetched_at=datetime(2026, 10, 14, tzinfo=UTC),
    )
    county = own.model_copy(update={"entity_id": "county:34035"})
    monkeypatch.setattr(
        api,
        "records_for",
        lambda s, entities: [r for r in (own, county) if r.entity_id in entities],
    )
    place = community(1, session).broadband_place
    assert place is not None and place.entity_id == f"{level}:{geoid}"
