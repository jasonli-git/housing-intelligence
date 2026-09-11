"""Citation binding: each figure in a text, resolved to the packet field that licenses it.

Milestone 13. A packet is the only thing a model is shown, so it is the ground truth for
every number the model writes: a figure is licensed when the packet carries it, and its
citation is the field that does — which metric, which quantity, over which period, read
from which source release, matched to the region how. Nothing here is a model. It is
string handling and a lookup: deterministic, free, and unable to hallucinate itself
(SPEC: automated checks verify numerical accuracy; a language model does not replace
them).

One index serves two callers, which is why it lives with the packet rather than in
either of them. `hip explain` binds every generation before storing it and refuses prose
carrying a figure the packet does not — the publication gate. The evaluation counts the
same unbound figures as fabrications (`hip.eval.checks`). So the rate a benchmark
reports and the rate at which the site would refuse a model's prose are one number,
produced by one piece of code.

The matching is deliberately generous, because a false accusation of fabrication does
more damage than a miss. A stated figure is licensed when it matches:

- a packet value, or that value as a writer rounds it — to one or two decimals, to a
  whole number, a ratio as a percentage, a large figure in thousands — or any of those
  within 0.5%, so "about $452,000" quotes 452,500;
- the size of a negative value where the sentence says which way it went: "a decline of
  36.66%" quotes -36.66. A bare "36.66%" does not, because it states a rise;
- the packet's own text, as a whole token: the "30%" in the label "Renters paying over
  30% of income on housing".

Skipped as structure rather than claims: ISO dates, year ranges, numbers echoed from the
question, and a plain whole number under 20 that matches nothing ("the 3 points below").
Only a plain whole number is skipped that way; a decimal, a percentage or an amount
under 20 is a claim, and is checked.

What binding adds to a check is attribution. Where several fields carry the number — a
rank of 4 and a 4.0% change, a cohort of 21 and a peer count of 21 — it prefers the field
whose unit the writer used, then the field whose metric the sentence names, and records
how many it could not tell apart. It cannot separate two equal numbers any better than
the sentence around them does, but it never binds a figure the packet does not carry.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, replace
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from hip.packets.schema import Packet

FigureKind = Literal[
    "value",
    "start",
    "change",
    "annualised",
    "rank",
    "cohort",
    "percentile",
    "year",
    "vintage",
    "text",
]

# Numbers as a reader writes them: 1,234.56  $310,000  4.7%  -2.3  −2.3  1998. The
# typographic minus is a sign, not punctuation — "(−36.66%)" is a decline. A hyphen after
# a letter joins a word instead: "pre-2018" is the year 2018, and reading it as minus 2018
# was the one unsupported figure run `v2` charged to Mistral Small 4.
_NUMBER = re.compile(r"(?:(?<![A-Za-z])[-−])?\$?\d[\d,]*(?:\.\d+)?%?")

# ISO dates are removed before numbers are extracted. Without this, `2019-12-31` is
# decomposed into 2019, -12, and -31, and every correctly-cited window turns into three
# fabricated figures — measured on a real run before this was caught. Dates are
# structure rather than claims, and the packet payload carries them verbatim.
_ISO_DATE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")

# Year ranges written with a hyphen or dash: "2019-2024", "2019–2024".
_YEAR_RANGE = re.compile(r"\b(\d{4})\s*[-–—]\s*(\d{4})\b")

# Relative tolerance for matching a stated figure to a packet value. Wide enough to
# accept honest rounding ("about $310,000" for 309,742) and narrow enough that a
# different figure of the same magnitude is still caught.
RELATIVE_TOLERANCE = 0.005

# A plain whole number below this that matches nothing is an ordinal, a count or a list
# position ("the 3 metrics below", "ranked 2nd") rather than a claim about the data.
TRIVIAL_BELOW = 20

# A unit of context: a sentence, or a line of a list. Not a semicolon or a colon — in
# "Home value: $591,891 (2026-07-31; rank 10 of 21)" all three figures are the home
# value's, and a boundary at either would cut the rank off from the metric it ranks.
_SENTENCE_END = re.compile(r"[.!?](?=\s)|\n")
_WORD = re.compile(r"[a-z]+")

# A plain whole number followed by a unit of time is a duration — "over 10 years", the
# `5y` window — and one joined to a word by a hyphen is a descriptor: "5-year estimates",
# "4-person household", "2-bedroom rent". Structure, like a date, not a claim.
_DESCRIPTOR_AFTER = re.compile(
    r"^(-[a-z]|\s+(years?|yrs?|months?|quarters?|weeks?|days?)\b|y\b)",
    re.IGNORECASE,
)

# A dropped sign is licensed only when the words around the figure carry it.
_DOWNWARD = re.compile(
    r"\b(fell|fall(s|ing|en)?|declin\w*|decreas\w*|drop(s|ped|ping)?|down|lower\w*|"
    r"loss(es)?|lost|shr[ai]nk\w*|shrunk|contract\w*|negative|minus|reduc\w*|slid|"
    r"slip\w*|sank|sunk|plung\w*|plummet\w*|dip(s|ped|ping)?|eas(ed|ing)|fewer|less|"
    r"outflow\w*|deficit\w*)\b",
    re.IGNORECASE,
)
_CHANGE_WORDS = re.compile(
    r"\b(ros[ae]|rise[sn]?|rising|up|increas\w*|grew|grow\w*|gain\w*|jump\w*|"
    r"climb\w*|surg\w*|chang\w*)\b",
    re.IGNORECASE,
)
_ANNUAL_WORDS = re.compile(
    r"\b(annual\w*|yearly|a year|per year|cagr|compound\w*)\b", re.IGNORECASE
)
_LEVEL_WORDS = re.compile(
    r"\b(highest|lowest|most|least|largest|smallest|expensive|cheapest|top|bottom)\b",
    re.IGNORECASE,
)
_ORDINAL_AFTER = re.compile(r"^(st|nd|rd|th)\b|^\s+of\s+\d|^\s*/\s*\d", re.IGNORECASE)
_COHORT_BEFORE = re.compile(r"(\b(of|among|out of)\s+|/\s*)$", re.IGNORECASE)
# "68 percent" is a percentage; "95 percentile" is a position.
_PERCENT_AFTER = re.compile(r"^\s*(percent|per cent)\b", re.IGNORECASE)
_COHORT_AFTER = re.compile(
    r"^\s+(count(y|ies)|municipalit(y|ies)|regions?|zips?|tracts?|places?|peers?)\b",
    re.IGNORECASE,
)
# Too common to say which metric a sentence is about.
_STOPWORDS = frozenset(
    {"the", "of", "and", "in", "a", "an", "to", "on", "for", "by", "as", "at", "is"}
    | {"its", "over", "per", "or", "with", "from", "than", "that", "this", "which"}
    | {"was", "were", "be", "been", "are", "has", "have", "had"}
)


# --- the records a binding produces ---------------------------------------------------


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Citation(_Strict):
    """One figure in a text, and the packet field that licenses it."""

    text: str = Field(description="The figure as written.")
    start: int = Field(description="Character offset of the figure in the text.")
    end: int = Field(description="Offset one past the figure's last character.")
    value: float = Field(description="The figure as read: `$452,000` is 452000.")
    packet_value: float = Field(
        description="The packet value it matched: 452500 for a stated `$452,000`."
    )
    field: str | None = Field(
        description=(
            "Path of the packet field, e.g. `metrics[zhvi_sfr].pct_change`. Null for a "
            "figure quoted from the packet's text outside any one field."
        )
    )
    kind: FigureKind
    metric_id: str | None = None
    label: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    match_method: str | None = None
    release_ids: list[int] = Field(default_factory=list)
    alternatives: int = Field(
        default=0,
        description=(
            "Other packet fields the figure matched equally well. Non-zero means the "
            "figure is licensed but the field it came from is a best reading."
        ),
    )


class CitedRelease(_Strict):
    """A source release a citation points at, as the packet describes it."""

    release_id: int
    source_id: str
    name: str
    publisher: str
    vintage: str
    fetched_at: datetime


class UnboundFigure(_Strict):
    """A figure no packet field licenses."""

    text: str
    start: int
    end: int
    value: float
    nearest: float | None = Field(
        default=None, description="The closest value the packet does carry."
    )


class Binding(_Strict):
    """Every figure in one text, bound to the packet or reported as unbound."""

    citations: list[Citation] = Field(default_factory=list)
    releases: list[CitedRelease] = Field(default_factory=list)
    unbound: list[UnboundFigure] = Field(default_factory=list)

    @property
    def complete(self) -> bool:
        """Whether every figure the text states is licensed by the packet."""
        return not self.unbound


# --- reading numbers out of text ------------------------------------------------------


@dataclass(frozen=True)
class Stated:
    """One number as written, with where it sits in the text."""

    value: float
    text: str
    start: int
    end: int


def _blank(
    pattern: re.Pattern[str], text: str, origin: list[int]
) -> tuple[str, list[int]]:
    """Replace each match with one space, keeping each character's original offset."""
    parts: list[str] = []
    positions: list[int] = []
    last = 0
    for match in pattern.finditer(text):
        parts.append(text[last : match.start()])
        positions.extend(origin[last : match.start()])
        parts.append(" ")
        positions.append(origin[match.start()])
        last = match.end()
    parts.append(text[last:])
    positions.extend(origin[last:])
    return "".join(parts), positions


