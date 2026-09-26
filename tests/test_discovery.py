"""Asking a publisher whether a newer release exists, instead of waiting for a constant.

The defect this closes: a dated vintage — a year, a fiscal year, a survey vintage — is
answered from disk forever, so revalidation (#188) never re-asks about it, and the
newest year each source requested was a constant nobody bumped. Measured 2026-09-23:
Building Permits had published 2025, IRS migration 2022–23, HUD income limits FY2026 and
BLS data through July 2026, and the platform requested none of them.

These drive the real `discover` methods against stub publishers, so what is under test is
each source's rule for "newer and usable" — including the two that are not "the file
exists": HUD's fiscal year is not in force until 1 October, and SR1A's closed-year
archive can exist as a stale snapshot.
"""

from __future__ import annotations

import io
import zipfile
from datetime import UTC, date, datetime
from pathlib import Path

import httpx
import pytest

from hip.config import GeographyScope
from hip.refresh import AcquireReport, acquire, exit_code
from hip.sources.base import Discovery, read_discovery, write_discovery
from hip.sources.census_permits import PermitsAdapter
from hip.sources.hud import HudChasAdapter, HudFmrAdapter, fmr_in_force_from
from hip.sources.irs_migration import MigrationAdapter, year_pairs
from hip.sources.nj_sr1a import Sr1aAdapter, vintages
from hip.sources.nj_tax_rates import NjTaxRatesAdapter
from hip.sources.registry import build_adapter

TODAY = date(2026, 9, 23)


def _publisher(answers: dict[str, httpx.Response | Exception]) -> httpx.MockTransport:
    """A publisher that answers by URL substring, 404 for anything it does not know."""

    def handle(request: httpx.Request) -> httpx.Response:
        for fragment, answer in answers.items():
            if fragment in str(request.url):
                if isinstance(answer, Exception):
                    raise answer
                return answer
        return httpx.Response(404)

    return httpx.MockTransport(handle)


def _ok(**headers: str) -> httpx.Response:
    return httpx.Response(200, headers=headers)


# --------------------------------------------------------------------- permits ---


def test_a_newer_year_is_found_when_every_file_it_needs_exists() -> None:
    adapter = PermitsAdapter(states=["NJ"])
    adapter.probe_transport = _publisher(
        {
            "co2512y.txt": _ok(**{"last-modified": "Fri, 20 Feb 2026 12:45:25 GMT"}),
            "ne2512y.txt": _ok(),
        }
    )

    found = adapter.discover(TODAY)

    assert found.newest == "2025"
    assert found.outcome == "confirmed"
    assert found.published == "Fri, 20 Feb 2026 12:45:25 GMT"


def test_a_year_missing_its_place_file_is_not_newer() -> None:
    """County permits without municipal ones would load half a year and sum it."""
    adapter = PermitsAdapter(states=["NJ"])
    adapter.probe_transport = _publisher({"co2512y.txt": _ok()})

    assert adapter.discover(TODAY).newest == "2024"


def test_discovery_never_moves_below_the_recorded_release() -> None:
    adapter = PermitsAdapter(states=["NJ"])
    adapter.newest = "2025"
    adapter.probe_transport = _publisher({})

    assert adapter.discover(TODAY).newest == "2025"


def test_an_unreachable_publisher_is_not_nothing_new() -> None:
    adapter = PermitsAdapter(states=["NJ"])
    adapter.probe_transport = _publisher({"co2512y.txt": httpx.ConnectError("no route")})

    found = adapter.discover(TODAY)

    assert found.outcome == "unreachable"
    assert found.newest == "2024", "an outage keeps what is known, it does not guess"


def test_a_server_error_is_unreachable_rather_than_absent() -> None:
    adapter = PermitsAdapter(states=["NJ"])
    adapter.probe_transport = _publisher({"co2512y.txt": httpx.Response(503)})

    assert adapter.discover(TODAY).outcome == "unreachable"


def test_refs_follow_the_discovered_year() -> None:
    adapter = PermitsAdapter(states=["NJ"])
    adapter.newest = "2025"

    assert adapter.refs()[0].url.endswith("co2512y.txt")


# ------------------------------------------------------------------------- IRS ---


def test_irs_pairs_end_at_the_discovered_pair() -> None:
    assert year_pairs("2223") == [(22, 23), (21, 22), (20, 21), (19, 20), (18, 19)]


def test_an_irs_pair_needs_both_directions() -> None:
    adapter = MigrationAdapter()
    adapter.probe_transport = _publisher(
        {"countyinflow2223.csv": _ok(), "countyoutflow2223.csv": _ok()}
    )

    assert adapter.discover(TODAY).newest == "2223"

    adapter = MigrationAdapter()
    adapter.probe_transport = _publisher({"countyinflow2223.csv": _ok()})

    assert adapter.discover(TODAY).newest == "2122"


