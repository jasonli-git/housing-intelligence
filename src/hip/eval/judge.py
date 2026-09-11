"""Claude grading local-model answers against the rubric.

Scope is deliberately narrow. Arithmetic is verified in `hip.eval.checks`, where a set
lookup is both cheaper and more reliable than a language model; the judge scores what
only a reader can — whether a claim is grounded, whether a caveat that mattered survived,
whether the answer is usable. SPEC draws exactly this line.

Three things about the API shape are load-bearing and each was a real failure mode:

- `output_config.format` pins the verdict to a JSON schema, so scores are parsed rather
  than regex-extracted, and a malformed grade cannot silently become a zero.
- `stop_reason` is checked before `content` is read. Opus 5 can return `refusal` with an
  empty content array, and indexing `content[0]` on that raises inside a paid batch.
- `max_tokens` covers thinking *plus* the verdict. Thinking is on by default on this
  model and bills as output, so a budget sized for the JSON alone truncates the verdict
  while the reasoning consumes the allowance.

`effort` is part of the instrument. Like the system prompt it moves scores, so it changes
only at a run boundary, and every verdict records the effort it was graded at and the
tokens it was billed for (ARCHITECTURE #101).

Batch is the default: the whole run is submitted at once, latency is irrelevant, and the
flat 50% halves the cost. Prompt caching would not stack usefully — parallel batch
requests sharing a prefix all miss the cache — so the discount is taken and any cache hit
treated as a bonus.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from hip.config import EvaluationConfig, Rubric
from hip.eval.prompts import estimate_tokens
from hip.eval.types import CriterionScore, Generation, Judgment, Scenario

log = logging.getLogger(__name__)

MISSING_KEY = (
    "ANTHROPIC_API_KEY is not set. `hip eval judge` is the only command that needs it; "
    "add it to .env (see .env.example). Every other stage runs without it."
)
MISSING_SDK = (
    "The anthropic SDK is not installed. It lives in the optional `eval` dependency "
    "group: `uv sync --group dev --group dbt --group mlx --group eval`."
)

# Changing this prompt changes scores, which is why Milestone 12 re-judges Gemma 4 E4B
# in the same batch as the hosted candidates rather than comparing them against the
# stored `v1` judgments. "local" is gone because it is no longer true and because
# telling the judge where a model runs invites it to grade the runtime.
_JUDGE_SYSTEM = """\
You are grading a language model's answer to a housing-analytics question.

The model was given a data packet and told to answer using only what it contains. You
are given the same packet, the question, and the answer.

Grade only what a reader can judge: whether claims are grounded in the packet, whether
qualifications survived, whether the answer is usable. Numeric accuracy is verified
separately by a deterministic checker — do not re-derive arithmetic, but do flag any
figure that contradicts the packet.

Score each criterion 0-4:
  0  absent or actively misleading
  1  serious problems
  2  acceptable with real gaps
  3  good
  4  could be published as-is

