"""Hosted inference: the runner, the preference list, and the gates around them.

No network and no API key. `HostedRunner` speaks HTTP through `httpx`, so a mock
transport is the whole seam — the tests drive real request construction and real
response parsing, and only the wire is fake. That is deliberately a stronger test than
patching the runner's own methods, because the parts most likely to be wrong are the
ones that differ per provider: where the answer sits, where the token counters sit, and
which failures are worth retrying.
"""

from __future__ import annotations

import json
import os
import pathlib
import threading
import time
from types import SimpleNamespace
from typing import Any

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
from hip.eval.report import (
    MAX_ERROR_RATE,
    ModelSummary,
    render_report,
    select_winner,
    summarize,
)
from hip.eval.runners import build_runner
from hip.eval.runners.hosted import HostedRunner
from hip.eval.runners.ollama import OllamaRunner
from hip.eval.selection import NoModelAvailable, passed_benchmark, resolve
from hip.eval.types import CriterionScore, Generation, Judgment, Scenario, Telemetry

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
    # 420 answer tokens + 90 thinking tokens. Gemini reports thinking separately in
    # `thoughtsTokenCount` and bills it at the output rate, while the OpenAI-shaped
    # providers fold it into `completion_tokens` and Ollama's `eval_count` covers both.
    # `generation_tokens` means every token billed as output, under all three, or the
    # cost column disagrees with the invoice and `reasoning_share` exceeds 100%.
    assert generation.telemetry.generation_tokens == 510
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


def _all_pass_at_default(
    evaluation: EvaluationConfig, run: str
) -> dict[str, ModelSummary]:
    """Every model passed, each measured at its provider's default reasoning."""
    summaries = _all_pass(evaluation, run)
    for summary in summaries.values():
        summary.reasoning_efforts.add("default")
    return summaries


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


# --- judge cost, measured rather than assumed ---------------------------------------


def test_judge_cost_tracks_the_run_s_own_packet_size() -> None:
    """A constant prompt size has been wrong twice: 7,000 tokens guessed, then 2,600
    measured against `v1` — whose packets carry 1,514 tokens where `v2`'s carry ~4,700,
    because the packet gained metrics and caveats across Milestones 7 and 9. The
    estimate has to come from the run being priced."""
    from hip.eval.judge import measured_cost

    evaluation = load_evaluation(CONFIG_DIR)
    small_gen, small_scenario = _judgeable(payload="x " * 500)
    large_gen, large_scenario = _judgeable(payload="x " * 5000)

    # A realistic run rather than one generation: the quote is rounded to cents, which
    # is the right precision for the decision it informs and too coarse to compare a
    # single call against another.
    small_cost, small_tokens = measured_cost(
        [small_gen] * 105, {small_scenario.key: small_scenario}, evaluation
    )
    large_cost, large_tokens = measured_cost(
        [large_gen] * 105, {large_scenario.key: large_scenario}, evaluation
    )

    assert large_tokens > small_tokens * 2
    assert large_cost > small_cost


def test_batch_mode_is_half_of_sync() -> None:
    from hip.eval.judge import measured_cost

    evaluation = load_evaluation(CONFIG_DIR)
    generation, scenario = _judgeable(payload="x " * 2000)
    # A run's worth rather than one call. The quote is rounded to cents, and a single
    # judgment at `high` is a few cents with a half-cent that rounds differently in each
    # mode — which compared the rounding, not the rates.
    run = [generation] * 105
    batch, _ = measured_cost(run, {scenario.key: scenario}, evaluation)
    evaluation.judge.mode = "sync"
    sync, _ = measured_cost(run, {scenario.key: scenario}, evaluation)
    assert sync == pytest.approx(batch * 2, rel=0.02)


def test_a_generation_with_no_matching_scenario_is_not_priced() -> None:
    """Pricing a prompt that cannot be built would quote for work the judge will skip."""
    from hip.eval.judge import measured_cost

    evaluation = load_evaluation(CONFIG_DIR)
    generation, _ = _judgeable(payload="x " * 100)
    cost, tokens = measured_cost([generation], {}, evaluation)
    assert (cost, tokens) == (0.0, 0)


def _judgeable(*, payload: str) -> tuple[Generation, Scenario]:
    scenario = _scenario().model_copy(update={"payload": payload})
    generation = _priced_generation("gemini-3.7-flash", "gemini", prompt=10, output=5)
    return generation.model_copy(update={"scenario_key": scenario.key}), scenario


def test_generations_are_written_as_they_complete_not_in_a_final_pass(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`store` promises a resumable run. A cohort collected in memory and written at the
    end loses everything if the process dies partway, which is when resumability is
    worth having."""
    from hip.eval.runner import run_evaluation
    from hip.eval.store import run_dir

    evaluation = _concurrent_evaluation()
    scenarios = [_scenario_n(i) for i in range(6)]
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setattr("hip.eval.store.get_settings", lambda: _settings_at(tmp_path))

    seen_on_disk: list[int] = []

    def generate(self, model, scenario, prompt, sampling, limits, mode, repeat, seed):  # type: ignore[no-untyped-def]
        path = run_dir("vstream") / "generations.jsonl"
        seen_on_disk.append(len(path.read_text().splitlines()) if path.exists() else 0)
        return _priced_generation_for(scenario, model.id, "hosted")

    monkeypatch.setattr(HostedRunner, "generate", generate)
    run_evaluation(evaluation, scenarios, "vstream", resume=False)

    # The last generation must have seen earlier ones already durable. A final-pass
    # write leaves every observation at zero.
    assert max(seen_on_disk) > 0, "nothing was on disk while the cohort was still running"


def test_reasoning_can_never_exceed_the_billed_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The invariant behind the fix. A `reasoning_share` above 100% is not a model that
    thought unusually hard; it is two providers disagreeing about what the denominator
    counts. Measured at 237% on `gemini-3.7-flash` in run `v2`, where it also meant the
    published cost for the winning candidate was 58% low."""
    monkeypatch.setenv("GEMINI_API_KEY", "goog-test")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {"parts": [{"text": "short answer"}]},
                        "finishReason": "STOP",
                    }
                ],
                # A thinking-heavy turn: far more reasoning than answer.
                "usageMetadata": {
                    "promptTokenCount": 100,
                    "candidatesTokenCount": 40,
                    "thoughtsTokenCount": 900,
                },
            },
        )

    runner = build_runner(_cohort("gemini", "https://x/v1beta"), "gemini")
    assert isinstance(runner, HostedRunner)
    generation = _generate(runner, handler, monkeypatch)
    telemetry = generation.telemetry
    assert telemetry.reasoning_tokens <= telemetry.generation_tokens
    assert telemetry.generation_tokens == 940


# --- multi-model explanation storage (Milestone 19) ---------------------------------


def test_rank_comes_from_preference_position() -> None:
    from hip.eval.explain import rank_of

    evaluation = _evaluation(["deepseek-test", "gemini-test", "gemma-4-e4b-q4"])
    assert rank_of(evaluation, "deepseek-test") == 0
    assert rank_of(evaluation, "gemini-test") == 1
    assert rank_of(evaluation, "gemma-4-e4b-q4") == 2


