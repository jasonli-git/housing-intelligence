"""Historical persistence facts (Milestone 52, ARCHITECTURE #348).

The arithmetic is pure and tested on made-up years; the adapters on publisher-shaped
payloads; the packet, report, binding and no-prediction gate on a county the migrated
warehouse holds, as the relationship tests do.
"""

from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from hip.analytics.persistence import Year, agreement, persistence
from hip.packets import bind, build_packet, render_markdown
from hip.packets.prediction import prediction_problems
from hip.sources.base import ReleaseRef, SourceError
from hip.sources.census_saipe import SaipeAdapter
from hip.sources.fhfa import HpiCountyAdapter
from hip.warehouse.db import get_engine, probe

warehouse = pytest.mark.skipif(
    not probe().migrated,
    reason="needs a migrated warehouse; run `make db-up && make migrate`",
)


def _series(values: dict[int, float], margin: float = 0.0) -> dict[int, Year]:
    return {y: Year(v, v - margin, v + margin) for y, v in values.items()}


# 2000-2014 at 10, a spell at 14-15 in 2004-2006, below the median in 2008, and today
# (2014) at 13: second-highest-ish, above its median since 2012.
HISTORY = {y: 10.0 for y in range(2000, 2015)} | {
    2004: 14.0,
    2005: 15.0,
    2006: 14.0,
    2008: 9.0,
    2012: 11.0,
    2013: 12.0,
    2014: 13.0,
}


def test_position_rank_and_peak_against_the_region_s_own_median() -> None:
    fact = persistence(_series(HISTORY))
    assert (fact["first_year"], fact["last_year"], fact["years"]) == (2000, 2014, 15)
    assert fact["vs_median"] == pytest.approx(30.0)  # 13 against a median of 10
    assert fact["rank"] == 4  # behind 2004, 2005 and 2006
    assert (fact["peak_year"], fact["peak_vs_median"]) == (2005, pytest.approx(50.0))
    assert fact["above_median_since"] == 2012
    assert fact["missing_years"] == []


def test_an_earlier_spell_at_today_s_level_and_when_it_came_back() -> None:
    fact = persistence(_series(HISTORY))
    assert fact["episodes"] == [
        {
            "start": 2004,
            "end": 2006,
            "years": 3,
            "peak_year": 2005,
            "peak_vs_median": pytest.approx(50.0),
            "back_to_median": 2007,
        }
    ]


def test_a_spell_is_never_carried_across_a_missing_year() -> None:
    gapped = {y: v for y, v in HISTORY.items() if y != 2005}
    fact = persistence(_series(gapped))
    assert fact["missing_years"] == [2005]
    assert [(e["start"], e["end"]) for e in fact["episodes"]] == [
        (2004, 2004),
        (2006, 2006),
    ]


def test_the_income_margin_widens_today_s_place_into_a_range() -> None:
    fact = persistence(_series(HISTORY, margin=1.5))
    # 13 ± 1.5: at 14.5 it passes 2004 and 2006; at 11.5 it falls behind 2013.
    assert (fact["rank_best"], fact["rank_worst"]) == (2, 5)
    assert fact["vs_median_low"] < fact["vs_median"] < fact["vs_median_high"]


def test_a_short_history_is_no_long_run() -> None:
    with pytest.raises(ValueError):
        persistence(_series({y: 10.0 for y in range(2015, 2024)}))


def test_validation_compares_directions_over_the_shared_years() -> None:
    series = _series({2019: 10.0, 2024: 12.0})
    assert agreement(series, {2019: 6.0, 2024: 6.5})["agrees"] is True
    assert agreement(series, {2019: 6.0, 2024: 5.9})["agrees"] is False
    assert agreement(series, {2024: 6.0}) is None


# --- Sources ----------------------------------------------------------------------------


def test_saipe_drops_an_unpublished_year_and_keeps_its_interval() -> None:
    ref = ReleaseRef("census_saipe", "county", "current", "https://x", scope="NJ")
    payload = [
        ["NAME", "SAEMHI_PT", "SAEMHI_LB90", "SAEMHI_UB90", "time", "state", "county"],
        ["Bergen County", "121894", "118000", "125788", "2024", "34", "003"],
        ["Bergen County", None, None, None, "1996", "34", "003"],
    ]
    rows = SaipeAdapter.to_records(payload, ref)
    assert rows == [
        {
            "geoid": "34003",
            "year": 2024,
            "name": "Bergen County",
            "median_hh_income": 121894.0,
            "lower_90": 118000.0,
            "upper_90": 125788.0,
        }
    ]
    payload[1][2] = "130000"  # a lower bound above the point
    with pytest.raises(SourceError):
        SaipeAdapter.to_records(payload, ref)


