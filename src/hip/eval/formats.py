"""The two readings a region carries, and what each must be to publish (Milestone 30).

**The analyst reading** is the interpretation the site has carried since Milestone 9:
two or three paragraphs on what changed and how the region compares, now giving every
survey figure its margin and every uncertain rank its range (SPEC principle 12).

**The consumer reading** is for someone deciding whether to live somewhere: short
answers to two fixed questions, asked for two figures each and published with at most
three, no source names and no jargon. The questions are fixed so the answers are
addressable — a county page places each by its id — and so every region's reading has
the same shape a reader can scan. It asked five until 2026-09-30: the bottom line, "is
it getting harder to afford here?" and "how does renting compare with buying?" restated
what the page's cost panels compute, so the page stopped showing them (ARCHITECTURE
#265) and the owner then stopped asking for them (#266). "What stands out here?" joined
on 2026-10-01, when the analyst reading was retired (#275): the fourth round of the
grounded-synthesis pilot, `reports/evaluation/synthesis-pilot.md`, three sentences on
the housing pattern that sets a place apart. "What's changing?" left the same day
(#281): the page's own computed sentences already say what changed, and it had become
the thinnest of the three answers and the one most often refused.

Both are held to the same gates as a condition of publication, and the consumer reading
to four more. Every one is deterministic, so a refusal costs nothing to decide and says
exactly what was wrong:

- every figure bound to the packet (`hip.packets.bind`, Milestone 13);
- every survey figure with its margin, every uncertain rank as its range
  (`hip.packets.margins`);
- for the consumer reading: the headings in order, each with an answer; no name of
  a source, agency, survey or index; none of the listed jargon; at most three figures
  an answer as written, not counting a margin, a quoted label or a range's second end;
  never two measures of the same thing; and under "What stands out here?", housing
  measures only and no opening on a date.

What no check can see — whether an answer advises rather than describes, or reads well
— is what the owner reads the three-county side-by-side for.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any

from hip.config import Audience
from hip.packets import Binding, Packet
from hip.packets.margins import describe_problems, joined_as_range, margin_problems

ANALYST_PROMPT = """\
You are a housing-market analyst writing a short explanatory note for a dashboard.

You are given a data packet for one region, already computed by a deterministic
pipeline. Write two or three short paragraphs explaining what the numbers show.

Rules:
- Use only figures that appear in the packet. Never invent one.
- Describe what changed and how the region compares with its peers.
- Carry through any caveat that changes how a figure should be read.
- Do not assert causes the packet cannot support. "Values rose while incomes did not"
  is supported; "values rose because of migration" is not.
- Call each measure what its label calls it, without narrowing what it covers: the
  vacancy rate counts every empty home, not only rentals.
- A figure shown with ± is a survey estimate. Whenever you state one, give its margin
  in the same sentence, as the packet does: "$100,645 (± $2,565)". Take the margin
  printed beside that very figure — a latest value's, a start value's or a change's —
  and copy it as printed. Where the packet
  says a figure has no sampling error, or that no margin is available, say so in the
  same sentence instead. A figure the packet shows with none of these is not a survey
  estimate: state it plainly.
