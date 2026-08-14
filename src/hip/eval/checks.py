"""Deterministic verification: does every number in the answer exist in the packet?

SPEC is explicit that automated checks verify numerical accuracy where possible and that
Claude evaluates qualitative quality rather than replacing deterministic validation. This
module is that division made real. A set lookup is a better instrument than a language
model for "is 4.7 in this packet", it costs nothing per call, and it cannot itself
hallucinate — so hallucination *rate*, the headline number of the whole evaluation, is
measured here rather than asked of a grader.

The check is deliberately generous, because a false accusation of fabrication is far
worse than a missed one: a stated figure counts as supported if it matches any packet
value, any value the packet's own fields imply (a percentage of a ratio, a rounded
thousand), or a year within the packet's window.
"""

from __future__ import annotations

import re

from hip.eval.normalize import looks_like_refusal
from hip.eval.types import CheckResult, Generation, NumericCheck, Scenario
from hip.packets import Packet

# Numbers as a reader writes them: 1,234.56  $310,000  4.7%  -2.3  1998
_NUMBER = re.compile(r"-?\$?\d[\d,]*(?:\.\d+)?%?")

# ISO dates are removed before numbers are extracted. Without this, `2019-12-31` is
# decomposed into 2019, -12, and -31, and every correctly-cited window turns into three
# fabricated figures — measured on a real run before this was caught. Dates are
# structure rather than claims, and the packet payload carries them verbatim, so they
# are verified as text below instead.
_ISO_DATE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")

# Year ranges written with a hyphen or dash: "2019-2024", "2019–2024".
_YEAR_RANGE = re.compile(r"\b(\d{4})\s*[-–—]\s*(\d{4})\b")

# Relative tolerance for matching a stated figure to a packet value. Wide enough to
# accept honest rounding ("about $310,000" for 309,742) and narrow enough that a
# different figure of the same magnitude is still caught.
_RELATIVE_TOLERANCE = 0.005

# Small integers are ordinals, counts, and list positions far more often than they are
# claims about data ("the 3 metrics below", "ranked 2nd"). Checking them produces noise,
# not signal, so anything under this is skipped unless it matches a rank the packet
# actually carries.
_TRIVIAL_BELOW = 20


def strip_dates(text: str) -> str:
    """Remove ISO dates and year ranges, which are not figures.

    Runs before number extraction so date punctuation cannot be mistaken for a negative
    number. Replaced with a space rather than deleted, so `2019-12-31to` cannot form.
    """
    return _ISO_DATE.sub(" ", _YEAR_RANGE.sub(" ", text))


def parse_numbers(text: str) -> list[tuple[float, str]]:
    """Every number in the text, as ``(value, as_written)``.

    A trailing `%` is kept in the source text but not applied to the value: packets
    store percentage change as a number like 4.7, and models write it as "4.7%". Treating
    those as different values would flag every correctly-quoted percentage as invented.
    """
    found: list[tuple[float, str]] = []
    for match in _NUMBER.finditer(strip_dates(text)):
        raw = match.group(0)
        cleaned = raw.replace(",", "").replace("$", "").rstrip("%")
        try:
            found.append((float(cleaned), raw))
        except ValueError:  # pragma: no cover - the pattern cannot produce this
            continue
    return found


def packet_values(packet: Packet) -> set[float]:
    """Every number a packet legitimately licenses a model to state.

    Includes derived forms a careful writer would use — a ratio expressed as a
    percentage, a value rounded to the nearest thousand — because those are correct
    quotations of the packet, not new claims.
    """
    values: set[float] = set()

    def add(value: float | int | None) -> None:
        if value is None:
            return
        number = float(value)
        values.add(number)
        values.add(round(number, 1))
        values.add(round(number, 2))
        values.add(float(round(number)))
        # A ratio quoted as a percentage, and a large figure quoted in thousands.
        values.add(round(number * 100, 1))
        if abs(number) >= 1000:
            values.add(round(number / 1000, 1))

    for metric in packet.metrics:
        add(metric.start_value)
        add(metric.end_value)
        add(metric.pct_change)
        add(metric.cagr)
        add(metric.rank)
        add(metric.of)
        add(metric.percentile)
        values.add(float(metric.window_start.year))
        values.add(float(metric.window_end.year))
    for level in packet.levels:
        add(level.value)
        add(level.rank)
        add(level.of)
        add(level.percentile)
        values.add(float(level.period_start.year))
        values.add(float(level.period_end.year))
    for highlight in packet.highlights:
        add(highlight.pct_change)
        add(highlight.rank)
        add(highlight.of)
    add(packet.comparisons.peer_count)
    values.add(float(packet.window.start.year))
    values.add(float(packet.window.end.year))
    for source in packet.sources:
        # Vintages are quotable provenance: "the 2023 ACS release".
        if source.vintage.isdigit():
            values.add(float(source.vintage))
    return values


def _supported(value: float, known: set[float]) -> tuple[bool, float | None]:
    """Whether a stated value matches a packet value, and the closest one if not."""
    if value in known:
        return True, value
    nearest: float | None = None
    smallest_gap = float("inf")
    for candidate in known:
        gap = abs(candidate - value)
        if gap < smallest_gap:
            smallest_gap, nearest = gap, candidate
        tolerance = max(abs(candidate) * _RELATIVE_TOLERANCE, 1e-9)
        if gap <= tolerance:
            return True, candidate
    return False, nearest


def _appears_verbatim(text: str, haystack: str) -> bool:
    """Whether the figure as written occurs literally in the text the model was given.

    Catches what value-matching cannot: numbers inside metric *names* ("Renters paying
    over 30% of income on housing"), source vintages, and anything else the packet
    states as prose. Quoting the packet back is the opposite of fabricating.
    """
    stripped = text.strip().lstrip("$").rstrip("%")
    return bool(stripped) and (text in haystack or stripped in haystack)


def check_generation(
    generation: Generation, scenario: Scenario, packet: Packet
) -> CheckResult:
    """Score one answer against the packet it was given.

    A figure is supported when it matches a packet value (including honest rounding and
    derived forms), when it appears verbatim in the payload, or when it was echoed from
    the question. The bar is deliberately low: this number is published as a fabrication
    rate, and a false accusation is far more damaging than a miss.
    """
    known = packet_values(packet)
    answer = generation.answer.strip()
    # Numbers the model was handed. Repeating one back is never an invention — the
    # refusal scenario asks about 1985, and a model that declines while naming the year
    # is behaving correctly.
    question_numbers = {value for value, _ in parse_numbers(scenario.question)}

    checks: list[NumericCheck] = []
    for value, text in parse_numbers(answer):
        if abs(value) < _TRIVIAL_BELOW and value not in known:
            continue
        if value in question_numbers:
            continue
        ok, nearest = _supported(value, known)
        if not ok and _appears_verbatim(text, scenario.payload):
            ok, nearest = True, value
        checks.append(NumericCheck(value=value, text=text, supported=ok, nearest=nearest))

    unsupported = [c for c in checks if not c.supported]
    return CheckResult(
        generation_key=generation.key,
        numbers=checks,
        unsupported_count=len(unsupported),
        unsupported_rate=len(unsupported) / len(checks) if checks else 0.0,
        empty_answer=not answer,
        refused=looks_like_refusal(answer),
        refusal_expected=scenario.expects_refusal,
    )