def _strip(text: str) -> tuple[str, list[int]]:
    """Year ranges, then ISO dates, each replaced by a space — the order matters.

    Replaced rather than deleted, so `2019-12-31to` cannot form a number, and with every
    surviving character's offset in the original kept, so a figure can be located.
    """
    stripped, origin = _blank(_YEAR_RANGE, text, list(range(len(text))))
    return _blank(_ISO_DATE, stripped, origin)


def strip_dates(text: str) -> str:
    """Remove ISO dates and year ranges, which are not figures."""
    return _strip(text)[0]


def stated_numbers(text: str) -> list[Stated]:
    """Every number in `text`, with its offsets.

    A trailing `%` is kept in the written form but not applied to the value: packets
    store percentage change as a number like 4.7, and models write it as "4.7%".
    Treating those as different values would flag every correct percentage as invented.
    """
    stripped, origin = _strip(text)
    found: list[Stated] = []
    for match in _NUMBER.finditer(stripped):
        # "$612,300, up 4%" — the comma after a figure is punctuation, not a digit group.
        raw = match.group(0).rstrip(",")
        cleaned = raw.replace(",", "").replace("$", "").replace("−", "-").rstrip("%")
        try:
            value = float(cleaned)
        except ValueError:  # pragma: no cover - the pattern cannot produce this
            continue
        # A match never spans a blanked date: the blank is a space, which the pattern
        # does not match, so its characters are contiguous in the original.
        found.append(
            Stated(
                value=value,
                text=raw,
                start=origin[match.start()],
                end=origin[match.start() + len(raw) - 1] + 1,
            )
        )
    return found