# ------------------------------------------------------------------------- HUD ---


@pytest.fixture
def hud_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HUD_API_TOKEN", "test-token")


def _hud_years(*published: int) -> httpx.MockTransport:
    """HUD's API: 200 for a published year, 400 "Invalid year" otherwise."""

    def handle(request: httpx.Request) -> httpx.Response:
        year = int(request.url.params["year"])
        if year in published:
            return httpx.Response(200, json={"data": {"year": str(year)}})
        return httpx.Response(400, json={"error": "Invalid year"})

    return httpx.MockTransport(handle)


def test_a_fiscal_year_published_before_it_starts_waits(hud_token: None) -> None:
    """FY2027's rents answered on 2026-09-23 and apply from 2026-10-01."""
    adapter = HudFmrAdapter(states=["NJ"])
    adapter.probe_transport = _hud_years(2026, 2027)

    found = adapter.discover(TODAY)

    assert found.newest == "2026", "next year's standard must not stand in for this one"
    assert found.pending == "2027"
    assert found.pending_from == date(2026, 10, 1)


def test_a_fiscal_year_is_used_from_the_day_it_starts(hud_token: None) -> None:
    adapter = HudFmrAdapter(states=["NJ"])
    adapter.probe_transport = _hud_years(2026, 2027)

    found = adapter.discover(date(2026, 10, 1))

    assert found.newest == "2027"
    assert found.pending is None


def test_fiscal_years_start_on_the_first_of_october_before() -> None:
    assert fmr_in_force_from(2027) == date(2026, 10, 1)


def test_income_limits_move_to_the_newest_published_year(hud_token: None) -> None:
    from hip.sources.hud import HudAdapter

    adapter = HudAdapter(states=["NJ"], county_fips=["34001"])
    adapter.probe_transport = _hud_years(2024, 2025, 2026)

    assert adapter.discover(TODAY).newest == "2026"


def test_an_empty_chas_answer_means_not_tabulated(hud_token: None) -> None:
    """HUD answers an untabulated span with `[]` and a 200, not an error."""

    def handle(request: httpx.Request) -> httpx.Response:
        span = request.url.params["year"]
        return httpx.Response(200, json=[{"A1": "1"}] if span == "2018-2022" else [])

    adapter = HudChasAdapter(states=["NJ"], county_fips=["34001"])
    adapter.probe_transport = httpx.MockTransport(handle)

    assert adapter.discover(TODAY).newest == "2018-2022"


# ------------------------------------------------------------------------ SR1A ---


def test_the_open_year_stays_open_until_the_next_one_exists() -> None:
    adapter = Sr1aAdapter()
    adapter.probe_transport = _publisher({})

    assert adapter.discover(TODAY).newest == "2026ytd"


def test_a_stale_closed_archive_does_not_close_the_year() -> None:
    """`Sales2026.zip` existed on 2026-09-23 — as a snapshot taken on 2025-10-30.

    It held 41,768 deeds recorded July to October 2025; the year-to-date file held
    169,935 through June 2026. Closing the year on its existence would have replaced a
    complete year with a third of one.
    """
    adapter = Sr1aAdapter()
    adapter.probe_transport = _publisher(
        {
            "YTDSR1A2027.zip": _ok(),
            "Sales2026.zip": _ok(**{"last-modified": "Thu, 30 Oct 2025 16:04:26 GMT"}),
        }
    )

    found = adapter.discover(TODAY)

    assert found.newest == "2026ytd"
    assert found.pending == "2027ytd"
    assert found.pending_reason and "2026" in found.pending_reason


def test_the_year_closes_once_its_archive_is_republished_after_june() -> None:
    adapter = Sr1aAdapter()
    adapter.probe_transport = _publisher(
        {
            "YTDSR1A2027.zip": _ok(),
            "Sales2026.zip": _ok(**{"last-modified": "Wed, 01 Oct 2026 14:00:00 GMT"}),
        }
    )

    assert adapter.discover(TODAY).newest == "2027ytd"


def test_a_closed_year_joins_the_closed_archives() -> None:
    adapter = Sr1aAdapter()
    adapter.newest = "2027ytd"

    assert [r.vintage for r in adapter.refs()] == list(vintages(2027))
    assert vintages(2027)[-2:] == ("2026", "2027ytd")


# ------------------------------------------------------------------ NJ tax rates ---


