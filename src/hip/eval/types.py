"""The record types the evaluation passes between its stages.

Each stage writes one of these as JSONL and the next stage reads it (see
`hip.eval.store`), so a run is resumable, diffable, and inspectable without rerunning
the expensive parts. Generation costs minutes of local inference; judging costs money.
Neither should have to be repeated because a later stage was edited.

Like the analysis packet these carry no wall-clock field except where the field *is* a
measurement (`duration_ms`), so re-deriving a report from the same artifacts produces
byte-identical output (the reasoning behind ARCHITECTURE #44).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from hip.config import JudgeEffort, ReasoningEffort
from hip.packets import Packet
from hip.packets.citations import FigureKind


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Scenario(_Strict):
    """One question against one packet — the unit every model is given.

    `payload` is the exact text the model sees and `packet` the packet it was rendered
    from, both kept with the question so the deterministic checker and the judge grade
    against what the model was actually shown, not a packet re-read from the warehouse
    later. `packet` arrived with Milestone 13: until then the checker rebuilt packets
    from the warehouse, which is only the same packet if nothing has been loaded since.
    For a JSON payload the two are the same bytes; for Markdown the payload cannot be
    parsed back, so older Markdown scenario sets have no packet at all.
    """

    scenario_id: str
    region_id: int
    region_label: str
    window: str
    question: str
    grounds: list[str] = Field(default_factory=list)
    expects_refusal: bool = False
    payload_format: Literal["json", "markdown"]
    payload: str
    payload_tokens: int = Field(
        description="Whitespace-free character count / 4 — an estimate, not a tokenizer."
    )
    packet: Packet | None = None

    @property
    def key(self) -> str:
        """Stable identity of the question, independent of which model answered it."""
        return f"{self.scenario_id}:{self.region_id}:{self.payload_format}"


class Telemetry(_Strict):
    """What a runtime reports about one generation.

    The two runtimes do not report the same things, and pretending otherwise would
    produce a table with silently incomparable columns:

    - `peak_memory_mb` is a true allocator peak under MLX (`mx.get_peak_memory()`) and
      process RSS under Ollama. Same column, different meaning, so `memory_basis`
      records which one it is rather than letting a reader assume.
    - `load_ms` is Ollama's `load_duration`. MLX reads weights lazily through mmap and
      reports nothing equivalent, so it stays null instead of being reported as zero.
    - `served_model` is the model a hosted provider says actually answered, which is
      not always the one requested: DeepSeek retires a model by routing its name to a
      successor, and on 2026-09-10 `deepseek-v4-flash` came back answered by
      `deepseek-flash` with HTTP 200. `system_fingerprint` is the backend identity where
      a provider sends one (DeepSeek does; Gemini and Mistral do not) — the only trace an
      unversioned alias leaves when it is repointed without its name changing. Both stay
      null for local runtimes, which run exactly the weights on disk.
    """

    prompt_tokens: int
    generation_tokens: int
    reasoning_tokens: int = 0
    ttft_ms: float | None = None
    generation_ms: float
    total_ms: float
    load_ms: float | None = None
    tokens_per_second: float | None = None
    peak_memory_mb: float | None = None
    memory_basis: Literal["allocator_peak", "process_rss"] | None = None
    finish_reason: str | None = None
    served_model: str | None = None
    system_fingerprint: str | None = None


class Generation(_Strict):
    """One model's answer to one scenario, normalized across runtimes.

    `answer` is what gets graded; `reasoning` is kept but never graded (a reasoning
    model would otherwise be scored on text its author never intended a reader to see).
    `truncated_reasoning` marks the case where the output budget ran out mid-thought,
    which is the difference between a model that declined to answer and one that was
    cut off before it could.
    """

    scenario_key: str
    scenario_id: str
    region_id: int
    model_id: str
    cohort: str
    mode: Literal["deterministic", "stability"]
    repeat: int = 0
    # The reasoning control the harness sent, recorded on the answer rather than read
    # back from config later: a report re-derived from these artifacts must say what this
    # generation was asked for even if the candidate's config has changed since. Records
    # written before Milestone 20 have no such field and parse as `default`, which is
    # exactly what they were — no earlier run sent a reasoning control to anyone.
    reasoning_effort: ReasoningEffort = "default"
    answer: str
    reasoning: str = ""
    truncated_reasoning: bool = False
    raw: str
    telemetry: Telemetry
    error: str | None = None

    @property
    def key(self) -> str:
        return f"{self.scenario_key}|{self.model_id}|{self.mode}|{self.repeat}"


class NumericCheck(_Strict):
    """One number the model stated, and whether the packet contains it.

    `nearest` is the packet value it matched, or for an unsupported figure the closest
    one the packet carries. `field` and `kind` are the citation the figure bound to —
    recorded since Milestone 13, so older checks parse with neither.
    """

    value: float
    text: str
    supported: bool
    nearest: float | None = None
    field: str | None = None
    kind: FigureKind | None = None


class CheckResult(_Strict):
    """Deterministic verification of one generation.

    Arithmetic is checked here rather than by the judge, because a language model
    grading whether 4.7 appears in a packet is a worse instrument than a set lookup
    and costs money per call (SPEC: Claude evaluates qualitative quality and does not
    replace deterministic validation).
    """

    generation_key: str
    numbers: list[NumericCheck] = Field(default_factory=list)
    unsupported_count: int = 0
    unsupported_rate: float = 0.0
    empty_answer: bool = False
    refused: bool = False
    refusal_expected: bool = False

    @property
    def refusal_correct(self) -> bool:
        return self.refused == self.refusal_expected


class CriterionScore(_Strict):
    score: float = Field(ge=0.0, le=4.0)
    justification: str


class Judgment(_Strict):
    """The judge's rubric verdict for one generation.

    `weighted_score` is computed here from the rubric weights rather than asked of the
    judge: a model doing arithmetic on its own scores is an avoidable error source, and
    changing a weight should not require re-judging.
    """

    generation_key: str
    model_id: str
    scenario_id: str
    scores: dict[str, CriterionScore]
    hallucinations: list[str] = Field(default_factory=list)
    summary: str
    weighted_score: float = 0.0
    judge_model: str = ""
    # How the judge was configured and what the verdict cost, recorded on the verdict
    # rather than read back from config: effort moves scores, so a report re-rendered
    # later has to say what each verdict was graded at, and the token counts are the only
    # record of what judging was billed. Verdicts from before these fields — all of `v1`
    # and `v2`, both graded at `medium` — parse with none of them.
    judge_effort: JudgeEffort | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    error: str | None = None
