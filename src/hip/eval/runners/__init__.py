"""Runtime selection. `config/evaluation.yml` names a runner; this resolves it."""

from __future__ import annotations

from hip.config import Cohort
from hip.eval.runners.base import ModelRunner, RunnerUnavailable
from hip.eval.runners.mlx_runner import MlxRunner
from hip.eval.runners.ollama import OllamaRunner


def build_runner(cohort: Cohort) -> ModelRunner:
    """The runner for one cohort, or a `RunnerUnavailable` naming the fix."""
    if cohort.runner == "ollama":
        return OllamaRunner(cohort.endpoint or "http://localhost:11434")
    if cohort.runner == "mlx":
        return MlxRunner()
    raise RunnerUnavailable(f"unknown runner '{cohort.runner}' (ollama | mlx)")


__all__ = [
    "MlxRunner",
    "ModelRunner",
    "OllamaRunner",
    "RunnerUnavailable",
    "build_runner",
]
