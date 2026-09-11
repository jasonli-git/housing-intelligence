"""Deterministic verification: does every number in the answer exist in the packet?

SPEC is explicit that automated checks verify numerical accuracy where possible and that
Claude evaluates qualitative quality rather than replacing deterministic validation. This
module is that division made real. A set lookup is a better instrument than a language
model for "is 4.7 in this packet", it costs nothing per call, and it cannot itself
hallucinate — so hallucination *rate*, the headline number of the whole evaluation, is
measured here rather than asked of a grader.

Since Milestone 13 the check is citation binding (`hip.packets.citations`): the index and
the rules `hip explain` applies before it stores prose. The fabrication rate this module
reports and the rate at which the site would refuse a model's prose are therefore one
number, and the rules — deliberately generous, because a false accusation of fabrication
is worse than a miss — are documented once, there.

Three rules changed with that move, so a run checked before it (`v1`, `v2`) keeps the
checks it was given rather than being re-graded under different ones:

- a decimal, a percentage or an amount under 20 is checked. Until then every number
  under 20 that failed to match exactly was skipped as an ordinal — measured on `v2`,
  57 such figures, every one of which does match;
- a figure counts as quoted from the payload only as a whole token, not as part of a
  longer number;
- a dropped sign is accepted where the sentence says which way the value went.
"""

from __future__ import annotations

from hip.eval.normalize import looks_like_refusal
from hip.eval.types import CheckResult, Generation, NumericCheck, Scenario
from hip.packets import Packet, bind
from hip.packets.citations import licensed_values, stated_numbers, strip_dates


def parse_numbers(text: str) -> list[tuple[float, str]]:
    """Every number in the text, as ``(value, as_written)``, dates and ranges removed."""
    return [(stated.value, stated.text) for stated in stated_numbers(text)]


def packet_values(packet: Packet) -> set[float]:
    """Every number a packet licenses a model to state outright.

    Includes the forms a careful writer uses — a ratio expressed as a percentage, a value
    rounded to the nearest thousand — because those are correct quotations of the packet,
    not new claims.
    """
    return licensed_values(packet)


def scenario_packet(scenario: Scenario) -> Packet | None:
    """The packet this scenario's model was shown: the ground truth to check against.

    Stored on the scenario since Milestone 13. Before that a JSON payload *is* the
    packet, and a Markdown one is a rendering of it that cannot be turned back — which
    is why a run built from Markdown before then has no ground truth left to re-check
    against, and `hip eval check` refuses it rather than grading against today's
    warehouse.
    """
    if scenario.packet is not None:
        return scenario.packet
    if scenario.payload_format == "json":
        return Packet.model_validate_json(scenario.payload)
    return None


def check_generation(
    generation: Generation, scenario: Scenario, packet: Packet
) -> CheckResult:
    """Score one answer against the packet it was given.

    A figure is supported when it binds to a packet field or is quoted from the payload
    the model was shown. Numbers echoed from the question are not claims: the refusal
    scenario asks about 1985, and a model that declines while naming the year is
    behaving correctly.
    """
    answer = generation.answer.strip()
    question_numbers = {value for value, _ in parse_numbers(scenario.question)}
    binding = bind(answer, packet, payload=scenario.payload, skip=question_numbers)

    stated: list[tuple[int, NumericCheck]] = [
        (
            citation.start,
            NumericCheck(
                value=citation.value,
                text=citation.text,
                supported=True,
                nearest=citation.packet_value,
                field=citation.field,
                kind=citation.kind,
            ),
        )
        for citation in binding.citations
    ]
    stated += [
        (
            figure.start,
            NumericCheck(
                value=figure.value,
                text=figure.text,
                supported=False,
                nearest=figure.nearest,
            ),
        )
        for figure in binding.unbound
    ]
    checks = [check for _, check in sorted(stated, key=lambda pair: pair[0])]

    unsupported = len(binding.unbound)
    return CheckResult(
        generation_key=generation.key,
        numbers=checks,
        unsupported_count=unsupported,
        unsupported_rate=unsupported / len(checks) if checks else 0.0,
        empty_answer=not answer,
        refused=looks_like_refusal(answer),
        refusal_expected=scenario.expects_refusal,
    )


__all__ = [
    "check_generation",
    "packet_values",
    "parse_numbers",
    "scenario_packet",
    "strip_dates",
]
