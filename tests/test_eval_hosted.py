"""Hosted inference: the runner, the preference list, and the gates around them.

No network and no API key. `HostedRunner` speaks HTTP through `httpx`, so a mock
transport is the whole seam — the tests drive real request construction and real
response parsing, and only the wire is fake. That is deliberately a stronger test than
patching the runner's own methods, because the parts most likely to be wrong are the
ones that differ per provider: where the answer sits, where the token counters sit, and
which failures are worth retrying.
"""

from __future__ import annotations

import os
import pathlib
import threading
import time

import httpx
import pytest

from hip.config import (
    CandidateModel,
    Cohort,
    EvalLimits,
    EvaluationConfig,
    GenerationConfig,
    SamplingParams,
    Settings,
    load_evaluation,
)
from hip.eval.report import MAX_ERROR_RATE, ModelSummary, select_winner, summarize
from hip.eval.runners import build_runner
from hip.eval.runners.hosted import HostedRunner
from hip.eval.runners.ollama import OllamaRunner
from hip.eval.selection import NoModelAvailable, passed_benchmark, resolve
from hip.eval.types import Generation, Scenario, Telemetry

SAMPLING = SamplingParams(temperature=0.0, top_p=1.0, top_k=1, repeat_penalty=1.0, seed=0)
LIMITS = EvalLimits(context_tokens=12288, max_output_tokens=6000, keep_alive=0)
CONFIG_DIR = pathlib.Path(__file__).resolve().parents[1] / "config"


def _scenario() -> Scenario:
    return Scenario(
        scenario_id="headline_change",
        region_id=11,
        region_label="Mercer County, NJ",
        window="5y",
        question="Which metric changed most?",
        payload_format="markdown",
        payload="# Mercer\n\nzhvi_sfr 500000",
        payload_tokens=10,
    )


def _cohort(provider: str, endpoint: str) -> Cohort:
    return Cohort(
        runner="hosted",
        provider=provider,  # type: ignore[arg-type]
        api_key_env=f"{provider.upper()}_API_KEY",
        endpoint=endpoint,
        models=[
            CandidateModel(
                id=f"{provider}-test",
                ref="pinned-model-0731",
                label=f"{provider} test",
                quantization="hosted",
                input_usd_per_mtok=0.25,
                output_usd_per_mtok=1.5,
            )
        ],
    )


def _generate(
    runner: HostedRunner,
    handler: object,
    monkeypatch: pytest.MonkeyPatch,
) -> Generation:
    """Run one generation with `handler` standing in for the provider's HTTP surface."""
    model = runner_model(runner)
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:  # type: ignore[arg-type]
        monkeypatch.setattr(httpx, "post", client.post)
        return runner.generate(
            model, _scenario(), "prompt", SAMPLING, LIMITS, "deterministic", 0, 0
        )


# --- config schema -----------------------------------------------------------------


def test_hosted_cohort_requires_provider_key_and_endpoint() -> None:
    with pytest.raises(ValueError, match="provider"):
        Cohort(runner="hosted", models=[_cohort("deepseek", "x").models[0]])


def test_local_cohort_rejects_hosted_only_fields() -> None:
    """A stray `provider:` on the Ollama cohort must fail rather than be ignored."""
    with pytest.raises(ValueError, match="local"):
        Cohort(
            runner="ollama",
            provider="deepseek",
            models=[_cohort("deepseek", "x").models[0]],
        )


def test_local_candidate_has_no_cost_rather_than_zero_cost() -> None:
    """A local generation is not free; it is not billed per token. The column must be
    blank rather than a misleading 0.00."""
    local = CandidateModel(
        id="gemma-4-e4b-q4", ref="bench", label="Gemma", quantization="Q4_K_M"
    )
    assert local.billed_per_token is False
    assert local.usd_for(2750, 800) is None


def test_hosted_candidate_prices_a_generation_from_its_own_rates() -> None:
    hosted = _cohort("gemini", "https://x").models[0]
    # 1M input at $0.25 plus 1M output at $1.50.
    assert hosted.usd_for(1_000_000, 1_000_000) == pytest.approx(1.75)


# --- cohort identity ---------------------------------------------------------------


