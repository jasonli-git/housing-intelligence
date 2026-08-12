"""The analysis packet: the contract between deterministic analytics and any consumer.

ARCHITECTURE #12. These models *are* the schema — `schemas/packet-v1.json` is generated
from them and committed, so a consumer in another language validates against the same
definition the assembler emits. `tests/test_packets.py` fails when the two drift.

Every field is either read from the warehouse or a label derived from one. Nothing here
is computed at assembly time: if a number is not in `fact_metric_observation`,
`fact_metric_change`, or `region_rankings`, it does not appear in a packet.

Deliberately no wall-clock field. A packet regenerated from an unchanged warehouse is
byte-identical to its predecessor, so `diff` answers "what changed in the data" rather
than "when did I run this". When it was gathered is a property of the source releases,
which every packet carries in `sources[].fetched_at`.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

PACKET_VERSION = "1.0"

# The published contract. Resolved from the source tree, which is where this project
# runs from (ARCHITECTURE #13 — local-first, no packaged deployment yet).
SCHEMA_PATH = Path(__file__).resolve().parents[3] / "schemas" / "packet-v1.json"


class _Strict(BaseModel):
    """Unknown fields are an error, so the published schema means what it says."""

    model_config = ConfigDict(extra="forbid")


class RegionRef(_Strict):
    """A region named but not described — used for the parent."""

    region_id: int
    name: str
    level: str


class PacketRegion(_Strict):
    region_id: int
    geoid: str
    level: str
    name: str
    label: str = Field(description="Display name, e.g. 'Mercer County, NJ'.")
    state_code: str
    parent: RegionRef | None = None


class PacketWindow(_Strict):
    """The change window, and the span the metrics in this packet actually cover.

    `start` and `end` are the envelope across every metric, not a claim that each one
    spans it: ACS is annual, Zillow monthly, FHFA quarterly, so a `5y` window resolves
    to slightly different dates per metric (ARCHITECTURE #35). The exact span for each
    is on the metric itself.
    """

    label: str
    start: date
    end: date


class PacketMetric(_Strict):
    """One metric's change over the window, with its rank and its provenance.

    `release_id`, `source_id`, and `match_method` describe the observation behind
    `end_value`. They are null only when the derived tables are stale relative to the
    facts — a rebuilt `hip analyze` restores them.
    """

    metric_id: str
    label: str
    unit: str
    direction: str
    window_start: date
    window_end: date
    start_value: float
    end_value: float
    pct_change: float
    cagr: float | None = None
    rank: int | None = None
    of: int | None = None
    percentile: float | None = None
    release_id: int | None = None
    source_id: str | None = None
    match_method: str | None = None


class PacketComparisons(_Strict):
    """The cohort this region was ranked against.

    `peer_count` is how many regions of this level are in scope; a metric's own `of`
    can be smaller, because not every region carries every metric. Where they differ,
    a caveat says so.
    """

    peer_level: str
    peer_scope: str
    peer_count: int


class PacketHighlight(_Strict):
    """A metric where this region sits at one end of its cohort.

    Selection, not statistics: the rank is read from `region_rankings` and nothing new
    is computed. `leading` is the good end as the metric's own `direction` defines it.
    """

    metric_id: str
    label: str
    position: Literal["leading", "trailing"]
    rank: int
    of: int
    pct_change: float


class PacketSource(_Strict):
    """One source release behind the numbers, so a claim can be traced to a file."""

    source_id: str
    name: str
    publisher: str
    license: str
    url: str
    vintage: str
    fetched_at: datetime
    release_ids: list[int]


class Packet(_Strict):
    packet_version: Literal["1.0"]
    region: PacketRegion
    window: PacketWindow
    metrics: list[PacketMetric]
    comparisons: PacketComparisons
    highlights: list[PacketHighlight]
    caveats: list[str]
    sources: list[PacketSource]


def published_schema() -> dict[str, Any]:
    """The JSON Schema document written to `schemas/packet-v1.json`."""
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        # Relative: the file is distributed with the repository, not hosted.
        "$id": "packet-v1.json",
        **Packet.model_json_schema(),
    }


def schema_text() -> str:
    """Serialized exactly as the committed file, so a diff is meaningful."""
    return json.dumps(published_schema(), indent=2, sort_keys=True) + "\n"
