"""Render an analysis packet as a Markdown report.

Pure: a packet in, a string out, no database and no I/O. The report is a *view* of the
packet, which is why it lives beside the assembler rather than in the API — the CLI, the
HTTP endpoint, and any later consumer render the same contract the same way.

Markdown rather than HTML or PDF: it is readable as text, diffable between runs, and
opens anywhere. The dashboard's `/regions/[id]/report` page renders the same packet for
the screen, so the two media share a contract rather than a template.

It is also what a model reads (`hip.eval.prompts.render_payload`), so what it shows is
what a reading may quote. Since packet 1.3 that includes every survey figure's margin
and every rank's range (SPEC principle 12): a survey rank the margins cannot pin down is
shown only as its range, so no reading is handed a single place the survey cannot back.

`format_value` mirrors `web/lib/format.ts`, and `format_metric`, `margin_label` and the
rank words mirror `formatMetric`, `marginLabel` and `rankReading` beside it. The
duplication is deliberate and small — the packet carries `unit`, and each medium formats
for itself; sharing the code would mean shipping Python to the browser or JavaScript to
the pipeline. `tests/test_packets.py` holds the two metric lists to the dashboard's.
"""

from __future__ import annotations

from hip.packets.schema import Packet, PacketHighlight, PacketLevel, PacketMetric

# What a survey figure with no margin says in its place, and what a margin of zero says
# — the Census fixes some figures to its population estimates, and they have no
# sampling error (ARCHITECTURE #250). The dashboard's `NO_MARGIN` and
# `NO_SAMPLING_ERROR`, word for word.
NO_MARGIN = "no margin available"
NO_SAMPLING_ERROR = "no sampling error"

# The `ratio` metrics that are shares, and the ones that are multiples: 0.62 of occupied
# homes is "62.2%", a home costing 4.26 times income is "4.26×". The unit says `ratio`
# for both, so the dashboard classifies by metric (ARCHITECTURE #124) and so does this.
SHARE_METRICS = frozenset(
    {
        "sr1a_median_sales_ratio",
        "acs_renter_severe_burden",
        "acs_owner_severe_burden",
        "acs_share_detached",
        "acs_share_attached",
        "acs_share_2_4_units",
        "acs_share_5_19_units",
        "acs_share_20plus_units",
        "acs_share_mobile_homes",
        "acs_share_built_2000_later",
        "acs_share_built_1980_1999",
        "acs_share_built_1940_1979",
        "acs_share_built_pre_1940",
        "acs_share_0_1_bedrooms",
        "acs_share_2_bedrooms",
        "acs_share_3_bedrooms",
        "acs_share_4plus_bedrooms",
        "acs_overcrowded_share",
        "acs_lacking_plumbing_share",
        "acs_lacking_kitchen_share",
        "acs_no_vehicle_share",
        "acs_rental_vacancy_rate",
        "acs_homeowner_vacancy_rate",
        "acs_vacant_seasonal_share",
        "acs_vacant_other_share",
        "acs_heat_gas_share",
        "acs_heat_electric_share",
        "acs_heat_oil_share",
        "acs_heat_propane_share",
        "acs_heat_other_share",
        "acs_commute_transit_share",
        "acs_work_from_home_share",
        "acs_commute_drove_alone_share",
        "acs_commute_walked_share",
        "acs_commute_60plus_share",
        "acs_living_alone_share",
        "acs_married_couple_share",
        "acs_with_children_share",
        "acs_disability_share",
        "acs_homeownership_rate",
        "acs_renter_cost_burden",
        "acs_renters_paying_utilities",
        "acs_vacancy_rate",
        "chas_owner_cost_burden",
        "chas_renter_cost_burden",
        "chas_renter_severe_burden",
        "fmr_to_income",
        "rent_to_income",
        "modiv_multifamily_share",
        "modiv_vacant_land_share",
    }
)
MULTIPLE_METRICS = frozenset({"price_to_income", "price_to_ami"})


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
    # A year is a label, not a quantity: "1,955" is wrong.
    if unit == "year":
        return str(round(value))
    if unit == "acres":
        return f"{value:,.2f} ac"
    # Milestone 34: people per household, and minutes of commuting each way.
    if unit == "people":
        return f"{value:.2f}"
    if unit == "minutes":
        return f"{value:.1f} min"
    formatted = f"{value:,.1f}"
    return formatted[:-2] if formatted.endswith(".0") else formatted


