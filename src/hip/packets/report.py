"""Render an analysis packet as a Markdown report.

Pure: a packet in, a string out, no database and no I/O. The report is a *view* of the
packet, which is why it lives beside the assembler rather than in the API — the CLI, the
HTTP endpoint, and any later consumer render the same contract the same way.

Markdown rather than HTML or PDF: it is readable as text, diffable between runs, and
opens anywhere. The dashboard's `/regions/[id]/report` page renders the same packet for
the screen, so the two media share a contract rather than a template.

`format_value` mirrors `web/lib/format.ts`. The duplication is deliberate and small —
the packet carries `unit`, and each medium formats for itself; sharing the code would
mean shipping Python to the browser or JavaScript to the pipeline.
"""

from __future__ import annotations

from hip.packets.schema import Packet, PacketMetric


def format_value(value: float, unit: str) -> str:
    """Format for display by the metric's unit, matching the dashboard's rendering."""
    if unit in {"usd", "usd_month"}:
        return f"${round(value):,}"
    if unit == "percent":
        return f"{value:.1f}%"
    if unit == "ratio":
        return f"{value:.2f}"
    if unit == "count":
        return f"{round(value):,}"
    formatted = f"{value:,.1f}"
    return formatted[:-2] if formatted.endswith(".0") else formatted


def format_change(pct: float) -> str:
    return f"{'+' if pct >= 0 else ''}{pct:.1f}%"


def _cell(text: str) -> str:
    """A pipe inside a cell would silently split the column."""
    return text.replace("|", "\\|")


def _rank(metric: PacketMetric) -> str:
    return "—" if metric.rank is None else f"{metric.rank} / {metric.of}"


def _annualised(metric: PacketMetric) -> str:
    return "—" if metric.cagr is None else f"{metric.cagr:.1f}%/yr"


def render_markdown(packet: Packet) -> str:
    """The full report for one packet."""
    region = packet.region
    window = packet.window
    lines: list[str] = [
        f"# {region.label} — housing report",
        "",
        f"{len(packet.metrics)} metrics over the `{window.label}` change window, "
        f"ranked against {packet.comparisons.peer_count} "
        f"{packet.comparisons.peer_level} regions in {packet.comparisons.peer_scope}.",
        "",
        # The envelope, not a span every metric covers: sources publish at different
        # frequencies and stop at different dates, so each metric resolves `5y` to its
        # own pair of dates. Saying "2018-12-31 to 2026-06-30" without this qualifier
        # would read as one shared period.
        f"Between them the metrics reach from {window.start} to {window.end}; each one "
        f"covers its own window, given in the table.",
        "",
    ]

    if packet.highlights:
        lines += ["## Where this region stands out", ""]
        for highlight in packet.highlights:
            end = "best" if highlight.position == "leading" else "worst"
            lines.append(
                f"- **{_cell(highlight.label)}** — rank {highlight.rank} of "
                f"{highlight.of} ({end} end), {format_change(highlight.pct_change)}"
            )
        lines.append("")

    lines += [
        "## Metrics",
        "",
        "| Metric | Start | Latest | Change | Annualised | Rank | Window |",
        "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for metric in packet.metrics:
        lines.append(
            f"| {_cell(metric.label)} "
            f"| {format_value(metric.start_value, metric.unit)} "
            f"| {format_value(metric.end_value, metric.unit)} "
            f"| {format_change(metric.pct_change)} "
            f"| {_annualised(metric)} "
            f"| {_rank(metric)} "
            f"| {metric.window_start} → {metric.window_end} |"
        )
    lines += [
        "",
        "Rank 1 is the better end of the cohort as the metric defines "
        "better, not always the largest rise.",
        "",
    ]

    if packet.caveats:
        lines += ["## Caveats", ""]
        lines += [f"- {caveat}" for caveat in packet.caveats]
        lines.append("")

    lines += [
        "## Sources",
        "",
        "| Source | Publisher | Vintage | Retrieved | Releases | Licence |",
        "| --- | --- | --- | --- | ---: | --- |",
    ]
    for source in packet.sources:
        lines.append(
            f"| {_cell(source.name)} | {_cell(source.publisher)} "
            f"| {_cell(source.vintage)} | {source.fetched_at.date()} "
            f"| {len(source.release_ids)} | {_cell(source.license)} |"
        )

    lines += [
        "",
        "---",
        "",
        f"Generated from analysis packet `{packet.packet_version}` for region "
        f"`{region.region_id}` (GEOID `{region.geoid}`). Every figure is read from the "
        "housing warehouse and produced by the sources above, subject to the caveats. "
        "Nothing in this report is model-generated.",
        "",
    ]
    return "\n".join(lines)