Declining to answer is correct when the packet cannot support one. An answer that
declines appropriately scores well on instruction_following; an answer that invents a
figure to avoid declining scores 0 or 1 on factual_accuracy.
"""


def _client() -> Any:
    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover - environment-dependent
        raise RuntimeError(MISSING_SDK) from exc
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError(MISSING_KEY)
    return anthropic.Anthropic()


def verdict_schema(rubric: Rubric) -> dict[str, Any]:
    """The JSON Schema the judge's response is constrained to.

    Generated from the configured rubric rather than written out, so adding a criterion
    to `config/evaluation.yml` cannot leave the schema behind.
    """
    criteria = {
        criterion.id: {
            "type": "object",
            "properties": {
                # An enum, not `{"type": "number", "minimum": 0, "maximum": 4}`.
                # Structured outputs reject numeric range constraints — the whole batch
                # came back `invalid_request_error: For 'number' type, properties
                # maximum, minimum are not supported`, 105 for 105. An enum expresses
                # the same bound in a form the API accepts, and enforces it server-side
                # rather than hoping the judge stays in range. The rubric's levels are
                # whole numbers anyway (the system prompt defines 0 through 4), so
                # nothing is lost by dropping fractional scores.
                "score": {"type": "integer", "enum": [0, 1, 2, 3, 4]},
                "justification": {"type": "string"},
            },
            "required": ["score", "justification"],
            "additionalProperties": False,
        }
        for criterion in rubric.criteria
    }
    return {
        "type": "object",
        "properties": {
            "scores": {
                "type": "object",
                "properties": criteria,
                "required": list(criteria),
                "additionalProperties": False,
            },
            "hallucinations": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Claims the packet does not support, quoted.",
            },
            "summary": {"type": "string"},
        },
        "required": ["scores", "hallucinations", "summary"],
        "additionalProperties": False,
    }


def build_judge_prompt(generation: Generation, scenario: Scenario, rubric: Rubric) -> str:
    criteria = "\n".join(
        f"- {c.id} (weight {c.weight}): {c.description.strip()}" for c in rubric.criteria
    )
    return (
        f"CRITERIA\n{criteria}\n\n"
        f"--- DATA PACKET ---\n{scenario.payload}\n--- END DATA PACKET ---\n\n"
        f"QUESTION\n{scenario.question}\n\n"
        f"MODEL ANSWER\n{generation.answer or '(the model returned nothing)'}\n"
    )


def weighted(scores: dict[str, CriterionScore], rubric: Rubric) -> float:
    """Rubric-weighted mean on the 0-4 scale.

    Computed here rather than requested from the judge: a model doing arithmetic on its
    own scores is an avoidable error source, and re-weighting should not cost a re-judge.
    """
    total = sum(c.weight for c in rubric.criteria)
    if not total:
        return 0.0
    return round(
        sum(scores[c.id].score * c.weight for c in rubric.criteria if c.id in scores)
        / total,
        3,
    )


def _request_params(
    evaluation: EvaluationConfig, generation: Generation, scenario: Scenario
) -> dict[str, Any]:
    judge = evaluation.judge
    return {
        "model": judge.model,
        "max_tokens": judge.max_tokens,
        "system": _JUDGE_SYSTEM,
        "output_config": {
            "effort": judge.effort,
            "format": {
                "type": "json_schema",
                "schema": verdict_schema(evaluation.rubric),
            },
        },
        "messages": [
            {
                "role": "user",
                "content": build_judge_prompt(generation, scenario, evaluation.rubric),
            }
        ],
    }


def _parse(
    payload: dict[str, Any],
    generation: Generation,
    evaluation: EvaluationConfig,
    usage: tuple[int | None, int | None] = (None, None),
) -> Judgment:
    scores = {
        key: CriterionScore(
            score=float(value["score"]), justification=str(value["justification"])
        )
        for key, value in payload["scores"].items()
    }
    return Judgment(
        generation_key=generation.key,
        model_id=generation.model_id,
        scenario_id=generation.scenario_id,
        scores=scores,
        hallucinations=[str(h) for h in payload.get("hallucinations", [])],
        summary=str(payload.get("summary", "")),
        weighted_score=weighted(scores, evaluation.rubric),
        judge_model=evaluation.judge.model,
        judge_effort=evaluation.judge.effort,
        input_tokens=usage[0],
        output_tokens=usage[1],
    )


def _failed(
    generation: Generation,
    evaluation: EvaluationConfig,
    error: str,
    usage: tuple[int | None, int | None] = (None, None),
) -> Judgment:
    return Judgment(
        generation_key=generation.key,
        model_id=generation.model_id,
        scenario_id=generation.scenario_id,
        scores={},
        summary="",
        judge_model=evaluation.judge.model,
        judge_effort=evaluation.judge.effort,
        input_tokens=usage[0],
        output_tokens=usage[1],
        error=error,
    )


def _usage(message: Any) -> tuple[int | None, int | None]:
    """Input and output tokens the API billed for one verdict, where it reported them.

    Output includes the judge's thinking, which is most of it. Cache counters are left
    out: batch requests sharing a prefix all miss the cache (see the module docstring).
    """
    usage = getattr(message, "usage", None)
    if usage is None:
        return None, None
    return getattr(usage, "input_tokens", None), getattr(usage, "output_tokens", None)


def _text_of(message: Any) -> str:
    """The response text, after checking the model did not decline.

    `stop_reason` first: a refusal carries an empty content array, and reading
    `content[0]` on one raises inside an already-paid batch result.
    """
    if getattr(message, "stop_reason", None) == "refusal":
        raise ValueError("judge refused to grade this answer")
    for block in message.content:
        if block.type == "text":
            return str(block.text)
    raise ValueError(f"judge returned no text (stop_reason={message.stop_reason})")


def judge_sync(
    generations: list[Generation],
    scenarios: dict[str, Scenario],
    evaluation: EvaluationConfig,
) -> list[Judgment]:
    """Grade one request at a time. Full price — for smoke tests and small runs."""
    client = _client()
    judgments: list[Judgment] = []
    for generation in generations:
        scenario = scenarios[generation.scenario_key]
        message = None
        try:
            message = client.messages.create(
                **_request_params(evaluation, generation, scenario)
            )
            payload = json.loads(_text_of(message))
            judgments.append(_parse(payload, generation, evaluation, _usage(message)))
        except Exception as exc:  # noqa: BLE001 - one bad grade must not lose the rest
            log.warning("judge failed for %s: %s", generation.key, exc)
            # A verdict that arrived but could not be read was still billed.
            judgments.append(_failed(generation, evaluation, str(exc), _usage(message)))
    return judgments


def judge_batch(
    generations: list[Generation],
    scenarios: dict[str, Scenario],
    evaluation: EvaluationConfig,
    *,
    poll_seconds: int = 20,
    timeout_seconds: int = 3600,
) -> list[Judgment]:
    """Grade every generation in one batch, at half price.

    Results come back in arbitrary order and are keyed by `custom_id`, never by
    position. `custom_id` is the generation index rather than its key, because keys
    contain characters the field does not accept.
    """
    client = _client()
    index = {f"g{i}": generation for i, generation in enumerate(generations)}

    batch = client.messages.batches.create(
        requests=[
            {
                "custom_id": custom_id,
                "params": _request_params(
                    evaluation, generation, scenarios[generation.scenario_key]
                ),
            }
            for custom_id, generation in index.items()
        ]
    )
    log.info("submitted batch %s with %d judgments", batch.id, len(index))

    deadline = time.monotonic() + timeout_seconds
    while True:
        current = client.messages.batches.retrieve(batch.id)
        if current.processing_status == "ended":
            break
        if time.monotonic() > deadline:
            raise TimeoutError(
                f"batch {batch.id} still {current.processing_status} after "
                f"{timeout_seconds}s. It is not lost — results keep for 29 days; "
                f"re-run `hip eval judge --batch-id {batch.id}` to collect them."
            )
        time.sleep(poll_seconds)

    return collect_batch(batch.id, index, evaluation, client=client)


def collect_batch(
    batch_id: str,
    index: dict[str, Generation],
    evaluation: EvaluationConfig,
    *,
    client: Any = None,
) -> list[Judgment]:
    """Read a finished batch's results into judgments."""
    client = client or _client()
    judgments: list[Judgment] = []
    for result in client.messages.batches.results(batch_id):
        generation = index.get(result.custom_id)
        if generation is None:  # pragma: no cover - would mean a foreign batch
            continue
        if result.result.type != "succeeded":
            # Carry the API's own message through. Recording only the result *type*
            # turned a one-line schema-validation error into a 105-way mystery that
            # needed a separate script against the batch endpoint to diagnose.
            detail = getattr(result.result, "error", None)
            message = getattr(getattr(detail, "error", None), "message", None)
            judgments.append(
                _failed(
                    generation,
                    evaluation,
                    f"batch result: {result.result.type}"
                    + (f": {message}" if message else ""),
                )
            )
            continue
        message = result.result.message
        try:
            payload = json.loads(_text_of(message))
            judgments.append(_parse(payload, generation, evaluation, _usage(message)))
        except Exception as exc:  # noqa: BLE001 - one bad grade must not lose the rest
            # Most likely cut off by `max_tokens` mid-JSON. It was billed, so its usage is
            # kept for the cost of the run even though the verdict is not.
            judgments.append(_failed(generation, evaluation, str(exc), _usage(message)))
    return judgments


