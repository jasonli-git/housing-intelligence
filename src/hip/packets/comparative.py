"""Ranking words a reading may use only where the packet's ranks bear them out
(ARCHITECTURE #412).

Binding checks the figures a reading states, so a ranking made in words passes whether
the packet supports it or not: Gemini's test reading of Hudson said rents take "a
particularly large share of household budgets" with nothing behind it (TODO, #275). The
consumer reading ranks in words on purpose — at most three figures an answer — so the
words themselves are what has to be checked, against the ranks the packet carries.

By clause (a sentence split at commas, semicolons, "while", "but"): each ranking phrase
is a claim about every measure the clause names, and passes when any measure the words
could mean stands where the phrase says, its margin of error allowed for:

- "the highest" / "the lowest" — first or last place, `rank_best` within reach.
- "among the highest", "near the top", "relatively high", "above average" … — the
  quarter of the cohort at that end (the half, for "above / below average").
- "stands out" — either quarter.

A phrase in a clause naming no measure the packet ranks, in its own words or the
sentence's, is refused too: that is the Hudson sentence. Measures are named by their
packet label or by the everyday words in `_SPOKEN`; kept literal, so a new phrase is a
decision. Deterministic, like the causal rule (`hip.packets.causal`).
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

from hip.packets.citations import Binding, sentence_span
from hip.packets.schema import Packet

# (pattern, end, reach): end "high" or "low"; reach "first", "quarter", "half", "either".
_PHRASES: tuple[tuple[str, str, str], ...] = (
    (
        r"(?:among|one of) (?:the )?(?:state[’']?s |new jersey[’']?s |its |\w+ "
        r")?(?:highest|largest|"
        r"most expensive|priciest|top)",
        "high",
        "quarter",
    ),
    (
        r"(?:among|one of) (?:the )?(?:state[’']?s |new jersey[’']?s |its |\w+ "
        r")?(?:lowest|smallest|"
        r"least expensive|cheapest|least|bottom)",
        "low",
        "quarter",
    ),
    (
        r"near(?:ly)? (?:the )?(?:top|highest|high end|higher end)|(?:the )?higher end|"
        r"toward the top",
        "high",
        "quarter",
    ),
    (
        r"near(?:ly)? (?:the )?(?:bottom|lowest|low end|lower end)|(?:the )?lower end|"
        r"toward the bottom",
        "low",
        "quarter",
    ),
    (
        r"(?:relatively|comparatively|fairly|somewhat) "
        r"(?:high|large|heavy|steep|expensive|"
        r"costly|common)",
        "high",
        "half",
    ),
    (
        r"(?:relatively|comparatively|fairly|somewhat) (?:low|small|light|cheap|"
        r"affordable|rare|uncommon)",
        "low",
        "half",
    ),
    (
        r"(?:particularly|unusually|exceptionally|remarkably|especially|notably) (?:high|"
        r"large|heavy|steep|expensive|costly|common)|"
        r"(?:large|significant|substantial|sizable|outsized|heavy) (?:share|portion|"
        r"part|burden|proportion)",
        "high",
        "quarter",
    ),
    (
        r"(?:particularly|unusually|exceptionally|remarkably|especially|notably) (?:low|"
        r"small|light|cheap|affordable|rare|uncommon)|"
        r"(?:small|modest) (?:share|portion|part|burden|proportion)|least common",
        "low",
        "quarter",
    ),
    (
        r"above(?:[- ]the)?[- ]average|higher than (?:most|average|typical)",
        "high",
        "half",
    ),
    (r"below(?:[- ]the)?[- ]average|lower than (?:most|average|typical)", "low", "half"),
    (
        r"(?:the |state[’']?s |new jersey[’']?s |its )?(?:highest|largest|most "
        r"expensive|priciest)",
        "high",
        "first",
    ),
    (
        r"(?:the |state[’']?s |new jersey[’']?s |its )?(?:lowest|smallest|least "
        r"expensive|cheapest)",
        "low",
        "first",
    ),
    (r"stands? out", "either", "quarter"),
)
_PHRASE = re.compile(
    "|".join(f"(?P<p{i}>\\b(?:{p})\\b)" for i, (p, _, _) in enumerate(_PHRASES)),
    re.IGNORECASE,
)

# Everyday words for measures, beside each packet label. A ratio's words come first, so
# "home value compared with income" is the ratio, not its two sides.
_SPOKEN: tuple[tuple[str, tuple[str, ...]], ...] = (
    # Before the home value ratio, whose "price to income" it contains.
    (
        r"sale[- ]prices? (?:compared (?:with|to)|against|relative to|to) "
        r"(?:household )?incomes?",
        ("sale_price_to_income",),
    ),
    (
        r"(?:home )?values? (?:compared (?:with|to)|against|relative to|to) "
        r"(?:household )?"
        r"incomes?|price[- ]to[- ]income",
        ("price_to_income",),
    ),
    (
        r"rents? (?:compared (?:with|to)|against|relative to|to) (?:household )?incomes?|"
        r"rent[- ]to[- ]income",
        ("rent_to_income",),
    ),
    (
        r"rents?|renting costs?|rental costs?|cost(?:s)? (?:of|to) rent",
        (
            "zori_all",
            "acs_median_gross_rent",
            "acs_median_rent_1br",
            "acs_median_rent_2br",
            "acs_median_rent_3br",
        ),
    ),
    (
        r"home values?|home prices?|house prices?|buying costs?|cost(?:s)? (?:of|to) buy|"
        r"sale prices?",
        ("zhvi_sfr", "acs_median_home_value", "sr1a_median_sale_price"),
    ),
    (
        r"(?:housing[- ]cost )?burden\w*|"
        r"(?:share|portion|part|proportion) of (?:their |its |a |the )?"
        r"(?:households?[’']? |family |renters?[’']? |owners?[’']? |monthly |yearly )?"
        r"(?:incomes?|budgets?|paychecks?|earnings)(?: (?:going to|spent on|that goes "
        r"to) housing)?|"
        r"household budgets?|(?:paying|spending|spend|pay) (?:over|more than) 30% of "
        r"(?:their |household )?incomes?(?: on housing)?",
        (
            "acs_renter_cost_burden",
            "chas_renter_cost_burden",
            "chas_owner_cost_burden",
            "acs_owner_severe_burden",
        ),
    ),
    # readings-v11: Cumberland's "monthly owner costs with a mortgage" fell through to
    # the rents named earlier in its sentence, and the refusal blamed the wrong measure.
    (
        r"(?:monthly )?owner(?:s'?)? costs?(?: a month)?,? without a mortgage",
        ("acs_owner_costs_no_mortgage",),
    ),
    (
        r"(?:monthly )?owner(?:s'?)? costs?(?: a month)?,? with a mortgage",
        ("acs_owner_costs_mortgage",),
    ),
    (r"(?:household )?incomes?|paychecks?", ("acs_median_hh_income",)),
    (
        r"homeownership|home ?ownership|owner[- ]occupied share|owning a home",
        ("acs_homeownership_rate",),
    ),
    (r"vacan\w*|empty homes?|stand(?:s|ing)? empty", ("acs_vacancy_rate",)),
    (
        r"homes? added|new homes?|net homes?|permit\w*",
        ("nj_net_units_per_1000", "nj_net_units_added", "permits_total_units"),
    ),
    (r"(?:single[- ]family )?detached", ("acs_share_detached",)),
    (
        r"property tax\w*|tax bills?|tax rates?",
        ("modiv_median_tax_bill", "nj_effective_tax_rate", "nj_general_tax_rate"),
    ),
    (r"commut\w*", ("acs_mean_commute_minutes", "acs_commute_60plus_share")),
    (r"flood\w*", ("fema_flood_homes_share", "fema_mapped_homes_share")),
    (r"population|residents", ("pep_population", "acs_population")),
)
# A clause that speaks of standing ("ranks near the bottom") reads top and bottom as
# best and worst, not as the highest and lowest values.
_STANDING = re.compile(r"\b(?:rank\w*|standings?|placed?)\b", re.I)
_JOIN = re.compile(
    r"^\W*(?:and|or|as well as|plus)(?:\W+(?:both|its|the|typical|"
    r"observed|overall|annual))*\W*$",
    re.I,
)
_ADJECTIVE = re.compile(r"^\W*(?:(?:a|an|the|its|share of|rate of)\W+){0,2}$", re.I)
# A comparison among the place's own changes — "the largest percentage change in the
# packet" — is not a standing among places, which is what the ranks hold.
_OWN_CHANGE = re.compile(
    r"\b(?:change[sd]?|increase[sd]?|rise|rose|growth|gains?|drops?|declines?|fell|"
    r"falls?|shifts?|moved|swings?)\b",
    re.I,
)
_PEERS = re.compile(
    r"\b(?:count(?:y|ies)|towns?|municipalit\w+|zip|state|new jersey|peers?|places?|"
    r"areas?|regions?)\b",
    re.I,
)
# "a large share of their income": a share phrase followed by what it is a share of
# names the burden, not the income (`regenerate`, 2026-10-22: Cumberland, whose renters
# carry the state's heaviest burden, was refused because income ranks last).
_SHARE_END = re.compile(r"(?:share|portion|part|proportion)$", re.I)
_SHARE_OF = re.compile(
    r"^\s+of\s+(?:(?:their|its|a|the|households?[’']?|family|renters?[’']?|"
    r"owners?[’']?|monthly|yearly)\s+)*(?:incomes?|budgets?|paychecks?|earnings)\b",
    re.I,
)
_RENTER_BURDEN = ("acs_renter_cost_burden", "chas_renter_cost_burden")
_OWNER_BURDEN = ("chas_owner_cost_burden", "acs_owner_severe_burden")
_RENTERS = re.compile(r"\brent(?:er|ers|ing)\b", re.I)
_OWNERS = re.compile(r"\b(?:owner|owners|homeowners?|owning|mortgage)\b", re.I)

_CLAUSE = re.compile(r"[,;:—]|\s-\s|\b(?:while|but|whereas|although)\b", re.I)


@dataclass(frozen=True)
class _Rank:
    of: int
    best: int  # nearest the top its margin allows: 1 = highest value, or best standing
    worst: int


def _ranks(packet: Packet, *, standing: bool) -> dict[str, _Rank]:
    """Each ranked level's place from the top. The packet ranks best-first, so where
    lower is better rank 1 is the lowest value: by value (`standing` False) that order is
    turned over; by standing — "ranks near the bottom" — it is the packet's own."""
    out: dict[str, _Rank] = {}
    for level in packet.levels:
        if level.rank is None or not level.of:
            continue
        best = level.rank_best if level.rank_best is not None else level.rank
        worst = level.rank_worst if level.rank_worst is not None else level.rank
        if level.direction == "lower_is_better" and not standing:
            best, worst = level.of + 1 - worst, level.of + 1 - best
        out[level.metric_id] = _Rank(level.of, min(best, worst), max(best, worst))
    return out