def test_a_model_not_on_the_list_sorts_last_not_first() -> None:
    """A candidate named explicitly with `--model` must not silently become the
    preferred explanation just because it has no listed position."""
    from hip.eval.explain import rank_of

    evaluation = _evaluation(["deepseek-test", "gemma-4-e4b-q4"])
    assert rank_of(evaluation, "mistral-large-3") == 2
    assert rank_of(evaluation, "mistral-large-3") > rank_of(evaluation, "gemma-4-e4b-q4")


# --- substitution detection (Milestone 22) ------------------------------------------


def _openai_body(
    served: str | None,
    *,
    content: str = "Values rose.",
    finish: str = "stop",
    fingerprint: str | None = None,
    reasoning_tokens: int = 0,
) -> dict[str, object]:
    body: dict[str, object] = {
        "choices": [{"message": {"content": content}, "finish_reason": finish}],
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": 40,
            "completion_tokens_details": {"reasoning_tokens": reasoning_tokens},
        },
    }
    if served is not None:
        body["model"] = served
    if fingerprint is not None:
        body["system_fingerprint"] = fingerprint
    return body


def _answering(body: dict[str, object]) -> object:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=body)

    return handler


def _probe(
    runner: HostedRunner, handler: object, monkeypatch: pytest.MonkeyPatch
) -> str | None:
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:  # type: ignore[arg-type]
        monkeypatch.setattr(httpx, "post", client.post)
        return runner.probe(runner_model(runner))


def _deepseek(monkeypatch: pytest.MonkeyPatch) -> HostedRunner:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    runner = build_runner(_cohort("deepseek", "https://x/v1"), "deepseek")
    assert isinstance(runner, HostedRunner)
    return runner


def test_a_routed_model_is_recorded_as_a_substitution_not_an_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Measured 2026-09-10: `deepseek-v4-flash` returns HTTP 200 answered by
    `deepseek-flash`. Nothing fails, so without this check the row would carry the
    retired model's name above another model's prose."""
    runner = _deepseek(monkeypatch)
    body = _openai_body("deepseek-flash", fingerprint="aeb56401")
    generation = _generate(runner, _answering(body), monkeypatch)

    assert generation.error is not None
    assert "substitution" in generation.error
    assert "pinned-model-0731" in generation.error
    assert "deepseek-flash" in generation.error
    assert generation.answer == ""
    # The call was billed, so the cost column has to see it.
    assert generation.telemetry.generation_tokens == 40
    assert generation.telemetry.served_model == "deepseek-flash"


def test_the_requested_model_answering_is_recorded_with_its_fingerprint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runner = _deepseek(monkeypatch)
    body = _openai_body("pinned-model-0731", fingerprint="a307abda")
    generation = _generate(runner, _answering(body), monkeypatch)

    assert generation.error is None
    assert generation.answer == "Values rose."
    assert generation.telemetry.served_model == "pinned-model-0731"
    assert generation.telemetry.system_fingerprint == "a307abda"


def test_a_response_naming_no_model_is_accepted_rather_than_failed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unverifiable is not the same as wrong. Failing here would make any provider that
    omits the field unusable."""
    runner = _deepseek(monkeypatch)
    generation = _generate(runner, _answering(_openai_body(None)), monkeypatch)
    assert generation.error is None
    assert generation.telemetry.served_model is None


def test_gemini_names_the_served_model_as_model_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "goog-test")
    runner = build_runner(_cohort("gemini", "https://x/v1beta"), "gemini")
    assert isinstance(runner, HostedRunner)

    def body(version: str) -> dict[str, object]:
        return {
            "candidates": [
                {"content": {"parts": [{"text": "ok"}]}, "finishReason": "STOP"}
            ],
            "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 2},
            "modelVersion": version,
        }

    same = _generate(runner, _answering(body("pinned-model-0731")), monkeypatch)
    assert same.error is None
    assert same.telemetry.served_model == "pinned-model-0731"
    # Gemini sends no fingerprint, and that is not a failure.
    assert same.telemetry.system_fingerprint is None

    other = _generate(runner, _answering(body("gemini-some-successor")), monkeypatch)
    assert other.error is not None and "substitution" in other.error


def test_a_reasoning_model_cut_off_before_answering_is_marked_truncated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DeepSeek reasons in a separate field the tag-based check never reads, so three
    empty `v2` answers that spent 6,000 tokens reasoning reported truncated=False."""
    runner = _deepseek(monkeypatch)
    body = _openai_body(
        "pinned-model-0731", content="", finish="length", reasoning_tokens=6000
    )
    generation = _generate(runner, _answering(body), monkeypatch)
    assert generation.answer == ""
    assert generation.truncated_reasoning is True


def test_a_cutoff_after_the_answer_began_is_not_truncated_reasoning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Out of budget mid-answer is a different finding from out of budget mid-thought."""
    runner = _deepseek(monkeypatch)
    body = _openai_body("pinned-model-0731", content="Values rose and", finish="length")
    generation = _generate(runner, _answering(body), monkeypatch)
    assert generation.truncated_reasoning is False


def test_gemini_max_tokens_before_any_text_is_also_truncation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "goog-test")
    runner = build_runner(_cohort("gemini", "https://x/v1beta"), "gemini")
    assert isinstance(runner, HostedRunner)
    body = {
        "candidates": [{"content": {"parts": []}, "finishReason": "MAX_TOKENS"}],
        "usageMetadata": {"promptTokenCount": 10, "thoughtsTokenCount": 900},
        "modelVersion": "pinned-model-0731",
    }
    generation = _generate(runner, _answering(body), monkeypatch)
    assert generation.truncated_reasoning is True


def test_probe_catches_a_routed_model_that_answers_perfectly_well(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """ "Text came back" is exactly the test routing passes, which is why it is no longer
    the test."""
    runner = _deepseek(monkeypatch)
    failure = _probe(runner, _answering(_openai_body("deepseek-flash")), monkeypatch)
    assert failure is not None and "substitution" in failure


def test_probe_accepts_a_reasoning_model_cut_off_by_its_small_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """It is the right model and it responded. Failing it would wrongly skip a tier."""
    runner = _deepseek(monkeypatch)
    body = _openai_body("pinned-model-0731", content="", finish="length")
    assert _probe(runner, _answering(body), monkeypatch) is None


def test_probe_still_fails_an_empty_answer_that_was_not_a_cutoff(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runner = _deepseek(monkeypatch)
    body = _openai_body("pinned-model-0731", content="", finish="stop")
    assert _probe(runner, _answering(body), monkeypatch) == "returned no text"


def test_resolve_falls_through_past_a_routed_pin_when_probing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The gap Milestone 22 closed: availability was a key check, so a withdrawn or
    routed model resolved as available and then failed every region."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setenv("GEMINI_API_KEY", "goog-test")
    monkeypatch.setattr("hip.eval.selection.benchmarked", _all_pass)
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: "v2")
    monkeypatch.setattr(
        HostedRunner,
        "probe",
        lambda self, model: (
            "substitution: requested x but deepseek answered with y"
            if self.provider == "deepseek"
            else None
        ),
    )

    resolution = resolve(
        _evaluation(["deepseek-test", "gemini-test", "gemma-4-e4b-q4"]), probe=True
    )
    assert resolution.model_id == "gemini-test"
    assert resolution.skipped[0][0] == "deepseek-test"
    assert "substitution" in resolution.skipped[0][1]


def test_resolve_does_not_probe_unless_asked(monkeypatch: pytest.MonkeyPatch) -> None:
    """Resolving stays free for callers that only ask what the list would pick."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setattr("hip.eval.selection.benchmarked", _all_pass)
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: "v2")

    def forbidden(self: HostedRunner, model: CandidateModel) -> str | None:
        raise AssertionError("resolve probed without being asked to")

    monkeypatch.setattr(HostedRunner, "probe", forbidden)
    resolution = resolve(_evaluation(["deepseek-test", "gemma-4-e4b-q4"]))
    assert resolution.model_id == "deepseek-test"


def test_explicit_models_are_each_verified_once_and_local_ones_not_at_all(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`--all` and `--model` skip `resolve`, so they are verified up front instead of
    learning about a routed pin from one paid failure per region."""
    from hip.eval_cli import _unusable

    # Every model passed: this is about probing, not about what a run measured.
    monkeypatch.setattr("hip.eval.selection.benchmarked", _all_pass)
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: "v2")
    probed: list[str] = []

    def probe(self: HostedRunner, model: CandidateModel) -> str | None:
        probed.append(model.id)
        return "substitution: routed" if self.provider == "deepseek" else None

    monkeypatch.setattr(HostedRunner, "probe", probe)
    evaluation = _evaluation(["deepseek-test", "gemini-test", "gemma-4-e4b-q4"])
    unusable = _unusable(evaluation, ["deepseek-test", "gemini-test", "gemma-4-e4b-q4"])

    assert unusable == {"deepseek-test": "substitution: routed"}
    assert probed == ["deepseek-test", "gemini-test"]