def test_cohort_name_comes_from_config_not_from_the_runner_class() -> None:
    """Three providers share one `HostedRunner`; stamping the class's own name on every
    generation would collapse them into one column in the report."""
    runner = build_runner(_cohort("gemini", "https://x"), "gemini")
    assert isinstance(runner, HostedRunner)
    assert runner._cohort == "gemini"

    other = build_runner(_cohort("mistral", "https://y"), "mistral")
    assert isinstance(other, HostedRunner)
    assert other._cohort == "mistral"


def test_ollama_cohort_name_is_also_configurable() -> None:
    assert OllamaRunner("http://localhost:11434", "second-gguf")._cohort == "second-gguf"


# --- availability ------------------------------------------------------------------


def test_a_missing_key_is_unavailability_not_an_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The whole preference list depends on this: a tier with no key falls through to
    the next one exactly as a withdrawn model does."""
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    runner = build_runner(_cohort("deepseek", "https://api.deepseek.com"), "deepseek")
    assert runner.available() is False


def test_a_present_key_is_availability_without_a_network_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    runner = build_runner(_cohort("deepseek", "https://api.deepseek.com"), "deepseek")
    assert runner.available() is True


# --- generation, per dialect -------------------------------------------------------


def test_openai_shaped_response_is_parsed_with_its_usage_counters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("Authorization")
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "Home values rose.",
                            "reasoning_content": "thinking about it",
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 2750,
                    "completion_tokens": 800,
                    "completion_tokens_details": {"reasoning_tokens": 300},
                },
            },
        )

    runner = build_runner(_cohort("deepseek", "https://api.deepseek.com/v1"), "deepseek")
    assert isinstance(runner, HostedRunner)
    generation = _generate(runner, handler, monkeypatch)

    assert captured["url"] == "https://api.deepseek.com/v1/chat/completions"
    assert captured["auth"] == "Bearer sk-test"
    assert generation.answer == "Home values rose."
    assert generation.reasoning == "thinking about it"
    assert generation.telemetry.prompt_tokens == 2750
    assert generation.telemetry.generation_tokens == 800
    assert generation.telemetry.reasoning_tokens == 300
    assert generation.error is None
    assert generation.cohort == "deepseek"


def test_gemini_shaped_response_is_parsed_from_its_own_field_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "goog-test")
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("x-goog-api-key")
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {"parts": [{"text": "Rents outpaced incomes."}]},
                        "finishReason": "STOP",
                    }
                ],
                "usageMetadata": {
                    "promptTokenCount": 2600,
                    "candidatesTokenCount": 420,
                    "thoughtsTokenCount": 90,
                },
            },
        )

    runner = build_runner(
        _cohort("gemini", "https://generativelanguage.googleapis.com/v1beta"), "gemini"
    )
    assert isinstance(runner, HostedRunner)
    generation = _generate(runner, handler, monkeypatch)

    assert captured["url"].endswith("/models/pinned-model-0731:generateContent")  # type: ignore[union-attr]
    assert captured["auth"] == "goog-test"
    assert generation.answer == "Rents outpaced incomes."
    assert generation.telemetry.prompt_tokens == 2600
    assert generation.telemetry.generation_tokens == 420
    assert generation.telemetry.reasoning_tokens == 90


def test_a_blocked_gemini_prompt_is_a_refusal_not_an_empty_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reporting a block as an empty answer would let the refusal scenario score a model
    that never saw the question."""
    monkeypatch.setenv("GEMINI_API_KEY", "goog-test")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}})

    runner = build_runner(_cohort("gemini", "https://x/v1beta"), "gemini")
    assert isinstance(runner, HostedRunner)
    generation = _generate(runner, handler, monkeypatch)
    assert generation.answer == ""
    assert generation.telemetry.finish_reason == "blocked:SAFETY"