def _workbook(path: Path, rows: list[list[str]], sheet: str = "county") -> Path:
    def cell(column: int, row: int, value: str) -> str:
        ref = f"{'ABCDEFGH'[column]}{row}"
        return f'<c r="{ref}" t="inlineStr"><is><t>{value}</t></is></c>'

    body = "".join(
        f'<row r="{r}">'
        + "".join(cell(c, r, v) for c, v in enumerate(values) if v != "")
        + "</row>"
        for r, values in enumerate(rows, start=1)
    )
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(
            "xl/workbook.xml",
            f'<workbook xmlns="{ns}" xmlns:r="{rel}"><sheets>'
            f'<sheet name="{sheet}" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        z.writestr(
            "xl/_rels/workbook.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
            'relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" '
            'Type="x"/></Relationships>',
        )
        z.writestr(
            "xl/worksheets/sheet1.xml",
            f'<worksheet xmlns="{ns}"><sheetData>{body}</sheetData></worksheet>',
        )
    return path


HEADER = ["State", "County", "FIPS code", "Year", "Annual Change (%)", "HPI", "", ""]


def test_fhfa_county_rows_skip_an_unestimated_year(tmp_path: Path) -> None:
    path = _workbook(
        tmp_path / "hpi_at_county.xlsx",
        [
            ["HPI for Counties (All-Transactions Index)"],
            HEADER,
            ["NJ", "Bergen", "34003", "2024", "6.79", "1531.35"],
            ["NJ", "Bergen", "34003", "2025", "", "."],
        ],
    )
    ref = HpiCountyAdapter(states=["NJ"]).refs()[0]
    assert HpiCountyAdapter.xlsx_records(path, ref) == [
        {
            "state": "NJ",
            "geoid": "34003",
            "year": 2024,
            "hpi": 1531.35,
            "annual_change": 6.79,
        }
    ]


def test_fhfa_county_refuses_a_changed_workbook(tmp_path: Path) -> None:
    ref = HpiCountyAdapter(states=["NJ"]).refs()[0]
    renamed = _workbook(tmp_path / "a.xlsx", [HEADER], sheet="counties")
    with pytest.raises(SourceError):
        HpiCountyAdapter.xlsx_records(renamed, ref)
    headerless = _workbook(tmp_path / "b.xlsx", [["NJ", "Bergen", "34003", "2024"]])
    with pytest.raises(SourceError):
        HpiCountyAdapter.xlsx_records(headerless, ref)


# --- Packet, report, binding and the no-prediction gate ---------------------------------


@pytest.fixture(scope="module")
def bergen() -> object:
    with Session(get_engine()) as session:
        from sqlalchemy import text

        region = session.execute(
            text("SELECT region_id FROM regions WHERE level='county' AND name='Bergen'")
        ).scalar_one()
        return build_packet(session, region)


@warehouse
def test_the_packet_carries_the_fact_and_not_its_inputs(bergen: object) -> None:
    packet = bergen
    assert packet.packet_version == "1.6"
    assert packet.persistence is not None
    hidden = {"fhfa_hpi_county", "saipe_median_hh_income"}
    assert not hidden & {m.metric_id for m in packet.metrics}
    assert not hidden & {lv.metric_id for lv in packet.levels}
    report = render_markdown(packet)
    assert "## How today compares with its own history" in report
    assert "It is not a forecast" in report


@warehouse
def test_a_quoted_distance_from_the_median_binds_to_the_fact(bergen: object) -> None:
    packet = bergen
    p = packet.persistence
    sentence = f"In {p.last_year} it sat {p.vs_median:.1f}% above its long-run median."
    binding = bind(sentence, packet)
    assert any(c.field == "persistence.vs_median" for c in binding.citations), json.dumps(
        [c.model_dump(mode="json") for c in binding.citations]
    )


@warehouse
@pytest.mark.parametrize(
    ("follow", "refused"),
    [
        ("Prices will likely fall back toward that level.", True),
        ("It is due for a correction.", True),
        ("This describes the past and is not a forecast of what comes next.", False),
        ("Earlier spells this high lasted a few years.", False),
    ],
)
def test_no_forecast_from_the_long_run_comparison(
    bergen: object, follow: str, refused: bool
) -> None:
    packet = bergen
    p = packet.persistence
    text = (
        f"In {p.last_year} it sat {p.vs_median:.1f}% above its long-run median. {follow}"
    )
    problems = prediction_problems(text, bind(text, packet), packet)
    assert bool(problems) is refused


@warehouse
def test_a_forecast_unrelated_to_the_fact_is_not_this_gate_s(bergen: object) -> None:
    packet = bergen
    text = "Rents will rise. Buyers should check the flood map."
    assert prediction_problems(text, bind(text, packet), packet) == []