def _workbook(*sheets: str) -> bytes:
    index = "".join(
        f'<sheet name="{name}" sheetId="{i}"/>' for i, name in enumerate(sheets)
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as book:
        book.writestr("xl/workbook.xml", f"<workbook><sheets>{index}</sheets></workbook>")
    return buffer.getvalue()


def test_the_tax_edition_is_read_from_the_sheet_names() -> None:
    adapter = NjTaxRatesAdapter(end_year=2025)
    body = _workbook("General Tax Rates 1997-2026", "Effective Tax Rates 1997-2026")
    adapter.probe_transport = _publisher(
        {"GTRhistory.xlsx": httpx.Response(200, content=body)}
    )

    assert adapter.discover(TODAY).newest == "2026"


def test_one_rate_sheet_ahead_of_the_other_is_not_an_edition() -> None:
    """An effective rate landed against last year's general rate would be wrong."""
    adapter = NjTaxRatesAdapter(end_year=2025)
    body = _workbook("General Tax Rates 1997-2026", "Effective Tax Rates 1997-2025")
    adapter.probe_transport = _publisher(
        {"GTRhistory.xlsx": httpx.Response(200, content=body)}
    )

    assert adapter.discover(TODAY).newest == "2025"


def test_the_landed_sheet_follows_the_release_not_the_floor() -> None:
    adapter = NjTaxRatesAdapter(end_year=2025)
    adapter.newest = "2026"
    general = next(r for r in adapter.refs() if r.layer == "general")

    assert general.vintage == "2026"
    assert adapter.landing_sheet(general) == "General Tax Rates 1997-2026"


# ------------------------------------------------------------ record and pinning ---


def _found(newest: str, outcome: str = "confirmed") -> Discovery:
    return Discovery(
        source_id="census_permits",
        newest=newest,
        checked_at=datetime(2026, 9, 23, tzinfo=UTC),
        outcome=outcome,  # type: ignore[arg-type]
        pending="2027",
        pending_from=date(2026, 10, 1),
    )


def test_a_discovery_round_trips_through_its_record(tmp_path: Path) -> None:
    write_discovery(tmp_path, _found("2025"))

    assert read_discovery(tmp_path, "census_permits") == _found("2025")


def test_an_unreachable_discovery_keeps_the_last_good_record(tmp_path: Path) -> None:
    write_discovery(tmp_path, _found("2025"))
    write_discovery(tmp_path, _found("2024", outcome="unreachable"))

    recorded = read_discovery(tmp_path, "census_permits")
    assert recorded is not None and recorded.newest == "2025"


def test_later_stages_build_refs_from_the_record(tmp_path: Path) -> None:
    """Offline, and the same release acquisition fetched (#197)."""
    write_discovery(tmp_path, _found("2025"))
    scope = GeographyScope(
        states=["NJ"], levels=["county"], municipality_id_system="census_mcd"
    )

    adapter = build_adapter("census_permits", scope, raw_dir=tmp_path)

    assert adapter.newest == "2025"
    assert adapter.refs()[0].vintage == "2025"


def test_without_a_record_an_adapter_answers_with_its_floor(tmp_path: Path) -> None:
    scope = GeographyScope(
        states=["NJ"], levels=["county"], municipality_id_system="census_mcd"
    )

    assert build_adapter("census_permits", scope, raw_dir=tmp_path).newest is None


# ------------------------------------------------------------------ acquisition ---


class _Recorded(PermitsAdapter):
    """Permits whose downloads never leave the test: only discovery is under test."""

    def __init__(self, transport: httpx.MockTransport) -> None:
        super().__init__(states=["NJ"])
        self.probe_transport = transport

    def refs(self, vintage: str | None = None):  # type: ignore[no-untyped-def]
        return []


def test_acquisition_discovers_first_and_records_it(tmp_path: Path) -> None:
    adapter = _Recorded(_publisher({"co2512y.txt": _ok(), "ne2512y.txt": _ok()}))

    outcomes = [o for _, o in acquire([adapter], raw_dir=tmp_path, today=TODAY)]

    assert [o.newest for o in outcomes if isinstance(o, Discovery)] == ["2025"]
    assert adapter.newest == "2025"
    recorded = read_discovery(tmp_path, "census_permits")
    assert recorded is not None and recorded.newest == "2025"


def test_a_later_refresh_keeps_the_publication_date_it_learned(tmp_path: Path) -> None:
    """Found building Milestone 27's freshness page: the probe learns `published` only
    when it finds a newer release, so the next refresh — finding nothing newer — wrote
    `None` over it. The 2026-09-26 refresh erased Building Permits' 2026-02-20 so."""
    stamped = {"last-modified": "Fri, 20 Feb 2026 12:45:25 GMT"}
    first = _Recorded(_publisher({"co2512y.txt": _ok(**stamped), "ne2512y.txt": _ok()}))
    list(acquire([first], raw_dir=tmp_path, today=TODAY))
    learned = read_discovery(tmp_path, "census_permits")
    assert learned is not None and learned.published is not None

    # A week later: 2025 is still the newest, and the probe for 2026 finds nothing.
    later = _Recorded(_publisher({}))
    later.newest = "2025"
    list(acquire([later], raw_dir=tmp_path, today=TODAY))

    kept = read_discovery(tmp_path, "census_permits")
    assert kept is not None and kept.newest == "2025"
    assert kept.published == learned.published


def test_a_newer_release_replaces_the_carried_publication_date(tmp_path: Path) -> None:
    """Carried only while the release is unchanged: a new newest brings its own date."""
    old = {"last-modified": "Fri, 20 Feb 2026 12:45:25 GMT"}
    new = {"last-modified": "Fri, 19 Feb 2027 12:00:00 GMT"}
    first = _Recorded(_publisher({"co2512y.txt": _ok(**old), "ne2512y.txt": _ok()}))
    list(acquire([first], raw_dir=tmp_path, today=TODAY))

    later = _Recorded(_publisher({"co2612y.txt": _ok(**new), "ne2612y.txt": _ok()}))
    later.newest = "2025"
    list(acquire([later], raw_dir=tmp_path, today=TODAY))

    replaced = read_discovery(tmp_path, "census_permits")
    assert replaced is not None and replaced.newest == "2026"
    assert replaced.published is not None and "2027" in replaced.published


def test_a_named_vintage_skips_discovery(tmp_path: Path) -> None:
    """Naming a vintage is asking for exactly that release."""
    adapter = _Recorded(_publisher({"co2512y.txt": httpx.ConnectError("no")}))

    outcomes = [o for _, o in acquire([adapter], raw_dir=tmp_path, vintage="2024")]

    assert not [o for o in outcomes if isinstance(o, Discovery)]


def test_an_unreachable_discovery_makes_the_refresh_partial(tmp_path: Path) -> None:
    adapter = _Recorded(_publisher({"co2512y.txt": httpx.ConnectError("no route")}))
    report = AcquireReport()
    for _, outcome in acquire([adapter], raw_dir=tmp_path, today=TODAY):
        report.add(outcome)

    assert report.undiscovered
    assert exit_code(report, pipeline_ran=True, pipeline_ok=True) == 3


# ----------------------------------------------------------------------- MOD-IV ---


def _metadata(*steps: tuple[str, str]) -> str:
    body = "".join(
        f"<prcStep><stepDesc>{text}</stepDesc><stepDateTm>{when}T00:00:00</stepDateTm>"
        "</prcStep>"
        for when, text in steps
    )
    return f"<metadata><dqInfo>{body}</dqInfo></metadata>"


def test_the_modiv_tax_year_is_read_from_the_newest_join() -> None:
    """The layer has no tax-year field; NJOGIS's processing history is the record."""
    from hip.sources.nj_modiv import ModivAdapter

    history = _metadata(
        (
            "2024-11-18",
            "re-generated with a join to the MOD-IV data for the 2023 tax year",
        ),
        (
            "2025-09-11",
            "re-generated with a join to the MOD-IV data for the 2024 tax year",
        ),
        ("2026-06-04", "NJOGIS obtained updated Parcel data for Morris County"),
    )
    adapter = ModivAdapter()
    adapter.probe_transport = _publisher(
        {"metadata.xml": httpx.Response(200, text=history)}
    )

    found = adapter.discover(TODAY)

    assert found.newest == "2024"
    assert found.published == "2025-09-11", "a parcel-shape update is not a new tax year"


def test_a_reworded_history_is_not_a_tax_year() -> None:
    from hip.sources.nj_modiv import ModivAdapter

    adapter = ModivAdapter()
    adapter.probe_transport = _publisher(
        {"metadata.xml": httpx.Response(200, text=_metadata(("2025-09-11", "updated")))}
    )

    assert adapter.discover(TODAY).outcome == "unreachable"


def test_staging_receives_the_recorded_tax_year(tmp_path: Path) -> None:
    from hip.transform.dbt_runner import _modiv_tax_year

    assert _modiv_tax_year(tmp_path) is None, "no record: staging keeps the old dating"
    write_discovery(
        tmp_path,
        Discovery("nj_modiv", "2024", datetime(2026, 9, 23, tzinfo=UTC)),
    )
    assert _modiv_tax_year(tmp_path) == 2024