# Opus 5 list price. Batch halves both.
_JUDGE_IN_USD_PER_MTOK = 5.0
_JUDGE_OUT_USD_PER_MTOK = 25.0

# Fallback only, for a caller with no artifacts to measure. Prefer `measured_cost`,
# which builds the real prompts: a constant here was wrong twice already. It was 7,000
# (the packet, guessed) until 2026-09-06, then 2,600 (measured against run `v1`) — and
# `v1`'s packets carry 1,514 tokens where `v2`'s carry 4,539 to 4,849, because the
# packet gained metrics, sources and caveats across Milestones 7 and 9. Any constant
# is a snapshot of one run's packet size and silently under-quotes the next one.
_JUDGE_PROMPT_TOKENS = 2600

# Output per verdict, by effort, for quoting a run before it is judged. Dominated by
# thinking rather than by the verdict JSON, and billed at the output rate. `medium` is
# the figure calibrated against `v1`'s judging (#84) — the earlier 800 was the size of
# the JSON alone and under-reported the bill by between 15% and 60%. The other levels
# are planning figures scaled from it, not measurements, set on the high side because a
# run that costs more than it was quoted is the failure worth avoiding. Every verdict now
# records the output tokens it was billed for (#101), so `high` is the first of these a
# run will replace with a measurement.
_JUDGE_OUTPUT_TOKENS: dict[str, int] = {
    "low": 1_000,
    "medium": 2_000,
    "high": 5_000,
    "xhigh": 8_000,
    "max": 12_000,
}