def test_a_misspelled_model_is_skipped_rather_than_crashing_the_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from hip.eval_cli import _unusable

    monkeypatch.setattr("hip.eval.selection.benchmarked", _all_pass)
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: "v2")
    evaluation = _evaluation(["gemma-4-e4b-q4"])
    assert list(_unusable(evaluation, ["no-such-model", "gemma-4-e4b-q4"])) == [
        "no-such-model"
    ]


def test_telemetry_written_before_the_new_fields_still_parses() -> None:
    """Every run `v1` and `v2` record on disk predates these fields."""
    old = Telemetry.model_validate(
        {
            "prompt_tokens": 1,
            "generation_tokens": 1,
            "generation_ms": 1.0,
            "total_ms": 1.0,
        }
    )
    assert old.served_model is None
    assert old.system_fingerprint is None


# --- reasoning effort (Milestone 20) ------------------------------------------------


def _at(provider: str, effort: str) -> CandidateModel:
    """The test cohorts' candidate, asked for `effort`."""
    return CandidateModel(
        id=f"{provider}-test",
        ref="pinned-model-0731",
        label=f"{provider} test",
        quantization="hosted",
        reasoning_effort=effort,  # type: ignore[arg-type]
        input_usd_per_mtok=0.25,
        output_usd_per_mtok=1.5,
    )


def _generate_as(
    runner: HostedRunner,
    model: CandidateModel,
    handler: object,
    monkeypatch: pytest.MonkeyPatch,
) -> Generation:
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:  # type: ignore[arg-type]
        monkeypatch.setattr(httpx, "post", client.post)
        return runner.generate(
            model, _scenario(), "prompt", SAMPLING, LIMITS, "deterministic", 0, 0
        )


def _recording(body: dict[str, object], sent: list[dict[str, Any]]) -> object:
    """A provider that answers `body` and keeps every request body it receives."""

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(json.loads(request.content))
        return httpx.Response(200, json=body)

    return handler


def _gemini_answer() -> dict[str, object]:
    return {
        "candidates": [{"content": {"parts": [{"text": "ok"}]}, "finishReason": "STOP"}],
        "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 2},
        "modelVersion": "pinned-model-0731",
    }


def _gemini(monkeypatch: pytest.MonkeyPatch) -> HostedRunner:
    monkeypatch.setenv("GEMINI_API_KEY", "goog-test")
    runner = build_runner(_cohort("gemini", "https://x/v1beta"), "gemini")
    assert isinstance(runner, HostedRunner)
    return runner


def _with_effort(
    evaluation: EvaluationConfig, model_id: str, effort: str
) -> EvaluationConfig:
    """`evaluation` with one candidate's effort edited in place — the edit Milestone 20's
    guards exist to catch."""
    cohorts = {
        name: cohort.model_copy(
            update={
                "models": [
                    m.model_copy(update={"reasoning_effort": effort})
                    if m.id == model_id
                    else m
                    for m in cohort.models
                ]
            }
        )
        for name, cohort in evaluation.cohorts.items()
    }
    return evaluation.model_copy(update={"cohorts": cohorts})


def _judged(
    generation: Generation, score: float, evaluation: EvaluationConfig
) -> Judgment:
    return Judgment(
        generation_key=generation.key,
        model_id=generation.model_id,
        scenario_id=generation.scenario_id,
        scores={
            criterion.id: CriterionScore(score=score, justification="")
            for criterion in evaluation.rubric.criteria
        },
        summary="",
        weighted_score=score,
    )


def test_a_default_candidate_sends_exactly_what_v2_sent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`v2` was measured with no reasoning field in any request. A default candidate must
    keep sending exactly that, or its benchmarked configuration moves underneath it."""
    sent: list[dict[str, Any]] = []
    deepseek = _deepseek(monkeypatch)
    answer = _recording(_openai_body("pinned-model-0731"), sent)
    _generate_as(deepseek, _at("deepseek", "default"), answer, monkeypatch)
    assert set(sent[-1]) == {
        "model",
        "messages",
        "stream",
        "temperature",
        "top_p",
        "max_tokens",
    }

    gemini = _gemini(monkeypatch)
    _generate_as(
        gemini, _at("gemini", "default"), _recording(_gemini_answer(), sent), monkeypatch
    )
    assert set(sent[-1]) == {"contents", "generationConfig"}
    assert set(sent[-1]["generationConfig"]) == {"temperature", "topP", "maxOutputTokens"}


def test_deepseek_disabled_is_sent_as_its_hard_off(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent: list[dict[str, Any]] = []
    runner = _deepseek(monkeypatch)
    answer = _recording(_openai_body("pinned-model-0731"), sent)
    _generate_as(runner, _at("deepseek", "disabled"), answer, monkeypatch)
    assert sent[-1]["thinking"] == {"type": "disabled"}
    # The documented `reasoning_effort` is not the lever — it saved 7% on V4 Pro.
    assert "reasoning_effort" not in sent[-1]


def test_gemini_low_is_sent_as_a_thinking_level_inside_generation_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent: list[dict[str, Any]] = []
    runner = _gemini(monkeypatch)
    _generate_as(
        runner, _at("gemini", "low"), _recording(_gemini_answer(), sent), monkeypatch
    )
    config = sent[-1]["generationConfig"]
    assert config["thinkingConfig"] == {"thinkingLevel": "low"}
    assert "thinkingConfig" not in sent[-1]
    # Not the legacy budget, which Gemini 3 keeps only for backward compatibility.
    assert "thinkingBudget" not in config["thinkingConfig"]


def test_a_level_no_model_has_been_seen_to_accept_is_not_a_setting() -> None:
    """`minimal` is documented for Gemini 3 Flash, and 3.7 Flash answered it with HTTP
    400 on 2026-09-10. A value config accepts is a claim that some model honours it."""
    with pytest.raises(ValueError, match="reasoning_effort"):
        _at("gemini", "minimal")


def test_every_generation_records_the_effort_it_was_sent_at(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Read from the answer rather than from config, so a report re-derived after a
    config edit still says what each answer was asked for — failures included."""
    runner = _deepseek(monkeypatch)
    model = _at("deepseek", "disabled")

    answered = _generate_as(
        runner, model, _answering(_openai_body("pinned-model-0731")), monkeypatch
    )
    assert answered.error is None
    assert answered.reasoning_effort == "disabled"

    substituted = _generate_as(
        runner, model, _answering(_openai_body("some-successor")), monkeypatch
    )
    assert substituted.error is not None
    assert substituted.reasoning_effort == "disabled"

    monkeypatch.delenv("DEEPSEEK_API_KEY")
    unkeyed = runner.generate(
        model, _scenario(), "prompt", SAMPLING, LIMITS, "deterministic", 0, 0
    )
    assert unkeyed.error is not None
    assert unkeyed.reasoning_effort == "disabled"


