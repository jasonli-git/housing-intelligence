"""Generating region explanations with the model the evaluation selected.

This is the AI layer the platform actually ships, and it is deliberately the smallest
one that is useful. SPEC: AI is an enhancement, the platform stays fully useful with it
disabled, the model explains computed metrics rather than producing them, and the reader
can always tell interpretation from measurement.

Four consequences, all enforced in code rather than left to convention:

- The model sees a packet and nothing else. No warehouse handle, no SQL, no raw source
  files — the same contract every evaluated model was given.
- Generation happens here, in a CLI command, and the result is stored. The API never
  runs a model (ARCHITECTURE #6), and on this machine it could not afford to.
- The stored row carries the model, the runtime, and a hash of the packet it was written
  from, so a reader is never shown generated prose that looks like a computed figure and
  never shown prose about numbers that have since changed.
- Every figure in the prose is bound to the packet field that licenses it before the
  row is written, and prose stating a figure the packet does not carry is refused rather
  than stored (Milestone 13). Until then the figure check ran only in the evaluation, so
  published prose was vouched for by its model's benchmark and nothing else.
"""

from __future__ import annotations

import logging
from collections.abc import Collection, Sequence
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from hip.config import EvaluationConfig
from hip.eval.prompts import build_prompt, fits_context, render_payload
from hip.eval.runners import build_runner
from hip.eval.runners.mlx_runner import MlxRunner
from hip.eval.types import Scenario
from hip.packets import (
    Binding,
    Packet,
    bind,
    build_packet,
    packet_content_hash,
    packet_hash,
    still_describes,
)
from hip.packets.citations import describe_unbound
from hip.warehouse.models import RegionExplanation

log = logging.getLogger(__name__)


class UnboundFigures(RuntimeError):
    """Generated prose stated a figure its packet does not carry, so it was not stored.

    A `RuntimeError`, like every other way a generation fails, so a bulk run records it
    and moves on; its own type so the run can report it as a refusal rather than an
    error — the model answered, and the answer was not publishable.
    """

    def __init__(
        self, region_id: int, model_id: str, binding: Binding, body: str | None = None
    ) -> None:
        self.binding = binding
        super().__init__(
            f"region {region_id}: {model_id} stated {len(binding.unbound)} figure(s) "
            f"the packet does not carry — {describe_unbound(binding, body)} — not stored"
        )


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
    # What the packet said, without where it said it from: staleness is decided on
    # this, so a re-download that moves nothing re-binds instead of regenerating.
    content_sha256: str
    # Every figure in `body`, resolved to the packet field that licenses it. Complete by
    # construction — prose with an unbound figure never becomes an `Explanation`.
    binding: Binding
    # Position in `generation.preference` when this was written. Stored rather than
    # looked up because the API may not read that config (`API_MAY_IMPORT`), so the
    # order five explanations are offered in has to travel with the rows.
    rank: int = 0


def generate(
    packet: Packet,
    evaluation: EvaluationConfig,
    model_id: str,
    *,
    payload_format: str = "markdown",
    rank: int | None = None,
) -> Explanation:
    """Run one packet through the selected model.

    Markdown by default: the same information at roughly a third of the JSON token
    count, which on a 16GB machine is the difference between a comfortable context and
    a truncated one. The evaluation is what establishes whether that costs quality.
    """
    candidate = evaluation.model(model_id)
    cohort_name = evaluation.cohort_of(model_id)
    cohort = evaluation.cohorts[cohort_name]
    runner = build_runner(cohort, cohort_name)

    # The cohort's own generation budget where it declares one, the evaluation's
    # otherwise. Never the evaluation's for a hosted cohort that has stated its own: a
    # reasoning model cut off mid-thought returns an empty answer, which this function
    # reports as a failure — correctly, but for a reason that is a config artifact about
    # different hardware rather than a property of the model.
    limits = cohort.generation_limits or evaluation.limits

    payload = render_payload(packet, payload_format)
    prompt = build_prompt(EXPLAIN_PROMPT, payload, EXPLAIN_QUESTION)
    if not fits_context(prompt, limits.max_output_tokens, limits.context_tokens):
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
            limits,
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
            f"Raise generation.max_output_tokens in config/evaluation.yml."
        )

    # The gate. Bound against the payload the model was given, so a figure it quoted
    # from the packet's own words is licensed by those words.
    body = generation.answer.strip()
    binding = bind(body, packet, payload=payload)
    if not binding.complete:
        raise UnboundFigures(packet.region.region_id, model_id, binding, body)

    return Explanation(
        region_id=packet.region.region_id,
        window=packet.window.label,
        model_id=candidate.id,
        model_label=candidate.label,
        # The provider, not the runner class, for a hosted cohort. Three providers
        # share one `HostedRunner`, so storing `cohort.runner` would record "hosted" on
        # every row and lose the one fact the dashboard's provenance panel exists to
        # show — which vendor wrote this paragraph.
        runtime=cohort.provider or cohort.runner,
        body=body,
        packet_sha256=packet_hash(packet),
        content_sha256=packet_content_hash(packet),
        binding=binding,
        rank=rank if rank is not None else rank_of(evaluation, model_id),
    )


