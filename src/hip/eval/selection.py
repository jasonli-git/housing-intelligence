"""Resolving the ordered preference list to the model that will actually write.

`select_winner` in `report.py` answers "which candidate scored best". This answers a
different question — "which candidate can write this paragraph right now" — and the two
are deliberately not the same mechanism. The winner is a finding about a run; the
resolution is a decision about a moment, and the moment is when a vendor is down.

Four rules, each of them a SPEC requirement rather than a convenience:

- **The list is walked in order and the first available candidate wins.** Not the best
  available one: reordering by score at generation time would make the published prose
  depend on a benchmark result that can change under a rebuild, and the point of a
  preference list is that its behaviour is predictable.
- **Only benchmarked models are eligible.** A model that has not been measured on these
  scenarios does not write text the platform publishes, and an entry that has not passed
  is skipped rather than trusted. This is what stops the list becoming a back door
  around Milestone 8's discipline.
- **The list ends at a local model**, enforced at config load. A hosted tail would mean
  a vendor decision could stop `hip explain` from running, which is the single failure
  mode the list exists to prevent.
- **Eligibility belongs to a configuration, not to a name** (Milestone 20). A model the
  benchmark measured at one reasoning effort, and that config now sets to another, is
  skipped: prose under its id would come from a configuration nobody measured.

Unavailability is normal operation, not an error. A tier with no API key, an unreachable
Ollama, and — when `probe` is on, as it is for `hip explain` — a withdrawn pin or one a
provider has routed to a different model are each a fallthrough, and only exhausting the
whole list raises.

The withdrawn-pin case was claimed here from Milestone 12 and was not true until 22.
Availability was a check that a key existed, which a withdrawn model passes, so it
resolved as available and then failed every region one at a time. A routed model was
worse: it never failed at all. Probing asks the provider, which is the only party that
knows.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from hip.config import CandidateModel, EvaluationConfig
from hip.eval.report import ModelSummary, meets_the_bar
from hip.eval.runners import HostedRunner, RunnerUnavailable, build_runner

log = logging.getLogger(__name__)


class NoModelAvailable(RuntimeError):
    """Every candidate in the preference list was skipped.

    Carries the whole trail rather than only the last failure, because "no model
    available" with no further detail is the least actionable message this command
    could produce: the recovery differs per tier, and which tiers were tried is the
    information that names it.
    """


@dataclass(frozen=True)
class Resolution:
    """The model that will generate, and what was passed over to reach it."""

    model_id: str
    cohort: str
    runtime: str
    skipped: list[tuple[str, str]] = field(default_factory=list)

    @property
    def is_fallback(self) -> bool:
        """Whether a preferred tier was passed over to get here.

        Worth surfacing in the CLI: a run that silently fell through to the local
        runtime takes hours instead of seconds, and the operator should learn that from
        the first line of output rather than from the wall clock.
        """
        return bool(self.skipped)


def passed_benchmark(summary: ModelSummary) -> bool:
    """Whether a model cleared the bars the report already applies to a winner.

    The predicate `select_winner` uses, called rather than restated. It was restated
    until Milestone 20, which is how a docstring here could call the two shared while a
    new condition would have had to be added twice.
    """
    return meets_the_bar(summary)


def configuration_drift(
    candidate: CandidateModel, measured: set[str], run: str | None
) -> str | None:
    """Why `candidate` as configured is not what `run` measured, or None if it is.

    Reasoning effort is the one part of a configuration every generation records, so it
    is the one this can check. A model the run never measured returns None: whether an
    unmeasured model may write is the benchmark gate's question, answered separately.
    """
    if not measured or measured == {candidate.reasoning_effort}:
        return None
    return (
        f"measured at reasoning effort {', '.join(sorted(measured))} in run '{run}' but "
        f"configured as '{candidate.reasoning_effort}' — a different setting is a "
        f"different candidate, with its own id and its own benchmark"
    )


def benchmarked(evaluation: EvaluationConfig, run: str) -> dict[str, ModelSummary]:
    """Summaries for the models in `run` that cleared the benchmark."""
    from hip.eval.report import summarize
    from hip.eval.store import load_checks, load_generations, load_judgments

    summaries = summarize(
        evaluation,
        load_generations(run),
        load_checks(run),
        load_judgments(run),
    )
    return {
        model_id: summary
        for model_id, summary in summaries.items()
        if passed_benchmark(summary)
    }


def latest_run() -> str | None:
    """The most recently written evaluation run, or None if none exists."""
    from hip.eval.store import runs

    available = list(runs())
    return available[-1] if available else None


def resolve(
    evaluation: EvaluationConfig,
    *,
    run: str | None = None,
    require_benchmark: bool = True,
    probe: bool = False,
) -> Resolution:
    """The first candidate in the preference list that has passed and can be reached.

    `require_benchmark=False` exists for the bootstrap case this milestone is itself in:
    before any run has scored a hosted candidate there is nothing to check against, and
    refusing to generate would make the benchmark unrunnable through this path. It is
    not a flag for ordinary use, and `hip explain` states plainly when it is set.

    `probe=True` calls each hosted tier once before choosing it — a few tokens, a fraction
    of a cent — and falls through past any that is unreachable or answered by a model
    other than the one requested. Off by default so that resolving stays free for callers
    that only want to know what the list would pick.
    """
    run = run or latest_run()
    eligible: dict[str, ModelSummary] = {}
    if require_benchmark:
        if run is None:
            raise NoModelAvailable(
                "no evaluation run exists, so no candidate has passed the benchmark. "
                "Run `hip eval run` and `hip eval judge` first, or name a model with "
                "--model."
            )
        eligible = benchmarked(evaluation, run)

    skipped: list[tuple[str, str]] = []
    declared = {m.id for m in evaluation.models}

    for model_id in evaluation.generation.preference:
        if model_id not in declared:
            # `hip check-config` catches this; reaching it here means config changed
            # under a running process.
            skipped.append((model_id, "no cohort declares it"))
            continue
        if require_benchmark and model_id not in eligible:
            skipped.append((model_id, f"has not passed the benchmark in run '{run}'"))
            continue
        if require_benchmark:
            drift = configuration_drift(
                evaluation.model(model_id), eligible[model_id].reasoning_efforts, run
            )
            if drift:
                skipped.append((model_id, drift))
                continue

        cohort_name = evaluation.cohort_of(model_id)
        cohort = evaluation.cohorts[cohort_name]
        try:
            runner = build_runner(cohort, cohort_name)
            available = runner.available()
        except RunnerUnavailable as exc:
            skipped.append((model_id, str(exc)))
            continue
        if not available:
            skipped.append((model_id, f"cohort '{cohort_name}' is unavailable"))
            continue
        if probe and isinstance(runner, HostedRunner):
            failure = runner.probe(evaluation.model(model_id))
            if failure:
                skipped.append((model_id, failure))
                continue

        for passed_over, why in skipped:
            log.info("preference: skipped %s (%s)", passed_over, why)
        return Resolution(
            model_id=model_id,
            cohort=cohort_name,
            runtime=cohort.provider or cohort.runner,
            skipped=skipped,
        )

    trail = "\n  ".join(f"{model_id}: {why}" for model_id, why in skipped)
    raise NoModelAvailable(
        "every candidate in generation.preference was skipped:\n  " + trail
    )