def _holds(rank: _Rank, end: str, reach: str) -> bool:
    span = {
        "first": 1,
        "quarter": max(1, math.ceil(rank.of / 4)),
        "half": max(1, math.ceil(rank.of / 2)),
    }[reach if reach != "either" else "quarter"]
    high = rank.best <= span
    low = rank.worst >= rank.of + 1 - span
    return {"high": high, "low": low, "either": high or low}[end]


def _vocabulary(
    packet: Packet, ranked: set[str]
) -> list[tuple[re.Pattern[str], set[str]]]:
    words: list[tuple[re.Pattern[str], set[str]]] = []
    for pattern, metrics in _SPOKEN:
        held = set(metrics) & ranked
        if held:
            words.append((re.compile(rf"\b(?:{pattern})\b", re.I), held))
    for level in packet.levels:
        if level.metric_id in ranked and len(level.label) > 3:
            label = re.escape(level.label.lower()).replace(r"\ ", r"[\s-]+")
            words.append((re.compile(rf"\b{label}\b", re.I), {level.metric_id}))
    return words


def _named(
    text: str, words: list[tuple[re.Pattern[str], set[str]]]
) -> list[tuple[int, int, set[str]]]:
    """The measures a span names, in order, each mention once: a ratio's words hide its
    sides'."""
    found: list[tuple[int, int, set[str]]] = []
    for pattern, metrics in words:
        for match in pattern.finditer(text):
            if any(match.start() < e and s < match.end() for s, e, _ in found):
                continue
            found.append((match.start(), match.end(), metrics))
    return sorted(found, key=lambda m: m[0])


