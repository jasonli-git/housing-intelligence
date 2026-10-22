"""A reading may call a figure a survey estimate only if it is one (ARCHITECTURE #422).

Binding checks the figures a reading states, not what it says they are. Cumberland's
reading in `readings-v8` said "the typical home value rests on a five-year window of
survey estimates" of Zillow's home value, a modelled index; the binding passed, since
the figure itself was right (TODO, #275).

A survey word ("survey", "five-year estimate", "ACS") is a claim about the measures it
speaks of: those the clause names, else the sentence's, else the figures the sentence
cites, else the previous sentence's ("these five-year survey estimates"). A measure
named in everyday words that could mean several ("home value": Zillow's index, the
Census's owner-reported value, the state's sale price) means the one the reading cites,
where it cites one. The claim passes when any measure it speaks of is a survey figure or
calculated from one (`PacketLevel.survey`), and is refused when none is. Words that deny
it ("not a survey", "unlike the survey") are not a claim. Deterministic, like the causal
and ranking-word rules (`hip.packets.causal`, `hip.packets.comparative`).
"""

from __future__ import annotations

import re

from hip.packets.citations import Binding, sentence_span
from hip.packets.comparative import _CLAUSE, _claimed, _named, _vocabulary
from hip.packets.schema import Packet

# Not "non-survey", which denies it, and not "the five-year window", which is the
# change window every measure has (both found in `readings-v1` and `v6`).
_SURVEY = re.compile(
    r"(?<!non-)\bsurvey(?:ed|s)?\b|\b(?:five|5)[- ]year (?:survey )?(?:estimates?|"
    r"averages?|samples?)\b|\bACS\b|\bAmerican Community Survey\b",
    re.IGNORECASE,
)
_DENIED = re.compile(
    r"\b(?:not|never|unlike|rather than|instead of|no)\b(?:\s+\w+){0,3}\s*$", re.I
)
_FIELD = re.compile(r"^(?:levels|metrics)\[([^\]]+)\]\.")


def _cited(binding: Binding, start: int, stop: int) -> set[str]:
    """The metrics whose figures the reading states between `start` and `stop`."""
    found = set()
    for citation in binding.citations:
        match = _FIELD.match(citation.field or "")
        if match and start <= citation.start < stop:
            found.add(match.group(1))
    return found


def kind_problems(text: str, binding: Binding, packet: Packet) -> list[str]:
    """Each survey word spoken of measures none of which is a survey figure."""
    levels = {lv.metric_id: lv for lv in packet.levels}
    survey = {m for m, lv in levels.items() if lv.survey}
    words = _vocabulary(packet, set(levels))
    cited_anywhere = _cited(binding, 0, len(text))
    problems: list[str] = []
    for match in _SURVEY.finditer(text):
        start, stop = sentence_span(text, match.start(), match.end())
        if _DENIED.search(text[max(start, match.start() - 40) : match.start()]):
            continue
        cuts = [start] + [m.end() + start for m in _CLAUSE.finditer(text[start:stop])]
        cuts += [stop]
        lo = max(c for c in cuts if c <= match.start())
        hi = min(c for c in cuts if c >= match.end())
        clause = text[lo:hi]
        at, until = match.start() - lo, match.end() - lo
        groups = _claimed(clause, _named(clause, words), at, until)
        if not groups:
            sentence = text[start:stop]
            groups = _claimed(
                sentence,
                _named(sentence, words),
                match.start() - start,
                match.end() - start,
            )
        if not groups:
            groups = [{m} for m in _cited(binding, start, stop)]
        if not groups and start > 1:
            prior_start, prior_stop = sentence_span(text, start - 2, start - 1)
            prior = text[prior_start:prior_stop]
            groups = [m[2] for m in _named(prior, words)]
            groups += [{m} for m in _cited(binding, prior_start, prior_stop)]
        # Everyday words mean the measure the reading cites, where it cites one of them.
        meant = [(g & cited_anywhere) or g for g in groups if g]
        if not meant or any(g & survey for g in meant):
            continue
        named = sorted({m for g in meant for m in g})
        shown = ", ".join(
            f"{levels[m].label!r} ({levels[m].record_type or 'not a survey'})"
            for m in named
            if m in levels
        )
        problems.append(
            f'"{match.group(0)}" calls a figure a survey estimate that is not one: '
            f"{shown}. Name each figure's kind as the packet does, or drop the word"
        )
    return problems
