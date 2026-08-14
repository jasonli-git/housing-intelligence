"""The GGUF cohort, served by Ollama's HTTP API.

`/api/generate` with `"stream": false` because the response carries the telemetry the
evaluation needs — `prompt_eval_count`, `eval_count`, `eval_duration`, `load_duration`,
`total_duration` — in one object. Streaming would give a time-to-first-token but would
mean reassembling the counts from the final chunk for no gain: Ollama's `load_duration`
already separates model loading from generation, which is the number that would
otherwise contaminate throughput.

Every sampling parameter is sent explicitly. Ollama ships no baked parameters for these
imports, so an omitted field silently becomes its own default (temp 0.8, top_p 0.9,
top_k 40, repeat_penalty 1.1) and the GGUF cohort would be sampled stochastically while
MLX ran greedily.
"""

from __future__ import annotations

import logging
import time

import httpx

from hip.config import CandidateModel, EvalLimits, SamplingParams
from hip.eval.normalize import split_reasoning
from hip.eval.runners.base import RunnerUnavailable
from hip.eval.types import Generation, Scenario, Telemetry

log = logging.getLogger(__name__)

# Local inference on a 12B model with a 6,000-token packet is slow but not unbounded.
# Generous enough that a legitimately slow generation completes, short enough that a
# wedged runtime does not hang an overnight run.
_TIMEOUT = httpx.Timeout(600.0, connect=5.0)

_NS_PER_MS = 1_000_000


class OllamaRunner:
    """Implements `ModelRunner` over a local Ollama server."""

    def __init__(self, endpoint: str = "http://localhost:11434") -> None:
        self._endpoint = endpoint.rstrip("/")

    def available(self) -> bool:
        try:
            response = httpx.get(f"{self._endpoint}/api/tags", timeout=3.0)
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    def installed_models(self) -> set[str]:
        """Model names Ollama can serve, without the `:latest` suffix it appends."""
        try:
            response = httpx.get(f"{self._endpoint}/api/tags", timeout=5.0)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RunnerUnavailable(
                f"Ollama is not reachable at {self._endpoint} ({exc}). "
                f"Start it with `ollama serve`."
            ) from exc
        return {
            str(model["name"]).split(":")[0]
            for model in response.json().get("models", [])
        }

    def generate(
        self,
        model: CandidateModel,
        scenario: Scenario,
        prompt: str,
        sampling: SamplingParams,
        limits: EvalLimits,
        mode: str,
        repeat: int,
        seed: int | None,
    ) -> Generation:
        options: dict[str, object] = {
            "temperature": sampling.temperature,
            "top_p": sampling.top_p,
            "top_k": sampling.top_k,
            "repeat_penalty": sampling.repeat_penalty,
            "num_ctx": limits.context_tokens,
            "num_predict": limits.max_output_tokens,
        }
        if seed is not None:
            options["seed"] = seed

        body = {
            "model": model.ref,
            # `/api/chat` rather than `/api/generate`. The imports here were created with
            # a bare `FROM`, which leaves Ollama with `TEMPLATE {{ .Prompt }}` — a raw
            # passthrough. For most models the architecture's own RENDERER still applies
            # and both endpoints return byte-identical output (verified 2026-08-13 on
            # gemma-4-E4B). For a *thinking* model it does not: gemma-4-12B returned an
            # empty string from `/api/generate` for every prompt, including "Reply with
            # exactly: OK", while burning the whole token budget — its output goes to the
            # reasoning channel that the raw path never populates. Sending messages makes
            # each model's own instruct formatting apply, which is also what the MLX
            # runner now does with `apply_chat_template`, so both cohorts are symmetric.
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": options,
            # Unload as soon as the answer is returned. Two of these resident at once
            # does not fit in 16GB, and the next model would start by swapping.
            "keep_alive": limits.keep_alive,
        }

        started = time.perf_counter()
        try:
            response = httpx.post(
                f"{self._endpoint}/api/chat", json=body, timeout=_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as exc:
            log.warning("ollama generation failed for %s: %s", model.id, exc)
            return self._failed(model, scenario, mode, repeat, str(exc), started)

        message = data.get("message") or {}
        raw = str(message.get("content", ""))
        answer, reasoning, truncated = split_reasoning(raw, message.get("thinking"))

        eval_ns = int(data.get("eval_duration") or 0)
        eval_count = int(data.get("eval_count") or 0)
        prompt_ns = int(data.get("prompt_eval_duration") or 0)
        load_ns = int(data.get("load_duration") or 0)

        telemetry = Telemetry(
            prompt_tokens=int(data.get("prompt_eval_count") or 0),
            generation_tokens=eval_count,
            # Ollama's eval_count covers reasoning and answer together, so reasoning is
            # counted from the split text rather than reported by the runtime.
            reasoning_tokens=len(reasoning) // 4 if reasoning else 0,
            # Prompt evaluation ends where generation begins, so the first token lands
            # after load plus prompt processing. Not a measured first-yield timestamp
            # the way MLX reports one, but the same quantity.
            ttft_ms=(load_ns + prompt_ns) / _NS_PER_MS if prompt_ns else None,
            generation_ms=eval_ns / _NS_PER_MS,
            total_ms=int(data.get("total_duration") or 0) / _NS_PER_MS,
            load_ms=load_ns / _NS_PER_MS if load_ns else None,
            tokens_per_second=(eval_count / (eval_ns / 1e9)) if eval_ns else None,
            # Ollama reports no memory figure at all. Left null rather than filled with
            # a process-RSS reading taken from outside, which would not be comparable
            # to MLX's allocator peak even though it would look like it was.
            peak_memory_mb=None,
            memory_basis=None,
            finish_reason=str(data.get("done_reason") or ""),
        )
        return Generation(
            scenario_key=scenario.key,
            scenario_id=scenario.scenario_id,
            region_id=scenario.region_id,
            model_id=model.id,
            cohort="gguf",
            mode=mode,  # type: ignore[arg-type]
            repeat=repeat,
            answer=answer,
            reasoning=reasoning,
            truncated_reasoning=truncated,
            raw=raw,
            telemetry=telemetry,
        )

    def _failed(
        self,
        model: CandidateModel,
        scenario: Scenario,
        mode: str,
        repeat: int,
        error: str,
        started: float,
    ) -> Generation:
        elapsed = (time.perf_counter() - started) * 1000
        return Generation(
            scenario_key=scenario.key,
            scenario_id=scenario.scenario_id,
            region_id=scenario.region_id,
            model_id=model.id,
            cohort="gguf",
            mode=mode,  # type: ignore[arg-type]
            repeat=repeat,
            answer="",
            raw="",
            telemetry=Telemetry(
                prompt_tokens=0,
                generation_tokens=0,
                generation_ms=0.0,
                total_ms=elapsed,
            ),
            error=error,
        )
