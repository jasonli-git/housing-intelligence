"""Generating region readings with the models the evaluation selected.

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

Since Milestone 30 a region carries two readings, one per audience (`hip.eval.formats`):
the analyst reading, the interpretation as it always was, and the consumer reading, a
two fixed questions in plain language. Both are refused, too, where a survey figure is
stated without its margin or an uncertain rank as a place (SPEC principle 12), and the
consumer reading where it loses its shape, names a source, uses jargon or crowds an
answer with figures. A refusal is not a failure of the run: the model is shown the
refusal and asked to correct its answer (`generation.revisions`, #266), and only then
is the next model on the audience's list asked.
"""

from __future__ import annotations

import logging
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal, cast

from sqlalchemy import delete, func, select, tuple_
from sqlalchemy.orm import Session

from hip.config import Audience, EvaluationConfig
from hip.eval.costs import Usage, generation_usd
from hip.eval.formats import (
    ANALYST_PROMPT,
    ANALYST_QUESTION,
    FORMATS,
    QUESTIONS,
    MalformedReading,
    revision_request,
)
from hip.eval.formats import Section as Section
from hip.eval.prompts import build_prompt, fits_context, render_payload
from hip.eval.runners import build_runner
from hip.eval.runners.mlx_runner import MlxRunner
from hip.eval.types import Generation, Scenario
from hip.packets import (
    Binding,
    Packet,
    bind,
    build_packet,
    packet_content_hash,
    packet_hash,
    still_describes,
)
from hip.packets.citations import BINDING_VERSION, describe_unbound
from hip.warehouse.models import RegionExplanation

log = logging.getLogger(__name__)

# The analyst format under its original names, which the evaluation's tests and every
# reading written before Milestone 30 were built against.
EXPLAIN_PROMPT = ANALYST_PROMPT
EXPLAIN_QUESTION = ANALYST_QUESTION


class GenerationFailed(RuntimeError):
    """A generation that produced nothing publishable for a reason of its own — an
    error, an empty answer, a substituted model. Carries what it cost where it cost
    anything, because a run's cost includes what it paid for and could not use."""

    def __init__(self, message: str, usage: Usage | None = None) -> None:
        self.usage = usage
        # Refused attempts before this one, by the same model (`generate`'s revisions).
        self.earlier: list[Usage] = []
        super().__init__(message)

    def reasons(self) -> list[str]:
        """What to tell the model that wrote it, for a revision."""
        return [str(self)]


class UnboundFigures(GenerationFailed):
    """Generated prose stated a figure its packet does not carry, so it was not stored.

    A `RuntimeError`, like every other way a generation fails, so a bulk run records it
    and moves on; its own type so the run can report it as a refusal rather than an
    error — the model answered, and the answer was not publishable.
    """

    def __init__(
        self,
        region_id: int,
        model_id: str,
        binding: Binding,
        body: str | None = None,
        usage: Usage | None = None,
    ) -> None:
        self.binding = binding
        self.unbound_detail = describe_unbound(binding, body)
        super().__init__(
            f"region {region_id}: {model_id} stated {len(binding.unbound)} figure(s) "
            f"the packet does not carry — {self.unbound_detail} — not stored",
            usage,
        )

    def reasons(self) -> list[str]:
        return [
            f"figures the data packet does not carry, which must be removed or replaced "
            f"with the packet's own: {self.unbound_detail}"
        ]


class ReadingRefused(GenerationFailed):
    """A bound reading that still may not be published: a survey figure without its
    margin, an uncertain rank quoted as a place, or a consumer reading without its
    shape, with a source name or jargon, or with too many figures in an answer."""

    def __init__(
        self,
        region_id: int,
        model_id: str,
        problems: list[str],
        usage: Usage | None = None,
    ) -> None:
        self.problems = problems
        shown = "; ".join(problems[:3])
        more = f"; and {len(problems) - 3} more" if len(problems) > 3 else ""
        super().__init__(
            f"region {region_id}: {model_id} wrote a reading that cannot be published — "
            f"{shown}{more} — not stored",
            usage,
        )

    def reasons(self) -> list[str]:
        return list(self.problems)


@dataclass
class Explanation:
    """A generated reading and the provenance that makes it accountable."""

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
    # Position in the audience's preference list when this was written. Stored rather
    # than looked up because the API may not read that config (`API_MAY_IMPORT`).
    rank: int = 0
    audience: Audience = "analyst"
    # A consumer reading's answers; empty for an analyst reading.
    sections: list[Section] = field(default_factory=list)
    usage: Usage | None = None
    # Refused attempts by the same model before the one stored, each still billed.
    earlier: list[Usage] = field(default_factory=list)


