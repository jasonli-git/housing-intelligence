"""Fail closed if the reviewed BPU actual-performance columns move."""

import json

import pytest

from hip.api.routers.infrastructure import InfrastructureRecord, _one_per_year
from hip.sources.base import ReleaseRef, SourceError
from hip.sources.nj_bpu import BpuAnnualReportsAdapter, BpuReliabilityAdapter


def example() -> str:
    return "EO25070453 Agenda Date: 8/13/25\n" + "\n".join(
        f"Table {n} – JCP&L {year} Reliability Performance\n"
        "CAIDI SAIFI\nBenchmark Minimum Actual Benchmark Minimum Actual\n"
        f"JCP&L N/A N/A {caidi} N/A N/A {saifi}\n"
        "JCP&L -\nNorthern 136 149 198.33 1.49 1.84 2.08\n"
        for n, year, caidi, saifi in [
            (1, 2022, 118.81, 1.46),
            (2, 2023, 147.3, 1.48),
            (3, 2024, 160.30, 1.95),
        ]
    )


def test_actuals_are_not_benchmarks_or_eia_duration() -> None:
    rows = BpuReliabilityAdapter.pdf_records(example(), BpuReliabilityAdapter().refs()[0])
    assert len(rows) == 3
    latest = json.loads(str(rows[-1]["payload"]))
    assert latest["caidi_minutes"] == 160.30
    assert latest["saifi"] == 1.95
    assert latest["year"] == 2024
    assert latest["published"] == "2025-08-13"
    assert "saidi" not in latest
    assert "exclusions not specified" in latest["basis"]


@pytest.mark.parametrize(
    "bad",
    [
        example().replace("Table 3", "Table 4"),
        example().replace("N/A N/A 160.3 N/A N/A 1.95", "149 198.33 1.49 1.84 2.08"),
        example().replace("EO25070453", "EO99999999"),
        example().replace("CAIDI SAIFI", "SAIFI CAIDI"),
        example().replace(
            "JCP&L N/A N/A 118.81 N/A N/A 1.46",
            "JCP&L N/A N/A 118.81 N/A N/A 1.46\nJCP&L N/A N/A 118.81 N/A N/A 1.46",
        ),
    ],
)
def test_changed_order_or_layout_fails(bad: str) -> None:
    with pytest.raises(SourceError):
        BpuReliabilityAdapter.pdf_records(bad, BpuReliabilityAdapter().refs()[0])


# --- The utilities' own annual reports, from OPRA request C263585 (#347) -------------

REPORTS = {
    "ace": (
        "Atlantic City Electric 2025 Annual System Performance Report\n"
        " SAIFI Components\n\n"
        "   Areas   Minimum Performance Level   2025 Actual Performance   Status\n"
        "    ACE Overall           0.81                       0.67               Met\n"
        "     Cape May             0.67                       0.40               Met\n"
        " CAIDI Components\n\n"
        "   Areas   Minimum Performance Level   2025 Actual Performance   Status\n"
        "    ACE Overall            95                        109            Not Met\n"
    ),
    "jcpl": (
        "2025 Annual System Performance Report\n"
        "The following table indicates the actual CAIDI and SAIFI reliability index\n"
        "                     CAIDI                         SAIFI\n"
        "        Benchmark  Minimum   2025     Benchmark  Minimum    2025\n"
        "  JCP&L    N/A       N/A    145.56      N/A       N/A       1.80\n"
        "  JCP&L-\n       150.29   191.99   152.62    1.64   2.12   2.15\n"
    ),
    "pseg": (
        "PSE&G Annual System Performance Report 2025\n"
        "          Company Wide Ten Year Data - CAIDI\n\n"
        "   Year            2023     2024    2025\n"
        "   Actual CAIDI    66.11    70.49   69.34\n"
        "          Company Wide Ten Year Data - SAIFI (Sheet 1 of 2)\n\n"
        "   Year            2023     2024    2025\n"
        "   Actual SAIFI    0.57     0.53    0.61\n"
    ),
    "reco": (
        "Rockland Electric Company\n"
        "Service Reliability Filing For 2025 System Performance\n"
        "  Overall, in 2025, the RECO service territory experienced a SAIFI of 1.07 "
        "interruptions per customer\n        served and a CAIDI of 98.9 minutes of "
        "interruption.\n"
    ),
}


