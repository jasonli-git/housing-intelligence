"""DCA's Construction Reporter: homes certified and demolished (Milestone 39).

The rows a workbook means, the year-to-date block a preliminary year is read from, and a
probe that is not fooled by the server's 200 for a missing file. No network: the grids
are built here, and the publisher is a `MockTransport`.
"""

from __future__ import annotations

from datetime import date

import httpx
import pytest

from hip.sources.base import ReleaseRef
from hip.sources.nj_construction import (
    _XLS_MAGIC,
    CERTIFIED,
    DEMOLISHED,
    NjConstructionAdapter,
    rows_of,
)


def _ref(vintage: str, layer: str = "certified") -> ReleaseRef:
    return ReleaseRef(
        source_id="nj_construction", layer=layer, vintage=vintage, url="https://x"
    )


def _yearly(towns: int = 320) -> list[list[str]]:
    grid = [
        ["Housing units certified, 2024", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["COMU CODE", "MUNICIPALITY", "total", "ONETWO", "MULTI", "MIXED"],
        ["0101", "ABSECON CITY", "3", "3", "", "0"],
        ["1110", "PRINCETON TWP", "See Princeton (1114)", "", "", ""],
    ]
    grid += [[f"{2000 + i:04d}", f"TOWN {i}", "1", "1", "0", "0"] for i in range(towns)]
    return grid


def test_a_yearly_summary_reads_each_town_and_keeps_a_blank_as_unreported() -> None:
    rows = rows_of(_yearly(), _ref("2024"))
    absecon = rows[0]
    assert absecon == {
        "cd_code": "0101",
        "municipality": "ABSECON CITY",
        "total": 3.0,
        "one_two_family": 3.0,
        "multifamily": None,
        "mixed_use": 0.0,
        "year": 2024,
        "preliminary": False,
    }
    # A merged town's pointer to its successor is not a town.
    assert all(r["cd_code"] != "1110" for r in rows)


def test_a_short_read_is_refused() -> None:
    with pytest.raises(ValueError, match="layout has changed"):
        rows_of(_yearly(towns=10), _ref("2024"))


def test_text_where_a_count_belongs_is_refused() -> None:
    grid = _yearly()
    grid[3][2] = "n/a"
    with pytest.raises(ValueError):
        rows_of(grid, _ref("2024"))


def _monthly() -> list[list[str]]:
    title = ["Housing units certified, certs1", "", "", "", "", "", ""]
    title += ["Housing Units Certified, certs2", "", "", "", "", ""]
    grid = [title, [""] * 13, ["code"] + [""] * 6 + ["code"] + [""] * 5]
    # The month lists fewer towns than the year to date: the blocks do not align.
    for i in range(320):
        month = [f"{2000 + i:04d}", "T", "0", "0", "0", "0"] if i % 2 else [""] * 6
        grid.append([*month, "", f"{3000 + i:04d}", "T", "2", "2", "0", "0"])
    return grid


def test_a_preliminary_year_is_read_from_the_year_to_date_block() -> None:
    rows = rows_of(_monthly(), _ref("2025-ytd"))
    assert len(rows) == 320
    assert rows[0]["cd_code"] == "3000"
    assert {r["preliminary"] for r in rows} == {True}
    assert {r["year"] for r in rows} == {2025}


def test_a_report_without_its_year_to_date_block_is_refused() -> None:
    grid = _monthly()
    grid[0][7] = "Housing Units Certified, certs1"
    with pytest.raises(ValueError, match="no year-to-date block"):
        rows_of(grid, _ref("2025-ytd"))


def test_refs_read_a_year_from_its_summary_and_2025_from_the_year_to_date() -> None:
    refs = NjConstructionAdapter().refs()
    keys = {(r.layer, r.vintage) for r in refs}
    assert ("certified", "2014") in keys and ("demolished", "2024") in keys
    assert ("certified", "2025-ytd") in keys and ("demolished", "2025-ytd") in keys
    assert len(refs) == len(CERTIFIED) + len(DEMOLISHED) + 2
    # The names changed shape in 2015, and are listed as published.
    assert CERTIFIED[2014].endswith("certs_2014.xls")
    assert CERTIFIED[2015].endswith("certs_15.xls")
    assert DEMOLISHED[2014].endswith("demos_2014.xls")


def _publisher(answers: dict[str, httpx.Response]) -> httpx.MockTransport:
    def handle(request: httpx.Request) -> httpx.Response:
        for fragment, answer in answers.items():
            if fragment in str(request.url):
                return answer
        # The server's answer for a file it does not have: a page, with a 200.
        return httpx.Response(200, content=b"<!DOCTYPE html><html>")

    return httpx.MockTransport(handle)


def test_discovery_is_not_fooled_by_a_200_page_for_a_missing_file() -> None:
    adapter = NjConstructionAdapter()
    adapter.probe_transport = _publisher({})
    found = adapter.discover(date(2026, 10, 2))
    assert found.newest == str(max(CERTIFIED))


def test_discovery_finds_a_new_yearly_summary_by_its_bytes() -> None:
    adapter = NjConstructionAdapter()
    adapter.probe_transport = _publisher(
        {"2025yearly/certs_25.xls": httpx.Response(200, content=_XLS_MAGIC + b"rest")}
    )
    found = adapter.discover(date(2026, 10, 2))
    assert found.newest == "2025"


def test_a_summary_discovery_found_is_fetched_and_replaces_the_year_to_date() -> None:
    adapter = NjConstructionAdapter()
    adapter.newest = "2025"
    keys = {(r.layer, r.vintage): r.url for r in adapter.refs()}
    assert keys[("certified", "2025")].endswith("2025yearly/certs_25.xls")
    assert keys[("demolished", "2025")].endswith("2025yearly/demo_25.xls")
    assert ("certified", "2025-ytd") not in keys


def test_the_rate_per_1000_is_ranked_by_level_but_given_no_change() -> None:
    """A flow counted afresh each year: "+45%" between two years says nothing (#300)."""
    from hip.analytics.compute import RATIOS, unchanged_metrics, unranked_metrics

    assert "nj_net_units_per_1000" in unchanged_metrics()
    assert "nj_net_units_per_1000" not in unranked_metrics()
    assert (
        "nj_net_units_per_1000",
        "nj_net_units_added",
        "acs_housing_units",
        1000.0,
    ) in (RATIOS)
    # Counts rank town size, so none is ranked or changed.
    for metric in ("nj_units_certified", "nj_units_demolished", "nj_net_units_added"):
        assert metric in unranked_metrics()