# The system prompt and the generated JSON schema, which ride on every request and
# do not vary with the run. Measured 2026-09-06: 226 + 442.
_JUDGE_FIXED_TOKENS = 668


def _rates(evaluation: EvaluationConfig) -> tuple[float, float]:
    in_rate, out_rate = _JUDGE_IN_USD_PER_MTOK, _JUDGE_OUT_USD_PER_MTOK
    if evaluation.judge.mode == "batch":
        return in_rate / 2, out_rate / 2
    return in_rate, out_rate


def assumed_output_tokens(evaluation: EvaluationConfig) -> int:
    """Output tokens per verdict a quote assumes: the effort's figure, within the cap."""
    judge = evaluation.judge
    return min(_JUDGE_OUTPUT_TOKENS[judge.effort], judge.max_tokens)


def _price(prompt_tokens: int, count: int, evaluation: EvaluationConfig) -> float:
    in_rate, out_rate = _rates(evaluation)
    output = assumed_output_tokens(evaluation)
    return round(count * (prompt_tokens * in_rate + output * out_rate) / 1_000_000, 2)


def estimated_cost(count: int, evaluation: EvaluationConfig) -> float:
    """Rough dollar cost of judging `count` generations, from a fixed prompt size.

    Kept for callers with nothing to measure. `measured_cost` is strictly better and is
    what `hip eval cost` uses.
    """
    return _price(_JUDGE_PROMPT_TOKENS, count, evaluation)


def measured_cost(
    generations: list[Generation],
    scenarios: dict[str, Scenario],
    evaluation: EvaluationConfig,
) -> tuple[float, int]:
    """Cost of judging exactly these generations, and the mean prompt size behind it.

    Builds the real judge prompt for every generation rather than assuming one, because
    the prompt is dominated by the packet and the packet's size is a property of the
    run, not of this module. The output side is the effort's planning figure from
    `_JUDGE_OUTPUT_TOKENS`, set high on purpose: a judging run that costs more than it
    was quoted is the failure worth avoiding.
    """
    total = 0
    priced = 0
    for generation in generations:
        scenario = scenarios.get(generation.scenario_key)
        if scenario is None:
            continue
        prompt = build_judge_prompt(generation, scenario, evaluation.rubric)
        total += estimate_tokens(prompt) + _JUDGE_FIXED_TOKENS
        priced += 1
    if not priced:
        return 0.0, 0
    mean = total // priced
    return _price(mean, priced, evaluation), mean


def recorded_cost(
    judgments: list[Judgment], evaluation: EvaluationConfig
) -> tuple[float, int, int] | None:
    """What judging these verdicts was billed, from the usage each one recorded.

    Returns `(usd, input_tokens, output_tokens)`, or None when no verdict carries usage —
    every run judged before the fields existed. Priced at the configured mode's rates,
    which is the mode the batch ran in unless config changed since. A verdict that failed
    after it arrived is counted, because it was paid for.
    """
    billed = [
        judgment
        for judgment in judgments
        if judgment.input_tokens is not None and judgment.output_tokens is not None
    ]
    if not billed:
        return None
    tokens_in = sum(judgment.input_tokens or 0 for judgment in billed)
    tokens_out = sum(judgment.output_tokens or 0 for judgment in billed)
    in_rate, out_rate = _rates(evaluation)
    usd = round((tokens_in * in_rate + tokens_out * out_rate) / 1_000_000, 2)
    return usd, tokens_in, tokens_out