def format_metric(value: float, unit: str, metric_id: str) -> str:
    """A metric's value as the dashboard shows it: a share as a percentage, a multiple
    with ×, monthly money per month. Everything else is `format_value`.

    The dashboard throws on a ratio classed as neither, so an unclassified metric fails
    its build; a report falls back to the plain ratio rather than failing a pipeline run
    over formatting, and the build catches the omission first.
    """
    if unit == "ratio":
        if metric_id in SHARE_METRICS:
            return f"{value * 100:.1f}%"
        if metric_id in MULTIPLE_METRICS:
            return f"{value:.2f}×"
    if unit == "usd_month":
        return f"{format_value(value, unit)}/mo"
    return format_value(value, unit)


def margin_label(
    value: float, margin: float | None, unit: str, metric_id: str, *, survey: bool
) -> str | None:
    """A value's margin as it reads beside the value: "± $2,565", "± 2.3 points" for a
    share, "± 0.11×" for a multiple; a share whose margin would pass 0% or 100% as its
    range. `NO_MARGIN` for a survey figure without one; None for a figure with no
    sampling error to report, which reads exactly as it did before margins.
    """
    if margin is None:
        return NO_MARGIN if survey else None
    if margin == 0:
        return NO_SAMPLING_ERROR
    if unit == "ratio" and metric_id in SHARE_METRICS:
        low, high = value - margin, value + margin
        if low < 0 or high > 1:
            return (
                f"{format_metric(max(0.0, low), unit, metric_id)} to "
                f"{format_metric(min(1.0, high), unit, metric_id)}"
            )
        return f"± {margin * 100:.1f} points"
    if unit == "ratio" and metric_id in MULTIPLE_METRICS:
        return f"± {margin:.2f}×"
    return f"± {format_metric(margin, unit, metric_id)}"


def change_margin_label(margin: float | None, *, survey: bool) -> str | None:
    """A change's margin in the change's own terms: "+24.2%" reads "± 4.0%"."""
    if margin is None:
        return NO_MARGIN if survey else None
    if margin == 0:
        return NO_SAMPLING_ERROR
    return f"± {margin:.1f}%"


def with_margin(shown: str, label: str | None) -> str:
    """A figure and its margin: "$100,645 ± $2,565", or "385,864 (no sampling
    error)". The figure alone where there is no margin to give."""
    if label is None:
        return shown
    return f"{shown} {label}" if label.startswith("±") else f"{shown} ({label})"


def format_change(pct: float) -> str:
    return f"{'+' if pct >= 0 else ''}{pct:.1f}%"


def ordinal(n: int) -> str:
    last_two = n % 100
    if 11 <= last_two <= 13:
        return f"{n}th"
    return f"{n}{['th', 'st', 'nd', 'rd'][n % 10] if n % 10 < 4 else 'th'}"


def _position(rank: int, of: int) -> float:
    """Rank 1 at zero, the final rank at one; a cohort of one sits in the middle."""
    return (rank - 1) / (of - 1) if of > 1 else 0.5


def rank_words(best: int, worst: int, of: int) -> str:
    """Where a range of ranks sits, by thirds of the cohort — `rankReading`'s words."""
    if best == 1 and worst == of:
        return "too uncertain to place"
    start, end = _position(best, of), _position(worst, of)
    if end <= 1 / 3:
        return "near the top"
    if start >= 2 / 3:
        return "near the bottom"
    if start >= 1 / 3 and end <= 2 / 3:
        return "near the middle"
    if start < 1 / 3 and end > 2 / 3:
        return "can't be told apart from most"
    return "toward the top" if start < 1 / 3 else "toward the bottom"


def has_range(entry: PacketMetric | PacketLevel | PacketHighlight) -> bool:
    """Whether the margins leave this rank more than one place to fall in."""
    return (
        entry.rank_best is not None
        and entry.rank_worst is not None
        and entry.rank_best != entry.rank_worst
    )


def rank_label(entry: PacketMetric | PacketLevel) -> str:
    """ "12th of 21", or for a rank the margins cannot pin down, only its range:
    "3rd–20th of 21 (can't be told apart from most)"."""
    if entry.rank is None or entry.of is None:
        return "—"
    if has_range(entry):
        assert entry.rank_best is not None and entry.rank_worst is not None
        return (
            f"{ordinal(entry.rank_best)}–{ordinal(entry.rank_worst)} of {entry.of} "
            f"({rank_words(entry.rank_best, entry.rank_worst, entry.of)})"
        )
    return f"{ordinal(entry.rank)} of {entry.of}"


def _cell(text: str) -> str:
    """A pipe inside a cell would silently split the column."""
    return text.replace("|", "\\|")