def _plain_whole(stated: Stated) -> bool:
    """A number written with no decimal, percentage or currency — how counts look."""
    return not any(mark in stated.text for mark in ".%$")


# --- the index: every figure a packet licenses ----------------------------------------

FormName = Literal["as_is", "rounded", "percent", "thousands", "magnitude"]


@dataclass(frozen=True)
class _Form:
    value: float
    name: FormName
    # Years and vintages. The 0.5% tolerance is ten years wide at 2020, so until
    # Milestone 13 any year within a decade of one the packet carried was supported.
    exact_only: bool = False


@dataclass(frozen=True)
class Figure:
    """One quotable number a packet carries, and where it came from."""

    field: str
    kind: FigureKind
    value: float
    forms: tuple[_Form, ...]
    metric_id: str | None = None
    label: str | None = None
    unit: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    release_ids: tuple[int, ...] = ()
    match_method: str | None = None
    order: int = 0


def _forms(value: float, *, plain: bool = False) -> tuple[_Form, ...]:
    """The ways a writer may state `value`: as is, rounded, as a percentage, in thousands.

    Those are the forms the evaluation checker has accepted since Milestone 8. A negative
    value adds the same forms of its size, marked so binding can ask the sentence for a
    direction before accepting one. `plain` is for years and vintages, which are only
    ever written one way.
    """
    if plain:
        return (_Form(value, "as_is", exact_only=True),)

    def written(number: float) -> dict[float, FormName]:
        out: dict[float, FormName] = {}
        candidates: tuple[tuple[float, FormName], ...] = (
            (number, "as_is"),
            (round(number, 1), "rounded"),
            (round(number, 2), "rounded"),
            (float(round(number)), "rounded"),
            (round(number * 100, 1), "percent"),
        )
        for form, name in candidates:
            out.setdefault(form, name)
        if abs(number) >= 1000:
            out.setdefault(round(number / 1000, 1), "thousands")
        return out

    forms = written(value)
    if value < 0:
        for form in written(-value):
            forms.setdefault(form, "magnitude")
    return tuple(_Form(form, name) for form, name in forms.items())