def _usage(evaluation: EvaluationConfig, model_id: str, generation: Generation) -> Usage:
    candidate = evaluation.model(model_id)
    cohort = evaluation.cohort_for(model_id)
    telemetry = generation.telemetry
    usd, off_peak = generation_usd(
        candidate,
        cohort,
        telemetry.prompt_tokens,
        telemetry.generation_tokens,
        tier=telemetry.service_tier,
        at=datetime.now(UTC),
    )
    return Usage(
        model_id=model_id,
        prompt_tokens=telemetry.prompt_tokens,
        generation_tokens=telemetry.generation_tokens,
        tier=telemetry.service_tier,
        usd=usd,
        off_peak=off_peak,
    )


def run_model(
    packet: Packet,
    evaluation: EvaluationConfig,
    model_id: str,
    *,
    audience: Audience = "analyst",
    payload_format: str = "markdown",
    service_tier: str | None = None,
    revision: str | None = None,
) -> tuple[Generation, str, Usage]:
    """One call to one model with one audience's prompt: the generation, the payload it
    was shown, and what it cost. Raises only for a packet that does not fit the model's
    context; a failed call is a `Generation` with an error, for the caller to judge.

    `revision` follows the question when the model is asked to correct a refused answer
    (`formats.revision_request`); the packet-first prefix is unchanged, so it caches."""
    candidate = evaluation.model(model_id)
    cohort_name = evaluation.cohort_of(model_id)
    cohort = evaluation.cohorts[cohort_name]
    runner = build_runner(cohort, cohort_name, service_tier=service_tier)

    # The cohort's own generation budget where it declares one, the evaluation's
    # otherwise. Never the evaluation's for a hosted cohort that has stated its own: a
    # reasoning model cut off mid-thought returns an empty answer, which is reported as
    # a failure — correctly, but for a reason that is a config artifact about different
    # hardware rather than a property of the model.
    limits = cohort.generation_limits or evaluation.limits

    reading = FORMATS[audience]
    payload = render_payload(packet, payload_format)
    prompt = build_prompt(reading.prompt, payload, reading.question)
    if revision:
        prompt += f"\n{revision}\n"
    if not fits_context(prompt, limits.max_output_tokens, limits.context_tokens):
        raise ValueError(
            f"region {packet.region.region_id}: packet does not fit the configured "
            f"context window. Raise limits.context_tokens in config/evaluation.yml "
            f"rather than letting the runtime truncate it."
        )

    scenario = Scenario(
        scenario_id=f"explain-{audience}",
        region_id=packet.region.region_id,
        region_label=packet.region.label,
        window=packet.window.label,
        question=reading.question,
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
    return generation, payload, _usage(evaluation, model_id, generation)


def judge_generation(
    packet: Packet,
    generation: Generation,
    payload: str,
    *,
    audience: Audience,
    usage: Usage | None = None,
) -> tuple[str, list[Section], Binding]:
    """The gates a generation must pass to be published, in order: an answer at all,
    its audience's shape, every figure bound, then the audience's own rules.

    Returns the body to store, its sections and its binding; raises `GenerationFailed`
    or one of its refusals otherwise. Shared by `generate` and the side-by-side, so what
    the owner reads there is judged exactly as publication would judge it.
    """
    region_id = packet.region.region_id
    model_id = generation.model_id
    if generation.error:
        raise GenerationFailed(f"region {region_id}: {generation.error}", usage)
    if not generation.answer.strip():
        # An empty answer from a reasoning model usually means the output budget went
        # entirely to hidden reasoning — a truncation, not a refusal, and storing it
        # would put a blank interpretation panel in front of a reader.
        detail = (
            "reasoning was truncated"
            if generation.truncated_reasoning
            else "no reasoning emitted"
        )
        raise GenerationFailed(
            f"region {region_id}: {model_id} returned no answer "
            f"({generation.telemetry.generation_tokens} tokens generated, {detail}). "
            f"Raise generation.max_output_tokens in config/evaluation.yml.",
            usage,
        )

    reading = FORMATS[audience]
    try:
        body, sections = reading.shape(generation.answer)
    except MalformedReading as exc:
        raise ReadingRefused(region_id, model_id, [str(exc)], usage) from exc

    # The binding gate. Bound against the payload the model was given, so a figure it
    # quoted from the packet's own words is licensed by those words.
    binding = bind(body, packet, payload=payload)
    if not binding.complete:
        raise UnboundFigures(region_id, model_id, binding, body, usage)
    problems = reading.problems(body, sections, binding, packet)
    if problems:
        raise ReadingRefused(region_id, model_id, problems, usage)
    return body, sections, binding


def generate(
    packet: Packet,
    evaluation: EvaluationConfig,
    model_id: str,
    *,
    audience: Audience = "analyst",
    payload_format: str = "markdown",
    rank: int | None = None,
) -> Explanation:
    """Run one packet through one model for one audience, and judge the result.

    Markdown by default: the same information at roughly a third of the JSON token
    count, which on a 16GB machine is the difference between a comfortable context and
    a truncated one. The evaluation is what establishes whether that costs quality.

    A hosted cohort is asked for its `generation_tier` — Gemini's Flex, at half price —
    which the evaluation never uses.
    """
    candidate = evaluation.model(model_id)
    cohort = evaluation.cohort_for(model_id)
    body, sections, binding, usage, earlier = write_reading(
        packet,
        evaluation,
        model_id,
        audience=audience,
        payload_format=payload_format,
        service_tier=cohort.generation_tier,
    )
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
        rank=rank if rank is not None else rank_of(evaluation, model_id, audience),
        audience=audience,
        sections=sections,
        usage=usage,
        earlier=earlier,
    )