def test_a_hosted_runtime_reports_no_memory_figure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`memory_basis` exists so a column is never filled with a differently-meaning
    number. The memory of a machine we do not own is not one this evaluation has."""
    monkeypatch.setenv("MISTRAL_API_KEY", "m-test")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 2},
            },
        )

    runner = build_runner(_cohort("mistral", "https://api.mistral.ai/v1"), "mistral")
    assert isinstance(runner, HostedRunner)
    generation = _generate(runner, handler, monkeypatch)
    assert generation.telemetry.peak_memory_mb is None
    assert generation.telemetry.memory_basis is None
    assert generation.telemetry.load_ms is None
    assert generation.telemetry.ttft_ms is None


# --- retry -------------------------------------------------------------------------


def test_a_rate_limit_is_retried_and_then_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setattr("hip.eval.runners.hosted.time.sleep", lambda _: None)
    attempts: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(1)
        if len(attempts) < 3:
            return httpx.Response(429, headers={"retry-after": "0"}, json={})
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "done"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
            },
        )

    runner = build_runner(_cohort("deepseek", "https://x/v1"), "deepseek")
    assert isinstance(runner, HostedRunner)
    generation = _generate(runner, handler, monkeypatch)
    assert len(attempts) == 3
    assert generation.answer == "done"
    assert generation.error is None


def test_a_bad_request_is_not_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    """Repeating a 400 wastes the run's wall clock and produces the same answer."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setattr("hip.eval.runners.hosted.time.sleep", lambda _: None)
    attempts: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(1)
        return httpx.Response(400, json={"error": "bad model"})

    runner = build_runner(_cohort("deepseek", "https://x/v1"), "deepseek")
    assert isinstance(runner, HostedRunner)
    generation = _generate(runner, handler, monkeypatch)
    assert len(attempts) == 1
    assert generation.error is not None


def test_exhausted_retries_return_a_generation_rather_than_raising(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`ModelRunner` requires that a model-level failure be a finding: losing the other
    14 scenarios to one bad answer is worse than recording it."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setattr("hip.eval.runners.hosted.time.sleep", lambda _: None)
    attempts: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(1)
        return httpx.Response(503, json={})

    runner = build_runner(_cohort("deepseek", "https://x/v1"), "deepseek")
    assert isinstance(runner, HostedRunner)
    generation = _generate(runner, handler, monkeypatch)
    assert len(attempts) == 4
    assert generation.error is not None
    assert generation.answer == ""


def test_retry_after_is_honoured_over_the_computed_backoff() -> None:
    assert HostedRunner._retry_delay(0, "5") == 5.0
    # An HTTP-date `Retry-After` falls through to the computed backoff rather than
    # sending the runner off to parse a date format.
    assert HostedRunner._retry_delay(0, "Wed, 21 Oct 2026 07:28:00 GMT") <= 1.0
    # Capped, so a provider asking for an hour does not wedge the run.
    assert HostedRunner._retry_delay(0, "9999") == 30.0


# --- the error-rate gate -----------------------------------------------------------


def _summary(model_id: str, *, generations: int, errors: int) -> ModelSummary:
    summary = ModelSummary(
        model_id=model_id,
        label=model_id,
        cohort="hosted",
        quantization="hosted",
        generations=generations,
        errors=errors,
    )
    summary.scores.extend([3.5] * (generations - errors))
    return summary


def test_one_transient_error_no_longer_disqualifies_a_candidate() -> None:
    """The absolute `errors == 0` gate was right for a local runtime, where an error
    means the model could not run. One 429 must not lose a winning hosted model."""
    summaries = {
        "hosted-a": _summary("hosted-a", generations=15, errors=1),
        "local-b": _summary("local-b", generations=15, errors=0),
    }
    summaries["local-b"].scores.clear()
    summaries["local-b"].scores.extend([2.0] * 15)
    winner = select_winner(summaries)
    assert winner is not None
    assert winner.model_id == "hosted-a"


def test_a_model_failing_too_often_is_still_excluded() -> None:
    summaries = {"flaky": _summary("flaky", generations=15, errors=4)}
    assert summaries["flaky"].error_rate > MAX_ERROR_RATE
    assert select_winner(summaries) is None


def test_error_rate_is_zero_rather_than_undefined_when_nothing_ran() -> None:
    empty = ModelSummary(model_id="x", label="x", cohort="c", quantization="q")
    assert empty.error_rate == 0.0
    # ...and it is still not selectable, because it has no score.
    assert select_winner({"x": empty}) is None


def runner_model(runner: HostedRunner) -> CandidateModel:
    """The single candidate declared by the test cohorts above."""
    return CandidateModel(
        id=f"{runner.provider}-test",
        ref="pinned-model-0731",
        label="test",
        quantization="hosted",
        input_usd_per_mtok=0.25,
        output_usd_per_mtok=1.5,
    )


# --- run ordering ------------------------------------------------------------------


def test_runs_are_ordered_by_write_time_not_by_name(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`hip explain` takes the last entry as "the most recent evaluation". A lexical
    sort puts `v10` before `v2`, which would generate the whole site's prose with an
    older run's winner and say nothing about it."""
    import hip.config as config_module
    from hip.eval.store import runs

    monkeypatch.setattr(
        config_module, "get_settings", lambda: _settings_at(tmp_path), raising=True
    )
    monkeypatch.setattr(
        "hip.eval.store.get_settings", lambda: _settings_at(tmp_path), raising=True
    )
    root = tmp_path / "eval"
    for index, name in enumerate(["v1", "v2", "v9", "v10"]):
        directory = root / name
        directory.mkdir(parents=True)
        os.utime(directory, (1_700_000_000 + index, 1_700_000_000 + index))

    assert list(runs())[-1] == "v10"


def _settings_at(root: pathlib.Path) -> Settings:
    return Settings(data_dir=root)


# --- preference-list resolution ----------------------------------------------------


def _evaluation(preference: list[str]) -> EvaluationConfig:
    """A three-tier config: two hosted providers, then a local model."""
    base = load_evaluation(CONFIG_DIR)
    return base.model_copy(
        update={
            "cohorts": {
                "deepseek": _cohort("deepseek", "https://api.deepseek.com/v1"),
                "gemini": _cohort("gemini", "https://gen.googleapis.com/v1beta"),
                "gguf": Cohort(
                    runner="ollama",
                    endpoint="http://localhost:11434",
                    models=[
                        CandidateModel(
                            id="gemma-4-e4b-q4",
                            ref="bench-gemma-4-e4b-q4",
                            label="Gemma 4 E4B",
                            quantization="Q4_K_M",
                        )
                    ],
                ),
            },
            "generation": GenerationConfig(preference=preference),
        }
    )


def _all_pass(evaluation: EvaluationConfig, run: str) -> dict[str, ModelSummary]:
    return {m.id: _summary(m.id, generations=15, errors=0) for m in evaluation.models}


def test_the_first_reachable_tier_wins_and_the_rest_are_recorded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "goog-test")
    monkeypatch.setattr("hip.eval.selection.benchmarked", _all_pass)
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: "v2")

    resolution = resolve(_evaluation(["deepseek-test", "gemini-test", "gemma-4-e4b-q4"]))

    assert resolution.model_id == "gemini-test"
    assert resolution.runtime == "gemini"
    assert resolution.is_fallback is True
    assert [model for model, _ in resolution.skipped] == ["deepseek-test"]