def _releases(*ids: int | None) -> tuple[int, ...]:
    return tuple(dict.fromkeys(i for i in ids if i is not None))


@dataclass(frozen=True)
class _About:
    """What a figure shares with the others read from the same metric and period."""

    metric_id: str | None = None
    label: str | None = None
    unit: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    release_ids: tuple[int, ...] = ()
    match_method: str | None = None


_UNATTRIBUTED = _About()


def figure_index(packet: Packet) -> list[Figure]:
    """Every figure `packet` licenses, in the order ties are resolved.

    Duplicates are folded where they are the same fact under two paths, so that
    `alternatives` counts genuine ambiguity rather than bookkeeping: a metric's latest
    value is bound to its `levels` entry, which carries the observation's whole period;
    a cohort equal to the packet's peer count is the peer count; one entry per distinct
    year; and a highlight repeats its metric.
    """
    figures: list[Figure] = []

    def add(
        field: str,
        kind: FigureKind,
        value: float | None,
        about: _About = _UNATTRIBUTED,
        *,
        plain: bool = False,
    ) -> None:
        if value is None:
            return
        number = float(value)
        figures.append(
            Figure(
                field=field,
                kind=kind,
                value=number,
                forms=_forms(number, plain=plain),
                metric_id=about.metric_id,
                label=about.label,
                unit=about.unit,
                period_start=about.period_start,
                period_end=about.period_end,
                release_ids=about.release_ids,
                match_method=about.match_method,
                order=len(figures),
            )
        )

    peers = packet.comparisons.peer_count
    add("comparisons.peer_count", "cohort", peers)

    years: set[int] = set()

    def add_year(field: str, year: int) -> None:
        if year not in years:
            years.add(year)
            add(field, "year", year, plain=True)

    add_year("window.start", packet.window.start.year)
    add_year("window.end", packet.window.end.year)

    levels = {level.metric_id: level for level in packet.levels}
    for metric in packet.metrics:
        key = f"metrics[{metric.metric_id}]"
        about = _About(metric_id=metric.metric_id, label=metric.label, unit=metric.unit)
        window = replace(
            about,
            period_start=metric.window_start,
            period_end=metric.window_end,
            release_ids=_releases(metric.start_release_id, metric.release_id),
            match_method=metric.match_method,
        )
        add(
            f"{key}.start_value",
            "start",
            metric.start_value,
            replace(
                about,
                period_end=metric.window_start,
                release_ids=_releases(metric.start_release_id),
                match_method=metric.start_match_method or metric.match_method,
            ),
        )
        level = levels.get(metric.metric_id)
        if level is None or level.value != metric.end_value:
            add(
                f"{key}.end_value",
                "value",
                metric.end_value,
                replace(
                    about,
                    period_end=metric.window_end,
                    release_ids=_releases(metric.release_id),
                    match_method=metric.match_method,
                ),
            )
        add(f"{key}.pct_change", "change", metric.pct_change, window)
        add(f"{key}.cagr", "annualised", metric.cagr, window)
        add(f"{key}.rank", "rank", metric.rank, window)
        if metric.of != peers:
            add(f"{key}.of", "cohort", metric.of, window)
        add(f"{key}.percentile", "percentile", metric.percentile, window)
        add_year(f"{key}.window_start", metric.window_start.year)
        add_year(f"{key}.window_end", metric.window_end.year)

    for level in packet.levels:
        key = f"levels[{level.metric_id}]"
        observed = _About(
            metric_id=level.metric_id,
            label=level.label,
            unit=level.unit,
            period_start=level.period_start,
            period_end=level.period_end,
            release_ids=_releases(level.release_id),
            match_method=level.match_method,
        )
        add(f"{key}.value", "value", level.value, observed)
        add(f"{key}.rank", "rank", level.rank, observed)
        if level.of != peers:
            add(f"{key}.of", "cohort", level.of, observed)
        add(f"{key}.percentile", "percentile", level.percentile, observed)
        add_year(f"{key}.period_start", level.period_start.year)
        add_year(f"{key}.period_end", level.period_end.year)

    metrics = {metric.metric_id: metric for metric in packet.metrics}
    for index, highlight in enumerate(packet.highlights):
        # Selected from `metrics`, so ordinarily a repeat. Indexed only where it is not,
        # which a hand-built packet can be.
        twin = metrics.get(highlight.metric_id)
        key = f"highlights[{index}]"
        named = _About(metric_id=highlight.metric_id, label=highlight.label)
        if twin is None or twin.pct_change != highlight.pct_change:
            add(f"{key}.pct_change", "change", highlight.pct_change, named)
        if twin is None or twin.rank != highlight.rank:
            add(f"{key}.rank", "rank", highlight.rank, named)
        if (twin is None or twin.of != highlight.of) and highlight.of != peers:
            add(f"{key}.of", "cohort", highlight.of, named)

    for index, source in enumerate(packet.sources):
        # Vintages are quotable provenance: "the 2023 ACS release".
        if source.vintage.isdigit():
            add(
                f"sources[{index}].vintage",
                "vintage",
                float(source.vintage),
                _About(release_ids=tuple(source.release_ids)),
                plain=True,
            )
    return figures


