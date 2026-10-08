"""No forecasts from history (Milestone 52, ARCHITECTURE #348).

The persistence fact says how far a region's price-to-income sits from its own long-run
median and how earlier spells at that level ended. It is the evidence a forecast would
lean on, and the obvious misreading of it is one: "prices are 30% above their median,
so they will fall back". Nothing in the data says that, and the platform publishes no
forecast (SPEC principle 11; Milestone 53 is where a modelled estimate would be built,
validated and labelled).

The rule is by sentence, as the causal gate's is. A sentence with forecast wording is
refused when it, or the sentence before it, cites a persistence figure. Wording that
denies a forecast — "this is not a forecast", "does not predict" — passes.
"""

from __future__ import annotations

import re

from hip.packets.citations import Binding, sentence_span
from hip.packets.schema import Packet

PREDICTION = re.compile(
    r"\b(?:"
    r"will (?:likely |probably |eventually |soon )?"
    r"(?:fall|drop|decline|ease|cool|correct|rise|climb|keep|continue|stay|remain|"
    r"return|revert|come (?:down|back)|go (?:up|down)|level off|normali[sz]e)"
    r"|(?:is|are|seems?|looks?) (?:likely|unlikely|expected|set|bound|poised|due) to"
    r"|(?:could|may|might|should|would) (?:soon |eventually )?"
    r"(?:fall|drop|decline|ease|cool|correct|revert|return|come (?:down|back)|"
    r"normali[sz]e|level off)"
    r"|due for|overdue|sooner or later|inevitabl\w*|forecast\w*|predict\w*"
    r"|in the (?:coming|next few) (?:years|months)|going forward"
    r")\b",
    re.IGNORECASE,
)
_DENIED = re.compile(
    r"\b(?:not|no|never|nothing|cannot|can't|doesn't|isn't)\b[^.]{0,24}$"
)


def prediction_problems(text: str, binding: Binding, packet: Packet) -> list[str]:
    """Each sentence that forecasts from the persistence fact."""
    if packet.persistence is None:
        return []
    cited = [
        (c.start, c.end)
        for c in binding.citations
        if c.field is not None and c.field.startswith("persistence")
    ]
    if not cited:
        return []

    def cites(start: int, end: int) -> bool:
        return any(start <= c_start < end for c_start, _ in cited)

    problems: list[str] = []
    seen: set[tuple[int, int]] = set()
    for match in PREDICTION.finditer(text):
        if _DENIED.search(text[max(0, match.start() - 40) : match.start()]):
            continue
        start, end = sentence_span(text, match.start(), match.end())
        if (start, end) in seen:
            continue
        before = sentence_span(text, start - 2, start - 1) if start > 1 else None
        if not (cites(start, end) or (before is not None and cites(*before))):
            continue
        seen.add((start, end))
        problems.append(
            f'a forecast ("{match.group(0)}") from the long-run comparison in '
            f'"…{text[max(start, match.start() - 40) : match.end() + 20]}…": it says how '
            f"far today sits from the past and how earlier spells ended, not what comes "
            f"next"
        )
    return problems
