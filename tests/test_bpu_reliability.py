"""Fail closed if the reviewed BPU actual-performance columns move."""

import json

import pytest

from hip.sources.base import SourceError
from hip.sources.nj_bpu import BpuReliabilityAdapter


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