def _report(utility: str, year: str = "2025") -> ReleaseRef:
    return next(
        r
        for r in BpuAnnualReportsAdapter().refs(year)
        if r.layer == utility and r.vintage == year
    )


@pytest.mark.parametrize(
    ("utility", "eia_id", "caidi", "saifi"),
    [
        ("ace", "963", 109.0, 0.67),
        ("jcpl", "9726", 145.56, 1.80),
        ("pseg", "15477", 69.34, 0.61),
        ("reco", "16213", 98.9, 1.07),
    ],
)
def test_each_report_yields_its_company_wide_actuals(
    utility: str, eia_id: str, caidi: float, saifi: float
) -> None:
    rows = BpuAnnualReportsAdapter.pdf_records(REPORTS[utility], _report(utility))
    assert len(rows) == 1
    payload = json.loads(str(rows[0]["payload"]))
    assert (payload["utility_id"], payload["year"]) == (eia_id, 2025)
    assert (payload["caidi_minutes"], payload["saifi"]) == (caidi, saifi)
    assert payload["opra_request"] == "C263585"
    assert ("major events excluded" in payload["basis"]) is (utility == "ace")


@pytest.mark.parametrize(
    ("utility", "bad"),
    [
        # A district row is never read as the company's.
        ("ace", REPORTS["ace"].replace("ACE Overall", "Cape Mayy")),
        # The year a table reports must be the report's year.
        ("jcpl", REPORTS["jcpl"].replace("2025", "2024")),
        ("pseg", REPORTS["pseg"].replace("2025", "2024")),
        ("reco", REPORTS["reco"].replace("SAIFI of 1.07", "SAIFI near 1.07")),
        # A figure outside review bounds is refused rather than published.
        ("pseg", REPORTS["pseg"].replace("69.34", "6934")),
        # A second territory row is ambiguous.
        (
            "jcpl",
            REPORTS["jcpl"].replace(
                "  JCP&L-",
                "  JCP&L    N/A       N/A    1.0      N/A       N/A       1.0\n  JCP&L-",
            ),
        ),
    ],
)
def test_a_changed_report_fails_rather_than_misreads(utility: str, bad: str) -> None:
    with pytest.raises(SourceError):
        BpuAnnualReportsAdapter.pdf_records(bad, _report(utility))


def test_an_unreviewed_year_is_refused() -> None:
    with pytest.raises(SourceError):
        BpuAnnualReportsAdapter().refs("2026")


def test_a_year_in_both_the_order_and_the_report_is_shown_once_from_the_report() -> None:
    def record(source: str, year: int, caidi: float) -> InfrastructureRecord:
        return InfrastructureRecord(
            source_id=source,
            kind="regulatory_reliability",
            entity_id="utility:9726",
            record_id=f"9726:{year}",
            payload={"year": year, "caidi_minutes": caidi, "saifi": 1.0},
            release_id=1,
            vintage=str(year),
            file_sha256="0" * 64,
            fetched_at="2026-10-08T00:00:00",
        )

    shown = _one_per_year(
        [
            record("nj_bpu_reliability", 2023, 147.3),
            record("nj_bpu_reliability", 2024, 160.3),
            record("nj_bpu_reports", 2024, 160.3),
            record("nj_bpu_reports", 2025, 145.56),
        ]
    )
    assert [(r.payload["year"], r.source_id) for r in shown] == [
        (2025, "nj_bpu_reports"),
        (2024, "nj_bpu_reports"),
        (2023, "nj_bpu_reliability"),
    ]
