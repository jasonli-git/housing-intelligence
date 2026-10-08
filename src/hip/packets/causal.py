"""Causal wording a reading may use, and where (Milestone 51, ARCHITECTURE #337).

A reading may say a figure moved *because* of another only where the packet carries a
relationship that makes it so — a ratio split into its two sides, which is arithmetic
(`relationships[]`, kind `ratio_split`). Any other causal claim between measures is one
the data cannot support, however plausible it reads: "prices rose because of
migration" is refused, "home value to income fell because incomes rose faster than
values" is not.

The rule is by sentence. A sentence with causal wording that cites no figure is about
method — "because these survey estimates pool five years" — and passes. One that cites
figures passes only when a causal relationship holds the ratio it cites, and every other
measure it cites is one of that ratio's sides. Deterministic, so a refusal costs nothing
to decide and says exactly what was wrong. What it cannot see — a causal claim between
measures named only in words — is the limitation recorded with the figure-free claims
binding cannot check (TODO).
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


def causal_problems(text: str, binding: Binding, packet: Packet) -> list[str]:
    """Each sentence whose causal wording no relationship in `packet` supports."""
    labels = {m.metric_id: m.label for m in packet.metrics}
    labels |= {lv.metric_id: lv.label for lv in packet.levels}
    supported = [
        {figure.metric_id for figure in relationship.figures}
        for relationship in packet.relationships
        if relationship.causal
    ]
    ratios = {
        figure.metric_id
        for relationship in packet.relationships
        if relationship.causal
        for figure in relationship.figures
        if figure.role.startswith("ratio_")
    }
    problems: list[str] = []
    seen: set[tuple[int, int]] = set()
    for match in CAUSAL.finditer(text):
        # The sentence as binding finds one, which a decimal point does not end.
        start, end = sentence_span(text, match.start(), match.end())
        if (start, end) in seen:
            continue
        seen.add((start, end))
        cited = {
            c.metric_id
            for c in binding.citations
            if c.metric_id and c.kind not in _NOT_A_MEASURE and start <= c.start < end
        }
        if not cited:
            continue
        if cited & ratios and any(cited <= metrics for metrics in supported):
            continue
        named = ", ".join(sorted(repr(labels.get(m, m)) for m in cited))
        problems.append(
            f'causal wording "{match.group(0)}" with {named}: no relationship in the '
            f"data supports a cause there; only a ratio's change may be explained by "
            f"its two sides"
        )
    return problems