def test_an_unbenchmarked_candidate_is_skipped_rather_than_trusted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A model that has not been measured on these scenarios does not write text the
    platform publishes. This is what stops the list becoming a back door around the
    evaluation."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setenv("GEMINI_API_KEY", "goog-test")
    monkeypatch.setattr(
        "hip.eval.selection.benchmarked",
        lambda evaluation, run: {
            "gemini-test": _summary("gemini-test", generations=15, errors=0)
        },
    )
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: "v2")

    resolution = resolve(_evaluation(["deepseek-test", "gemini-test", "gemma-4-e4b-q4"]))

    assert resolution.model_id == "gemini-test"
    assert "has not passed the benchmark" in resolution.skipped[0][1]


def test_a_candidate_that_fabricates_too_often_is_not_eligible_to_write() -> None:
    """The bar to write is the bar to win — a model can never be eligible to generate
    under looser rules than it was eligible to be recommended under."""
    fabricator = _summary("loose", generations=15, errors=0)
    fabricator.unsupported_numbers = 10
    fabricator.total_numbers = 100
    assert fabricator.hallucination_rate > 0.05
    assert passed_benchmark(fabricator) is False


def test_exhausting_the_list_raises_with_the_whole_trail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """ "No model available" with no further detail is the least actionable message this
    command could produce: the recovery differs per tier."""
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr("hip.eval.selection.benchmarked", _all_pass)
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: "v2")
    monkeypatch.setattr(
        "hip.eval.runners.ollama.OllamaRunner.available", lambda self: False
    )

    with pytest.raises(NoModelAvailable) as caught:
        resolve(_evaluation(["deepseek-test", "gemini-test", "gemma-4-e4b-q4"]))

    message = str(caught.value)
    assert "deepseek-test" in message
    assert "gemini-test" in message
    assert "gemma-4-e4b-q4" in message