def test_records_from_before_the_field_parse_as_default() -> None:
    """No run before Milestone 20 sent a reasoning control, so `default` is the truth
    about every `v1` and `v2` record rather than a guess."""
    record = _priced_generation("gemma-4-e4b-q4", "gguf", prompt=1, output=1)
    old = record.model_dump(exclude={"reasoning_effort"})
    assert "reasoning_effort" not in old
    assert Generation.model_validate(old).reasoning_effort == "default"


def test_a_local_cohort_cannot_be_given_a_reasoning_effort() -> None:
    """The local runners send no reasoning control, so a setting there would be recorded
    against answers it never reached."""
    with pytest.raises(ValueError, match="sends no reasoning control"):
        Cohort(
            runner="ollama",
            endpoint="http://localhost:11434",
            models=[_at("local", "disabled")],
        )


@pytest.mark.parametrize(
    ("provider", "effort"),
    [
        ("mistral", "disabled"),
        ("mistral", "low"),
        # Gemini 3.7 Flash accepts no off switch; `low` is its floor, a weaker claim.
        ("gemini", "disabled"),
        # Documented by DeepSeek and not the lever — 7% on V4 Pro — so not offered.
        ("deepseek", "low"),
    ],
)
def test_a_provider_is_never_asked_for_a_setting_it_does_not_offer(
    provider: str, effort: str
) -> None:
    with pytest.raises(ValueError, match="does not offer"):
        Cohort(
            runner="hosted",
            provider=provider,  # type: ignore[arg-type]
            api_key_env="KEY",
            endpoint="https://x",
            models=[_at(provider, effort)],
        )


def test_every_offered_setting_has_a_wire_format_and_nothing_else_does() -> None:
    """Config validates against `REASONING_CONTROLS` and the runner sends from its
    dialect table. If they disagree, a setting either passes validation and is then
    dropped, or has a wire format that config never lets anyone use."""
    from hip.config import REASONING_CONTROLS
    from hip.eval.runners.hosted import _DIALECTS

    assert set(_DIALECTS) == set(REASONING_CONTROLS)
    for provider, offered in REASONING_CONTROLS.items():
        assert set(_DIALECTS[provider].reasoning) == offered - {"default"}, provider


def test_a_runner_refuses_a_setting_rather_than_sending_without_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unreachable through config. A runner handed an unvalidated candidate must not send
    the request without the control and record the answer as though it had."""
    from hip.eval.runners import RunnerUnavailable

    monkeypatch.setenv("MISTRAL_API_KEY", "m-test")
    runner = build_runner(_cohort("mistral", "https://x/v1"), "mistral")
    assert isinstance(runner, HostedRunner)

    def never(request: httpx.Request) -> httpx.Response:
        raise AssertionError("a request went out without its reasoning control")

    with pytest.raises(RunnerUnavailable, match="offers no reasoning_effort"):
        _generate_as(runner, _at("mistral", "disabled"), never, monkeypatch)


def test_the_probe_sends_the_configured_setting(monkeypatch: pytest.MonkeyPatch) -> None:
    """So a provider that refuses a setting fails `hip eval models --probe`, rather than
    fifteen generations into a run."""
    sent: list[dict[str, Any]] = []
    runner = _deepseek(monkeypatch)
    handler = _recording(_openai_body("pinned-model-0731"), sent)
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:  # type: ignore[arg-type]
        monkeypatch.setattr(httpx, "post", client.post)
        assert runner.probe(_at("deepseek", "disabled")) is None
    assert sent[-1]["thinking"] == {"type": "disabled"}


def test_two_ids_for_one_configuration_are_a_config_problem() -> None:
    """The realistic mistake: a variant copied from its base and left at the base's
    effort, so one configuration is measured twice under two names."""
    from hip.config import evaluation_problems

    base = _evaluation(["deepseek-test", "gemma-4-e4b-q4"])
    deepseek = base.cohorts["deepseek"]

    def with_extra(candidate: CandidateModel) -> EvaluationConfig:
        extended = deepseek.model_copy(update={"models": [*deepseek.models, candidate]})
        return base.model_copy(update={"cohorts": {**base.cohorts, "deepseek": extended}})

    twin = deepseek.models[0].model_copy(update={"id": "deepseek-test-copy"})
    problems = evaluation_problems(with_extra(twin))
    assert any("one configuration" in problem for problem in problems)

    variant = twin.model_copy(update={"reasoning_effort": "disabled"})
    problems = evaluation_problems(with_extra(variant))
    assert not any("one configuration" in problem for problem in problems)


def test_the_repo_config_adds_variants_without_touching_a_benchmarked_candidate() -> None:
    evaluation = load_evaluation(CONFIG_DIR)
    deepseek = evaluation.model("deepseek-flash-nothink")
    gemini = evaluation.model("gemini-3.7-flash-low")
    assert (deepseek.ref, deepseek.reasoning_effort) == ("deepseek-flash", "disabled")
    assert (gemini.ref, gemini.reasoning_effort) == ("gemini-3.7-flash", "low")
    # The same call as the base model, so the same rates.
    for variant, base_id in ((deepseek, "deepseek-flash"), (gemini, "gemini-3.7-flash")):
        base = evaluation.model(base_id)
        assert variant.input_usd_per_mtok == base.input_usd_per_mtok
        assert variant.output_usd_per_mtok == base.output_usd_per_mtok
    # Unbenchmarked, so neither may write yet.
    assert not {deepseek.id, gemini.id} & set(evaluation.generation.preference)
    # Everything `v2` measured is still configured the way it was measured. An in-place
    # edit here would publish prose from a setting nobody benchmarked.
    measured_in_v2 = {
        "deepseek-v4-flash",
        "deepseek-v4-pro",
        "gemini-3.1-flash-lite",
        "gemini-3.7-flash",
        "mistral-small-4",
        "mistral-large-3",
        "gemma-4-e4b-q4",
    }
    assert {evaluation.model(m).reasoning_effort for m in measured_in_v2} == {"default"}


def _serial(evaluation: EvaluationConfig) -> EvaluationConfig:
    return evaluation.model_copy(
        update={
            "generation": GenerationConfig(
                preference=list(evaluation.generation.preference), max_concurrency=1
            )
        }
    )


def test_resuming_a_candidate_under_a_changed_effort_is_refused(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A resume would append answers made under the new setting to answers made under
    the old one, and the report would average two configurations under one id."""
    from hip.eval.runner import ConfigurationChanged, run_evaluation
    from hip.eval.store import GENERATIONS, append_record, run_dir

    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setattr("hip.eval.store.get_settings", lambda: _settings_at(tmp_path))
    scenarios = [_scenario_n(i) for i in range(3)]
    append_record(
        run_dir("vresume") / GENERATIONS,
        _priced_generation_for(scenarios[0], "deepseek-test", "hosted"),
    )
    changed = _with_effort(_concurrent_evaluation(), "deepseek-test", "disabled")
    calls: list[int] = []
    monkeypatch.setattr(
        HostedRunner,
        "generate",
        lambda *a, **k: calls.append(1),  # type: ignore[arg-type,return-value]
    )

    with pytest.raises(ConfigurationChanged, match="--restart"):
        run_evaluation(changed, scenarios, "vresume")
    assert calls == [], "a generation was submitted before the refusal"


