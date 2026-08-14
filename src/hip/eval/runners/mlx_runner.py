"""The MLX cohort, served in-process by MLX-LM.

Unlike Ollama there is no server: weights are read straight from the LM Studio directory
and the model lives in this process, which is why `mx.get_peak_memory()` is a true
allocator peak rather than the process RSS Ollama would report. The two are reported
under different `memory_basis` values so a reader cannot mistake one for the other.

`mlx-lm` is imported lazily, inside the methods that need it. The import costs seconds
and pulls a large transformers tree, and it is Apple-silicon only — importing it at
module load would make `hip eval report` on a non-macOS checkout fail on an unrelated
dependency (ARCHITECTURE #55).
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

from hip.config import CandidateModel, EvalLimits, SamplingParams
from hip.eval.normalize import split_reasoning
from hip.eval.runners.base import RunnerUnavailable
from hip.eval.types import Generation, Scenario, Telemetry

log = logging.getLogger(__name__)

# Where LM Studio keeps its models. MLX reads them in place, so there is no import step
# and no second copy on disk.
LMSTUDIO_MODELS = Path.home() / ".lmstudio" / "models"

_MISSING = (
    "mlx-lm is not installed. It lives in the optional `mlx` dependency group "
    "(Apple silicon only): `uv sync --group dev --group dbt --group mlx --group eval`."
)


def _import_mlx() -> tuple[Any, Any]:
    try:
        import mlx.core as mx
        from mlx_lm import load, stream_generate
    except ImportError as exc:  # pragma: no cover - environment-dependent
        raise RunnerUnavailable(_MISSING) from exc
    return mx, (load, stream_generate)


def apply_chat_template(tokenizer: Any, prompt: str) -> str:
    """Wrap the prompt in the model's own instruct formatting.

    Not optional, and its absence is nearly silent. `stream_generate` takes a raw string
    and does not template it, so an untemplated model never sees the turn markers it was
    fine-tuned on and never emits the end-of-turn token that stops generation. Measured
    2026-08-13 on Qwen3-8B: the templated GGUF run stopped at 528 tokens with a clean
    answer, while the untemplated MLX run produced the same opening and then continued to
    the 3,000-token cap — inflating its stated-figure count from 89 to 1,461 and burying
    the answer past the point where refusal detection could see it.

    Ollama's `/api/generate` applies the model's template to the prompt server-side, so
    templating here is what makes the two cohorts comparable rather than an MLX quirk.
    The whole prompt goes in as the user turn, matching what Ollama does with it.
    """
    if getattr(tokenizer, "chat_template", None) is None:
        return prompt
    templated = tokenizer.apply_chat_template(
        [{"role": "user", "content": prompt}],
        add_generation_prompt=True,
        tokenize=False,
    )
    return str(templated)


class MlxRunner:
    """Implements `ModelRunner` over MLX-LM, holding one model at a time.

    The cache is deliberately single-entry. Two 4-bit 8B models resident at once is
    roughly 10GB before any KV cache, which on 16GB of unified memory means swap — and
    swap was measured to be the difference between a usable run and an unusable one.
    """

    def __init__(self, models_dir: Path | None = None) -> None:
        self._models_dir = models_dir or LMSTUDIO_MODELS
        self._loaded: tuple[str, Any, Any] | None = None

    def available(self) -> bool:
        try:
            _import_mlx()
        except RunnerUnavailable:
            return False
        return self._models_dir.exists()

    def resolve(self, ref: str) -> Path:
        path = self._models_dir / ref
        if not path.exists():
            raise RunnerUnavailable(
                f"MLX model '{ref}' not found under {self._models_dir}. "
                f"Download it in LM Studio, or correct `ref` in config/evaluation.yml."
            )
        return path

    def unload(self) -> None:
        """Drop the resident model and return its memory.

        Called between models by the runner loop. Without it the peak memory reported
        for the second model includes the first one's weights.
        """
        if self._loaded is None:
            return
        self._loaded = None
        mx, _ = _import_mlx()
        mx.clear_cache()

    def _load(self, ref: str) -> tuple[Any, Any]:
        if self._loaded and self._loaded[0] == ref:
            return self._loaded[1], self._loaded[2]
        self.unload()
        _, (load, _stream) = _import_mlx()
        model, tokenizer = load(str(self.resolve(ref)))
        self._loaded = (ref, model, tokenizer)
        return model, tokenizer

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
        mx, (_load, stream_generate) = _import_mlx()
        from mlx_lm.sample_utils import make_sampler

        started = time.perf_counter()
        try:
            loaded, tokenizer = self._load(model.ref)
        except RunnerUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001 - a bad model file is a finding
            log.warning("mlx load failed for %s: %s", model.id, exc)
            return self._failed(model, scenario, mode, repeat, str(exc), started)

        if seed is not None:
            mx.random.seed(seed)
        mx.reset_peak_memory()

        # MLX-LM defaults to greedy; every parameter is passed explicitly so the two
        # cohorts are sampled identically rather than each at its own default.
        sampler = make_sampler(
            temp=sampling.temperature,
            top_p=sampling.top_p,
            top_k=sampling.top_k,
        )

        pieces: list[str] = []
        ttft_ms: float | None = None
        last: Any = None
        try:
            for response in stream_generate(
                loaded,
                tokenizer,
                apply_chat_template(tokenizer, prompt),
                max_tokens=limits.max_output_tokens,
                sampler=sampler,
            ):
                if ttft_ms is None:
                    ttft_ms = (time.perf_counter() - started) * 1000
                pieces.append(response.text)
                last = response
        except Exception as exc:  # noqa: BLE001 - a failed generation is a finding
            log.warning("mlx generation failed for %s: %s", model.id, exc)
            return self._failed(model, scenario, mode, repeat, str(exc), started)

        total_ms = (time.perf_counter() - started) * 1000
        raw = "".join(pieces)
        # MLX leaves <think> inline; there is no out-of-band reasoning field.
        answer, reasoning, truncated = split_reasoning(raw, None)

        telemetry = Telemetry(
            prompt_tokens=int(getattr(last, "prompt_tokens", 0) or 0),
            generation_tokens=int(getattr(last, "generation_tokens", 0) or 0),
            reasoning_tokens=len(reasoning) // 4 if reasoning else 0,
            ttft_ms=ttft_ms,
            generation_ms=total_ms - (ttft_ms or 0.0),
            total_ms=total_ms,
            # Weights are mmapped lazily, so there is no discrete load phase to report.
            # Null rather than 0.0, which would read as "loaded instantly".
            load_ms=None,
            tokens_per_second=float(getattr(last, "generation_tps", 0.0) or 0.0) or None,
            peak_memory_mb=float(mx.get_peak_memory()) / (1024 * 1024),
            memory_basis="allocator_peak",
            finish_reason=str(getattr(last, "finish_reason", "") or ""),
        )
        return Generation(
            scenario_key=scenario.key,
            scenario_id=scenario.scenario_id,
            region_id=scenario.region_id,
            model_id=model.id,
            cohort="mlx",
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
        return Generation(
            scenario_key=scenario.key,
            scenario_id=scenario.scenario_id,
            region_id=scenario.region_id,
            model_id=model.id,
            cohort="mlx",
            mode=mode,  # type: ignore[arg-type]
            repeat=repeat,
            answer="",
            raw="",
            telemetry=Telemetry(
                prompt_tokens=0,
                generation_tokens=0,
                generation_ms=0.0,
                total_ms=(time.perf_counter() - started) * 1000,
            ),
            error=error,
        )
