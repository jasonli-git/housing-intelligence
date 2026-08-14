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

_JUDGE_SYSTEM = """\
You are grading a local language model's answer to a housing-analytics question.

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
    payload: dict[str, Any], generation: Generation, evaluation: EvaluationConfig
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
    )


def _failed(generation: Generation, evaluation: EvaluationConfig, error: str) -> Judgment:
    return Judgment(
        generation_key=generation.key,
        model_id=generation.model_id,
        scenario_id=generation.scenario_id,
        scores={},
        summary="",
        judge_model=evaluation.judge.model,
        error=error,
    )


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
        try:
            message = client.messages.create(
                **_request_params(evaluation, generation, scenario)
            )
            judgments.append(
                _parse(json.loads(_text_of(message)), generation, evaluation)
            )
        except Exception as exc:  # noqa: BLE001 - one bad grade must not lose the rest
            log.warning("judge failed for %s: %s", generation.key, exc)
            judgments.append(_failed(generation, evaluation, str(exc)))
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
        try:
            payload = json.loads(_text_of(result.result.message))
            judgments.append(_parse(payload, generation, evaluation))
        except Exception as exc:  # noqa: BLE001 - one bad grade must not lose the rest
            judgments.append(_failed(generation, evaluation, str(exc)))
    return judgments


def estimated_cost(count: int, evaluation: EvaluationConfig) -> float:
    """Rough dollar cost of judging `count` generations.

    Opus 5 list price is $5/MTok in and $25/MTok out; batch halves both. Input assumes a
    packet-sized prompt, output assumes thinking plus verdict — thinking bills as output,
    which is why the output figure is not the size of the JSON.
    """
    in_rate, out_rate = 5.0, 25.0
    if evaluation.judge.mode == "batch":
        in_rate, out_rate = in_rate / 2, out_rate / 2
    prompt_tokens, output_tokens = 7000, 800
    return round(
        count * (prompt_tokens * in_rate + output_tokens * out_rate) / 1_000_000, 2
    )