def test_a_restart_runs_the_changed_configuration_and_records_it(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from hip.eval.runner import run_evaluation
    from hip.eval.store import GENERATIONS, append_record, run_dir

    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setattr("hip.eval.store.get_settings", lambda: _settings_at(tmp_path))
    scenarios = [_scenario_n(i) for i in range(3)]
    append_record(
        run_dir("vrestart") / GENERATIONS,
        _priced_generation_for(scenarios[0], "deepseek-test", "hosted"),
    )
    changed = _serial(_with_effort(_concurrent_evaluation(), "deepseek-test", "disabled"))
    handler = _answering(_openai_body("pinned-model-0731"))
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:  # type: ignore[arg-type]
        monkeypatch.setattr(httpx, "post", client.post)
        produced = run_evaluation(changed, scenarios, "vrestart", resume=False)

    assert len(produced) == 3
    assert {generation.reasoning_effort for generation in produced} == {"disabled"}


def test_resolve_skips_a_model_configured_at_an_effort_its_benchmark_did_not_measure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The back door the field would otherwise open: flip the effort on a listed model
    and its id stays eligible while its configuration is new."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.setenv("GEMINI_API_KEY", "goog-test")

    def measured_at_default(
        evaluation: EvaluationConfig, run: str
    ) -> dict[str, ModelSummary]:
        summaries = _all_pass(evaluation, run)
        for summary in summaries.values():
            summary.reasoning_efforts.add("default")
        return summaries

    monkeypatch.setattr("hip.eval.selection.benchmarked", measured_at_default)
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: "v2")
    evaluation = _with_effort(
        _evaluation(["deepseek-test", "gemini-test", "gemma-4-e4b-q4"]),
        "deepseek-test",
        "disabled",
    )

    resolution = resolve(evaluation)
    assert resolution.model_id == "gemini-test"
    passed_over, why = resolution.skipped[0]
    assert passed_over == "deepseek-test"
    assert "measured at reasoning effort default" in why
    assert "configured as 'disabled'" in why


def test_explicit_models_skip_a_configuration_the_latest_run_did_not_measure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`--all` and `--model` bypass `resolve`, and `--all` is the path the regeneration
    after `v3` takes, so the same check has to hold there."""
    from hip.eval_cli import _unusable

    monkeypatch.setattr("hip.eval.selection.benchmarked", _all_pass_at_default)
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: "v2")
    monkeypatch.setattr(HostedRunner, "probe", lambda self, model: None)
    evaluation = _with_effort(
        _evaluation(["gemini-test", "gemma-4-e4b-q4"]), "gemini-test", "low"
    )

    unusable = _unusable(evaluation, ["gemini-test", "gemma-4-e4b-q4"])
    assert list(unusable) == ["gemini-test"]
    assert "configured as 'low'" in unusable["gemini-test"]


def test_every_table_states_the_effort_behind_its_figures() -> None:
    evaluation = _evaluation(["deepseek-test", "gemini-test"])
    generations = [
        _priced_generation("deepseek-test", "deepseek", prompt=100, output=40),
        _priced_generation("gemini-test", "gemini", prompt=100, output=40).model_copy(
            update={"reasoning_effort": "low"}
        ),
    ]
    judgments = [_judged(g, 3.0, evaluation) for g in generations]
    text = render_report(evaluation, [_scenario()], generations, [], judgments, run="t")

    # Deterministic checks, rubric scores, cost and efficiency, quality per dollar.
    assert text.count("| Effort |") == 4
    assert "| low |" in text
    assert "reasoning effort `" in text  # the selected-model line
    assert "Reasoning effort is part of each candidate's configuration" in text


def test_a_run_at_provider_defaults_says_so_from_its_own_numbers() -> None:
    """Derived from the run rather than written into the renderer, which until Milestone
    20 printed `v2`'s shares and a V4 Pro measurement into every report."""
    evaluation = _evaluation(["deepseek-test", "gemini-test"])
    generations = [
        _priced_generation("deepseek-test", "deepseek", prompt=100, output=40),
        _priced_generation("gemini-test", "gemini", prompt=100, output=40),
    ]
    judgments = [_judged(g, 3.0, evaluation) for g in generations]
    text = render_report(evaluation, [_scenario()], generations, [], judgments, run="t")

    assert "Every candidate here ran at its provider's default reasoning effort" in text
    assert "deepseek-v4-pro" not in text


def test_a_disabled_answer_that_still_reasoned_is_flagged_and_low_is_not() -> None:
    """`disabled` claims none, so it is checked against the count. `low` claims only a
    level, so reasoning under it is the setting working as documented."""
    evaluation = _evaluation(["deepseek-test", "gemini-test"])

    def reasoned(model_id: str, cohort: str, effort: str) -> Generation:
        generation = _priced_generation(model_id, cohort, prompt=100, output=40)
        telemetry = generation.telemetry.model_copy(update={"reasoning_tokens": 30})
        return generation.model_copy(
            update={"reasoning_effort": effort, "telemetry": telemetry}
        )

    generations = [
        reasoned("deepseek-test", "deepseek", "disabled"),
        reasoned("gemini-test", "gemini", "low"),
    ]
    text = render_report(evaluation, [_scenario()], generations, [], [], run="t")

    assert "**deepseek test reasoned despite `disabled`**" in text
    assert "gemini test reasoned" not in text


def test_a_model_sent_two_efforts_under_one_id_cannot_be_selected() -> None:
    evaluation = _evaluation(["gemini-test"])
    first = _priced_generation("gemini-test", "gemini", prompt=1, output=1)
    second = first.model_copy(
        update={
            "scenario_key": "caveats:11:markdown",
            "scenario_id": "caveats",
            "reasoning_effort": "low",
        }
    )
    judgments = [_judged(g, 4.0, evaluation) for g in (first, second)]
    summaries = summarize(evaluation, [first, second], [], judgments)

    assert summaries["gemini-test"].reasoning_efforts == {"default", "low"}
    assert passed_benchmark(summaries["gemini-test"]) is False
    assert select_winner(summaries) is None
    text = render_report(
        evaluation, [_scenario()], [first, second], [], judgments, run="t"
    )
    assert "more than one reasoning effort" in text


# --- the judge's configuration (pre-v3, ARCHITECTURE #101) --------------------------


