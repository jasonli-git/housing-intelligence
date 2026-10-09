"""NCES's district directory, read to explain districts with no NJDOE results (#356)."""

import csv
import io
import json
import zipfile
from pathlib import Path

import pytest

from hip.sources.base import ReleaseRef, SourceError
from hip.sources.community import DISTRICT_SUCCESSORS, DistrictDirectoryAdapter
from hip.warehouse.community import validate_payload

FIELDS = [
    "SCHOOL_YEAR",
    "ST",
    "ST_LEAID",
    "LEAID",
    "LEA_NAME",
    "SY_STATUS_TEXT",
    "LEA_TYPE_TEXT",
    "OPERATIONAL_SCHOOLS",
    "GSLO",
    "GSHI",
]


def _row(code: str, **fields: str) -> dict[str, str]:
    return {
        "SCHOOL_YEAR": "2024-2025",
        "ST": "NJ",
        "ST_LEAID": f"NJ-{code.replace('-', '')}",
        "LEAID": f"34{code.replace('-', '')}",
        "LEA_NAME": f"District {code}",
        "SY_STATUS_TEXT": "Open",
        "LEA_TYPE_TEXT": "Regular public school district",
        "OPERATIONAL_SCHOOLS": "2",
        "GSLO": "KG",
        "GSHI": "12",
        **fields,
    }


def _directory(**changed: dict[str, str]) -> list[dict[str, str]]:
    rows = {f"99-{i:04d}": _row(f"99-{i:04d}") for i in range(500)}
    for old in DISTRICT_SUCCESSORS:
        rows[old] = _row(old, SY_STATUS_TEXT="Closed", OPERATIONAL_SCHOOLS="0")
    for new in set(DISTRICT_SUCCESSORS.values()):
        rows[new] = _row(new, SY_STATUS_TEXT="New", OPERATIONAL_SCHOOLS="3")
    rows["01-0960"] = _row("01-0960", OPERATIONAL_SCHOOLS="0", GSLO="N", GSHI="N")
    for code, fields in changed.items():
        rows[code.replace("_", "-")] = {**rows[code.replace("_", "-")], **fields}
    return [*rows.values(), _row("36-0001", ST="NY")]


def _zip(tmp_path: Path, rows: list[dict[str, str]]) -> Path:
    text = io.StringIO()
    writer = csv.DictWriter(text, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(rows)
    path = tmp_path / "ccd.zip"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("ccd_lea_029_2425.csv", text.getvalue())
    return path


def _ref() -> ReleaseRef:
    return DistrictDirectoryAdapter(states=["NJ"]).refs()[0]


def _by_id(records: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    return {str(r["record_id"]): json.loads(str(r["payload"])) for r in records}


def test_each_state_district_is_kept_by_njdoe_code(tmp_path: Path) -> None:
    records = DistrictDirectoryAdapter.xlsx_records(_zip(tmp_path, _directory()), _ref())
    by_id = _by_id(records)
    assert "36-0001" not in by_id
    assert by_id["01-0960"]["operational_schools"] == 0
    assert records[0]["kind"] == "district_status"
    for payload in by_id.values():
        validate_payload("district_status", payload)


def test_a_reviewed_merger_names_its_successor(tmp_path: Path) -> None:
    by_id = _by_id(
        DistrictDirectoryAdapter.xlsx_records(_zip(tmp_path, _directory()), _ref())
    )
    for old, new in DISTRICT_SUCCESSORS.items():
        assert by_id[old]["successor"]["district_id"] == new  # type: ignore[index]
    assert "successor" not in by_id["01-0960"]


@pytest.mark.parametrize(
    "changed",
    [
        # The predecessor reopened, or its successor runs no schools: review the table.
        {"25_0130": {"SY_STATUS_TEXT": "Open"}},
        {"25_1456": {"OPERATIONAL_SCHOOLS": "0"}},
    ],
)
def test_a_merger_the_directory_no_longer_shows_fails(
    tmp_path: Path, changed: dict[str, dict[str, str]]
) -> None:
    with pytest.raises(SourceError, match="DISTRICT_SUCCESSORS"):
        DistrictDirectoryAdapter.xlsx_records(
            _zip(tmp_path, _directory(**changed)), _ref()
        )


def test_another_year_or_a_short_file_fails(tmp_path: Path) -> None:
    rows = _directory()
    rows[0] = {**rows[0], "SCHOOL_YEAR": "2023-2024"}
    with pytest.raises(SourceError, match="2023-2024"):
        DistrictDirectoryAdapter.xlsx_records(_zip(tmp_path, rows), _ref())
    with pytest.raises(SourceError, match="unexpectedly small"):
        DistrictDirectoryAdapter.xlsx_records(_zip(tmp_path, _directory()[450:]), _ref())


def test_an_unreviewed_year_is_refused() -> None:
    with pytest.raises(SourceError, match="no reviewed directory"):
        DistrictDirectoryAdapter(states=["NJ"]).refs("2025-26")


def test_a_successor_on_an_open_district_is_invalid() -> None:
    with pytest.raises(ValueError, match="successor"):
        validate_payload(
            "district_status",
            {
                "status": "Open",
                "operational_schools": 1,
                "successor": {"district_id": "25-1456"},
            },
        )
