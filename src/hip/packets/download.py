"""A region's figures as a CSV a reader can download (Milestone 31, ARCHITECTURE #270).

One row per figure the region page shows: each metric's latest value, and its change
over the window where it has one. Every row carries what kind of figure it is (SPEC
principle 11), its margin where it is a survey figure (principle 12), the source and
release it came from, and the licence it carries — inherited, for a figure the platform
calculated, from the most restrictive of its inputs (#269). So a row cut out of the file
still says what it is and what it may be used for.

The file opens with `#` lines, which spreadsheet imports show as text and `pandas`
skips with `comment="#"`: what the file is and how to cite it, any restriction on the
figures in it, the notices the sources' terms require, and what was left out. A figure
whose licence is `display_only` is never written — Freddie Mac's terms forbid
redistributing its mortgage rate without an agreement, so the site shows it and does not
hand it out — and the header names what was omitted and why, rather than leaving a
reader to wonder.

Rendered from the packet, as the Markdown report is, so the API and the published file
agree byte for byte, and nothing here can state a figure the packet does not carry.
"""

from __future__ import annotations

import csv
import io

from hip.config import RECORD_TYPE_LABELS
from hip.packets.report import format_metric
from hip.packets.schema import Packet, PacketLevel, PacketMetric, PacketSource

REPOSITORY = "https://github.com/jasonli-git/housing-intelligence"

# Each licence class as a row states it. Kept short: the source's own terms are named in
# the header and linked from the site. Worded for the figure's sources, not the figure:
# a ratio this platform calculates from public-domain inputs is not itself a U.S.
# Government work, but nothing restricts it.
LICENCE_WORDS = {
    "public_domain": "No restriction: public-domain sources",
    "public_record": "No restriction: public records, free to copy and distribute",
    "attribution": "Free to use with attribution to the source",
    "non_commercial": "Non-commercial use only, with attribution to the source",
    "display_only": "Display only; not for redistribution",
}

COLUMNS = (
    "metric_id",
    "label",
    "figure",
    "kind",
    "value",
    "shown_as",
    "unit",
    "margin_of_error",
    "period_start",
    "period_end",
    "start_value",
    "start_margin",
    "pct_change",
    "pct_change_margin",
    "rank",
    "rank_best",
    "rank_worst",
    "of",
    "source",
    "publisher",
    "originator",
    "vintage",
    "licence",
)


def _source_of(
    entry: PacketMetric | PacketLevel, sources: list[PacketSource]
) -> PacketSource | None:
    return next((s for s in sources if entry.release_id in s.release_ids), None)


def _blank(value: object) -> object:
    return "" if value is None else value


def _row(
    entry: PacketMetric | PacketLevel, sources: list[PacketSource]
) -> dict[str, object]:
    source = _source_of(entry, sources)
    common: dict[str, object] = {
        "metric_id": entry.metric_id,
        "label": entry.label,
        "kind": RECORD_TYPE_LABELS.get(entry.record_type, "")  # type: ignore[call-overload]
        if entry.record_type
        else "",
        "unit": entry.unit,
        "rank": _blank(entry.rank),
        "rank_best": _blank(entry.rank_best),
        "rank_worst": _blank(entry.rank_worst),
        "of": _blank(entry.of),
        "source": source.name if source else "",
        "publisher": source.publisher if source else "",
        "originator": _blank(entry.originator),
        "vintage": source.vintage if source else "",
        "licence": LICENCE_WORDS.get(entry.licence_class or "", ""),
    }
    if isinstance(entry, PacketLevel):
        return {
            **common,
            "figure": "latest value",
            "value": entry.value,
            "shown_as": format_metric(entry.value, entry.unit, entry.metric_id),
            "margin_of_error": _blank(entry.margin_of_error),
            "period_start": entry.period_start.isoformat(),
            "period_end": entry.period_end.isoformat(),
        }
    return {
        **common,
        "figure": "change over the window",
        "value": entry.end_value,
        "shown_as": format_metric(entry.end_value, entry.unit, entry.metric_id),
        "margin_of_error": _blank(entry.end_margin),
        "period_start": entry.window_start.isoformat(),
        "period_end": entry.window_end.isoformat(),
        "start_value": entry.start_value,
        "start_margin": _blank(entry.start_margin),
        "pct_change": round(entry.pct_change, 4),
        "pct_change_margin": _blank(entry.pct_change_margin),
    }


def _restricted_names(entries: list[PacketMetric | PacketLevel]) -> list[str]:
    return sorted({e.label for e in entries if e.licence_class == "non_commercial"})


def render_csv(packet: Packet) -> str:
    """The region's figures, one per row, with the header lines described above."""
    entries: list[PacketMetric | PacketLevel] = [*packet.levels, *packet.metrics]
    kept = [e for e in entries if e.licence_class != "display_only"]
    left_out = sorted({e.label for e in entries if e.licence_class == "display_only"})

    region, window = packet.region, packet.window
    header = [
        f"{region.label}: every figure in its page's tables, over the {window.label} "
        f"window (packet {packet.packet_version})",
        f"Cite as: Housing Intelligence Platform, {region.label}, {window.label} window, "
        f"{REPOSITORY}. Each row names the source and release its figure came from.",
        "Each row's kind says whether it is a survey estimate, administrative "
        "records, an official determination, a published benchmark, a calculation or "
        "a modelled estimate; a survey estimate's margin of error is at 90% confidence.",
    ]
    restricted = _restricted_names(kept)
    if restricted:
        owners = sorted(
            {s.publisher for s in packet.sources if s.licence_class == "non_commercial"}
        )
        header.append(
            "NOT FOR COMMERCIAL USE: "
            + ", ".join(restricted)
            + " come from, or are calculated from, data licensed for non-commercial use "
            f"with attribution ({', '.join(owners)}). Keep that restriction and the "
            "attribution with any copy of these rows."
        )
    if left_out:
        header.append(
            "Left out: "
            + ", ".join(left_out)
            + ". Their owner's terms allow them to be shown on the site but not "
            "redistributed."
        )
    notices = sorted({n for s in packet.sources for n in s.notices})
    header += notices

    out = io.StringIO()
    for line in header:
        out.write(f"# {line}\n")
    writer = csv.DictWriter(out, fieldnames=COLUMNS, lineterminator="\n")
    writer.writeheader()
    for entry in kept:
        writer.writerow({column: "" for column in COLUMNS} | _row(entry, packet.sources))
    return out.getvalue()


__all__ = ["render_csv"]