def _verdict_json(evaluation: EvaluationConfig) -> str:
    return json.dumps(
        {
            "scores": {
                criterion.id: {"score": 3, "justification": "grounded"}
                for criterion in evaluation.rubric.criteria
            },
            "hallucinations": [],
            "summary": "fine",
        }
    )


class _Batches:
    def __init__(self, results: list[object]) -> None:
        self._results = results

    def results(self, batch_id: str) -> list[object]:
        return self._results


class _Client:
    """The one corner of the Anthropic client that `collect_batch` reads."""

    def __init__(self, results: list[object]) -> None:
        self.messages = SimpleNamespace(batches=_Batches(results))


def _succeeded(custom_id: str, text: str, *, tokens_in: int, tokens_out: int) -> object:
    message = SimpleNamespace(
        stop_reason="end_turn",
        content=[SimpleNamespace(type="text", text=text)],
        usage=SimpleNamespace(input_tokens=tokens_in, output_tokens=tokens_out),
    )
    return SimpleNamespace(
        custom_id=custom_id, result=SimpleNamespace(type="succeeded", message=message)
    )


def test_the_judge_grades_at_high_with_room_to_finish() -> None:
    """At `high` the verdict shares `max_tokens` with the thinking before it, so a cap
    sized for `medium` would cut paid-for verdicts off mid-JSON."""
    from hip.eval.judge import assumed_output_tokens

    evaluation = load_evaluation(CONFIG_DIR)
    assert evaluation.judge.effort == "high"
    assert evaluation.judge.max_tokens >= 2 * assumed_output_tokens(evaluation)


def test_judging_is_quoted_at_the_configured_effort() -> None:
    from hip.eval.judge import assumed_output_tokens, measured_cost

    evaluation = load_evaluation(CONFIG_DIR)
    generation, scenario = _judgeable(payload="x " * 2000)
    scenarios = {scenario.key: scenario}

    high, _ = measured_cost([generation] * 105, scenarios, evaluation)
    at_medium = evaluation.model_copy(
        update={"judge": evaluation.judge.model_copy(update={"effort": "medium"})}
    )
    medium, _ = measured_cost([generation] * 105, scenarios, at_medium)
    assert high > medium

    # The assumption never exceeds what the cap would let the judge emit.
    capped = evaluation.model_copy(
        update={"judge": evaluation.judge.model_copy(update={"max_tokens": 1024})}
    )
    assert assumed_output_tokens(capped) == 1024


def test_a_verdict_records_its_judge_effort_and_billed_tokens() -> None:
    from hip.eval.judge import collect_batch

    evaluation = load_evaluation(CONFIG_DIR)
    generation = _priced_generation("gemini-3.7-flash", "gemini", prompt=10, output=5)
    verdict = _verdict_json(evaluation)
    client = _Client([_succeeded("g0", verdict, tokens_in=7200, tokens_out=4100)])

    [judgment] = collect_batch("batch", {"g0": generation}, evaluation, client=client)
    assert judgment.error is None
    assert judgment.judge_effort == "high"
    assert (judgment.input_tokens, judgment.output_tokens) == (7200, 4100)


def test_a_verdict_cut_off_mid_json_keeps_its_billed_tokens() -> None:
    """Truncated by `max_tokens`, it is a failed judgment — and it was still paid for."""
    from hip.eval.judge import collect_batch

    evaluation = load_evaluation(CONFIG_DIR)
    generation = _priced_generation("gemini-3.7-flash", "gemini", prompt=10, output=5)
    cut_off = '{"scores": {"factual_ac'
    client = _Client([_succeeded("g0", cut_off, tokens_in=7200, tokens_out=16000)])

    [judgment] = collect_batch("batch", {"g0": generation}, evaluation, client=client)
    assert judgment.error is not None
    assert judgment.output_tokens == 16000


def test_verdicts_from_before_the_fields_still_parse() -> None:
    """Every `v1` and `v2` verdict predates them; both runs were graded at `medium`."""
    old = Judgment.model_validate(
        {
            "generation_key": "k",
            "model_id": "m",
            "scenario_id": "s",
            "scores": {},
            "summary": "",
            "judge_model": "claude-opus-5",
        }
    )
    assert (old.judge_effort, old.input_tokens, old.output_tokens) == (None, None, None)


def test_recorded_cost_prices_what_the_verdicts_were_billed() -> None:
    from hip.eval.judge import recorded_cost

    evaluation = load_evaluation(CONFIG_DIR)  # batch: half of $5 in and $25 out per Mtok
    billed = Judgment(
        generation_key="k",
        model_id="m",
        scenario_id="s",
        scores={},
        summary="",
        input_tokens=1_000_000,
        output_tokens=1_000_000,
    )
    assert recorded_cost([billed], evaluation) == (15.0, 1_000_000, 1_000_000)
    unrecorded = billed.model_copy(update={"input_tokens": None, "output_tokens": None})
    assert recorded_cost([unrecorded], evaluation) is None


def test_the_report_names_the_judge_as_its_verdicts_record_it() -> None:
    """Re-rendering after the judge changes must not re-attribute old scores to it."""
    evaluation = _evaluation(["gemini-test"])
    generation = _priced_generation("gemini-test", "gemini", prompt=1, output=1)
    judged = _judged(generation, 3.0, evaluation).model_copy(
        update={"judge_model": "claude-opus-5", "judge_effort": "high"}
    )
    text = render_report(evaluation, [_scenario()], [generation], [], [judged], run="t")
    assert "Graded by `claude-opus-5` at effort `high` against" in text

    unrecorded = judged.model_copy(update={"judge_effort": None})
    text = render_report(
        evaluation, [_scenario()], [generation], [], [unrecorded], run="t"
    )
    assert "Graded by `claude-opus-5` against" in text


# --- Guards before `v3`, 2026-09-11 ------------------------------------------------


def _run_on_disk(
    name: str, *, generations: int = 0, judged: bool = False, written_at: int = 0
) -> None:
    """A run directory with a scenario set and as much of a run as asked for."""
    from hip.eval.store import (
        GENERATIONS,
        JUDGMENTS,
        SCENARIOS,
        append_record,
        run_dir,
        write_records,
    )

    write_records(run_dir(name) / SCENARIOS, [_scenario()])
    generation = _priced_generation("gemini-test", "gemini", prompt=1, output=1)
    for _ in range(generations):
        append_record(run_dir(name) / GENERATIONS, generation)
    if judged:
        verdict = _judged(generation, 3.0, _evaluation(["gemini-test"]))
        append_record(run_dir(name) / JUDGMENTS, verdict)
    if written_at:
        os.utime(run_dir(name), (written_at, written_at))


