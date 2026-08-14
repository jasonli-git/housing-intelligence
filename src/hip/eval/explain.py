"""Generating region explanations with the model the evaluation selected.

This is the AI layer the platform actually ships, and it is deliberately the smallest
one that is useful. SPEC: AI is an enhancement, the platform stays fully useful with it
disabled, the model explains computed metrics rather than producing them, and the reader
can always tell interpretation from measurement.

Three consequences, all enforced in code rather than left to convention:

- The model sees a packet and nothing else. No warehouse handle, no SQL, no raw source
  files — the same contract every evaluated model was given.
- Generation happens here, in a CLI command, and the result is stored. The API never
  runs a model (ARCHITECTURE #6), and on this machine it could not afford to.
- The stored row carries the model, the runtime, and a hash of the packet it was written
  from, so a reader is never shown generated prose that looks like a computed figure and
  never shown prose about numbers that have since changed.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from hip.config import EvaluationConfig
from hip.eval.prompts import build_prompt, fits_context, render_payload
from hip.eval.runners import build_runner
from hip.eval.runners.mlx_runner import MlxRunner
from hip.eval.types import Scenario
from hip.packets import Packet, build_packet, packet_hash
from hip.warehouse.models import RegionExplanation

log = logging.getLogger(__name__)

# The instruction that produces an explanation rather than an answer to a question. It
# differs from the evaluation's system prompt on purpose: the evaluation measures
# question-answering, while this asks for the short narrative the dashboard shows.
EXPLAIN_PROMPT = """\
You are a housing-market analyst writing a short explanatory note for a dashboard.

You are given a data packet for one region, already computed by a deterministic
pipeline. Write two or three short paragraphs explaining what the numbers show.

Rules:
- Use only figures that appear in the packet. Never invent one.
- Describe what changed and how the region compares with its peers.
- Carry through any caveat that changes how a figure should be read.
- Do not assert causes the packet cannot support. "Values rose while incomes did not"
  is supported; "values rose because of migration" is not.
- No preamble, no headings, no bullet lists. Plain prose a resident could follow.
"""

EXPLAIN_QUESTION = (
    "Explain what this packet shows about the region's housing market over the window."
)


@dataclass
class Explanation:
    """A generated explanation and the provenance that makes it accountable."""

    region_id: int
    window: str
    model_id: str
    model_label: str
    runtime: str
    body: str
    packet_sha256: str


def generate(
    packet: Packet,
    evaluation: EvaluationConfig,
    model_id: str,
    *,
    payload_format: str = "markdown",
) -> Explanation:
    """Run one packet through the selected model.

    Markdown by default: the same information at roughly a third of the JSON token
    count, which on a 16GB machine is the difference between a comfortable context and
    a truncated one. The evaluation is what establishes whether that costs quality.
    """
    candidate = evaluation.model(model_id)
    cohort_name = evaluation.cohort_of(model_id)
    cohort = evaluation.cohorts[cohort_name]
    runner = build_runner(cohort)

    payload = render_payload(packet, payload_format)
    prompt = build_prompt(EXPLAIN_PROMPT, payload, EXPLAIN_QUESTION)
    if not fits_context(
        prompt, evaluation.limits.max_output_tokens, evaluation.limits.context_tokens
    ):
        raise ValueError(
            f"region {packet.region.region_id}: packet does not fit the configured "
            f"context window. Raise limits.context_tokens in config/evaluation.yml "
            f"rather than letting the runtime truncate it."
        )

    scenario = Scenario(
        scenario_id="explain",
        region_id=packet.region.region_id,
        region_label=packet.region.label,
        window=packet.window.label,
        question=EXPLAIN_QUESTION,
        payload_format=payload_format,  # type: ignore[arg-type]
        payload=payload,
        payload_tokens=0,
    )
    try:
        generation = runner.generate(
            candidate,
            scenario,
            prompt,
            evaluation.sampling.deterministic,
            evaluation.limits,
            "deterministic",
            0,
            evaluation.sampling.deterministic.seed,
        )
    finally:
        if isinstance(runner, MlxRunner):
            runner.unload()

    if generation.error:
        raise RuntimeError(f"region {packet.region.region_id}: {generation.error}")
    if not generation.answer.strip():
        # An empty answer from a reasoning model usually means the output budget went
        # entirely to hidden reasoning — a truncation, not a refusal, and storing it
        # would put a blank interpretation panel in front of a reader.
        detail = (
            "reasoning was truncated"
            if generation.truncated_reasoning
            else "no reasoning emitted"
        )
        raise RuntimeError(
            f"region {packet.region.region_id}: {model_id} returned no answer "
            f"({generation.telemetry.generation_tokens} tokens generated, {detail}). "
            f"Raise limits.max_output_tokens."
        )

    return Explanation(
        region_id=packet.region.region_id,
        window=packet.window.label,
        model_id=candidate.id,
        model_label=candidate.label,
        runtime=cohort.runner,
        body=generation.answer.strip(),
        packet_sha256=packet_hash(packet),
    )


def store(session: Session, explanation: Explanation) -> None:
    """Replace any existing explanation for this region and window."""
    session.execute(
        delete(RegionExplanation).where(
            RegionExplanation.region_id == explanation.region_id,
            RegionExplanation.window == explanation.window,
        )
    )
    session.add(
        RegionExplanation(
            region_id=explanation.region_id,
            window=explanation.window,
            model_id=explanation.model_id,
            model_label=explanation.model_label,
            runtime=explanation.runtime,
            body=explanation.body,
            packet_sha256=explanation.packet_sha256,
        )
    )


def explain_region(
    session: Session,
    evaluation: EvaluationConfig,
    region_id: int,
    model_id: str,
    *,
    window: str = "5y",
    payload_format: str = "markdown",
) -> Explanation:
    """Build the packet, generate, and store — the whole path for one region."""
    packet = build_packet(session, region_id, window)
    explanation = generate(packet, evaluation, model_id, payload_format=payload_format)
    store(session, explanation)
    return explanation


def is_stale(session: Session, region_id: int, window: str, packet: Packet) -> bool:
    """Whether the stored explanation was written from different numbers."""
    stored = session.execute(
        select(RegionExplanation.packet_sha256).where(
            RegionExplanation.region_id == region_id,
            RegionExplanation.window == window,
        )
    ).scalar_one_or_none()
    return stored is not None and stored != packet_hash(packet)