def write_reading(
    packet: Packet,
    evaluation: EvaluationConfig,
    model_id: str,
    *,
    audience: Audience,
    payload_format: str = "markdown",
    service_tier: str | None = None,
) -> tuple[str, list[Section], Binding, Usage, list[Usage]]:
    """One model's publishable reading, asking it to correct a refused one.

    A refusal names the rule and quotes the words that broke it, which is exactly what
    the model needs to fix it: so before the region passes to the next model on the
    list, the same model is shown its answer and the refusal and asked again, up to
    `generation.revisions` times (ARCHITECTURE #266). The corrected answer is judged by
    every gate, as the first was. A failed call is not revised — there is no answer to
    correct — and neither is a revision's own failure.

    Returns the body, sections and binding to store, the usage of the call that wrote
    it, and of every refused attempt before it. Raises the last refusal otherwise, with
    the earlier attempts' usage on `earlier`.
    """
    earlier: list[Usage] = []
    revision: str | None = None
    for attempt in range(evaluation.generation.revisions + 1):
        generation, payload, usage = run_model(
            packet,
            evaluation,
            model_id,
            audience=audience,
            payload_format=payload_format,
            service_tier=service_tier,
            revision=revision,
        )
        try:
            body, sections, binding = judge_generation(
                packet, generation, payload, audience=audience, usage=usage
            )
        except (UnboundFigures, ReadingRefused) as exc:
            if attempt == evaluation.generation.revisions:
                exc.earlier = earlier
                raise
            log.warning(
                "%s/%s/%s refused, asking for a revision: %s",
                audience,
                model_id,
                packet.region.region_id,
                "; ".join(exc.reasons()),
            )
            earlier.append(usage)
            revision = revision_request(generation.answer, exc.reasons())
            continue
        except GenerationFailed as exc:
            exc.earlier = earlier
            raise
        return body, sections, binding, usage, earlier
    raise AssertionError("unreachable")  # pragma: no cover


def rank_of(
    evaluation: EvaluationConfig, model_id: str, audience: Audience = "analyst"
) -> int:
    """Where `model_id` sits in the audience's preference list.

    A model that is not on the list — one named explicitly with `--model` — sorts after
    every model that is, rather than silently ahead of them at position 0.
    """
    preference = evaluation.generation.preference[audience]
    return preference.index(model_id) if model_id in preference else len(preference)


def store(session: Session, explanation: Explanation) -> None:
    """Replace this region's reading for this window and audience.

    Keyed on the audience since migration 0019: a region carries one analyst and one
    consumer reading, so writing either replaces whichever model wrote it before.
    """
    session.execute(
        delete(RegionExplanation).where(
            RegionExplanation.region_id == explanation.region_id,
            RegionExplanation.window == explanation.window,
            RegionExplanation.audience == explanation.audience,
        )
    )
    session.add(
        RegionExplanation(
            region_id=explanation.region_id,
            window=explanation.window,
            audience=explanation.audience,
            model_id=explanation.model_id,
            model_label=explanation.model_label,
            runtime=explanation.runtime,
            rank=explanation.rank,
            body=explanation.body,
            packet_sha256=explanation.packet_sha256,
            content_sha256=explanation.content_sha256,
            binding=explanation.binding.model_dump(mode="json"),
            sections=(
                [section.as_json() for section in explanation.sections]
                if explanation.sections
                else None
            ),
        )
    )


