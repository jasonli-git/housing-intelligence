"""The seam between the evaluation and whatever actually runs a model.

One protocol, two implementations, and the evaluation depends on neither. That is the
point of the milestone: SPEC principle 9 says the model choice must follow measurement
rather than reputation, which is only true if swapping a runtime is a config edit. A
third runtime — llama.cpp directly, vLLM, a hosted endpoint — implements `ModelRunner`
and nothing else changes.

Both implementations are responsible for normalizing their runtime's telemetry into
`Telemetry`, including being honest about what they cannot report. Ollama exposes process
RSS where MLX exposes a true allocator peak; neither may quietly present its number as
the other's.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from hip.config import CandidateModel, EvalLimits, SamplingParams
from hip.eval.types import Generation, Scenario


class RunnerUnavailable(RuntimeError):
    """A runtime is not installed, not running, or cannot serve a model.

    Raised with an actionable message — which command starts the service, which
    dependency group supplies the import — because the recovery is always a specific
    step and never "try again".
    """


@runtime_checkable
class ModelRunner(Protocol):
    """Generates one answer and reports what the generation cost."""

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
        """Run `prompt` through `model`, returning the normalized result.

        Implementations must not raise on a model-level failure — a model that errors
        is a finding, and losing the rest of a 40-generation run to one bad answer is
        worse than recording it. Return a `Generation` with `error` set instead. Only a
        runtime-level problem, where no model can run at all, raises `RunnerUnavailable`.
        """
        ...

    def available(self) -> bool:
        """Whether this runtime can currently serve anything."""
        ...