def test_a_scenario_set_is_frozen_once_anything_is_generated_against_it(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Rebuilding it would leave recorded answers graded against packets they were never
    shown — and until 2026-09-10 a bare `hip eval scenarios` did that to `v1`."""
    from hip.eval.store import scenario_set_problem

    monkeypatch.setattr("hip.eval.store.get_settings", lambda: _settings_at(tmp_path))
    _run_on_disk("v1", generations=2)

    for replace in (False, True):
        problem = scenario_set_problem("v1", replace=replace)
        assert problem is not None
        assert "2 generations" in problem
        assert "frozen" in problem


def test_a_draft_scenario_set_is_rebuilt_only_when_asked(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from hip.eval.store import scenario_set_problem

    monkeypatch.setattr("hip.eval.store.get_settings", lambda: _settings_at(tmp_path))
    assert scenario_set_problem("v3", replace=False) is None, "a new run"
    _run_on_disk("v3")

    problem = scenario_set_problem("v3", replace=False)
    assert problem is not None
    assert "--replace" in problem
    assert scenario_set_problem("v3", replace=True) is None


def test_every_eval_command_that_touches_a_run_names_it() -> None:
    """Each defaulted to `v1`, the oldest frozen run, until 2026-09-10."""
    from typer.testing import CliRunner

    from hip.cli import app

    for command in ("scenarios", "run", "check", "judge", "report", "show", "cost"):
        result = CliRunner().invoke(app, ["eval", command])
        assert result.exit_code == 2, command
        assert "--run" in result.output, command


def test_the_benchmark_gives_models_the_payload_hip_explain_sends() -> None:
    """`v2` measured prose from JSON packets the site never sends: its scenarios were
    built on this command's old default, JSON, with no `--format` (#103)."""
    import inspect

    from hip.cli import explain
    from hip.eval.explain import explain_region
    from hip.eval.scenarios import build_scenarios
    from hip.eval_cli import scenarios_command

    def default(function: Any) -> Any:
        return inspect.signature(function).parameters["payload_format"].default

    assert default(explain) == default(explain_region) == "markdown"
    assert default(scenarios_command) == default(build_scenarios) == "markdown"


def test_a_run_still_in_progress_does_not_become_the_latest(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A run exists from its first file, and nothing in it can pass until it is judged.
    As the latest it would make every model ineligible while `v3` generates and waits
    on its batch — `hip explain` stopped for exactly as long as the benchmark ran."""
    from hip.eval.selection import latest_run
    from hip.eval.store import JUDGMENTS, append_record, run_dir

    monkeypatch.setattr("hip.eval.store.get_settings", lambda: _settings_at(tmp_path))
    _run_on_disk("v2", generations=1, judged=True, written_at=1_700_000_000)
    _run_on_disk("v3", generations=1, written_at=1_700_000_100)
    assert latest_run() == "v2"

    generation = _priced_generation("gemini-test", "gemini", prompt=1, output=1)
    verdict = _judged(generation, 3.0, _evaluation(["gemini-test"]))
    append_record(run_dir("v3") / JUDGMENTS, verdict)
    assert latest_run() == "v3"


def test_explicit_models_skip_one_the_latest_run_did_not_pass(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The gap Milestone 20 left open: `--all` and `--model` checked a model's
    configuration but never its benchmark, so an unmeasured model published through
    them while the preference list refused it."""
    from hip.eval_cli import _unusable

    def only_gemma(evaluation: EvaluationConfig, run: str) -> dict[str, ModelSummary]:
        return {"gemma-4-e4b-q4": _summary("gemma-4-e4b-q4", generations=15, errors=0)}

    monkeypatch.setattr("hip.eval.selection.benchmarked", only_gemma)
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: "v3")
    probed: list[str] = []

    def probe(self: HostedRunner, model: CandidateModel) -> str | None:
        probed.append(model.id)
        return None

    monkeypatch.setattr(HostedRunner, "probe", probe)
    evaluation = _evaluation(["gemini-test", "gemma-4-e4b-q4"])
    requested = ["gemini-test", "gemma-4-e4b-q4"]

    assert _unusable(evaluation, requested) == {
        "gemini-test": "has not passed the benchmark in run 'v3'"
    }
    assert probed == [], "a model the gate refuses is not worth a paid probe"
    # `--unbenchmarked` lifts the gate and nothing else: the probe still runs.
    assert _unusable(evaluation, requested, require_benchmark=False) == {}
    assert probed == ["gemini-test"]


def test_with_no_judged_run_no_explicit_model_may_publish(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from hip.eval_cli import _unusable

    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: None)
    unusable = _unusable(_evaluation(["gemma-4-e4b-q4"]), ["gemma-4-e4b-q4"])
    assert "no evaluation run has been judged" in unusable["gemma-4-e4b-q4"]


def test_the_exit_status_tells_a_scheduler_partial_from_clean() -> None:
    from hip.eval_cli import PARTIAL, _exit_code, _Outcome

    clean = {"a": _Outcome(written=20, current=1), "b": _Outcome(current=21)}
    assert _exit_code(clean) == 0
    assert _exit_code({"a": _Outcome(written=21), "b": _Outcome(skipped="routed")}) == (
        PARTIAL
    )
    assert _exit_code({"a": _Outcome(written=20, failed=1)}) == PARTIAL
    assert _exit_code({"a": _Outcome(skipped="routed"), "b": _Outcome(failed=21)}) == 1
    assert PARTIAL not in (0, 1, 2), "2 is Click's usage error"


def test_a_missing_runtime_skips_its_model_and_the_rest_still_run(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """A `RunnerUnavailable` ended the whole command until 2026-09-11, taking every model
    after the one that raised it with it."""
    from hip.eval.runners import RunnerUnavailable
    from hip.eval_cli import PARTIAL, _explain_each, _Outcome, _summarize

    def explain_region(
        session: Any, evaluation: Any, region_id: int, model_id: str, **_: Any
    ) -> Any:
        if model_id == "gemma-4-e4b-q4":
            raise RunnerUnavailable("mlx-lm is not installed")
        if region_id == 2:
            raise RuntimeError("empty answer")
        return SimpleNamespace(model_id=model_id, region_id=region_id, body="Rose.\n")

    monkeypatch.setattr("hip.eval.explain.explain_region", explain_region)
    monkeypatch.setattr("hip.eval_cli._is_fresh", lambda *args: False)
    outcomes = {
        "gemma-4-e4b-q4": _Outcome(),
        "gemini-test": _Outcome(),
        "deepseek-test": _Outcome(skipped="routed to deepseek-flash"),
    }

    _explain_each(
        SimpleNamespace(commit=lambda: None),  # type: ignore[arg-type]
        _evaluation(["gemini-test"]),
        outcomes,
        [1, 2, 3],
        window="5y",
        payload_format="markdown",
        force=False,
    )

    assert outcomes["gemma-4-e4b-q4"].skipped == "mlx-lm is not installed"
    assert (outcomes["gemini-test"].written, outcomes["gemini-test"].failed) == (2, 1)
    assert _summarize(outcomes) == PARTIAL
    printed = capsys.readouterr().out
    assert "skipped: mlx-lm is not installed" in printed
    assert "skipped: routed to deepseek-flash" in printed
    assert printed.rstrip().endswith(
        "2 explanations written, 1 failed, 2 of 3 model(s) skipped — partial"
    )


def test_all_with_no_usable_model_exits_1_without_touching_the_warehouse(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import typer

    from hip.eval_cli import explain_command

    def forbidden() -> None:
        raise AssertionError("opened the warehouse with nothing to generate")

    evaluation = _evaluation(["gemini-test", "gemma-4-e4b-q4"])
    monkeypatch.setattr("hip.eval_cli.load_evaluation", lambda: evaluation)
    monkeypatch.setattr("hip.eval_cli.get_engine", forbidden)
    monkeypatch.setattr("hip.eval.selection.latest_run", lambda: None)

    with pytest.raises(typer.Exit) as exited:
        explain_command(None, None, "5y", "county", "markdown", None, all_models=True)
    assert exited.value.exit_code == 1


def _with_candidate(
    evaluation: EvaluationConfig, cohort: str, candidate: CandidateModel
) -> EvaluationConfig:
    cohorts = dict(evaluation.cohorts)
    cohorts[cohort] = cohorts[cohort].model_copy(
        update={"models": [*cohorts[cohort].models, candidate]}
    )
    return evaluation.model_copy(update={"cohorts": cohorts})


def test_the_report_says_when_deepseek_ignored_the_pinned_temperature() -> None:
    """DeepSeek ignores temperature while its models reason, so `v3`'s two DeepSeek rows
    differ in sampling as well as in reasoning — which no table can show (#104)."""
    nothink = CandidateModel(
        id="deepseek-nothink",
        ref="pinned-model-0731",
        label="deepseek nothink",
        quantization="hosted",
        reasoning_effort="disabled",
        input_usd_per_mtok=0.25,
        output_usd_per_mtok=1.5,
    )
    evaluation = _with_candidate(_evaluation(["deepseek-test"]), "deepseek", nothink)
    thinking = _priced_generation("deepseek-test", "deepseek", prompt=100, output=40)
    thinking = thinking.model_copy(
        update={
            "telemetry": thinking.telemetry.model_copy(update={"reasoning_tokens": 30})
        }
    )
    silent = _priced_generation("deepseek-nothink", "deepseek", prompt=100, output=40)
    silent = silent.model_copy(update={"reasoning_effort": "disabled"})

    text = render_report(evaluation, [_scenario()], [thinking, silent], [], [], run="t")
    assert "**Every candidate was sent temperature 0.0**" in text
    assert "so **deepseek test** was sampled at DeepSeek's own setting" in text
    assert "Set beside **deepseek nothink**, which did not reason" in text


def test_the_report_says_gemini_3_ran_below_googles_recommended_temperature() -> None:
    evaluation = _evaluation(["gemini-test"])
    gemini = evaluation.cohorts["gemini"]
    gemini_3 = gemini.models[0].model_copy(update={"ref": "gemini-3.7-flash"})
    evaluation = evaluation.model_copy(
        update={
            "cohorts": {
                **evaluation.cohorts,
                "gemini": gemini.model_copy(update={"models": [gemini_3]}),
            }
        }
    )
    generation = _priced_generation("gemini-test", "gemini", prompt=1, output=1)

    text = render_report(evaluation, [_scenario()], [generation], [], [], run="t")
    assert "Google recommends temperature 1.0 for Gemini 3" in text
    assert "**gemini test** was held to the same setting regardless" in text


def test_a_run_the_pinned_temperature_fully_controls_carries_no_sampling_note() -> None:
    """`v1` — local models only — renders as it did before the note existed."""
    evaluation = _evaluation(["gemma-4-e4b-q4"])
    generation = _priced_generation("gemma-4-e4b-q4", "gguf", prompt=1, output=1)
    text = render_report(evaluation, [_scenario()], [generation], [], [], run="t")
    assert "temperature" not in text


# --- Qwen, the fourth hosted provider, 2026-09-11 ----------------------------------


def _qwen(monkeypatch: pytest.MonkeyPatch) -> HostedRunner:
    monkeypatch.setenv("QWEN_API_KEY", "sk-ws-test")
    runner = build_runner(_cohort("qwen", "https://x/compatible-mode/v1"), "qwen")
    assert isinstance(runner, HostedRunner)
    return runner


def test_qwen_disabled_is_sent_as_enable_thinking_false_and_default_sends_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Qwen 3.5-3.8 think by default. The off switch is a top-level field over plain
    HTTP — `extra_body` is only how the OpenAI SDK spells it."""
    sent: list[dict[str, Any]] = []
    runner = _qwen(monkeypatch)
    answer = _recording(_openai_body("pinned-model-0731"), sent)

    _generate_as(runner, _at("qwen", "disabled"), answer, monkeypatch)
    assert sent[-1]["enable_thinking"] is False

    _generate_as(runner, _at("qwen", "default"), answer, monkeypatch)
    assert "enable_thinking" not in sent[-1]


def test_a_qwen_thinking_answer_is_split_and_counted_as_the_provider_bills_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The shape `qwen3.7-flash-2026-07-15` returned on 2026-09-11: thinking under
    `reasoning_content`, counted inside `completion_tokens`, like DeepSeek's."""
    body = {
        "model": "pinned-model-0731",
        "choices": [
            {
                "message": {
                    "content": "Housing is becoming less affordable.",
                    "reasoning_content": "The packet shows three ratios...",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 2821,
            "completion_tokens": 2497,
            "completion_tokens_details": {"reasoning_tokens": 2268},
        },
    }
    generation = _generate_as(
        _qwen(monkeypatch), _at("qwen", "default"), _answering(body), monkeypatch
    )

    assert generation.error is None
    assert generation.answer == "Housing is becoming less affordable."
    assert generation.reasoning == "The packet shows three ratios..."
    assert generation.telemetry.generation_tokens == 2497
    assert generation.telemetry.reasoning_tokens == 2268
    assert generation.telemetry.served_model == "pinned-model-0731"


def test_the_qwen_candidates_are_pinned_snapshots_at_both_efforts() -> None:
    """Pinning is what Qwen offers DeepSeek's slot: a dated snapshot, where DeepSeek
    serves only aliases it repoints."""
    import re

    evaluation = load_evaluation(CONFIG_DIR)
    qwen = evaluation.cohorts["qwen"]
    assert qwen.endpoint is not None
    # A key is bound to its region, and only Singapore has the free quota.
    assert qwen.endpoint.startswith("https://dashscope-intl.aliyuncs.com/")
    for model in qwen.models:
        assert re.search(r"-\d{4}-\d{2}-\d{2}$", model.ref), model.id
    efforts: dict[str, set[str]] = {}
    for model in qwen.models:
        efforts.setdefault(model.ref, set()).add(model.reasoning_effort)
    assert list(efforts.values()) == [{"default", "disabled"}] * 2


def test_the_report_holds_qwen_to_the_temperature_its_cards_give_for_each_mode() -> None:
    """Qwen recommends 1.0 when thinking and 0.7 when not, so at the stability mode's 0.7
    only the candidate that reasoned sits below its recommendation (#104, #105)."""
    evaluation = load_evaluation(CONFIG_DIR)
    thinking = _priced_generation("qwen3.7-flash", "qwen", prompt=100, output=40)
    thinking = thinking.model_copy(
        update={
            "mode": "stability",
            "telemetry": thinking.telemetry.model_copy(update={"reasoning_tokens": 30}),
        }
    )
    direct = _priced_generation("qwen3.7-flash-nothink", "qwen", prompt=100, output=40)
    direct = direct.model_copy(
        update={"mode": "stability", "reasoning_effort": "disabled"}
    )

    text = render_report(evaluation, [_scenario()], [thinking, direct], [], [], run="t")
    assert "**Every candidate was sent temperature 0.7**" in text
    assert (
        "it publishes none for 3.7; **Qwen3.7 Flash** was held to the same setting "
        "regardless." in text
    )

    greedy = [g.model_copy(update={"mode": "deterministic"}) for g in (thinking, direct)]
    text = render_report(evaluation, [_scenario()], greedy, [], [], run="t")
    assert (
        "**Qwen3.7 Flash** and **Qwen3.7 Flash (thinking off)** were held to the same "
        "setting regardless." in text
    )
