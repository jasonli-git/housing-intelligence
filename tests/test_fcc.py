"""FCC public summary imports never invent a household or municipal denominator."""

import csv
import io
import json
import zipfile
from pathlib import Path
from typing import Any
from unittest.mock import Mock

import pytest

from hip.api.routers.community import CommunityRecord, community
from hip.config import load_geography
from hip.sources.base import SourceError
from hip.sources.fcc import (
    COUNTIES,
    SPEEDS,
    TECHNOLOGIES,
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
