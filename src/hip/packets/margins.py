"""Whether prose gives each survey figure its margin, and each uncertain rank its range.

SPEC principle 12: wherever the platform shows a survey figure it shows the figure's
margin of error, and where the publisher reports none it says so. A reading is shown on
the site, so the rule reaches prose too (Milestone 30) — and binding alone cannot keep
it, because binding asks only whether each figure is in the packet. "Household income
rose to $100,645" binds perfectly and still reads as exact.

So this reads a binding back against its packet and reports, per figure:

- **A survey figure without its margin in the same sentence** — the margin of that very
  quantity: a start value's, an end value's, or the change's. Where the packet has a
  margin of zero the sentence must say "no sampling error", and where it has none, that
  no margin is available. "Same sentence" is the unit binding already uses for context;
  a margin two sentences later is not beside the figure it qualifies. A figure is
  judged under every field it could have been read from, not only the one binding
  chose: in "incomes rose 24% (give or take 4%) while rents rose 28% (give or take
  4%)" binding may hand the 28% to rent-to-income for its words, and the sentence is
  right about rent. So a margin is found by its value after "±" or "give or take", not
  only by the field binding gave it, and a figure any of whose readings is satisfied —
  or needs no margin — passes.
- **A rank the margins cannot pin down, quoted as a place** — the single rank, one end
  of its range alone, or a percentile. "Between 10th and 12th" passes; "12th" does not
  (ARCHITECTURE #241).

Deterministic and free, like binding: `hip explain` refuses prose with a problem here,
exactly as it refuses an unbound figure, and the side-by-side reports both. A packet
older than 1.3 marks nothing as a survey figure, so prose written from one has no
problems here by construction — it was held to the rule of its day.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from hip.packets.citations import (
    Binding,
    Citation,
    Figure,
    readings_of,
    sentence_span,
    states_margin,
)
from hip.packets.schema import Packet, PacketLevel, PacketMetric

# What a sentence says in place of a margin. The site's own phrases are "no margin
# available" and "no sampling error"; prose varies the wording, so each is matched
# loosely, and neither can be satisfied by the other.
_NO_MARGIN = re.compile(
    r"\bno margin\b|\bmargin (of error )?(is |was )?(not available|unavailable|unknown)",
    re.IGNORECASE,
)
_NO_SAMPLING_ERROR = re.compile(
    r"\b(no|without|not subject to|free of) sampling error\b", re.IGNORECASE
)

# A number read as a rank only where the words say so: an ordinal suffix, "of 21", or
# "rank" / "place" just before it. Binding may attribute a stray small number to a rank
# field for want of anything better, and this check must not refuse prose for that.
_ORDINAL_AFTER = re.compile(r"^(st|nd|rd|th)\b|^\s+of\s+\d", re.IGNORECASE)
_RANK_BEFORE = re.compile(r"\b(rank(ed|s|ing)?|place[ds]?|No\.|#)\s*$", re.IGNORECASE)

_ENTRY = re.compile(r"^(metrics|levels)\[([^\]]+)\]\.(.+)$")

# What joins a range's two ends: "3rd–7th", "between 1st and 2nd", "5th to 18th". The
# ordinal suffix of the first end sits between the numbers, so it is allowed here.
_RANGE_JOIN = re.compile(r"^(?:st|nd|rd|th)?\s*(?:[–—-]|to|and|through)\s*$", re.I)


@dataclass(frozen=True)
class MarginProblem:
    """One figure that reads more exactly than its survey allows."""

    text: str
    start: int
    end: int
    reason: str


def _entries(
    packet: Packet,
) -> tuple[dict[str, PacketMetric], dict[str, PacketLevel]]:
    return (
        {metric.metric_id: metric for metric in packet.metrics},
        {level.metric_id: level for level in packet.levels},
    )


_QUANTITIES = frozenset({"value", "start", "change", "annualised"})


def _needed(
    field: str | None,
    kind: str,
    metrics: dict[str, PacketMetric],
    levels: dict[str, PacketLevel],
) -> tuple[float | None, set[str]] | None:
    """The margin a survey figure read from `field` needs, and the fields that give it.

    None when the field is not a survey figure's value, start or change — nothing is
    needed. A margin of None means none is available; the empty field set then means no
    number can satisfy it, only the words.
    """
    if field is None or kind not in _QUANTITIES:
        return None
    match = _ENTRY.match(field)
    if match is None:
        return None
    array, metric_id, attribute = match.groups()
    metric = metrics.get(metric_id)
    level = levels.get(metric_id)
    level_margin = {
        f"levels[{metric_id}].margin_of_error",
        f"levels[{metric_id}].margin_of_error.low",
        f"levels[{metric_id}].margin_of_error.high",
    }
    end_margin = {
        f"metrics[{metric_id}].end_margin",
        f"metrics[{metric_id}].end_margin.low",
        f"metrics[{metric_id}].end_margin.high",
    }
    if array == "levels":
        if level is None or not level.survey:
            return None
        return level.margin_of_error, level_margin | end_margin
    if metric is None or not metric.survey:
        return None
    if attribute == "end_value":
        return metric.end_margin, end_margin | level_margin
    if attribute == "start_value":
        return metric.start_margin, {
            f"metrics[{metric_id}].start_margin",
            f"metrics[{metric_id}].start_margin.low",
            f"metrics[{metric_id}].start_margin.high",
        }
    if attribute == "pct_change":
        return metric.pct_change_margin, {f"metrics[{metric_id}].pct_change_margin"}
    # An annualised change: nothing computes its margin, so only the words will do.
    return None, set()


def _ranged(
    field: str, metrics: dict[str, PacketMetric], levels: dict[str, PacketLevel]
) -> tuple[str, PacketMetric | PacketLevel] | None:
    """The entry a rank field belongs to, if its margins leave it a range."""
    match = _ENTRY.match(field)
    if match is None:
        return None
    array, metric_id, _ = match.groups()
    entry = (metrics if array == "metrics" else levels).get(metric_id)
    if entry is None or entry.rank_best is None or entry.rank_worst is None:
        return None
    if entry.rank_best == entry.rank_worst:
        return None
    return f"{array}[{metric_id}]", entry


def _rank_problem(
    field: str,
    kind: str,
    fields: set[str],
    metrics: dict[str, PacketMetric],
    levels: dict[str, PacketLevel],
    stated: set[float] | None = None,
) -> str | None:
    """Why a rank read from `field` claims more than its survey allows, or None.

    A range is quoted when both its ends are in the sentence — as bound fields, or,
    judging an alternative reading, as ranks the sentence states (`stated`).
    """
    ranged = _ranged(field, metrics, levels)
    if ranged is None:
        return None
    prefix, entry = ranged
    span_text = f"{entry.rank_best}–{entry.rank_worst} of {entry.of}"
    if kind == "percentile":
        return f"a percentile for a rank the survey places only within {span_text}"
    if field == f"{prefix}.rank":
        return f"a single rank where the survey places it only within {span_text}"
    if {f"{prefix}.rank_best", f"{prefix}.rank_worst"} <= fields:
        return None
    ends = {float(entry.rank_best or 0), float(entry.rank_worst or 0)}
    if stated is not None and ends <= stated:
        return None
    return f"one end of the range {span_text} quoted as a place"


def _quoted_as_range(text: str, citation: Citation, cited: list[Citation]) -> set[float]:
    """The pair of ranks `citation` is written as one end of, if it is: the two numbers
    of "3rd–7th" or "between 1st and 2nd", whichever fields binding gave each.

    Binding places each number on its own, so the two ends of one range can land on two
    different measures that happen to share those values — and the check would then see
    each end quoted alone. A range written as a range is judged as one here (#266).
    """
    for other in cited:
        if other is citation:
            continue
        first, second = sorted((citation, other), key=lambda c: c.start)
        if _RANGE_JOIN.match(text[first.end : second.start]):
            return {citation.value, other.value}
    return set()


def _ranklike(text: str, citation: Citation) -> bool:
    after = text[citation.end : citation.end + 12]
    before = text[max(0, citation.start - 20) : citation.start]
    return bool(_ORDINAL_AFTER.match(after) or _RANK_BEFORE.search(before))


def _satisfied(
    need: tuple[float | None, set[str]],
    sentence: str,
    span: tuple[int, int],
    text: str,
    fields: set[str],
) -> str | None:
    """Why a figure with this need reads more exactly than its survey allows, or None."""
    margin, satisfied_by = need
    if margin is None:
        if _NO_MARGIN.search(sentence):
            return None
        return (
            "a survey figure with no margin available, stated as if exact — say that "
            "no margin is available"
        )
    if margin == 0:
        if _NO_SAMPLING_ERROR.search(sentence):
            return None
        return "a survey figure with no sampling error, stated without saying so"
    if fields & satisfied_by or states_margin(text, span[0], span[1], margin):
        return None
    return "a survey figure stated without its margin"


def _figure_need(
    figure: Figure,
    metrics: dict[str, PacketMetric],
    levels: dict[str, PacketLevel],
) -> tuple[float | None, set[str]] | None:
    return _needed(figure.field, figure.kind, metrics, levels)


def margin_problems(text: str, binding: Binding, packet: Packet) -> list[MarginProblem]:
    """Every figure in `text` that reads more exactly than its survey allows."""
    metrics, levels = _entries(packet)
    sentences: dict[tuple[int, int], list[Citation]] = {}
    for citation in binding.citations:
        span = sentence_span(text, citation.start, citation.end)
        sentences.setdefault(span, []).append(citation)

    problems: list[MarginProblem] = []

    def problem(citation: Citation, reason: str) -> None:
        problems.append(
            MarginProblem(
                text=citation.text,
                start=citation.start,
                end=citation.end,
                reason=reason,
            )
        )

    for span, cited in sentences.items():
        sentence = text[span[0] : span[1]]
        fields = {c.field for c in cited if c.field is not None}
        for citation in cited:
            needed = _needed(citation.field, citation.kind, metrics, levels)
            if needed is not None:
                why = _satisfied(needed, sentence, span, text, fields)
                if why is not None:
                    # Every other field the figure could be read from, before refusing.
                    alternatives = [
                        _figure_need(figure, metrics, levels)
                        for figure in readings_of(text, citation, packet)
                        if figure.field != citation.field
                    ]
                    if any(
                        need is None
                        or _satisfied(need, sentence, span, text, fields) is None
                        for need in alternatives
                    ):
                        continue
                    problem(citation, why)
                continue

            if citation.field is None or citation.kind not in {"rank", "percentile"}:
                continue
            why = _rank_problem(
                citation.field,
                citation.kind,
                fields,
                metrics,
                levels,
                _quoted_as_range(text, citation, cited) or None,
            )
            if why is None or (citation.kind == "rank" and not _ranklike(text, citation)):
                continue
            # As with a margin, every field the rank could be read from: "17th" may be
            # the rank by value, one place, where binding gave it the ranged change's.
            stated = {c.value for c in cited if c.kind == "rank"}
            if any(
                figure.kind in {"rank", "percentile"}
                and _rank_problem(
                    figure.field, figure.kind, fields, metrics, levels, stated
                )
                is None
                for figure in readings_of(text, citation, packet)
                if figure.field != citation.field
            ):
                continue
            problem(citation, why)
    problems.sort(key=lambda p: p.start)
    return problems


def describe_problems(problems: list[MarginProblem], text: str, limit: int = 4) -> str:
    """The problems as one line, each with the words around it, for a run's log."""

    def excerpt(p: MarginProblem) -> str:
        before = text[max(0, p.start - 40) : p.start].split("\n")[-1]
        after = text[p.end : p.end + 30].split("\n")[0]
        return f'{p.reason} in "…{before}{p.text}{after}…"'

    shown = [excerpt(p) for p in problems[:limit]]
    more = len(problems) - limit
    return "; ".join(shown) + (f"; and {more} more" if more > 0 else "")


__all__ = ["MarginProblem", "describe_problems", "margin_problems"]
