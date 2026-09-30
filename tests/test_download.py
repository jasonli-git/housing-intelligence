"""A region's figures as a CSV (Milestone 31): what each row carries, what the header
says, and what is left out. Built from a fixed packet, so it needs no warehouse."""

from __future__ import annotations

import csv
import io
from datetime import datetime

from hip.packets.download import render_csv
from hip.packets.schema import Packet, PacketSource
from tests.test_packet_uncertainty import uncertain_packet

CENSUS_NOTICE = (
    "This product uses the Census Bureau Data API but is not endorsed or certified by "
    "the Census Bureau."
)


def _licensed() -> Packet:
    """The fixture with 1.4's fields filled as the warehouse fills them, and the
    mortgage rate's owner forbidding redistribution."""
    packet = uncertain_packet()
    kinds = {"zhvi_sfr": ("modelled", "non_commercial")}

    def dressed(entry: object) -> object:
        kind, licence = kinds.get(entry.metric_id, ("survey", "public_domain"))  # type: ignore[attr-defined]
        return entry.model_copy(update={"record_type": kind, "licence_class": licence})  # type: ignore[attr-defined]

    rate = packet.levels[0].model_copy(
        update={
            "metric_id": "mortgage_rate_30y_weekly",
            "label": "30-year fixed mortgage rate",
            "record_type": "benchmark",
            "licence_class": "display_only",
            "originator": "Freddie Mac",
        }
    )
    census = packet.sources[0].model_copy(
        update={"licence_class": "public_domain", "notices": [CENSUS_NOTICE]}
    )
    zillow = PacketSource(
        source_id="zillow_zhvi",
        name="Zillow Home Value Index",
        publisher="Zillow Research",
        license="Free for non-commercial use with attribution",
        url="https://example.invalid",
        vintage="2026-08",
        fetched_at=datetime(2026, 9, 26, 12, 0),
        release_ids=[9],
        licence_class="non_commercial",
    )
    return packet.model_copy(
        update={
            "packet_version": "1.4",
            "metrics": [dressed(m) for m in packet.metrics],
            "levels": [*(dressed(v) for v in packet.levels), rate],
            "sources": [census, zillow],
        }
    )


def _read(text: str) -> tuple[list[str], list[dict[str, str]]]:
    header = [line[2:] for line in text.splitlines() if line.startswith("# ")]
    body = "\n".join(line for line in text.splitlines() if not line.startswith("#"))
    return header, list(csv.DictReader(io.StringIO(body)))


def test_every_row_says_what_kind_of_figure_it_is_and_its_licence() -> None:
    _, rows = _read(render_csv(_licensed()))
    assert rows and all(row["kind"] and row["licence"] for row in rows)
    zillow = [row for row in rows if row["metric_id"] == "zhvi_sfr"]
    assert zillow and all(r["licence"].startswith("Non-commercial") for r in zillow)
    assert {r["kind"] for r in zillow} == {"Modelled estimate"}


def test_a_restricted_figure_is_named_in_the_header_with_its_owner() -> None:
    header, _ = _read(render_csv(_licensed()))
    restriction = next(line for line in header if line.startswith("NOT FOR COMMERCIAL"))
    assert "Home value index, single-family" in restriction
    assert "Zillow Research" in restriction


def test_a_display_only_figure_is_left_out_and_the_header_says_so() -> None:
    """Freddie Mac's terms forbid redistributing its data: shown, never handed out."""
    text = render_csv(_licensed())
    header, rows = _read(text)
    assert "mortgage_rate_30y_weekly" not in {row["metric_id"] for row in rows}
    assert any(
        line.startswith("Left out: 30-year fixed mortgage rate") for line in header
    )


def test_the_notices_the_sources_require_travel_with_the_file() -> None:
    header, _ = _read(render_csv(_licensed()))
    assert CENSUS_NOTICE in header
    assert any(
        line.startswith("Cite as: Housing Intelligence Platform") for line in header
    )


def test_a_change_row_carries_both_ends_and_the_changes_margin() -> None:
    _, rows = _read(render_csv(_licensed()))
    change = next(
        r
        for r in rows
        if r["figure"] == "change over the window" and r["metric_id"] != "zhvi_sfr"
    )
    assert change["start_value"] and change["pct_change"] and change["pct_change_margin"]