def rank_of(evaluation: EvaluationConfig, model_id: str) -> int:
    """Where `model_id` sits in the preference list.

    A model that is not on the list — one named explicitly with `--model` — sorts after
    every model that is, rather than silently ahead of them at position 0.
    """
    preference = evaluation.generation.preference
    return preference.index(model_id) if model_id in preference else len(preference)


def store(session: Session, explanation: Explanation) -> None:
    """Replace this model's explanation for this region and window.

    Scoped to the model since migration 0010. Deleting by `(region_id, window)` alone
    would make generating a second model's reading erase the first, which is the whole
    capability the key was widened for.
    """
    session.execute(
        delete(RegionExplanation).where(
            RegionExplanation.region_id == explanation.region_id,
            RegionExplanation.window == explanation.window,
            RegionExplanation.model_id == explanation.model_id,
        )
    )
    session.add(
        RegionExplanation(
            region_id=explanation.region_id,
            window=explanation.window,
            model_id=explanation.model_id,
            model_label=explanation.model_label,
            runtime=explanation.runtime,
            rank=explanation.rank,
            body=explanation.body,
            packet_sha256=explanation.packet_sha256,
            content_sha256=explanation.content_sha256,
            binding=explanation.binding.model_dump(mode="json"),
        )
    )


def prune(
    session: Session,
    region_ids: Sequence[int],
    window: str,
    keep: Collection[str],
) -> dict[str, int]:
    """Delete these regions' stored explanations for `window` from every model not kept.

    `hip explain` never deletes on its own: writing a model's reading replaces that
    model's previous one, and a model that leaves the preference list keeps its rows —
    which `/regions/{id}/explanations` goes on serving beside its replacement's. This is
    the explicit way out, scoped to what the run covers. Returns the rows removed per
    model, so the run can say exactly what it deleted.
    """
    if not keep:
        raise ValueError("refusing to prune with nothing to keep")
    scope = (
        RegionExplanation.region_id.in_(list(region_ids)),
        RegionExplanation.window == window,
        RegionExplanation.model_id.not_in(sorted(keep)),
    )
    removed = {
        model_id: int(count)
        for model_id, count in session.execute(
            select(RegionExplanation.model_id, func.count())
            .where(*scope)
            .group_by(RegionExplanation.model_id)
        ).tuples()
    }
    if removed:
        session.execute(delete(RegionExplanation).where(*scope))
    return removed


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


def is_stale(
    session: Session,
    region_id: int,
    window: str,
    packet: Packet,
    model_id: str | None = None,
) -> bool:
    """Whether a stored explanation was written from different numbers.

    Per model since migration 0010: one model's reading can be current while another's
    is stale, because they are generated independently. With no `model_id` the question
    is asked of the whole region — stale if *any* stored explanation is, which is the
    conservative reading for a caller deciding whether to warn a reader. On the content
    hash since Milestone 13, so a re-download that moved no figure is not staleness.
    """
    query = select(RegionExplanation).where(
        RegionExplanation.region_id == region_id,
        RegionExplanation.window == window,
    )
    if model_id is not None:
        query = query.where(RegionExplanation.model_id == model_id)
    return any(
        not still_describes(
            packet, packet_sha256=row.packet_sha256, content_sha256=row.content_sha256
        )
        for row in session.execute(query).scalars()
    )


Freshness = Literal["current", "rebind", "stale"]


def freshness(row: RegionExplanation, packet: Packet) -> Freshness:
    """What a stored explanation needs, given the packet as it stands now.

    `current` — written from these exact bytes and already bound. `rebind` — its words
    still describe the packet but its citations do not: either it was written before
    binding existed, or only provenance moved (a re-download that changed a release id
    or a retrieval date and no figure). Both are repaired without a model call.
    `stale` — the figures it describes have changed, so only a new generation will do.
    """
    if row.packet_sha256 == packet_hash(packet):
        return "current" if row.binding is not None else "rebind"
    if row.content_sha256 is not None and row.content_sha256 == packet_content_hash(
        packet
    ):
        return "rebind"
    return "stale"


def rebind(
    row: RegionExplanation, packet: Packet, *, payload_format: str = "markdown"
) -> Binding:
    """Bind a stored explanation to the current packet, and pin it there if it binds.

    The row is updated only when every figure binds, so a refusal leaves it exactly as
    it was. The prose and `generated_at` are untouched: the text was not rewritten, only
    re-cited.
    """
    binding = bind(row.body, packet, payload=render_payload(packet, payload_format))
    if binding.complete:
        row.binding = binding.model_dump(mode="json")
        row.packet_sha256 = packet_hash(packet)
        row.content_sha256 = packet_content_hash(packet)
    return binding
