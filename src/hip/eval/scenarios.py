"""Building the question set every model answers.

A scenario is one question crossed with one real packet. Real rather than synthetic
because SPEC asks for standardized tests generated from real or representative housing
analytics, and because a model that handles invented tidy data and fails on a genuine
packet — with its null ranks, its sparse rent metrics, its provenance caveats — has been
measured on the wrong thing.

Selection is deterministic. Regions are sampled by evenly spaced index over a sorted id
list, so the same warehouse yields the same scenarios on every run and two evaluations
are comparable without pinning a random seed.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from hip.config import EvaluationConfig
from hip.eval.prompts import estimate_tokens, render_payload
from hip.eval.types import Scenario
from hip.packets import Packet, PacketUnavailable, build_packet, regions_for_level


def sample_regions(region_ids: list[int], count: int) -> list[int]:
    """`count` ids spread evenly across the sorted list.

    Evenly spaced rather than random: no seed to record, no dependence on Python's hash
    ordering, and the sample spans the range of the warehouse rather than clustering.
    """
    ordered = sorted(region_ids)
    if count >= len(ordered):
        return ordered
    if count <= 0:
        return []
    step = len(ordered) / count
    return [ordered[int(i * step)] for i in range(count)]


def build_scenarios(
    session: Session,
    evaluation: EvaluationConfig,
    *,
    window: str = "5y",
    level: str = "county",
    regions: int = 3,
    payload_format: str = "json",
    region_ids: list[int] | None = None,
) -> list[Scenario]:
    """Every configured question against a deterministic sample of packets.

    A region whose packet cannot be built is skipped rather than fatal: the sample is
    a convenience, and losing one county should not stop an evaluation.
    """
    candidates = region_ids or regions_for_level(session, level, window)
    chosen = sample_regions(candidates, regions) if region_ids is None else candidates

    scenarios: list[Scenario] = []
    for region_id in chosen:
        try:
            packet = build_packet(session, region_id, window)
        except PacketUnavailable:
            continue
        scenarios.extend(scenarios_for_packet(packet, evaluation, payload_format))
    return scenarios


def scenarios_for_packet(
    packet: Packet, evaluation: EvaluationConfig, payload_format: str
) -> list[Scenario]:
    """Every configured question against one packet."""
    payload = render_payload(packet, payload_format)
    return [
        Scenario(
            scenario_id=template.id,
            region_id=packet.region.region_id,
            region_label=packet.region.label,
            window=packet.window.label,
            question=template.question.strip(),
            grounds=template.grounds,
            expects_refusal=template.expects_refusal,
            payload_format=payload_format,  # type: ignore[arg-type]
            payload=payload,
            payload_tokens=estimate_tokens(payload),
        )
        for template in evaluation.scenarios
    ]
