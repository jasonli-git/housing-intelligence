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

import hashlib
import json
from datetime import date, datetime
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# 1.1 adds `levels`. Additive and backward-compatible: every 1.0 field kept its name and
# meaning, so a reader written against 1.0 still parses a 1.1 packet and simply does not
# see the new array. The minor version is the signal that nothing was taken away.
#
# 1.2 adds the provenance of each change window's *start*: `start_release_id` and
# `start_match_method` on a metric, and the releases they name in `sources[]`. Until
# then a packet cited only the observation behind `end_value`, and the start of a window
# very often comes from an older release — ACS 2019 against 2023 — that `sources[]`
# never listed. Citation binding (Milestone 13) cannot resolve a figure to a release the
# packet does not name. Additive in the same way 1.1 was.
PACKET_VERSION = "1.2"

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
    `end_value`; `start_release_id` and `start_match_method` the one behind
    `start_value`, which for an annual source is a different release. All are null only
    when the derived tables are stale relative to the facts — a rebuilt `hip analyze`
    restores them — and the start pair is absent from packets older than 1.2.
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
    start_release_id: int | None = None
    start_match_method: str | None = None


class PacketLevel(_Strict):
    """A metric's most recent observed value, and where it stands among peers.

    `metrics` describes movement and needs two observations to exist at all. A snapshot
    source — MOD-IV publishes one composite of 3.48M parcels — has no movement, so
    without this array its figures would load into the warehouse and never reach a
    reader. Ranked by value rather than by change (migration 0006).

    Every metric with an observation appears here, including those that also appear in
    `metrics`: "the value now" and "how it moved" are both worth stating, and a
    consumer should not have to reconstruct the first from the second.
    """

    metric_id: str
    label: str
    unit: str
    direction: str
    value: float
    period_start: date
    period_end: date
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
    # 1.1 still parses. Every 1.2 addition is optional, and the evaluation reads the 1.1
    # packets frozen into run `v2`'s scenarios as the ground truth for its checks.
    packet_version: Literal["1.1", "1.2"]
    region: PacketRegion
    window: PacketWindow
    metrics: list[PacketMetric]
    levels: list[PacketLevel]
    comparisons: PacketComparisons
    highlights: list[PacketHighlight]
    caveats: list[str]
    sources: list[PacketSource]


def packet_hash(packet: Packet) -> str:
    """SHA-256 of a packet's canonical JSON — its identity as data.

    Lives here rather than with the code that generates explanations because it is a
    property of the packet, and because the API needs it to answer "is this explanation
    stale?" without importing the evaluation stage (which the dependency rule forbids).

    Meaningful precisely because a packet carries no wall-clock field (#44): the hash
    changes when the data changes and at no other time, so a mismatch is a real
    difference in the numbers rather than a different generation timestamp. Provenance
    counts as data here, so a re-download that mints a new release moves it too;
    `packet_content_hash` is the one that does not.
    """
    return hashlib.sha256(packet.model_dump_json().encode()).hexdigest()


# The fields that say where a figure came from rather than what it is.
_METRIC_PROVENANCE = {
    "release_id",
    "source_id",
    "match_method",
    "start_release_id",
    "start_match_method",
}
_LEVEL_PROVENANCE = {"release_id", "source_id", "match_method"}


def packet_content_hash(packet: Packet) -> str:
    """SHA-256 of what a packet says, leaving out where it says it from.

    `packet_hash` changes whenever a source is downloaded again and returns different
    bytes, because the new file is a new release with a new `fetched_at` — even when not
    one number a reader sees has moved. Prose written from the packet is still accurate
    then; only its citations point at a superseded file. So staleness is decided on this
    hash, and a change that moves only `packet_hash` is repaired by re-binding the stored
    text rather than paying a model to rewrite it (Milestone 13).

    Excluded: every release id, source id and match method, the `sources[]` block, and
    the contract version. Included: every figure, label, caveat, rank and date, because
    each of those is something the prose may have said.
    """
    content = packet.model_dump(
        mode="json",
        exclude={
            "packet_version": True,
            "sources": True,
            "metrics": {"__all__": _METRIC_PROVENANCE},
            "levels": {"__all__": _LEVEL_PROVENANCE},
        },
    )
    canonical = json.dumps(content, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def still_describes(
    packet: Packet, *, packet_sha256: str, content_sha256: str | None
) -> bool:
    """Whether text written from a packet with these hashes still describes `packet`.

    On the content hash where the text has one. Rows written before Milestone 13 carry
    only the full hash, and for them the stricter comparison is the only one available.
    """
    if content_sha256 is not None:
        return content_sha256 == packet_content_hash(packet)
    return packet_sha256 == packet_hash(packet)


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
