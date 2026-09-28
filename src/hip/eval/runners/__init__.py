"""Runtime selection. `config/evaluation.yml` names a runner; this resolves it."""

from __future__ import annotations

from hip.config import Cohort
from hip.eval.runners.base import ModelRunner, RunnerUnavailable
from hip.eval.runners.hosted import HostedRunner
from hip.eval.runners.mlx_runner import MlxRunner
from hip.eval.runners.ollama import OllamaRunner


def build_runner(
    cohort: Cohort, name: str, *, service_tier: str | None = None
) -> ModelRunner:
    """The runner for one cohort, or a `RunnerUnavailable` naming the fix.

    `name` is the cohort's key in `config/evaluation.yml`, passed in because a runner
    class does not own a cohort: `HostedRunner` serves three of them, one per provider,
    and stamping the class's own name onto every `Generation` would collapse them into
    one column in the report.

    `service_tier` asks a hosted provider for a tier other than its standard one —
    `hip explain` passes the cohort's `generation_tier`; the evaluation never does.
    """
    if cohort.runner == "ollama":
        return OllamaRunner(cohort.endpoint or "http://localhost:11434", name)
    if cohort.runner == "mlx":
        return MlxRunner(cohort=name)
    if cohort.runner == "hosted":
        return HostedRunner(cohort, name, service_tier=service_tier)
    raise RunnerUnavailable(f"unknown runner '{cohort.runner}' (ollama | mlx | hosted)")


__all__ = [
    "HostedRunner",
    "MlxRunner",
    "ModelRunner",
    "OllamaRunner",
    "RunnerUnavailable",
    "build_runner",
]