- A rank shown as a range, such as "10th–12th of 21", is as precise as the survey
  allows: give the range ("between 10th and 12th of 21 counties") or its words ("near
  the middle"), never a single rank.
- No preamble, no headings, no bullet lists. Plain prose a resident could follow.
"""

ANALYST_QUESTION = (
    "Explain what this packet shows about the region's housing market over the window."
)


@dataclass(frozen=True)
class Question:
    """One fixed question of the consumer reading. `id` is the published key."""

    id: str
    heading: str


QUESTIONS: tuple[Question, ...] = (Question("what_stands_out", "What stands out here?"),)

# Answers the reading no longer asks for. "What should I check before moving?" was
# retired on 2026-10-05 (Milestone 43): the page answers it with rule-based checks
# (`web/lib/homeChecks.ts`), so asking a model for it would pay for words no page shows.
# A stored reading that still carries one is not stale for it (`freshness`), so retiring
# a question costs no regeneration; new readings simply stop writing it.
RETIRED_QUESTIONS: frozenset[str] = frozenset({"before_moving"})

# Measures of the same thing. A reading quoting two of one family puts two figures a
# reader takes for the same quantity side by side, and they disagree: the pilot's first
# round set the survey's typical home value, $221,400, beside Zillow's, $279,277, and its
# third a sale price beside a typical value (#275).
SAME_THING: tuple[frozenset[str], ...] = (
    frozenset(
        {
            "zhvi_sfr",
            "acs_median_home_value",
            "fhfa_hpi",
            "fhfa_hpi_all_transactions",
            "sr1a_median_sale_price",
            # Milestone 36's views of the same deeds.
            "sr1a_median_sale_price_12m",
            "sr1a_price_lower_quartile",
            "sr1a_price_upper_quartile",
            "sr1a_median_price_per_sqft",
            "modiv_median_assessed_value",
        }
    ),
    # Rent, every source and size: Milestone 34's rents by bedrooms and Milestone 35's
    # Fair Market Rents by size and by ZIP are the same measure cut finer.
    frozenset(
        {
            "zori_all",
            "acs_median_gross_rent",
            "acs_median_rent_studio",
            "acs_median_rent_1br",
            "acs_median_rent_2br",
            "acs_median_rent_3br",
            "acs_median_rent_4br",
            "acs_rent_lower_quartile",
            "acs_rent_upper_quartile",
            "hud_fmr_0br",
            "hud_fmr_1br",
            "hud_fmr_2br",
            "hud_fmr_3br",
            "hud_fmr_4br",
            "hud_safmr_0br",
            "hud_safmr_1br",
            "hud_safmr_2br",
            "hud_safmr_3br",
            "hud_safmr_4br",
        }
    ),
    frozenset({"acs_population", "pep_population"}),
    frozenset({"acs_renter_cost_burden", "chas_renter_cost_burden"}),
    frozenset({"acs_median_hh_income", "hud_area_median_income"}),
)

# Not housing measures: "What stands out here?" keeps to housing, because the pilot's
# second round, free to range, led with unemployment and population and then guessed at
# what they meant for businesses and community life.
NOT_HOUSING: frozenset[str] = frozenset(
    {
        "acs_population",
        "pep_population",
        "unemployment_rate",
        "net_migration_returns",
        *(
            "irs_inflow_returns",
            "irs_outflow_returns",
            "irs_net_migration_per_1000",
            "irs_inflow_agi_per_return",
            "irs_outflow_agi_per_return",
            "irs_nonmigrant_agi_per_return",
            "irs_arrival_income_ratio",
        ),
        # Milestone 34's people and households: who lives here and how they get to
        # work, context for the homes rather than the homes.
        "acs_avg_household_size",
        "acs_living_alone_share",
        "acs_married_couple_share",
        "acs_with_children_share",
        "acs_disability_share",
        "acs_no_vehicle_share",
        "acs_commute_transit_share",
        "acs_work_from_home_share",
        "acs_commute_drove_alone_share",
        "acs_commute_walked_share",
        "acs_mean_commute_minutes",
        "acs_commute_60plus_share",
    }
)

_DATE_OPENING = re.compile(
    r"^\s*(?:(?:between|from|since|in|over|during)\s+)?\d{4}|^\s*between\b", re.I
)

# Names a general reader should never need: the sources behind the figures and the
# agencies and products that publish them. The packet's own publishers are added per
# region, so a new source's name is caught without a change here.
SOURCE_NAMES: tuple[str, ...] = (
    "Census",
    "American Community Survey",
    "ACS",
    "HUD",
    "Housing and Urban Development",
    "CHAS",
    "Zillow",
    "ZHVI",
    "ZORI",
    "FHFA",
    "Federal Housing Finance",
    "BLS",
    "Bureau of Labor",
    "IRS",
    "Internal Revenue",
    "FRED",
    "Freddie Mac",
    "Federal Reserve",
    "MOD-IV",
    "SR1A",
    "PEP",
    "Division of Taxation",
)

# The field's vocabulary, each with the plain words the prompt offers in its place.
JARGON: dict[str, str] = {
    "median": "typical",
    "percentile": "where it falls",
    "cohort": "the other counties",
    "CAGR": "a year",
    "annualized": "a year",
    "annualised": "a year",
    "vintage": "survey year",
    "index": "typical value",
    "ratio": "times",
    "AMI": "local incomes",
    "area median income": "local incomes",
    "Fair Market Rent": "a benchmark rent",
    "FMR": "a benchmark rent",
    "income limit": "income cutoff",
    "cost burden": "paying over 30% of income",
    "cost-burdened": "paying over 30% of income",
    "net migration": "more moving away than arriving",
    "parcel": "property",
    "basis points": "percentage points",
}

# Figures per answer: the prompt asks for two — "a couple", in the roadmap — and
# publication allows three (decided with the owner 2026-09-27, ARCHITECTURE #262). At
# two, the model that answered best lost a third of its readings for answers like "sold
# for $715,000, with a tax bill of $12,038; rent is $2,899 a month", whole at three and
# still short. The prompt stays at two because it is not a limit a model keeps exactly:
# asked for three, Gemini 3.7 Flash wrote four and five (measured 2026-09-28), where
# asked for two it wrote three at most — the conditions the owner's choice was read in.
TARGET_FIGURES = 2
MAX_FIGURES = 3

# The kinds that count toward it. A margin qualifies a figure rather than adding one, a
# cohort size or a year places it, and a number inside a quoted label is the label.
_COUNTED = frozenset({"value", "start", "change", "annualised", "percentile", "rank"})

CONSUMER_PROMPT = f"""\
You are writing a short, plain-language guide to one place's housing for someone
deciding whether to live there.

You are given a data packet for the region, already computed by a deterministic
pipeline. Answer under this heading, on its own line, word for word, with a short
answer beneath it:

{chr(10).join(q.heading for q in QUESTIONS)}

Rules:
- The answer states at most {TARGET_FIGURES} figures: choose the ones that matter most
  for its question and leave the rest out. Every dollar amount, percentage, count or
  rank is a figure; a margin, and a threshold such as "30% of income", are not. Before
  you finish, count the figures in the answer and cut any beyond {TARGET_FIGURES}.
- Call each measure what its label calls it, in plain words, without narrowing what it
  covers: the vacancy rate counts every empty home, not only rentals.
- Use only figures from the packet, as the packet writes them or rounded to three
  significant digits ($445,000, $1,620) or a whole percentage. Never calculate a figure
  of your own.
- A figure shown with ± is an estimate from a survey: give its margin in the same
  sentence, in plain words: "about $100,645 a year, give or take $2,565". Take the
  margin printed beside that very figure and copy it as printed, or round it to the
  nearest whole number: "± 2.51%" may become "give or take 3%", never "2%". Where the
  packet says a figure has no sampling error, or that no margin is available, say so.
  A figure the packet shows with none of these is not a survey estimate: state it
  plainly, with nothing about margins.
- Where the packet gives a rank as a range, say where the range sits ("near the middle
  of New Jersey's 21 counties") rather than any single rank.
- Write for someone with no background in housing data: no names of sources, agencies,
  surveys or indexes, no abbreviations, and none of these words: \
{", ".join(JARGON)}. The packet's own labels and caveats use some of these words — "home
  value index", "parcels", "area median income" — so put them in plain words rather
  than copying them: say "typical" where the packet says median, "typical home value"
  for a home value index, and "property" for a parcel.
- Describe; do not advise. Say what the figures show about renting and buying, not which
  the reader should choose.
- Do not claim causes the packet cannot support.
- Use one measure for each thing: never two different
  measures of home value (a sale price and a typical home value count as one), of
  rent, of income, or of what renters pay. A reader would see two figures for the same
  thing that seem to disagree.
- Under "What stands out here?", write exactly three sentences. First, the housing
  pattern that most sets this place apart from the places it is ranked against, judged
  by where its latest figures rank: connect two or three figures, do not list them, and
  begin with the place's name or the measure, never with a date, a span of years or
  "Between". Use housing measures only: home values and sale prices, rents, what
  households pay for housing against their income, empty homes, homeownership, homes
  permitted, property tax bills, and the age and type of homes; never population, jobs,
  unemployment or people moving. Second, what that pattern means for someone renting
  or buying here, said only in terms of those same figures: no new figure, no guess at
  why, and nothing about people, businesses, jobs or community life. Third, the one
  limitation that most affects the pattern. The pattern may be a change, where a change
  is what sets the place apart; then give its two ends ("from 10.3% to 4.6%") rather
  than a percentage change of a rate. Give a rank only for where the place stands now,
  in words a resident follows (highest, lowest, among the highest, near the middle),
  never for how much a figure changed.
- No preamble, no bullet lists, no bold.
"""

CONSUMER_QUESTION = "Answer the question about this region under its heading."


def revision_request(answer: str, problems: list[str]) -> str:
    """What a model is told after its reading was refused, to write it once more.

    The refusal's own sentences, which name the rule and quote the words that broke it,
    and the answer itself, so the model corrects that text rather than drafting anew and
    breaking a different rule (ARCHITECTURE #266).
    """
    listed = "\n".join(f"- {problem}" for problem in problems)
    return (
        "Your previous answer, below, could not be published, for these reasons:\n"
        f"{listed}\n"
        "Write the whole answer again, correcting exactly these, and keep every other "
        "rule above.\n"
        f"--- PREVIOUS ANSWER ---\n{answer.strip()}\n--- END PREVIOUS ANSWER ---"
    )


@dataclass(frozen=True)
class Section:
    """One answer in a consumer reading: its question, and where its text sits in the
    stored body. Offsets, like a citation's, so a page can mark figures inside it."""

    id: str
    heading: str
    start: int
    end: int

    def as_json(self) -> dict[str, Any]:
        return asdict(self)


class MalformedReading(ValueError):
    """A consumer reading missing a heading or an answer, so it has no fixed shape."""


def _heading_pattern(heading: str) -> re.Pattern[str]:
    """A heading as a model may dress it: "## The bottom line", "**The bottom line:**".

    Tolerant of markdown, a colon and a missing question mark, because the words are
    what makes the shape; anchored at a line start, so the phrase inside an answer is
    not a heading.
    """
    words = re.escape(heading.rstrip("?")).replace("'", "['’]")
    return re.compile(
        rf"^[ \t]*(?:#{{1,6}}[ \t]*)?(?:\*\*|__)?[ \t]*{words}\??[ \t]*"
        rf"(?:\*\*|__)?[ \t]*[:.]?[ \t]*(?:\*\*|__)?[ \t]*",
        re.IGNORECASE | re.MULTILINE,
    )


_BULLET = re.compile(r"^[ \t]*(?:[-*•]|\d+[.)])[ \t]+", re.MULTILINE)
_EMPHASIS = re.compile(r"\*\*|__")


def _clean(answer: str) -> str:
    """An answer as one run of plain text: no bullets, no bold, one space between."""
    text = _BULLET.sub("", answer)
    text = _EMPHASIS.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def shape_consumer(answer: str) -> tuple[str, list[Section]]:
    """The model's answer as the stored body — each heading exactly as written here,
    then its answer — and each answer's place in it.

    Raises `MalformedReading` when a heading is missing, out of order, or has no answer
    beneath it: a reading without its fixed shape cannot be shown as one, and the next
    model on the list is asked instead.
    """
    found: list[tuple[Question, re.Match[str]]] = []
    at = 0
    for question in QUESTIONS:
        match = _heading_pattern(question.heading).search(answer, at)
        if match is None:
            raise MalformedReading(f"no heading '{question.heading}'")
        found.append((question, match))
        at = match.end()

    body = ""
    sections: list[Section] = []
    for index, (question, match) in enumerate(found):
        stop = found[index + 1][1].start() if index + 1 < len(found) else len(answer)
        text = _clean(answer[match.end() : stop])
        if not text:
            raise MalformedReading(f"no answer under '{question.heading}'")
        if body:
            body += "\n\n"
        body += f"{question.heading}\n"
        sections.append(
            Section(question.id, question.heading, len(body), len(body) + len(text))
        )
        body += text
    return body, sections


def _banned(packet: Packet) -> list[tuple[str, re.Pattern[str]]]:
    names = list(SOURCE_NAMES)
    for source in packet.sources:
        names += [source.name, source.publisher]
    terms = [(name, "a source name") for name in dict.fromkeys(names) if name]
    terms += [(term, "jargon") for term in JARGON]
    # A plural is the same word: "parcels", "indexes".
    return [
        (
            f"{kind}: '{term}'",
            re.compile(rf"(?<![\w-]){re.escape(term)}(?:s|es)?(?![\w-])", re.I),
        )
        for term, kind in terms
    ]


def figures_in(body: str, binding: Binding, section: Section) -> int:
    """Figures a reader sees in one answer: each one written, so a figure stated twice
    counts twice, and a range's two ends ("between 3rd and 7th") count once.

    Counted as written rather than per packet field since 2026-09-30: the limit is on
    what crowds an answer, and a repeated figure crowds it as much as a new one.
    """
    stated = sorted(
        (
            citation
            for citation in binding.citations
            if section.start <= citation.start < section.end and citation.kind in _COUNTED
        ),
        key=lambda citation: citation.start,
    )
    count = 0
    for index, citation in enumerate(stated):
        previous = stated[index - 1] if index else None
        if (
            previous is not None
            and {previous.kind, citation.kind} <= {"rank", "percentile"}
            and joined_as_range(body, previous, citation)
        ):
            continue
        count += 1
    return count


def consumer_problems(
    body: str, sections: list[Section], binding: Binding, packet: Packet
) -> list[str]:
    """What keeps a shaped consumer reading from publication, beyond binding."""
    problems: list[str] = []
    for label, pattern in _banned(packet):
        match = pattern.search(body)
        if match is not None:
            problems.append(
                f'{label} in "…{body[max(0, match.start() - 30) : match.end() + 20]}…"'
            )
    for section in sections:
        count = figures_in(body, binding, section)
        if count > MAX_FIGURES:
            problems.append(
                f"{count} figures under '{section.heading}', where at most {MAX_FIGURES} "
                f"are allowed"
            )
    quoted = {
        c.metric_id: c.label or c.metric_id for c in binding.citations if c.metric_id
    }
    for family in SAME_THING:
        both = sorted(family & set(quoted))
        if len(both) > 1:
            problems.append(
                "two measures of the same thing: "
                + " and ".join(f"'{quoted[m]}'" for m in both)
                + "; keep the one the reading quotes first"
            )
    for section in sections:
        if section.id != "what_stands_out":
            continue
        answer = body[section.start : section.end]
        if _DATE_OPENING.search(answer):
            problems.append(
                f"'{section.heading}' opens with a date or a span of years; begin with "
                f"the place's name or the measure"
            )
        outside = sorted(
            {
                c.label or c.metric_id or ""
                for c in binding.citations
                if c.metric_id in NOT_HOUSING and section.start <= c.start < section.end
            }
        )
        if outside:
            problems.append(
                f"'{section.heading}' quotes {', '.join(repr(m) for m in outside)}, "
                f"which is not a housing measure"
            )
    return problems


@dataclass(frozen=True)
class Format:
    """One audience's prompt, question and shape."""

    audience: Audience
    prompt: str
    question: str

    def shape(self, answer: str) -> tuple[str, list[Section]]:
        """The stored body and its sections: the analyst reading is its prose as
        written, with no sections; the consumer reading is `shape_consumer`'s."""
        if self.audience == "consumer":
            return shape_consumer(answer)
        return answer.strip(), []

    def problems(
        self, body: str, sections: list[Section], binding: Binding, packet: Packet
    ) -> list[str]:
        """Everything that keeps a bound reading from publication, as sentences.

        Binding completeness is checked before this, by the caller, because it has its
        own refusal (`UnboundFigures`) that the evaluation shares.
        """
        found = margin_problems(body, binding, packet)
        problems = [describe_problems([problem], body) for problem in found]
        if self.audience == "consumer":
            problems += consumer_problems(body, sections, binding, packet)
        return problems


FORMATS: dict[Audience, Format] = {
    "analyst": Format("analyst", ANALYST_PROMPT, ANALYST_QUESTION),
    "consumer": Format("consumer", CONSUMER_PROMPT, CONSUMER_QUESTION),
}

__all__ = [
    "ANALYST_PROMPT",
    "CONSUMER_PROMPT",
    "FORMATS",
    "JARGON",
    "MAX_FIGURES",
    "NOT_HOUSING",
    "QUESTIONS",
    "RETIRED_QUESTIONS",
    "SAME_THING",
    "TARGET_FIGURES",
    "SOURCE_NAMES",
    "Format",
    "MalformedReading",
    "Question",
    "Section",
    "consumer_problems",
    "figures_in",
    "revision_request",
    "shape_consumer",
]
