"""Addresses written one way, so a typed address meets the assessor's (Milestone 38).

A reader types "12 Elm Ct"; MOD-IV holds "12 ELM COURT", and another town's assessor
"20 ELM PLACE." for a street a third writes "ELM PL". Both sides are normalised by the
same rule: upper case, punctuation dropped, and every word USPS Publication 28 writes
several ways — suffixes, directionals, ordinals, "Saint" — replaced by the Postal
Service's one abbreviation (`street_words.json`). The rule is applied to every word, not
only the last, because what matters is that both sides agree: "SAINT JAMES PLACE" and
"St James Pl" both become "ST JAMES PL".

The table ships to the page inside `parcels/streets/meta.json`, so the browser normalises
with this file's table and the two can never drift.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path

WORDS_FILE = Path(__file__).with_name("street_words.json")

# A house number: "4", "12A", "1-3", "12-14B", and a "1/2" after it.
_NUMBER = re.compile(r"^(\d+[A-Z]?(?:-\d+[A-Z]?)?)(?:\s+1/2)?\s+(.*)$")
# A unit after the street — "#3", "UNIT 1", "APT 1A", ", SUITE B01", "73SUITE A",
# " -BLDG 2", "C-1", "C005D" — cut off, so a condominium is found under its building's
# street; about 50,000 assessed addresses carry one. The page's `UNIT` is this pattern.
_UNIT = re.compile(
    r"(?:\s*#|\s*,?\s*\b(?:UNIT|APT|APARTMENT|SUITE|STE|BLDG|BUILDING)\b|SUITE\b"
    r"|\s+-BLDG\b|\s+[CU]-\d|\s+C0\d).*$"
)


@cache
def street_words() -> dict[str, list[str]]:
    """The table: each standard abbreviation and every spelling that means it."""
    table: dict[str, list[str]] = json.loads(WORDS_FILE.read_text())
    table.pop("_comment", None)
    return table


@cache
def _canonical() -> dict[str, str]:
    table = street_words()
    return {v: standard for standard, variants in table.items() for v in variants}


def words(text: str) -> list[str]:
    """`text` as normalised words: upper case, punctuation gone, each word standard."""
    canonical = _canonical()
    plain = re.sub(r"[^A-Z0-9 ]", " ", text.upper().replace("'", ""))
    return [canonical.get(word, word) for word in plain.split()]


@dataclass(frozen=True)
class Address:
    number: str | None
    street: str


def parse(address: str) -> Address:
    """An assessor's address as a house number and a normalised street. An address with
    no number at its start ("OFF MAIN ST", "REAR 12 ELM") keeps it all as the street."""
    upper = _UNIT.sub("", re.sub(r"\s+", " ", address.upper()).strip())
    match = _NUMBER.match(upper)
    if match:
        return Address(number=match.group(1), street=" ".join(words(match.group(2))))
    return Address(number=None, street=" ".join(words(upper)))


def shard(street: str) -> str:
    """The street index file a street lives in: its first two letters or digits."""
    return re.sub(r"[^A-Z0-9]", "", street)[:2]