def licensed_values(packet: Packet) -> set[float]:
    """Every number the packet licenses outright — every form but a dropped sign."""
    return {
        form.value
        for figure in figure_index(packet)
        for form in figure.forms
        if form.name != "magnitude"
    }


# --- matching one stated figure -------------------------------------------------------


@dataclass(frozen=True)
class _Match:
    figure: Figure
    form: _Form
    gap: float  # relative; 0.0 for an exact form


def _yearlike(stated: Stated) -> bool:
    """A four-digit whole number in the range years fall in, written as a year is.

    "2,023" is a count: a year is never written with a thousands separator.
    """
    return (
        _plain_whole(stated)
        and "," not in stated.text
        and not stated.text.startswith(("-", "−"))
        and 1900 <= stated.value <= 2100
    )


def _best_form(value: float, figure: Figure, *, exact: bool) -> _Match | None:
    """The form of `figure` closest to `value`, if one matches.

    Exact where `exact` says so, and always for a year or vintage; otherwise within the
    relative tolerance. Among equally close forms an outright one beats a dropped sign.
    """
    best: _Match | None = None
    for form in figure.forms:
        gap = abs(form.value - value)
        if gap and (exact or form.exact_only):
            continue
        if gap > max(abs(form.value) * RELATIVE_TOLERANCE, 1e-9):
            continue
        relative = gap / max(abs(form.value), 1e-9)
        rank = (relative, form.name == "magnitude")
        if best is None or rank < (best.gap, best.form.name == "magnitude"):
            best = _Match(figure, form, relative)
    return best


