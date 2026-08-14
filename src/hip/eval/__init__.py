"""Model evaluation and the explanation layer (Milestone 8).

The last stage of the pipeline and the only one that involves a language model. It sits
after `packets` because a packet is the entire contract a model is allowed to see — the
same reason the packet was built first and left without a consumer through Milestone 7
(ARCHITECTURE #11).

Nothing here writes a fact. The evaluation reads packets and produces artifacts under
`data/eval/`; `hip explain` writes prose into `region_explanations`, which no analytic
reads. The arrow points out to the reader, never back into the numbers.
"""

from hip.eval.checks import check_generation, packet_values, parse_numbers
from hip.eval.explain import Explanation, explain_region, is_stale
from hip.eval.judge import estimated_cost, judge_batch, judge_sync, verdict_schema
from hip.eval.normalize import looks_like_refusal, split_reasoning
from hip.eval.prompts import build_prompt, estimate_tokens, fits_context, render_payload
from hip.eval.report import render_report, select_winner, summarize
from hip.eval.runner import ContextOverflow, plan, run_evaluation
from hip.eval.scenarios import build_scenarios, sample_regions, scenarios_for_packet
from hip.eval.types import (
    CheckResult,
    CriterionScore,
    Generation,
    Judgment,
    NumericCheck,
    Scenario,
    Telemetry,
)

__all__ = [
    "CheckResult",
    "ContextOverflow",
    "CriterionScore",
    "Explanation",
    "Generation",
    "Judgment",
    "NumericCheck",
    "Scenario",
    "Telemetry",
    "build_prompt",
    "build_scenarios",
    "check_generation",
    "estimate_tokens",
    "estimated_cost",
    "explain_region",
    "fits_context",
    "is_stale",
    "judge_batch",
    "judge_sync",
    "looks_like_refusal",
    "packet_values",
    "parse_numbers",
    "plan",
    "render_payload",
    "render_report",
    "run_evaluation",
    "sample_regions",
    "scenarios_for_packet",
    "select_winner",
    "split_reasoning",
    "summarize",
    "verdict_schema",
]
