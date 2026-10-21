"""NJDEP's OPRA response 407131: the 2025 and 2026 service-line inventories
(ARCHITECTURE #409). Synthetic workbooks only; the real file is not committed."""

import json
import zipfile
from pathlib import Path

import pytest

from hip.api.routers.infrastructure import InfrastructureRecord
from hip.api.routers.water_systems import newest_inventory
from hip.sources.base import SourceError
from hip.sources.infrastructure import LeadLinesOpraAdapter

HEADER = [
    "PWSID",
    "Water System Name",
    "Submittal Date",
    "Lead Service Lines",
    "Galvanized Requiring Replacement Service Lines",
    "Lead Status Unknown Service Lines",
    "Non-lead service lines",
]
NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def workbook(path: Path, sheets: dict[str, list[list[str]]]) -> Path:
    def sheet_xml(rows: list[list[str]]) -> str:
        body = "".join(
            f'<row r="{r}">'
            + "".join(
                f'<c r="{"ABCDEFG"[c]}{r}" t="inlineStr"><is><t>{v}</t></is></c>'
                for c, v in enumerate(values)
            )
            + "</row>"
            for r, values in enumerate(rows, start=1)
        )
        return f'<worksheet xmlns="{NS}"><sheetData>{body}</sheetData></worksheet>'

    names = list(sheets)
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(
            "xl/workbook.xml",
            f'<workbook xmlns="{NS}" xmlns:r="{REL}"><sheets>'
            + "".join(
                f'<sheet name="{n}" sheetId="{i}" r:id="rId{i}"/>'
                for i, n in enumerate(names, start=1)
            )
            + "</sheets></workbook>",
        )
        z.writestr(
            "xl/_rels/workbook.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
            'relationships">'
            + "".join(
                f'<Relationship Id="rId{i}" Target="worksheets/sheet{i}.xml" Type="x"/>'
                for i in range(1, len(names) + 1)
            )
            + "</Relationships>",
        )
        for i, n in enumerate(names, start=1):
            z.writestr(f"xl/worksheets/sheet{i}.xml", sheet_xml(sheets[n]))
    return path


def systems(year: str, count: int = 160) -> list[list[str]]:
    return [HEADER] + [
        [f"NJ{n:07d}", f"SYSTEM {n}", f"07/1{n % 10}/{year}", "3", "4", "5", str(n)]
        for n in range(1, count + 1)
    ]


REF = LeadLinesOpraAdapter().refs()[0]


def test_both_submission_years_become_records(tmp_path: Path) -> None:
    path = workbook(
        tmp_path / "w.xlsx", {"2025": systems("2025"), "2026": systems("2026")}
    )
    records = LeadLinesOpraAdapter.xlsx_records(path, REF)
    assert len(records) == 320
    first = records[0]
    assert first["record_id"] == "NJ0000001:2025"
    payload = json.loads(str(first["payload"]))
    assert payload["lead"] == 3 and payload["galvanized"] == 4 and payload["unknown"] == 5
    assert payload["lead_connectors"] is None and payload["category_updated"] is None
    assert payload["submission_year"] == 2025 and payload["submitted"] == "2025-07-11"
    assert payload["opra_request"] == "407131"


@pytest.mark.parametrize(
    "change",
    ["header", "sheet", "count", "pwsid", "duplicate", "date", "few"],
)
def test_an_unreviewed_layout_is_refused(tmp_path: Path, change: str) -> None:
    rows = systems("2025", 320)
    sheets = {"2025": rows}
    if change == "header":
        rows[0][3] = "Lead Lines"
    elif change == "sheet":
        sheets = {"Inventory": rows}
    elif change == "count":
        rows[5][4] = "12.5"
    elif change == "pwsid":
        rows[5][0] = "PA1234567"
    elif change == "duplicate":
        rows[6][0] = rows[5][0]
    elif change == "date":
        rows[5][2] = "2025-07-01"
    else:
        sheets = {"2025": rows[:100]}
    with pytest.raises(SourceError):
        LeadLinesOpraAdapter.xlsx_records(workbook(tmp_path / "w.xlsx", sheets), REF)


def record(source: str, year: int) -> InfrastructureRecord:
    return InfrastructureRecord(
        source_id=source,
        kind="lead_inventory",
        entity_id="pwsid:NJ0102001",
        record_id=f"NJ0102001:{year}",
        payload={"submission_year": year, "lead": year - 2000},
        release_id=1,
        vintage="v",
        file_sha256="0" * 64,
        fetched_at="2026-10-21T00:00:00Z",
    )


def test_a_system_shows_its_newest_submission_whichever_source_holds_it() -> None:
    context = [
        record("njdep_lead_lines", 2024),
        record("njdep_lead_lines_opra", 2026),
        record("njdep_lead_lines_opra", 2025),
    ]
    newest = newest_inventory(context, "NJ0102001")
    assert newest is not None and newest.payload["submission_year"] == 2026
    assert newest_inventory(context[:1], "NJ0102001").payload["submission_year"] == 2024
    assert newest_inventory(context, "NJ9999999") is None
