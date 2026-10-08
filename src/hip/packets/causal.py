"""Causal wording a reading may use, and where (Milestone 51, ARCHITECTURE #337).

A reading may say a figure moved *because* of another only where the packet carries a
relationship that makes it so — a ratio split into its two sides, which is arithmetic
(`relationships[]`, kind `ratio_split`). Any other causal claim between measures is one
the data cannot support, however plausible it reads: "prices rose because of
migration" is refused, "home value to income fell because incomes rose faster than
values" is not.

The rule is by sentence. A sentence with causal wording that cites no figure is about
method — "because these survey estimates pool five years" — and passes. One that cites
figures passes only when a causal relationship holds a ratio the sentence names, and
every other measure it cites is one of that ratio's sides. Deterministic, so a refusal
costs nothing to decide and says exactly what was wrong. What it cannot see — a causal
claim between measures named only in words — is the limitation recorded with the
figure-free claims binding cannot check (TODO).

Loosened on 2026-10-08 (ARCHITECTURE #346), after benchmark `v4` refused 14 sentences of
which none made a claim the data cannot support:

- A ratio counts as named when the sentence, or the one before it, cites its figure or
  states its label: "The shift in **Home value to household income** occurred because
  values rose 68.6% while incomes rose 26.7%", or "Home value to income rose to 6.2.
  This rose because…". The cited measures must still be that ratio's two sides.
- Causal wording whose clause begins with how a figure was measured — "because the
  margin of error exceeds the estimate", "due to survey margins" — is about method.
- Denied causation ("not because homes became worth more") claims no cause.
- A clause repeating a packet caveat ("because pricier homes sold", against "a median
  that rises can mean pricier homes changed hands") is the packet's own statement.
"""

from __future__ import annotations

import re

from hip.packets.citations import Binding, sentence_span
from hip.packets.schema import Packet

CAUSAL = re.compile(
    r"\b(because|due to|driven by|as a result|led to|leading to|lead to|caused|"
    r"causing|thanks to|owing to|fuel(?:l?ed|l?ing|s)?|pushed (?:up|down)|"
    r"attributable to|result(?:ed|s|ing)? (?:in|from))\b",
    re.IGNORECASE,
)

# Figures that say when or among how many, not what moved.
_NOT_A_MEASURE = {"year", "vintage", "cohort"}

# How a figure was measured, at the head of a causal clause: "because the margin of
# error…", "due to survey margins". Kept short and literal; a new term is a decision.
_METHOD = re.compile(
    r"^\W*(?:\w+\W+){0,3}?(?:margins?|survey|sampl\w*|estimates?|overlap\w*)\b",
    re.IGNORECASE,
)
_DENIED = re.compile(r"\bnot\s+$", re.IGNORECASE)
# Where a causal clause ends for the caveat comparison.
_CLAUSE_END = re.compile(r"[,;:()\u2014]|\s-\s")
_WORD = re.compile(r"[a-z]+")
_STOP = {"the", "that", "this", "these", "those", "were", "with", "from", "than", "more"}


def _normal(text: str) -> str:
    """Lower case, markup and hyphens as spaces: `**Home-value**` reads `home value`."""
    return " ".join(re.sub(r"[-*_`]", " ", text.lower()).split())


def _content(text: str) -> set[str]:
    return {w for w in _WORD.findall(text.lower()) if len(w) >= 4 and w not in _STOP}


def _excused(text: str, match: re.Match[str], end: int, caveats: list[set[str]]) -> bool:
    """Whether one piece of causal wording claims no cause between measures."""
    if _DENIED.search(text[max(0, match.start() - 8) : match.start()]):
        return True
    clause = text[match.end() : end]
    if _METHOD.match(clause):
        return True
    head = _CLAUSE_END.split(clause, maxsplit=1)[0]
    words = _content(head)
    return len(words) >= 3 and any(words <= caveat for caveat in caveats)


def causal_problems(text: str, binding: Binding, packet: Packet) -> list[str]:
    """Each sentence whose causal wording no relationship in `packet` supports."""
    labels = {m.metric_id: m.label for m in packet.metrics}
    labels |= {lv.metric_id: lv.label for lv in packet.levels}
    # Each causal relationship's ratio, beside every measure it holds and their values.
    splits: dict[str, set[str]] = {}
    values: dict[str, list[float]] = {}
    for relationship in packet.relationships:
        if not relationship.causal:
            continue
        metrics = {figure.metric_id for figure in relationship.figures}
        for figure in relationship.figures:
            if figure.role.startswith("ratio_"):
                splits.setdefault(figure.metric_id, set()).update(metrics)
                values.setdefault(figure.metric_id, []).extend(
                    f.value for f in relationship.figures if f.value is not None
                )
    caveats = [_content(caveat) for caveat in packet.caveats]
    # "Home value to household income" is named by "value to income" too: the last word
    # of each side, with up to two qualifiers between ("value to area median income").
    spoken = {
        ratio: re.compile(rf"\b{a.split()[-1]} to (?:\w+ ){{0,2}}{b.split()[-1]}\b")
        for ratio in splits
        if len(parts := _normal(labels.get(ratio, ratio)).split(" to ", 1)) == 2
        for a, b in [parts]
    }

    def named(start: int, end: int) -> set[str]:
        """Ratios a span cites by figure or states by label."""
        cited = {c.metric_id for c in binding.citations if start <= c.start < end}
        words = _normal(text[start:end])
        return {
            ratio
            for ratio in splits
            if ratio in cited or (ratio in spoken and spoken[ratio].search(words))
        }

    def sides_only(ratio: str, start: int, end: int) -> bool:
        """Every measure the sentence cites is one of `ratio`'s sides. A figure binding
        gave to another field passes when it is one of the split's own values, as a
        yearly average that equals some level's figure is."""
        for c in binding.citations:
            if not (
                c.metric_id and c.kind not in _NOT_A_MEASURE and start <= c.start < end
            ):
                continue
            if c.metric_id == ratio or c.metric_id in splits[ratio]:
                continue
            # As stated, to the places it was written in: `$503,510` for 503,509.73.
            places = len(c.text.split(".")[1].rstrip("%×x ")) if "." in c.text else 0
            if not any(abs(c.value - v) <= 0.5 * 10**-places for v in values[ratio]):
                return False
        return True

    problems: list[str] = []
    by_sentence: dict[tuple[int, int], list[re.Match[str]]] = {}
    for match in CAUSAL.finditer(text):
        # The sentence as binding finds one, which a decimal point does not end.
        span = sentence_span(text, match.start(), match.end())
        by_sentence.setdefault(span, []).append(match)
    for (start, end), matches in by_sentence.items():
        cited = {
            c.metric_id
            for c in binding.citations
            if c.metric_id and c.kind not in _NOT_A_MEASURE and start <= c.start < end
        }
        if not cited:
            continue
        unexcused = [m for m in matches if not _excused(text, m, end, caveats)]
        if not unexcused:
            continue
        ratios = named(start, end)
        if start > 1:
            ratios |= named(*sentence_span(text, start - 2, start - 1))
        if any(sides_only(ratio, start, end) for ratio in ratios):
            continue
        named_measures = ", ".join(sorted(repr(labels.get(m, m)) for m in cited))
        problems.append(
            f'causal wording "{unexcused[0].group(0)}" with {named_measures}: no '
            f"relationship in the data supports a cause there; only a ratio's change may "
            f"be explained by its two sides"
        )
    return problems
