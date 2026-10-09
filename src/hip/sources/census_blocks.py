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

import csv
import io
import zipfile
from pathlib import Path
from typing import ClassVar

from hip.config import fips_for
from hip.sources.base import ReleaseRef, SourceAdapter, SourceError
from hip.sources.tiger import BASE_URL

# The Census's 2010-to-2020 tabulation block relationship files (#354), one per state.
RELATIONSHIP_URL = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/t10t20"
_RELATIONSHIP_FIELDS = (
    "STATE_2010",
    "COUNTY_2010",
    "TRACT_2010",
    "BLK_2010",
    "STATE_2020",
    "COUNTY_2020",
    "TRACT_2020",
    "BLK_2020",
    "AREALAND_2020",
    "AREALAND_INT",
)


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


class BlockRelationshipAdapter(SourceAdapter):
    """Which 2020 blocks each 2010 block became, and how much land they share (#354).

    FEMA places a flood claim in a census block group without saying which census's, and
    19,194 of New Jersey's paid claims sit in block groups only the 2010 Census had. The
    relationship file carries each 2010 block's land overlap with each 2020 block, so a
    2010 block group's homes can be found among the 2020 blocks it overlaps and placed in
    towns. Pinned: the file is published once, for the 2020 redraw.

    Only pairs sharing land are kept, and only the fields the overlap needs.
    """

    source_id: ClassVar[str] = "census_block_rel"
    default_vintage: ClassVar[str] = "2020"
    landing_format: ClassVar[str] = "xlsx_records"

    def __init__(self, states: list[str]) -> None:
        self.states = states

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        vintage = vintage or self.default_vintage
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="blocks",
                vintage=vintage,
                url=f"{RELATIONSHIP_URL}/TAB2010_TAB{vintage}_ST{fips_for(state)}.zip",
                scope=state,
            )
            for state in self.states
        ]

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        state = fips_for(ref.scope or "")
        with zipfile.ZipFile(path) as archive:
            members = [n for n in archive.namelist() if n.lower().endswith(".txt")]
            if len(members) != 1:
                raise SourceError(f"{ref.key}: expected one relationship text file")
            with archive.open(members[0]) as raw:
                # The file opens with a byte-order mark, which `utf-8-sig` drops.
                rows = csv.DictReader(
                    io.TextIOWrapper(raw, encoding="utf-8-sig"), delimiter="|"
                )
                if not set(_RELATIONSHIP_FIELDS) <= set(rows.fieldnames or []):
                    raise SourceError(f"{ref.key}: relationship file columns changed")
                records: list[dict[str, object]] = []
                for row in rows:
                    shared = float(row["AREALAND_INT"] or 0)
                    # The file lists every pair touching the state, its neighbours'
                    # blocks along the border among them; and pairs that share only
                    # water place no homes.
                    if shared <= 0 or state not in (row["STATE_2010"], row["STATE_2020"]):
                        continue
                    records.append(
                        {
                            "block_2010": row["STATE_2010"]
                            + row["COUNTY_2010"]
                            + row["TRACT_2010"]
                            + row["BLK_2010"],
                            "block_2020": row["STATE_2020"]
                            + row["COUNTY_2020"]
                            + row["TRACT_2020"]
                            + row["BLK_2020"],
                            "land_2020": float(row["AREALAND_2020"] or 0),
                            "land_shared": shared,
                        }
                    )
        if not records:
            raise SourceError(f"{ref.key}: no block pairs share land in {state}")
        return records
