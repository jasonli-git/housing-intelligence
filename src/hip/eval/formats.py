"""The two readings a region carries, and what each must be to publish (Milestone 30).

**The analyst reading** is the interpretation the site has carried since Milestone 9:
two or three paragraphs on what changed and how the region compares, now giving every
survey figure its margin and every uncertain rank its range (SPEC principle 12).

**The consumer reading** is for someone deciding whether to live somewhere: a bottom
line and short answers to four fixed questions, with at most two figures each, no
source names and no jargon. The questions are fixed so the answers are addressable —
Milestone 47's decision guides reuse them by id — and so every region's reading has the
same shape a reader can scan.

Both are held to the same gates as a condition of publication, and the consumer reading
to four more. Every one is deterministic, so a refusal costs nothing to decide and says
exactly what was wrong:

- every figure bound to the packet (`hip.packets.bind`, Milestone 13);
- every survey figure with its margin, every uncertain rank as its range
  (`hip.packets.margins`);
- for the consumer reading: the five headings in order, each with an answer; no name of
  a source, agency, survey or index; none of the listed jargon; at most two figures per
  answer, not counting a margin or a quoted label.

What no check can see — whether an answer advises rather than describes, or reads well
— is what the owner reads the three-county side-by-side for.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any

from hip.config import Audience
from hip.packets import Binding, Packet
from hip.packets.margins import describe_problems, margin_problems

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
  in the same sentence, as the packet does: "$100,645 (± $2,565)". Where the packet
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


QUESTIONS: tuple[Question, ...] = (
    Question("bottom_line", "The bottom line"),
    Question("harder_to_afford", "Is it getting harder to afford here?"),
    Question("rent_or_buy", "How does renting compare with buying?"),
    Question("whats_changing", "What's changing?"),
    Question("before_moving", "What should I check before moving?"),
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
pipeline. Answer under these five headings, each on its own line, word for word and in
this order, with a short answer beneath each:

{chr(10).join(q.heading for q in QUESTIONS)}

Rules:
- The bottom line is one or two sentences; every other answer two or three.
- Each answer states at most {TARGET_FIGURES} figures: choose the ones that matter most
  for its question and leave the rest out. Every dollar amount, percentage, count or
  rank is a figure; a margin, and a threshold such as "30% of income", are not. Before
  you finish, count the figures in each answer and cut any beyond {TARGET_FIGURES}.
- Call each measure what its label calls it, in plain words, without narrowing what it
  covers: the vacancy rate counts every empty home, not only rentals.
- Use only figures from the packet, as the packet writes them or rounded to three
  significant digits ($445,000, $1,620) or a whole percentage. Never calculate a figure
  of your own.
- A figure shown with ± is an estimate from a survey: give its margin in the same
  sentence, in plain words: "about $100,645 a year, give or take $2,565". Where the
  packet says a figure has no sampling error, or that no margin is available, say so.
  A figure the packet shows with none of these is not a survey estimate: state it
  plainly, with nothing about margins.
- Where the packet gives a rank as a range, say where the range sits ("near the middle
  of New Jersey's 21 counties") rather than any single rank.
- Write for someone with no background in housing data: no names of sources, agencies,
  surveys or indexes, no abbreviations, and none of these words: \
{", ".join(JARGON)}. Say "typical" where the packet says median.
- Describe; do not advise. Say what the figures show about renting and buying, not which
  the reader should choose.
- Do not claim causes the packet cannot support.
- Under "What should I check before moving?", name what these figures cannot tell
  someone about a particular home or street, drawn from the packet's caveats.
- No preamble, no bullet lists, no bold.
"""

CONSUMER_QUESTION = "Answer the five questions about this region under their headings."


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


def figures_in(binding: Binding, section: Section) -> int:
    """Figures stated in one answer; a range's two ends are one figure."""
    counted: set[str] = set()
    for citation in binding.citations:
        if not section.start <= citation.start < section.end:
            continue
        if citation.kind not in _COUNTED:
            continue
        field = citation.field or f"@{citation.start}"
        counted.add(re.sub(r"\.rank_(best|worst)$", ".rank", field))
    return len(counted)


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
        count = figures_in(binding, section)
        if count > MAX_FIGURES:
            problems.append(
                f"{count} figures under '{section.heading}', where at most {MAX_FIGURES} "
                f"are allowed"
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
    "QUESTIONS",
    "TARGET_FIGURES",
    "SOURCE_NAMES",
    "Format",
    "MalformedReading",
    "Question",
    "Section",
    "consumer_problems",
    "figures_in",
    "shape_consumer",
]