def _claimed(
    text: str, mentions: list[tuple[int, int, set[str]]], at: int, until: int
) -> list[set[str]]:
    """The measures a phrase at `at`–`until` speaks of: the nearest named before it,
    with any joined to it by "and" ("home value and observed rent are both among…"),
    else the nearest after it, with those joined after ("near the top for home values and
    incomes")."""
    before = [m for m in mentions if m[1] <= at]
    after = [m for m in mentions if m[0] >= until]
    # Directly before its measure, the words are its adjective: "a relatively low
    # homeownership rate".
    if after and _ADJECTIVE.match(text[until : after[0][0]]):
        before = []
    group = before[::-1] if before else after
    if not group:
        return []
    chosen = [group[0]]
    for prior in group[1:]:
        last = chosen[-1]
        gap = text[prior[1] : last[0]] if before else text[last[1] : prior[0]]
        if not _JOIN.match(gap):
            break
        chosen.append(prior)
    return [m[2] for m in chosen]


def comparative_problems(text: str, binding: Binding, packet: Packet) -> list[str]:
    """Each ranking phrase the packet's ranks do not bear out, or naming no measure."""
    del binding  # the rule reads words; kept for the shape every check shares
    by_value = _ranks(packet, standing=False)
    by_standing = _ranks(packet, standing=True)
    words = _vocabulary(packet, set(by_value))
    labels = {lv.metric_id: lv.label for lv in packet.levels}
    problems: list[str] = []
    for match in _PHRASE.finditer(text):
        group = next(name for name, value in match.groupdict().items() if value)
        _, end, reach = _PHRASES[int(group[1:])]
        start, stop = sentence_span(text, match.start(), match.end())
        # A question is a heading — "What stands out here?" — not a claim, even where the
        # heading runs into its answer without a full stop.
        rest = text[match.end() : stop + 1]
        if "?" in rest.split(".")[0][:20]:
            continue
        cuts = [start] + [m.end() + start for m in _CLAUSE.finditer(text[start:stop])]
        cuts += [stop]
        lo = max(c for c in cuts if c <= match.start())
        hi = min(c for c in cuts if c >= match.end())
        clause = text[lo:hi]
        at, until = match.start() - lo, match.end() - lo
        if _OWN_CHANGE.search(clause) and not _PEERS.search(clause):
            continue
        mentions = _claimed(clause, _named(clause, words), at, until)
        if _SHARE_END.search(match.group(0)) and _SHARE_OF.match(text[match.end() :]):
            # Whose burden the sentence says, where it says: renters' or owners'.
            sentence = text[start:stop]
            renters, owners = _RENTERS.search(sentence), _OWNERS.search(sentence)
            whose = (
                _RENTER_BURDEN
                if renters and not owners
                else _OWNER_BURDEN
                if owners and not renters
                else _RENTER_BURDEN + _OWNER_BURDEN
            )
            burden = set(whose) & set(by_value)
            mentions = [burden] if burden else mentions
        if not mentions:
            sentence = text[start:stop]
            mentions = _claimed(
                sentence,
                _named(sentence, words),
                match.start() - start,
                match.end() - start,
            )
        if not mentions and start > 1:
            # "Both measures sit near the low end": the measures of the sentence before.
            prior_start, prior_stop = sentence_span(text, start - 2, start - 1)
            mentions = [m[2] for m in _named(text[prior_start:prior_stop], words)]
        # "Ranks near the bottom" can mean the worst standing or the lowest values; since
        # the packet states ranks by value (#413) either reading is the data's, so a
        # clause about rank passes when either holds.
        readings = (
            [by_value, by_standing] if _STANDING.search(clause[:at]) else [by_value]
        )
        phrase = match.group(0)
        if not mentions and end == "either":
            # A bare "stands out" says nothing a rank could check, and claims no end.
            continue
        if not mentions:
            problems.append(
                f'ranking words "{phrase}" name no measure the data ranks: say which '
                f"measure, as the packet labels it, or drop the comparison"
            )
            continue
        for metrics in mentions:
            if not any(_holds(r[m], end, reach) for r in readings for m in metrics):
                ranks = readings[0]
                shown = ", ".join(
                    f"{labels.get(m, m)!r} {ranks[m].best}–{ranks[m].worst} of "
                    f"{ranks[m].of}"
                    for m in sorted(metrics)
                )
                problems.append(
                    f'ranking words "{phrase}" do not fit the data\'s ranks: {shown} '
                    f"(1 = highest value)"
                )
    return problems