def prune(
    session: Session,
    region_ids: Sequence[int],
    window: str,
    keep: Mapping[str, Collection[str]],
) -> dict[str, int]:
    """Delete these regions' stored readings for `window` from every model not kept for
    its audience. Only audiences in `keep` are in scope: asking `hip explain` to write
    consumers alone must never delete the analyst reading.

    A reading from a model that has left its audience's list is regenerated by the next
    run (`hip explain` treats it as stale), which replaces it; this removes the ones
    that could not be replaced, so a retired model's prose is never served on (#213).
    Returns the rows removed per model, so the run can say exactly what it deleted.
    """
    if not keep or not any(keep.values()):
        raise ValueError("refusing to prune with nothing to keep")
    kept = [
        (audience, model_id)
        for audience, models in keep.items()
        for model_id in sorted(models)
    ]
    scope = (
        RegionExplanation.region_id.in_(list(region_ids)),
        RegionExplanation.window == window,
        RegionExplanation.audience.in_(list(keep)),
        tuple_(RegionExplanation.audience, RegionExplanation.model_id).not_in(kept),
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
    audience: Audience = "analyst",
    window: str = "5y",
    payload_format: str = "markdown",
    packet: Packet | None = None,
) -> Explanation:
    """Build the packet, generate, and store — the whole path for one region."""
    if packet is None:
        packet = build_packet(session, region_id, window)
    explanation = generate(
        packet, evaluation, model_id, audience=audience, payload_format=payload_format
    )
    store(session, explanation)
    return explanation


def is_stale(
    session: Session,
    region_id: int,
    window: str,
    packet: Packet,
    audience: Audience | None = None,
) -> bool:
    """Whether a stored reading was written from different numbers.

    Per audience: the analyst and consumer readings are generated independently, so one
    can be current while the other is stale. With no `audience` the question is asked
    of the whole region — stale if *any* stored reading is, the conservative answer for
    a caller deciding whether to warn a reader. On the content hash since Milestone 13,
    so a re-download that moved no figure is not staleness.

    Which model wrote a reading does not enter into it, and that is decided rather than
    incidental (Milestone 30): a reading a fallback wrote when the first model could not
    passed every gate the first model's would have, and names the model that wrote it,
    so it stands until its figures change. The one exception is a model that has left
    its audience's list, whose readings `hip explain` rewrites — a question about the
    list, which this function does not read.
    """
    query = select(RegionExplanation).where(
        RegionExplanation.region_id == region_id,
        RegionExplanation.window == window,
    )
    if audience is not None:
        query = query.where(RegionExplanation.audience == audience)
    return any(
        not still_describes(
            packet, packet_sha256=row.packet_sha256, content_sha256=row.content_sha256
        )
        for row in session.execute(query).scalars()
    )


Freshness = Literal["current", "rebind", "stale"]


def freshness(row: RegionExplanation, packet: Packet) -> Freshness:
    """What a stored reading needs, given the packet as it stands now.

    `current` — written from these exact bytes and bound by this binder revision.
    `rebind` — its words still describe the packet but its citations do not: it was
    written before binding existed, the binder's attribution changed, or only
    provenance moved (a re-download that changed a release id or a retrieval date and
    no figure). Each is repaired without a model call.
    `stale` — the figures it describes have changed, or its answers are no longer the
    questions its format asks (#266), so only a new generation will do.
    """
    if row.audience == "consumer" and [
        section.get("id") for section in (row.sections or [])
    ] != [question.id for question in QUESTIONS]:
        return "stale"
    if row.packet_sha256 == packet_hash(packet):
        version = (
            row.binding.get("binding_version") if isinstance(row.binding, dict) else None
        )
        return "current" if version == BINDING_VERSION else "rebind"
    if row.content_sha256 is not None and row.content_sha256 == packet_content_hash(
        packet
    ):
        return "rebind"
    return "stale"


def rebind(
    row: RegionExplanation, packet: Packet, *, payload_format: str = "markdown"
) -> Binding:
    """Bind a stored reading to the current packet, and pin it there if it binds.

    The row is updated only when every figure binds. When the binder's attribution has
    changed, the reading must also still pass its publication rules under the new
    citations. A refusal leaves the old row untouched so the caller can regenerate it.
    The prose, its sections and `generated_at` are never changed by re-citation.
    """
    binding = bind(row.body, packet, payload=render_payload(packet, payload_format))
    old_version = (
        row.binding.get("binding_version") if isinstance(row.binding, dict) else None
    )
    acceptable = binding.complete
    if acceptable and row.binding is not None and old_version != BINDING_VERSION:
        reading = FORMATS[cast(Audience, row.audience)]
        try:
            shaped, sections = reading.shape(row.body)
        except MalformedReading:
            acceptable = False
        else:
            acceptable = shaped == row.body and not reading.problems(
                row.body, sections, binding, packet
            )
    if acceptable:
        row.binding = binding.model_dump(mode="json")
        row.packet_sha256 = packet_hash(packet)
        row.content_sha256 = packet_content_hash(packet)
    return binding