def _sentence(text: str, start: int, end: int) -> tuple[int, int]:
    """The span of the sentence — or line of a list — containing text[start:end]."""
    begin = 0
    for match in _SENTENCE_END.finditer(text, 0, start):
        begin = match.end()
    after = _SENTENCE_END.search(text, end)
    return begin, after.start() if after else len(text)


def _words(text: str) -> set[str]:
    """Content words, crudely singularised so "values" meets "value"."""
    return {
        word[:-1] if len(word) > 3 and word.endswith("s") else word
        for word in _WORD.findall(text.lower())
        if word not in _STOPWORDS
    }


@dataclass(frozen=True)
class _Context:
    """What the words around a figure say about which field it came from."""

    style: Literal["percent", "money", "plain"]
    sentence: set[str]
    near: str
    before: str
    after: str
    # Metrics already cited, unambiguously, earlier in the same sentence. A line reading
    # "Home value: $591,891, rank 10 of 21" is about one metric throughout, and the rank
    # is the home value's even where seven other fields also hold a 10.
    cited: frozenset[str]


def _context(text: str, stated: Stated, cited: frozenset[str]) -> _Context:
    begin, finish = _sentence(text, stated.start, stated.end)
    after = text[stated.end : finish]
    before = text[begin : stated.start]
    percent = stated.text.endswith("%") or bool(_PERCENT_AFTER.match(after))
    return _Context(
        style="percent" if percent else "money" if "$" in stated.text else "plain",
        sentence=_words(text[begin:finish]),
        near=before[-60:] + " " + after[:30],
        before=before[-14:],
        after=after,
        cited=cited,
    )


def _fit(match: _Match, context: _Context, stated: Stated) -> int:
    """How well the written form suits the field: 2 good, 1 neutral, 0 poor."""
    figure, form = match.figure, match.form
    if context.style == "percent":
        if form.name == "percent":
            return 2 if figure.unit == "ratio" or figure.kind == "percentile" else 0
        if figure.kind in {"change", "annualised"} or figure.unit == "percent":
            return 2
        return 0
    if context.style == "money":
        money = figure.unit in {"usd", "usd_month"} and figure.kind in {"value", "start"}
        return 2 if money else 0
    if figure.kind in {"year", "vintage"}:
        return 2 if _yearlike(stated) else 0
    return 0 if form.name == "percent" else 1


def _signal(match: _Match, context: _Context) -> int:
    """Words that name this field's metric, or its kind of quantity."""
    figure = match.figure
    named = _words(f"{figure.label or ''} {(figure.metric_id or '').replace('_', ' ')}")
    score = len(named & context.sentence)
    if figure.metric_id is not None and figure.metric_id in context.cited:
        score += 2
    kind = figure.kind
    if kind == "rank" and _ORDINAL_AFTER.search(context.after):
        score += 2
    if kind == "cohort" and (
        _COHORT_BEFORE.search(context.before) or _COHORT_AFTER.search(context.after)
    ):
        score += 2
    if kind == "change" and (
        _CHANGE_WORDS.search(context.near) or _DOWNWARD.search(context.near)
    ):
        score += 1
    if kind == "annualised" and _ANNUAL_WORDS.search(context.near):
        score += 2
    if kind == "percentile" and "percentile" in context.near.lower():
        score += 2
    if kind in {"rank", "cohort", "percentile"}:
        on_change = figure.field.startswith("metrics[")
        worded = _CHANGE_WORDS if on_change else _LEVEL_WORDS
        if worded.search(context.near):
            score += 1
    return score


