"""The evaluation report: which model was selected, and what the evidence was.

SPEC asks for this as a portfolio artifact that explains the choice from observed
performance on the housing task rather than from benchmark reputation. So the report
leads with the selection and its evidence, and every table under it is something a
reader can check against the artifacts in the run directory.

Two rules shape the layout:

- The anchor comparison comes first. Picking a winner across two cohorts is a
  cross-runtime comparison whether or not it is framed as one, and the matched 4-bit
  pairs are what license it. Presenting the leaderboard first would invite exactly the
  confounded reading the anchors exist to prevent.
- Deterministic results and judged results stay in separate tables. Hallucination rate
  is counted, not graded; merging the two would hide which numbers a language model
  produced.

Rendered as Markdown, like the region report (ARCHITECTURE #45): diffable, readable as
text, and printable by the browser without a rendering dependency.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from dataclasses import dataclass, field

from hip.config import EvaluationConfig
from hip.eval.types import CheckResult, Generation, Judgment, Scenario


@dataclass
class ModelSummary:
    """Everything the report knows about one model, from all three sources."""

    model_id: str
    label: str
    cohort: str
    quantization: str
    generations: int = 0
    errors: int = 0
    empty: int = 0
    truncated_reasoning: int = 0
    unsupported_numbers: int = 0
    total_numbers: int = 0
    refusal_correct: int = 0
    refusal_total: int = 0
    scores: list[float] = field(default_factory=list)
    criterion_scores: dict[str, list[float]] = field(default_factory=dict)
    hallucinations: int = 0
    tokens_per_second: list[float] = field(default_factory=list)
    ttft_ms: list[float] = field(default_factory=list)
    reasoning_tokens: int = 0
    generated_tokens: int = 0
    peak_memory_mb: list[float] = field(default_factory=list)

    @property
    def mean_score(self) -> float | None:
        return round(statistics.fmean(self.scores), 2) if self.scores else None

    @property
    def hallucination_rate(self) -> float:
        """Share of stated figures the packet does not support.

        Counted deterministically. This is the number the selection turns on: a model
        that writes well and invents figures is unusable for a platform whose claim is
        that every figure traces to a source file.
        """
        if not self.total_numbers:
            return 0.0
        return round(self.unsupported_numbers / self.total_numbers, 4)

    @property
    def reasoning_share(self) -> float:
        """Share of generated tokens spent on reasoning rather than the answer.

        An efficiency metric, never a quality one — reasoning is not graded. Nemotron
        spent 91% of its output here, which is the difference between a model that is
        slow and one that is unaffordable.
        """
        if not self.generated_tokens:
            return 0.0
        return round(self.reasoning_tokens / self.generated_tokens, 3)

    @property
    def median_tps(self) -> float | None:
        return (
            round(statistics.median(self.tokens_per_second), 1)
            if self.tokens_per_second
            else None
        )

    @property
    def median_ttft_ms(self) -> float | None:
        return round(statistics.median(self.ttft_ms)) if self.ttft_ms else None


def summarize(
    evaluation: EvaluationConfig,
    generations: list[Generation],
    checks: list[CheckResult],
    judgments: list[Judgment],
) -> dict[str, ModelSummary]:
    """Fold the three artifact streams into one row per model."""
    by_key = {check.generation_key: check for check in checks}
    judged: dict[str, Judgment] = {j.generation_key: j for j in judgments}

    summaries: dict[str, ModelSummary] = {}
    for generation in generations:
        try:
            candidate = evaluation.model(generation.model_id)
        except Exception:  # noqa: BLE001 - a model dropped from config still reports
            continue
        summary = summaries.setdefault(
            generation.model_id,
            ModelSummary(
                model_id=generation.model_id,
                label=candidate.label,
                cohort=generation.cohort,
                quantization=candidate.quantization,
            ),
        )
        summary.generations += 1
        if generation.error:
            summary.errors += 1
        if generation.truncated_reasoning:
            summary.truncated_reasoning += 1

        telemetry = generation.telemetry
        summary.generated_tokens += telemetry.generation_tokens
        summary.reasoning_tokens += telemetry.reasoning_tokens
        if telemetry.tokens_per_second:
            summary.tokens_per_second.append(telemetry.tokens_per_second)
        if telemetry.ttft_ms:
            summary.ttft_ms.append(telemetry.ttft_ms)
        if telemetry.peak_memory_mb:
            summary.peak_memory_mb.append(telemetry.peak_memory_mb)

        check = by_key.get(generation.key)
        if check:
            summary.total_numbers += len(check.numbers)
            summary.unsupported_numbers += check.unsupported_count
            if check.empty_answer:
                summary.empty += 1
            if check.refusal_expected:
                summary.refusal_total += 1
                if check.refusal_correct:
                    summary.refusal_correct += 1

        judgment = judged.get(generation.key)
        if judgment and not judgment.error and judgment.scores:
            summary.scores.append(judgment.weighted_score)
            summary.hallucinations += len(judgment.hallucinations)
            for criterion_id, score in judgment.scores.items():
                summary.criterion_scores.setdefault(criterion_id, []).append(score.score)
    return summaries


def anchor_pairs(
    evaluation: EvaluationConfig, summaries: dict[str, ModelSummary]
) -> list[tuple[str, ModelSummary, ModelSummary]]:
    """Matched model pairs, one per cohort, that license the cross-runtime comparison."""
    grouped: dict[str, list[ModelSummary]] = defaultdict(list)
    for candidate in evaluation.models:
        summary = summaries.get(candidate.id)
        if candidate.anchor and summary:
            grouped[candidate.anchor].append(summary)
    pairs = []
    for anchor, members in sorted(grouped.items()):
        if len(members) == 2:
            first, second = sorted(members, key=lambda s: s.cohort)
            pairs.append((anchor, first, second))
    return pairs


def _fmt(value: float | None, suffix: str = "", nd: int = 2) -> str:
    return "—" if value is None else f"{value:.{nd}f}{suffix}"


def select_winner(summaries: dict[str, ModelSummary]) -> ModelSummary | None:
    """The recommended model.

    Ordered by judged quality, but only among models that cleared the deterministic
    bar: nothing that fabricated a figure at more than a 5% rate is eligible, however
    well it writes. A platform whose premise is traceable numbers cannot ship an
    explainer that invents them, so this is a gate rather than another weighted term.
    """
    eligible = [
        summary
        for summary in summaries.values()
        if summary.mean_score is not None
        and summary.hallucination_rate <= 0.05
        and summary.errors == 0
    ]
    if not eligible:
        return None
    return max(eligible, key=lambda s: (s.mean_score or 0, s.median_tps or 0))


def render_report(
    evaluation: EvaluationConfig,
    scenarios: list[Scenario],
    generations: list[Generation],
    checks: list[CheckResult],
    judgments: list[Judgment],
    *,
    run: str,
) -> str:
    """The published evaluation report."""
    summaries = summarize(evaluation, generations, checks, judgments)
    winner = select_winner(summaries)
    judged = [j for j in judgments if not j.error and j.scores]
    regions = sorted({s.region_label for s in scenarios})
    formats = sorted({s.payload_format for s in scenarios})

    lines: list[str] = [
        "# Local model evaluation",
        "",
        f"Run `{run}`. {len(generations):,} generations from "
        f"{len(summaries)} models over {len({s.scenario_id for s in scenarios})} "
        f"scenarios and {len({s.region_id for s in scenarios})} regions "
        f"({', '.join(regions)}), payload format {', '.join(formats)}.",
        "",
    ]

    if not judged:
        lines += [
            "> **Not yet judged.** Generations and deterministic checks are present; "
            "no rubric scores have been collected, so no model is recommended. "
            "Run `hip eval judge` to complete the evaluation.",
            "",
        ]

    if winner:
        lines += [
            "## Selected model",
            "",
            f"**{winner.label}** (`{winner.model_id}`, {winner.cohort} cohort, "
            f"{winner.quantization}) — rubric score "
            f"{_fmt(winner.mean_score)}/4.00, "
            f"{winner.hallucination_rate:.1%} of stated figures unsupported, "
            f"{_fmt(winner.median_tps, ' tok/s', 1)}.",
            "",
            "Selected on measured performance on this task, not on benchmark "
            "reputation. Quality decides the ordering, but only among models that "
            "cleared the deterministic bar first: any model fabricating more than 5% "
            "of its figures is ineligible regardless of how it reads, because the "
            "platform's claim is that every number traces to a source file.",
            "",
        ]

    pairs = anchor_pairs(evaluation, summaries)
    if pairs:
        lines += [
            "## Anchor comparison — runtime, holding the model fixed",
            "",
            "Read this before the leaderboard. The two cohorts run different "
            "runtimes, so ranking every model in one table is a cross-runtime "
            "comparison whether or not it is framed as one. These pairs are the same "
            "model at the same 4-bit precision on both runtimes: any gap here is the "
            "runtime, and it is the size of that gap that says how far the leaderboard "
            "below can be trusted.",
            "",
            "| Model | Runtime | Rubric | Unsupported | tok/s | TTFT |",
            "|---|---|---|---:|---:|---:|",
        ]
        for _anchor, first, second in pairs:
            for summary in (first, second):
                lines.append(
                    f"| {summary.label} | {summary.cohort} | "
                    f"{_fmt(summary.mean_score)} | "
                    f"{summary.hallucination_rate:.1%} | "
                    f"{_fmt(summary.median_tps, '', 1)} | "
                    f"{_fmt(summary.median_ttft_ms, ' ms', 0)} |"
                )
        lines.append("")

    lines += [
        "## Deterministic checks",
        "",
        "Counted, not graded. Every figure a model stated is matched against the "
        "packet it was given; a figure the packet cannot support is a fabrication "
        "regardless of how the answer reads. No language model is involved.",
        "",
        "| Model | Cohort | Answers | Figures | Unsupported | Empty | Errors | Refusal |",
        "|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    for summary in sorted(summaries.values(), key=lambda s: s.hallucination_rate):
        refusal = (
            f"{summary.refusal_correct}/{summary.refusal_total}"
            if summary.refusal_total
            else "—"
        )
        lines.append(
            f"| {summary.label} | {summary.cohort} | {summary.generations} | "
            f"{summary.total_numbers} | {summary.hallucination_rate:.1%} | "
            f"{summary.empty} | {summary.errors} | {refusal} |"
        )

    if judged:
        criteria = [c.id for c in evaluation.rubric.criteria]
        lines += [
            "",
            "## Rubric scores",
            "",
            f"Graded by `{evaluation.judge.model}` against the criteria in "
            "`config/evaluation.yml`. Final answers only — reasoning tokens are "
            "measured as cost, never graded as quality.",
            "",
            "| Model | Weighted | " + " | ".join(criteria) + " | Flagged |",
            "|---|---:|" + "---:|" * len(criteria) + "---:|",
        ]
        ranked = sorted(
            (s for s in summaries.values() if s.mean_score is not None),
            key=lambda s: s.mean_score or 0,
            reverse=True,
        )
        for summary in ranked:
            cells = [
                _fmt(
                    statistics.fmean(summary.criterion_scores[c])
                    if summary.criterion_scores.get(c)
                    else None,
                    "",
                    1,
                )
                for c in criteria
            ]
            lines.append(
                f"| {summary.label} | {_fmt(summary.mean_score)} | "
                + " | ".join(cells)
                + f" | {summary.hallucinations} |"
            )

    lines += [
        "",
        "## Cost and efficiency",
        "",
        "`reasoning` is the share of generated tokens spent before the answer began. "
        "It is an efficiency measure only. Peak memory is comparable within a cohort "
        "and not across one: MLX reports a true allocator peak, Ollama reports "
        "nothing, and a process-RSS reading taken from outside would not mean the "
        "same thing.",
        "",
        "| Model | Cohort | tok/s | TTFT | Reasoning | Truncated | Peak memory |",
        "|---|---|---:|---:|---:|---:|---:|",
    ]
    for summary in sorted(summaries.values(), key=lambda s: -(s.median_tps or 0)):
        memory = (
            f"{statistics.median(summary.peak_memory_mb) / 1024:.1f} GB"
            if summary.peak_memory_mb
            else "—"
        )
        lines.append(
            f"| {summary.label} | {summary.cohort} | "
            f"{_fmt(summary.median_tps, '', 1)} | "
            f"{_fmt(summary.median_ttft_ms, ' ms', 0)} | "
            f"{summary.reasoning_share:.0%} | {summary.truncated_reasoning} | "
            f"{memory} |"
        )

    lines += [
        "",
        "## How to check this",
        "",
        f"Every figure above is derived from the artifacts in `data/eval/{run}/`: "
        "`scenarios.jsonl` holds the exact bytes each model was given, "
        "`generations.jsonl` the answers and telemetry, `checks.jsonl` the numeric "
        "verification, and `judgments.jsonl` the rubric verdicts with their "
        "justifications. The report recomputes from those files and adds nothing.",
        "",
    ]
    return "\n".join(lines)