def _end(highlight: PacketHighlight, directions: dict[str, str]) -> str:
    """Which end of its cohort a highlight sits at, in words its metric can support.

    `best` and `worst` only where the metric's direction defines a good end. A neutral
    metric — home value, a Fair Market Rent, a homeownership or vacancy rate — ranks
    largest first with no judgement attached, and calling a slow rise in home values the
    "worst end" put one in the report that the data never made.
    """
    leading = highlight.position == "leading"
    if directions.get(highlight.metric_id) == "neutral":
        return "top" if leading else "bottom"
    return "best" if leading else "worst"


def _annualised(metric: PacketMetric) -> str:
    """A survey figure's annualised change is left out: nothing computes its margin, and
    principle 12 lets no survey figure read as exact."""
    if metric.cagr is None or metric.survey:
        return "—"
    return f"{metric.cagr:.1f}%/yr"


def _highlight_line(
    highlight: PacketHighlight, directions: dict[str, str], metric: PacketMetric | None
) -> str:
    if has_range(highlight):
        assert highlight.rank_best is not None and highlight.rank_worst is not None
        place = (
            f"between {ordinal(highlight.rank_best)} and "
            f"{ordinal(highlight.rank_worst)} of {highlight.of}"
        )
    else:
        place = f"rank {highlight.rank} of {highlight.of}"
    change = format_change(highlight.pct_change)
    if metric is not None:
        change = with_margin(
            change, change_margin_label(metric.pct_change_margin, survey=metric.survey)
        )
    return (
        f"- **{_cell(highlight.label)}** — {place} "
        f"({_end(highlight, directions)} end), {change}"
    )


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

    metrics = {metric.metric_id: metric for metric in packet.metrics}
    if packet.highlights:
        lines += ["## Where this region stands out", ""]
        directions = {metric.metric_id: metric.direction for metric in packet.metrics}
        for highlight in packet.highlights:
            lines.append(
                _highlight_line(highlight, directions, metrics.get(highlight.metric_id))
            )
        lines.append("")

    lines += [
        "## Metrics",
        "",
        "| Metric | Start | Latest | Change | Annualised | Rank | Window |",
        "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for metric in packet.metrics:
        unit, mid, survey = metric.unit, metric.metric_id, metric.survey
        start = with_margin(
            format_metric(metric.start_value, unit, mid),
            margin_label(
                metric.start_value, metric.start_margin, unit, mid, survey=survey
            ),
        )
        latest = with_margin(
            format_metric(metric.end_value, unit, mid),
            margin_label(metric.end_value, metric.end_margin, unit, mid, survey=survey),
        )
        change = with_margin(
            format_change(metric.pct_change),
            change_margin_label(metric.pct_change_margin, survey=survey),
        )
        lines.append(
            f"| {_cell(metric.label)} "
            f"| {start} "
            f"| {latest} "
            f"| {change} "
            f"| {_annualised(metric)} "
            f"| {rank_label(metric)} "
            f"| {metric.window_start} → {metric.window_end} |"
        )
    lines += [
        "",
        "Rank 1 is the better end of the cohort as the metric defines "
        "better, not always the largest rise.",
        "",
    ]

    if packet.levels:
        lines += [
            "## Current values",
            "",
            "Every metric's most recent reading, ranked against peers by value rather "
            "than by change. Metrics published as a single snapshot — the MOD-IV "
            "assessment aggregates and HUD's CHAS tables — appear only here, because a "
            "change needs two observations.",
            "",
            "| Metric | Value | Rank | As of | Source |",
            "| --- | ---: | ---: | --- | --- |",
        ]
        for level in packet.levels:
            value = with_margin(
                format_metric(level.value, level.unit, level.metric_id),
                margin_label(
                    level.value,
                    level.margin_of_error,
                    level.unit,
                    level.metric_id,
                    survey=level.survey,
                ),
            )
            lines.append(
                f"| {_cell(level.label)} "
                f"| {value} "
                f"| {rank_label(level)} "
                f"| {level.period_end} "
                f"| {_cell(level.source_id or '—')} |"
            )
        lines.append("")

    if any(m.survey for m in packet.metrics) or any(lv.survey for lv in packet.levels):
        lines += [
            "## Margins of error",
            "",
            "± is a survey figure's 90% margin of error, as the publisher reports it or "
            "as its inputs imply: a change's margin is in the change's own terms, and a "
            "share's in percentage points. A rank given as a range is where those "
            "margins let this region fall — the survey cannot place it more precisely. "
            f'"{NO_MARGIN}" means the publisher reports none for that figure, which is '
            f'still an estimate; "{NO_SAMPLING_ERROR}" means the figure is fixed to '
            "another estimate rather than drawn from the sample. A survey figure's "
            "annualised change is not shown, because no margin is computed for it.",
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