def _choose(
    context: _Context, stated: Stated, matches: list[_Match]
) -> tuple[_Match, int]:
    """The best-supported field for a figure, and how many others tied with it.

    Raises `LookupError` when nothing is usable — no match at all, or only the size of
    a negative value in a sentence that does not say which way it moved.
    """
    usable = [
        m for m in matches if m.form.name != "magnitude" or _DOWNWARD.search(context.near)
    ]
    if not usable:
        raise LookupError(stated.text)

    def key(m: _Match) -> tuple[int, int, int, float, int]:
        return (
            _fit(m, context, stated),
            _signal(m, context),
            1 if m.gap == 0 else 0,
            -m.gap,
            -m.figure.order,
        )

    ranked = sorted(usable, key=key, reverse=True)
    top = key(ranked[0])[:3]
    tied = sum(1 for m in ranked[1:] if key(m)[:3] == top)
    return ranked[0], tied


def _nearest(value: float, figures: Iterable[Figure]) -> float | None:
    nearest: float | None = None
    smallest = float("inf")
    for figure in figures:
        for form in figure.forms:
            gap = abs(form.value - value)
            if gap < smallest:
                smallest, nearest = gap, form.value
    return nearest


def _packet_texts(packet: Packet) -> Iterator[tuple[str, str, str | None]]:
    """The packet's own prose, as `(field, text, metric_id)`."""
    yield "region.label", packet.region.label, None
    for metric in packet.metrics:
        yield f"metrics[{metric.metric_id}].label", metric.label, metric.metric_id
    for level in packet.levels:
        yield f"levels[{level.metric_id}].label", level.label, level.metric_id
    for index, caveat in enumerate(packet.caveats):
        yield f"caveats[{index}]", caveat, None
    for index, source in enumerate(packet.sources):
        yield f"sources[{index}].name", source.name, None
        yield f"sources[{index}].publisher", source.publisher, None


def _quotes(stated: Stated, haystack: str) -> bool:
    """Whether the figure occurs in `haystack` as a whole token, not inside a number.

    The evaluation checker accepted any substring until Milestone 13, so a stated 452
    was "quoted" from $452,500. Measured on run `v2`, that rescued four legitimate
    figures and no fabrication — three were a dropped sign, now licensed properly — but
    a gate on published prose cannot license a number for being part of another one.
    """
    core = stated.text.strip().replace("$", "").rstrip("%")
    if not core:
        return False
    pattern = rf"(?<![\d.,]){re.escape(core)}(?![\d]|[.,]\d)"
    return re.search(pattern, haystack) is not None


def _quoted(stated: Stated, packet: Packet, payload: str | None) -> Citation | None:
    """A citation for a figure the packet states in words rather than as a value."""
    for field, text, metric_id in _packet_texts(packet):
        if _quotes(stated, text):
            label = text if field.endswith(".label") else None
            return _text_citation(stated, field, metric_id, label)
    if payload is not None and _quotes(stated, payload):
        return _text_citation(stated, None, None, None)
    return None


def _text_citation(
    stated: Stated, field: str | None, metric_id: str | None, label: str | None
) -> Citation:
    return Citation(
        text=stated.text,
        start=stated.start,
        end=stated.end,
        value=stated.value,
        packet_value=stated.value,
        field=field,
        kind="text",
        metric_id=metric_id,
        label=label,
    )


def _is_claim(stated: Stated, text: str, outright: set[float], skip: set[float]) -> bool:
    """Whether a number in `text` asserts something the packet must license."""
    if stated.value in skip:
        return False
    if _plain_whole(stated):
        if _DESCRIPTOR_AFTER.match(text[stated.end : stated.end + 12]):
            return False
        if abs(stated.value) < TRIVIAL_BELOW and stated.value not in outright:
            return False
    return True