def test_the_bootstrap_path_skips_the_benchmark_gate_but_not_availability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Before any run has scored a hosted candidate there is nothing to check against,
    and refusing to generate would make the benchmark unrunnable through this path."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: None)

    resolution = resolve(
        _evaluation(["deepseek-test", "gemma-4-e4b-q4"]), require_benchmark=False
    )
    assert resolution.model_id == "deepseek-test"


def test_with_no_run_and_the_gate_on_resolution_fails_loudly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: None)
    with pytest.raises(NoModelAvailable, match="no evaluation run"):
        resolve(_evaluation(["deepseek-test", "gemma-4-e4b-q4"]))


# --- quality per dollar ------------------------------------------------------------


def test_cost_is_accumulated_from_the_providers_own_token_counters() -> None:
    """Priced from the counters the invoice is computed from, not from an estimate."""
    evaluation = _evaluation(["gemini-test"])
    generations = [
        _priced_generation("gemini-test", "gemini", prompt=1_000_000, output=1_000_000)
    ]
    summaries = summarize(evaluation, generations, [], [])
    # $0.25 per Mtok in, $1.50 per Mtok out.
    assert summaries["gemini-test"].usd == pytest.approx(1.75)


def test_a_local_model_has_no_cost_row_rather_than_a_zero_one() -> None:
    """A 0.00 in a published cost column reads as free. A local generation is not."""
    evaluation = _evaluation(["gemma-4-e4b-q4"])
    generations = [_priced_generation("gemma-4-e4b-q4", "gguf", prompt=2750, output=800)]
    summary = summarize(evaluation, generations, [], [])["gemma-4-e4b-q4"]
    assert summary.usd is None
    assert summary.usd_per_thousand is None
    assert summary.score_per_dollar is None


def test_quality_per_dollar_needs_both_halves() -> None:
    """A priced model with no rubric score has a cost but no ratio: dividing an absent
    score by a real cost would print a confident 0.0."""
    evaluation = _evaluation(["gemini-test"])
    generations = [_priced_generation("gemini-test", "gemini", prompt=2600, output=800)]
    summary = summarize(evaluation, generations, [], [])["gemini-test"]
    assert summary.usd is not None
    assert summary.mean_score is None
    assert summary.score_per_dollar is None


def _priced_generation(
    model_id: str, cohort: str, *, prompt: int, output: int
) -> Generation:
    return Generation(
        scenario_key="headline_change:11:markdown",
        scenario_id="headline_change",
        region_id=11,
        model_id=model_id,
        cohort=cohort,
        mode="deterministic",
        answer="Values rose.",
        raw="Values rose.",
        telemetry=Telemetry(
            prompt_tokens=prompt,
            generation_tokens=output,
            generation_ms=100.0,
            total_ms=100.0,
        ),
    )


# --- concurrency -------------------------------------------------------------------


