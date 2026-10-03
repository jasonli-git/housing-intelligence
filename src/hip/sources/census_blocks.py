"""The 2020 Census blocks, with the homes counted in each (Milestone 40).

A town's flooded share of *land* is not its residents' exposure: a township that is a
third wetland would read as a third flooded with every home on high ground. So flood
zones and water service areas are weighed by homes, and the finest place homes are
counted is the census block — 137,972 in New Jersey, each with `HOUSING20`, its housing
units in the 2020 Census, carried on TIGER's block file itself.

Pinned to 2020 on purpose: blocks are redrawn once a decade, and the counts are the
Census, not an estimate. A block's homes are taken as spread evenly over it, which is
the one assumption every share built on them makes (ARCHITECTURE #301).
"""

from __future__ import annotations

from typing import ClassVar

from hip.config import fips_for
from hip.sources.base import ReleaseRef, SourceAdapter
from hip.sources.tiger import BASE_URL


class BlocksAdapter(SourceAdapter):
    source_id: ClassVar[str] = "census_blocks"
    default_vintage: ClassVar[str] = "2020"
    landing_format: ClassVar[str] = "shapefile"

    def __init__(self, states: list[str]) -> None:
        self.states = states

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        vintage = vintage or self.default_vintage
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="blocks",
                vintage=vintage,
                url=f"{BASE_URL}/TIGER{vintage}/TABBLOCK20/"
                f"tl_{vintage}_{fips_for(state)}_tabblock20.zip",
                scope=state,
            )
            for state in self.states
        ]
