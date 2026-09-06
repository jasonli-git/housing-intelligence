"""The run loop: every model, every scenario.

Ordered by model rather than by scenario, and — for a local cohort — strictly
sequential. Both choices are memory, not style. Iterating scenario-first would load and
unload each model once per question (Ollama's `load_duration` measured in seconds, MLX's
model load in tens of seconds), and running two local generations concurrently would put
two models in 16GB of unified memory at once, which is the fastest route into swap. A
local model is loaded, asked everything, and unloaded before the next one starts, and
the two local runtimes are never active at the same time for the same reason.

**A hosted cohort has none of those constraints and is submitted concurrently.** Nothing
is resident here; the model is somebody else's memory. Serializing hosted requests would
throw away the single property that put hosted inference on Milestone 12 — the wall
clock, not the price. Concurrency is therefore a property of the cohort rather than of
this loop, bounded by `generation.max_concurrency` so that a fan-out does not earn the
429s that a retry then pays for in the wall clock it was meant to save.

Ordering is preserved regardless. Generations are written to disk in plan order even
when they complete out of it, so a resumed run and a re-derived report are unaffected by
which request happened to return first — the same reason the artifacts carry no
wall-clock field (ARCHITECTURE #44).
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from hip.config import CandidateModel, EvaluationConfig, SamplingParams
from hip.eval.prompts import build_prompt, estimate_tokens, fits_context
from hip.eval.runners import ModelRunner, RunnerUnavailable, build_runner
from hip.eval.runners.mlx_runner import MlxRunner
from hip.eval.store import CHECKS, GENERATIONS, append_record, completed_keys, run_dir
from hip.eval.types import Generation, Scenario

log = logging.getLogger(__name__)

Progress = Callable[[Generation], None]


class ContextOverflow(RuntimeError):
    """A prompt does not fit the configured context window.

    Fatal rather than a warning. Ollama truncates silently — no error, no flag on the
    response — so a model would answer from a fraction of the packet and the run would
    record a confident wrong answer as a model failing. The context is sized to the
    payload, not the payload trimmed to the context.
    """


def plan(
    evaluation: EvaluationConfig,
    scenarios: Iterable[Scenario],
    *,
    mode: str = "deterministic",
    repeats: int = 1,
    models: list[str] | None = None,
) -> list[tuple[str, Scenario, int]]:
    """Every `(model_id, scenario, repeat)` the run will execute, in execution order."""
    wanted = set(models) if models else None
    ordered = list(scenarios)
    return [
        (candidate.id, scenario, repeat)
        for candidate in evaluation.models
        if wanted is None or candidate.id in wanted
        for repeat in range(repeats if mode == "stability" else 1)
        for scenario in ordered
    ]


def sampling_for(evaluation: EvaluationConfig, mode: str) -> SamplingParams:
    """The pinned parameters for a mode, named explicitly rather than by attribute.

    `getattr(evaluation.sampling, mode)` would work and would also accept a typo as a
    silent `AttributeError` at generation time, halfway through a run.
    """
    if mode == "deterministic":
        return evaluation.sampling.deterministic
    if mode == "stability":
        return evaluation.sampling.stability
    raise ValueError(f"unknown sampling mode '{mode}' (deterministic | stability)")


def _seed_for(evaluation: EvaluationConfig, mode: str, repeat: int) -> int | None:
    """The seed for one repeat.

    Deterministic mode pins the configured seed. Stability mode varies it per repeat:
    holding a seed fixed at temperature 0.7 reproduces the same sample every time,
    which measures reproducibility rather than the run-to-run variation the mode
    exists to measure.
    """
    sampling = sampling_for(evaluation, mode)
    if mode == "deterministic":
        return sampling.seed
    return (sampling.seed or 0) + repeat


def run_evaluation(
    evaluation: EvaluationConfig,
    scenarios: list[Scenario],
    run: str,
    *,
    mode: str = "deterministic",
    repeats: int = 1,
    models: list[str] | None = None,
    resume: bool = True,
    on_generation: Progress | None = None,
) -> list[Generation]:
    """Execute the plan, appending each generation as it completes.

    Returns only the generations produced by this call; a resumed run's earlier
    records stay on disk and are picked up by the report.
    """
    path = run_dir(run) / GENERATIONS
    already = completed_keys(run) if resume else set()
    if not resume:
        # Clear the derived artifact too. Checks are appended per generation, so a
        # restart that left them behind would mix results from two different configs in
        # one file — which is exactly what a restart is usually for correcting.
        for stale in (path, run_dir(run) / CHECKS):
            stale.unlink(missing_ok=True)

    sampling = sampling_for(evaluation, mode)
    produced: list[Generation] = []

    for cohort_name, cohort in evaluation.cohorts.items():
        wanted = [
            candidate
            for candidate in cohort.models
            if models is None or candidate.id in models
        ]
        if not wanted:
            continue

        runner = build_runner(cohort, cohort_name)
        if not runner.available():
            raise RunnerUnavailable(
                f"cohort '{cohort_name}' runner '{cohort.runner}' is unavailable. "
                + (
                    "Start Ollama with `ollama serve`."
                    if cohort.runner == "ollama"
                    else "Install the `mlx` dependency group and check "
                    "~/.lmstudio/models."
                )
            )

        concurrency = (
            evaluation.generation.max_concurrency if cohort.runner == "hosted" else 1
        )

        try:
            for candidate in wanted:
                for repeat in range(repeats if mode == "stability" else 1):
                    seed = _seed_for(evaluation, mode, repeat)
                    pending = [
                        (scenario, _prompt_for(evaluation, scenario))
                        for scenario in scenarios
                        if f"{scenario.key}|{candidate.id}|{mode}|{repeat}" not in already
                    ]
                    if not pending:
                        continue

                    # Every loop variable bound as a default. The closure is consumed
                    # inside the iteration that creates it, so late binding would be
                    # harmless today and a real bug the moment a future does not.
                    def _one(
                        item: tuple[Scenario, str],
                        runner: ModelRunner = runner,
                        candidate: CandidateModel = candidate,
                        repeat: int = repeat,
                        seed: int | None = seed,
                    ) -> Generation:
                        scenario, prompt = item
                        return runner.generate(
                            candidate,
                            scenario,
                            prompt,
                            sampling,
                            evaluation.limits,
                            mode,
                            repeat,
                            seed,
                        )

                    if concurrency > 1:
                        with ThreadPoolExecutor(max_workers=concurrency) as pool:
                            # `map` yields in submission order, not completion order,
                            # so the JSONL stays in plan order however the requests
                            # interleave.
                            results = list(pool.map(_one, pending))
                    else:
                        results = [_one(item) for item in pending]

                    for generation in results:
                        append_record(path, generation)
                        produced.append(generation)
                        if on_generation:
                            on_generation(generation)
                # Release before the next model rather than after the cohort: MLX holds
                # weights in this process, so the next load would otherwise peak at two
                # models' worth of memory.
                if isinstance(runner, MlxRunner):
                    runner.unload()
        finally:
            if isinstance(runner, MlxRunner):
                runner.unload()

    return produced


def _prompt_for(evaluation: EvaluationConfig, scenario: Scenario) -> str:
    """The prompt for one scenario, refusing one that would be silently truncated.

    Fatal rather than a warning, and checked before anything is submitted: Ollama
    truncates with no error and no flag on the response, so a model would answer from a
    fraction of the packet and the run would record a confident wrong answer as a model
    failing. Hoisted out of the loop so the concurrent and sequential paths cannot
    diverge on it.
    """
    prompt = build_prompt(evaluation.system_prompt, scenario.payload, scenario.question)
    if not fits_context(
        prompt,
        evaluation.limits.max_output_tokens,
        evaluation.limits.context_tokens,
    ):
        raise ContextOverflow(
            f"{scenario.key}: prompt is ~{estimate_tokens(prompt):,} "
            f"tokens plus {evaluation.limits.max_output_tokens:,} "
            f"reserved for output, over the configured context_tokens of "
            f"{evaluation.limits.context_tokens:,}. Raise it in "
            f"config/evaluation.yml rather than letting the runtime truncate "
            f"the packet."
        )
    return prompt


def scenario_path(run: str) -> Path:
    return run_dir(run)