def bind(
    text: str,
    packet: Packet,
    *,
    payload: str | None = None,
    skip: Iterable[float] = (),
) -> Binding:
    """Bind every figure in `text` to the field of `packet` that licenses it.

    `payload` is the text the model was shown — the rendered packet — which licenses a
    figure it quotes as prose. `skip` holds numbers that are not claims in this text:
    the evaluation passes the ones its question stated, so a model that declines while
    naming the year it was asked about is not accused of inventing it.
    """
    figures = figure_index(packet)
    outright = {
        form.value for f in figures for form in f.forms if form.name != "magnitude"
    }
    skipped = set(skip)
    cited_in: dict[tuple[int, int], set[str]] = {}

    citations: list[Citation] = []
    unbound: list[UnboundFigure] = []
    for stated in stated_numbers(text):
        if not _is_claim(stated, text, outright, skipped):
            continue

        # A year is exactly one the packet covers or it is not one it covers.
        exact = _yearlike(stated)
        matches = [
            m
            for f in figures
            if (m := _best_form(stated.value, f, exact=exact)) is not None
        ]
        span = _sentence(text, stated.start, stated.end)
        cited = cited_in.setdefault(span, set())
        context = _context(text, stated, frozenset(cited))
        best: _Match | None
        try:
            best, tied = _choose(context, stated, matches)
        except LookupError:
            best, tied = None, 0
        # A value whose unit the writer did not use is the weakest reading there is; if
        # the packet says the figure in words — "80% AMI" in a metric's label — that is
        # what was quoted.
        if best is None or _fit(best, context, stated) == 0:
            quoted = _quoted(stated, packet, payload)
            if quoted is not None:
                citations.append(quoted)
                continue
        if best is None:
            unbound.append(
                UnboundFigure(
                    text=stated.text,
                    start=stated.start,
                    end=stated.end,
                    value=stated.value,
                    nearest=_nearest(stated.value, figures),
                )
            )
            continue

        figure = best.figure
        if not tied and figure.metric_id is not None:
            cited.add(figure.metric_id)
        citations.append(
            Citation(
                text=stated.text,
                start=stated.start,
                end=stated.end,
                value=stated.value,
                packet_value=figure.value,
                field=figure.field,
                kind=figure.kind,
                metric_id=figure.metric_id,
                label=figure.label,
                period_start=figure.period_start,
                period_end=figure.period_end,
                match_method=figure.match_method,
                release_ids=list(figure.release_ids),
                alternatives=tied,
            )
        )

    return Binding(
        citations=citations,
        releases=_cited_releases(packet, citations),
        unbound=unbound,
    )


def _cited_releases(packet: Packet, citations: list[Citation]) -> list[CitedRelease]:
    """The releases the citations name, described as the packet's `sources[]` does.

    A release the packet does not list — every start release in a packet older than
    1.2 — keeps its id on the citation and has no entry here.
    """
    wanted = {rid for citation in citations for rid in citation.release_ids}
    releases: list[CitedRelease] = []
    for source in packet.sources:
        for rid in source.release_ids:
            if rid in wanted:
                releases.append(
                    CitedRelease(
                        release_id=rid,
                        source_id=source.source_id,
                        name=source.name,
                        publisher=source.publisher,
                        vintage=source.vintage,
                        fetched_at=source.fetched_at,
                    )
                )
    return releases


def describe_unbound(binding: Binding, limit: int = 4) -> str:
    """The unbound figures as one line: `$612,300 (nearest 452,500), 88.4% (…)`."""

    def number(value: float) -> str:
        return f"{value:,.0f}" if abs(value) >= 1000 else f"{value:g}"

    shown = [
        f"{u.text} (nearest {number(u.nearest)})" if u.nearest is not None else u.text
        for u in binding.unbound[:limit]
    ]
    more = len(binding.unbound) - limit
    return ", ".join(shown) + (f", and {more} more" if more > 0 else "")


__all__ = [
    "Binding",
    "CitedRelease",
    "Citation",
    "Figure",
    "FigureKind",
    "RELATIVE_TOLERANCE",
    "Stated",
    "TRIVIAL_BELOW",
    "UnboundFigure",
    "bind",
    "describe_unbound",
    "figure_index",
    "licensed_values",
    "stated_numbers",
    "strip_dates",
]
