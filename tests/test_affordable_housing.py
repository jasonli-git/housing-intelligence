"""Affordable housing guards: no guessed towns, zeroed blanks or combined programmes."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile

import duckdb
import httpx
import jinja2
import pytest

from hip.config import REPO_ROOT, load_metrics, load_sources
from hip.publish import _plan
from hip.sources.base import SourceError
from hip.sources.hud_assistance import HudAssistedAdapter, HudLihtcAdapter
from hip.sources.nj_affordable import NjAffordableAdapter, number
from hip.sources.xlsx import rows
from hip.validate.gate import VALUE_BOUNDS


def workbook(path: Path, sheet: str, cells: dict[int, dict[str, str]]) -> Path:
    """An offered sparse workbook, with inline strings and one cached formula."""
    with ZipFile(path, "w") as z:
        z.writestr(
            "xl/workbook.xml",
            '<workbook xmlns="http://schemas.openxmlformats.org/'
            'spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/'
            f'officeDocument/2006/relationships"><sheets><sheet name="{sheet}" '
            'sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        z.writestr(
            "xl/_rels/workbook.xml.rels",
            '<Relationships><Relationship Id="rId1" '
            'Target="worksheets/sheet1.xml"/></Relationships>',
        )
        body = ""
        for index, row in cells.items():
            contents = "".join(
                f'<c r="{col}{index}" t="inlineStr"><is><t>{escape(v)}</t></is></c>'
                for col, v in row.items()
            )
            body += f'<row r="{index}">{contents}</row>'
        body += '<row r="5001"><c r="A5001"><f>1+2</f><v>3</v></c></row>'
        z.writestr(
            "xl/worksheets/sheet1.xml",
            '<worksheet xmlns="http://schemas.'
            'openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
            + body
            + "</sheetData></worksheet>",
        )
    return path


def dca_ref(layer: str):  # type: ignore[no-untyped-def]
    return next(r for r in NjAffordableAdapter().refs() if r.layer == layer)


def test_sparse_xlsx_reads_past_900_and_uses_only_cached_formula(tmp_path: Path) -> None:
    path = workbook(tmp_path / "sparse.xlsx", "Sheet1", {3000: {"A": "Late row"}})
    assert list(rows(path, "Sheet1")) == [(3000, {"A": "Late row"}), (5001, {"A": "3"})]


def test_1904_workbook_dates_are_refused_instead_of_shifted(tmp_path: Path) -> None:
    path = workbook(tmp_path / "old-dates.xlsx", "Sheet1", {4: {"A": "46000"}})
    with ZipFile(path) as z:
        files = {name: z.read(name) for name in z.namelist()}
    files["xl/workbook.xml"] = files["xl/workbook.xml"].replace(
        b"<sheets>", b'<workbookPr date1904="1"/><sheets>'
    )
    with ZipFile(path, "w") as z:
        for name, content in files.items():
            z.writestr(name, content)
    with pytest.raises(SourceError, match="1904 date system"):
        list(rows(path, "Sheet1"))


def test_dca_reads_capped_need_not_uncapped_column(tmp_path: Path) -> None:
    path = workbook(
        tmp_path / "need.xlsx",
        "Final Summary",
        {
            3: {"B": "DCA Municode", "Q": "Prospective Need 1,000/20% Cap"},
            4: {"A": "3400100100", "B": "0101", "F": "39", "L": "9000", "Q": "22"},
        },
    )
    row = NjAffordableAdapter.xlsx_records(path, dca_ref("need"))[0]
    p = json.loads(str(row["payload"]))
    assert p["prospective_need"] == 22
    assert p["present_need"] == 39
    assert p["non_binding"] is True


def test_missing_trust_submission_overrides_numeric_zero_and_negative_survives(
    tmp_path: Path,
) -> None:
    path = workbook(
        tmp_path / "trust.xlsx",
        "Data Summary - AHTF Data",
        {
            4: {"B": "DCA Muni Code", "K": "Balance in Account - 3/6/26", "BC": "46069"},
            5: {"B": "0101", "G": "Y", "H": "X", "K": "0"},
            6: {"B": "0102", "G": "Y", "K": "-100"},
        },
    )
    output = NjAffordableAdapter.xlsx_records(path, dca_ref("trust_funds"))
    missing, negative = [json.loads(str(r["payload"])) for r in output]
    assert missing["balance"] is None and missing["reported"] is False
    assert negative["balance"] == -100
    assert negative["table_as_of"] == "2026-03-06"
    assert negative["metadata_cutoff"] == "2026-02-16"


def test_project_blanks_are_unknown_not_incomplete_or_zero(tmp_path: Path) -> None:
    path = workbook(
        tmp_path / "projects.xlsx",
        " Data Summary - All Projects",
        {
            4: {"D": "DCA Muni Code"},
            5: {"A": "99", "D": "0101", "I": "--", "K": "--", "AQ": "--"},
        },
    )
    p = json.loads(
        str(NjAffordableAdapter.xlsx_records(path, dca_ref("projects"))[0]["payload"])
    )
    assert p["completed"] is None and p["units"] is None
    assert p["earliest_controls_end"] is None


def test_header_drift_is_refused(tmp_path: Path) -> None:
    path = workbook(tmp_path / "changed.xlsx", "Final Summary", {3: {"B": "Different"}})
    with pytest.raises(SourceError, match="header changed"):
        NjAffordableAdapter.xlsx_records(path, dca_ref("need"))


def test_future_co_date_is_kept_but_not_counted_as_completed(tmp_path: Path) -> None:
    path = workbook(
        tmp_path / "future.xlsx",
        " Data Summary - All Projects",
        {
            4: {"D": "DCA Muni Code"},
            5: {"A": "99", "D": "0101", "I": "Y", "K": "4", "J": "74411"},
        },
    )
    result = NjAffordableAdapter.xlsx_records(path, dca_ref("projects"))
    p = json.loads(str(result[0]["payload"]))
    assert p["completed"] is True  # Preserve the flag the publisher wrote.
    assert p["completion_date"] > result[0]["snapshot"]
    assert p["completed_for_summary"] is False


def test_duplicate_project_ids_are_refused(tmp_path: Path) -> None:
    path = workbook(
        tmp_path / "duplicate.xlsx",
        " Data Summary - All Projects",
        {
            4: {"D": "DCA Muni Code"},
            5: {"A": "99", "D": "0101"},
            6: {"A": "99", "D": "0102"},
        },
    )
    with pytest.raises(SourceError, match="duplicate identifiers"):
        NjAffordableAdapter.xlsx_records(path, dca_ref("projects"))


def test_new_reporting_workbook_is_discovered_without_year_edit() -> None:
    adapter = NjAffordableAdapter()
    adapter.probe_transport = httpx.MockTransport(
        lambda _: httpx.Response(
            200,
            text='<a href="Affordable%20Housing%20Municipal%20Status%20'
            'Report%203-1-27.xlsx">',
        )
    )
    found = adapter.discover(date(2027, 3, 2))
    assert found.newest == "2027-03-01"
    adapter.newest = found.newest
    assert "Report%203-1-27.xlsx" in adapter.refs()[1].url
    assert all(r.mutable for r in adapter.refs())


def test_hud_snapshot_is_from_publisher_not_download_clock() -> None:
    adapter = HudAssistedAdapter()
    adapter.probe_transport = httpx.MockTransport(
        lambda _: httpx.Response(200, text="<p>Current as of 09/11/2026</p>")
    )
    found = adapter.discover(date(2026, 10, 4))
    assert found.newest == "2026-09-11"
    adapter.newest = found.newest
    assert "as_of=2026-09-11" in adapter.refs()[0].url


def test_personal_contacts_not_requested_from_lihtc() -> None:
    fields = HudLihtcAdapter.LAYERS["properties"].fields
    assert not {"CONTACT", "COMPANY", "CO_ADD", "CO_TEL"}.intersection(fields)


def test_unknown_and_nonfinite_numbers_are_not_zero() -> None:
    assert number("--") is None
    assert number("0") == 0
    with pytest.raises(SourceError, match="Non-finite"):
        number("NaN")


def test_assistance_metrics_unranked_licensed_and_hud_income_bounded() -> None:
    metrics, sources = load_metrics(), load_sources()
    for mid in (
        "nj_ah_present_need",
        "nj_ah_prospective_need",
        "nj_ah_completed_units",
        "nj_ah_trust_balance",
    ):
        assert metrics[mid].ranked is False
        assert sources[metrics[mid].source_id].licence_class == "public_record"
    for mid in ("hud_area_median_income", "hud_income_limit_80"):
        assert VALUE_BOUNDS[mid] == (5000, 500000)
    assert dict(_plan([12], []))["/regions/12/affordable-housing"] == (
        "regions/12/affordable-housing.json"
    )


def test_raw_pruning_protects_inventory_citations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from hip import cli

    class Result:
        def all(self) -> list[tuple[str]]:
            return [("inventory-sha",)]

    class Session:
        def __init__(self, _: object) -> None:
            pass

        def __enter__(self):  # type: ignore[no-untyped-def]
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def execute(self, statement: object) -> Result:
            assert "FROM affordable_housing_records a" in str(statement)
            assert "a.release_id = sr.release_id" in str(statement)
            return Result()

    def superseded(raw_dir: Path, cited: set[str]) -> list[object]:
        assert cited == {"inventory-sha"}
        return []

    monkeypatch.setattr(cli, "Session", Session)
    monkeypatch.setattr(cli, "get_engine", lambda: None)
    monkeypatch.setattr(cli.refresh, "superseded_releases", superseded)
    cli.prune_raw()  # Default is read-only; never execute --apply in a test.


def render(model: str) -> str:
    env = jinja2.Environment()
    return env.from_string(
        (REPO_ROOT / f"dbt/models/staging/{model}.sql").read_text()
    ).render(
        config=lambda **_: "",
        ref=lambda name: name,
    )


def test_completed_projects_and_missing_funds_are_not_obligation_progress() -> None:
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE stg_nj_affordable_records (geoid VARCHAR, snapshot DATE, "
        "release_layer VARCHAR, release_vintage VARCHAR, kind VARCHAR, payload JSON)"
    )
    rows_ = [
        ("need", {"present_need": 3, "prospective_need": 10}),
        (
            "municipal_project",
            {"completed": True, "completed_for_summary": True, "units": 5},
        ),
        (
            "municipal_project",
            {"completed": None, "completed_for_summary": False, "units": 400},
        ),
        ("trust_fund", {"reported": False, "balance": 0}),
    ]
    for kind, payload in rows_:
        con.execute(
            "INSERT INTO stg_nj_affordable_records VALUES "
            "('3400100100', '2026-07-01', ?, 'current', ?, ?)",
            [
                "projects" if kind == "municipal_project" else kind,
                kind,
                json.dumps(payload),
            ],
        )
    result = con.execute(render("stg_nj_affordable")).fetchall()
    municipal = {r[1]: r[6] for r in result if r[3] == "municipality"}
    assert municipal["nj_ah_completed_units"] == 5
    assert "nj_ah_trust_balance" not in municipal
    assert not any("progress" in r[1] or "compliance" in r[1] for r in result)
    assert len(result) == 9  # Same three figures at town, county and state.
    con.close()