def test_a_hosted_cohort_runs_concurrently_and_a_local_one_does_not(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Concurrency is a property of the cohort, not of the loop. The local cohorts stay
    serial for the memory reason that put them that way; the hosted one must not, or
    the milestone's whole wall-clock argument is discarded."""
    in_flight, peak = _run_recording_concurrency(tmp_path, monkeypatch, "hosted")
    assert peak > 1, "hosted generations were serialized"
    assert in_flight == 0

    _, local_peak = _run_recording_concurrency(tmp_path, monkeypatch, "ollama")
    assert local_peak == 1, "a local cohort must not run two models at once"


def test_generations_are_written_in_plan_order_however_they_complete(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A resumed run and a re-derived report must not depend on which request happened
    to return first — the same reason the artifacts carry no wall-clock field."""
    import random as random_module

    from hip.eval.runner import run_evaluation

    evaluation = _concurrent_evaluation()
    scenarios = [_scenario_n(i) for i in range(8)]

    def slow_generate(
        self, model, scenario, prompt, sampling, limits, mode, repeat, seed
    ):  # type: ignore[no-untyped-def]
        # Reverse-ish completion order: later scenarios finish first.
        time.sleep(random_module.uniform(0.0, 0.01))
        return _priced_generation_for(scenario, model.id, "hosted")

    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setattr(HostedRunner, "generate", slow_generate)
    monkeypatch.setattr("hip.eval.store.get_settings", lambda: _settings_at(tmp_path))

    produced = run_evaluation(evaluation, scenarios, "vtest", resume=False)
    assert [g.scenario_id for g in produced] == [s.scenario_id for s in scenarios]


def test_an_oversized_prompt_is_refused_before_anything_is_submitted(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Hoisted out of the loop so the concurrent and sequential paths cannot diverge on
    it: a truncated packet is recorded as a model failing, which is the wrong finding."""
    from hip.eval.runner import ContextOverflow, run_evaluation

    evaluation = _concurrent_evaluation()
    huge = _scenario_n(0).model_copy(update={"payload": "x " * 100_000})
    calls: list[int] = []

    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setattr(
        HostedRunner,
        "generate",
        lambda *a, **k: calls.append(1),  # type: ignore[arg-type,return-value]
    )
    monkeypatch.setattr("hip.eval.store.get_settings", lambda: _settings_at(tmp_path))

    with pytest.raises(ContextOverflow):
        run_evaluation(evaluation, [huge], "vtest", resume=False)
    assert calls == []


def _concurrent_evaluation() -> EvaluationConfig:
    base = load_evaluation(CONFIG_DIR)
    return base.model_copy(
        update={
            "cohorts": {"hosted": _cohort("deepseek", "https://x/v1")},
            "generation": GenerationConfig(
                preference=["deepseek-test"], max_concurrency=4
            ),
        }
    )


def _scenario_n(index: int) -> Scenario:
    return _scenario().model_copy(update={"scenario_id": f"s{index}", "region_id": index})


def _priced_generation_for(scenario: Scenario, model_id: str, cohort: str) -> Generation:
    return _priced_generation(model_id, cohort, prompt=10, output=5).model_copy(
        update={
            "scenario_key": scenario.key,
            "scenario_id": scenario.scenario_id,
            "region_id": scenario.region_id,
        }
    )


def _run_recording_concurrency(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch, runner_kind: str
) -> tuple[int, int]:
    """Run one cohort and report (in-flight at the end, peak in-flight)."""
    from hip.eval.runner import run_evaluation
    from hip.eval.runners.ollama import OllamaRunner as _Ollama

    base = load_evaluation(CONFIG_DIR)
    if runner_kind == "hosted":
        cohorts = {"hosted": _cohort("deepseek", "https://x/v1")}
        target, model_id = HostedRunner, "deepseek-test"
        monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    else:
        cohorts = {
            "gguf": Cohort(
                runner="ollama",
                endpoint="http://localhost:11434",
                models=[
                    CandidateModel(
                        id="local-test", ref="r", label="l", quantization="Q4_K_M"
                    )
                ],
            )
        }
        target, model_id = _Ollama, "local-test"
        monkeypatch.setattr(_Ollama, "available", lambda self: True)

    evaluation = base.model_copy(
        update={
            "cohorts": cohorts,
            "generation": GenerationConfig(preference=[model_id], max_concurrency=4),
        }
    )

    state = {"now": 0, "peak": 0}
    lock = threading.Lock()

    def counting(self, model, scenario, prompt, sampling, limits, mode, repeat, seed):  # type: ignore[no-untyped-def]
        with lock:
            state["now"] += 1
            state["peak"] = max(state["peak"], state["now"])
        time.sleep(0.02)
        with lock:
            state["now"] -= 1
        return _priced_generation_for(scenario, model.id, "c")

    monkeypatch.setattr(target, "generate", counting)
    monkeypatch.setattr("hip.eval.store.get_settings", lambda: _settings_at(tmp_path))
    run_evaluation(
        evaluation, [_scenario_n(i) for i in range(6)], f"v{runner_kind}", resume=False
    )
    return state["now"], state["peak"]
