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
- Every table states the reasoning effort each model was *sent*, read from the
  generations rather than from config, and the reasoning it was *measured* at sits
  beside it. A model at two settings is two candidates (Milestone 20), and a setting is
  a request that only the token count shows was honoured.

Rendered as Markdown, like the region report (ARCHITECTURE #45): diffable, readable as
text, and printable by the browser without a rendering dependency.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from collections.abc import Iterable
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
    prompt_tokens: int = 0
    # None for a model that is not billed per token. Kept distinct from 0.0, which
    # would put a misleading free in a published cost column for a local model whose
    # real cost is a machine and an afternoon.
    usd: float | None = None
    peak_memory_mb: list[float] = field(default_factory=list)
    # Every reasoning setting this model's generations were sent at. One value in any
    # run written since Milestone 20, because `hip eval run` refuses to resume a
    # candidate under a changed setting; two mean the run averages two configurations.
    reasoning_efforts: set[str] = field(default_factory=set)
    # Generations sent at `disabled` that still reported reasoning tokens. `disabled` is
    # the one setting that makes a checkable claim — none — so it is checked rather than
    # trusted. `low` promises only a level and is not counted here.
    reasoned_while_disabled: int = 0

    @property
    def effort_label(self) -> str:
        """The setting as the report prints it."""
        if not self.reasoning_efforts:
            return "—"
        return ", ".join(sorted(self.reasoning_efforts))

    @property
    def mean_score(self) -> float | None:
        return round(statistics.fmean(self.scores), 2) if self.scores else None

    @property
    def error_rate(self) -> float:
        """Share of this model's generations that failed outright.

        Zero when nothing ran, so a model with no generations is never admitted by a
        vacuously clean error rate — `mean_score is not None` is what excludes it.
        """
        return self.errors / self.generations if self.generations else 0.0

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
    def usd_per_generation(self) -> float | None:
        if self.usd is None or not self.generations:
            return None
        return self.usd / self.generations

    @property
    def score_per_dollar(self) -> float | None:
        """Rubric points per dollar, over a full 1,000-generation run.

        Per-generation cost at these rates is a number with four leading zeros, which
        no reader can compare at a glance. Scaled to 1,000 generations because that is
        the order of a real regeneration pass — 1,135 published regions today, 3,144
        counties at Milestone 15 — so the figure is one someone can reason about
        against an actual bill rather than an abstract rate.
        """
        per = self.usd_per_generation
        if per is None or self.mean_score is None:
            return None
        if per == 0:
            return None
        return round(self.mean_score / (per * 1000), 1)

    @property
    def usd_per_thousand(self) -> float | None:
        per = self.usd_per_generation
        return round(per * 1000, 2) if per is not None else None

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
        summary.reasoning_efforts.add(generation.reasoning_effort)
        if (
            generation.reasoning_effort == "disabled"
            and generation.telemetry.reasoning_tokens > 0
        ):
            summary.reasoned_while_disabled += 1

        telemetry = generation.telemetry
        summary.generated_tokens += telemetry.generation_tokens
        summary.prompt_tokens += telemetry.prompt_tokens
        summary.reasoning_tokens += telemetry.reasoning_tokens
        # Priced from the provider's own token counters rather than from an estimate:
        # they are what the invoice is computed from, so the cost column and the bill
        # are derived from the same numbers.
        billed = candidate.usd_for(telemetry.prompt_tokens, telemetry.generation_tokens)
        if billed is not None:
            summary.usd = (summary.usd or 0.0) + billed
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


def measured_efforts(generations: Iterable[Generation]) -> dict[str, set[str]]:
    """The reasoning settings each model's generations were sent at.

    Read from the answers, never from config, so it describes what a run did rather than
    what config says now: the resume guard in `hip.eval.runner` and the configuration
    check in `hip.eval.selection` both ask it.
    """
    measured: dict[str, set[str]] = {}
    for generation in generations:
        measured.setdefault(generation.model_id, set()).add(generation.reasoning_effort)
    return measured


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


def _effort_note(priced: list[ModelSummary]) -> str:
    """What the quality-per-dollar column compares, derived from the run.

    Until Milestone 20 this was written into the renderer: `v2`'s reasoning shares and a
    2026-09-06 measurement that no file in the run directory holds. That broke the
    report's own promise to recompute from its artifacts and add nothing, and it would
    have printed `v2`'s facts into every later run.
    """
    shares = [summary.reasoning_share for summary in priced]
    spread = f"from {min(shares):.0%} to {max(shares):.0%}"
    if all(summary.reasoning_efforts == {"default"} for summary in priced):
        return (
            "**Every candidate here ran at its provider's default reasoning effort; the "
            "harness sent no reasoning control.** Defaults differ by vendor — reasoning "
            f"runs {spread} of output tokens across these candidates — so this compares "
            "models as they arrive out of the box, not at matched effort, and a "
            "reasoning-heavy candidate's figure is what its default costs rather than "
            "its floor."
        )
    return (
        "**Reasoning effort is part of each candidate's configuration, and the Effort "
        "column states it.** `default` means the harness sent no reasoning control and "
        "the provider decided; any other setting was sent as that provider's own control "
        "under its own candidate id, so a model at two settings is two rows rather than "
        f"one average of both. Reasoning runs {spread} of output tokens across these "
        "candidates."
    )


# A model may fail this share of its generations and still be recommended. Stated as a
# rate rather than as an absolute zero because the two runtimes fail differently: an
# error from a local runtime means the model genuinely could not run, while a hosted
# provider returns a 429 for reasons that have nothing to do with the model — and the
# retry in `HostedRunner` has already exhausted its attempts by the time one is
# recorded. An absolute gate would disqualify an otherwise winning hosted candidate on
# one bad afternoon. Set at one generation in fifteen, so a single failure in a
# standard 15-scenario run is survivable and two are not.
MAX_ERROR_RATE = 0.07
MAX_HALLUCINATION_RATE = 0.05


def meets_the_bar(summary: ModelSummary) -> bool:
    """Whether a model may be recommended — and, through `selection.passed_benchmark`,
    whether it may write. One definition for both, so a model can never be eligible to
    publish under looser rules than it was eligible to win under.

    Judged, under the fabrication bar, under the error bar for the reason above
    `MAX_ERROR_RATE`, and measured at one reasoning effort: a model run at two settings
    under one id has no single result to recommend, only an average of two candidates.
    """
    return (
        summary.mean_score is not None
        and summary.hallucination_rate <= MAX_HALLUCINATION_RATE
        and summary.error_rate <= MAX_ERROR_RATE
        and len(summary.reasoning_efforts) <= 1
    )


def select_winner(summaries: dict[str, ModelSummary]) -> ModelSummary | None:
    """The recommended model.

    Ordered by judged quality, but only among models that cleared the deterministic
    bar: nothing that fabricated a figure at more than a 5% rate is eligible, however
    well it writes. A platform whose premise is traceable numbers cannot ship an
    explainer that invents them, so this is a gate rather than another weighted term.
    """
    eligible = [summary for summary in summaries.values() if meets_the_bar(summary)]
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
        "# Model evaluation",
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

    for summary in summaries.values():
        if len(summary.reasoning_efforts) > 1:
            lines += [
                f"> **{summary.label} was sent more than one reasoning effort in this "
                f"run ({summary.effort_label}).** Its figures average two "
                "configurations under one id, so it is not eligible for selection.",
                "",
            ]

    if winner:
        lines += [
            "## Selected model",
            "",
            f"**{winner.label}** (`{winner.model_id}`, {winner.cohort} cohort, "
            f"{winner.quantization}, reasoning effort `{winner.effort_label}`) — "
            f"rubric score {_fmt(winner.mean_score)}/4.00, "
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
        "| Model | Cohort | Effort | Answers | Figures | Unsupported | Empty | Errors "
        "| Refusal |",
        "|---|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    for summary in sorted(summaries.values(), key=lambda s: s.hallucination_rate):
        refusal = (
            f"{summary.refusal_correct}/{summary.refusal_total}"
            if summary.refusal_total
            else "—"
        )
        lines.append(
            f"| {summary.label} | {summary.cohort} | {summary.effort_label} | "
            f"{summary.generations} | {summary.total_numbers} | "
            f"{summary.hallucination_rate:.1%} | {summary.empty} | {summary.errors} | "
            f"{refusal} |"
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
            "| Model | Effort | Weighted | " + " | ".join(criteria) + " | Flagged |",
            "|---|---|---:|" + "---:|" * len(criteria) + "---:|",
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
                f"| {summary.label} | {summary.effort_label} | "
                f"{_fmt(summary.mean_score)} | "
                + " | ".join(cells)
                + f" | {summary.hallucinations} |"
            )

    lines += [
        "",
        "## Cost and efficiency",
        "",
        "`effort` is the reasoning setting the harness sent — `default` means it sent "
        "none and the provider or runtime decided — and `reasoning` is the share of "
        "generated tokens actually spent before the answer began, which is how a setting "
        "is checked rather than trusted. Reasoning is an efficiency measure only. Peak "
        "memory is comparable within a cohort "
        "and not across one: MLX reports a true allocator peak, Ollama reports "
        "nothing, and a process-RSS reading taken from outside would not mean the "
        "same thing. `tok/s` is likewise not comparable across cohorts: a local "
        "figure measures the machine, while a hosted one measures a request over a "
        "network and is a latency number wearing a throughput label.",
        "",
        "| Model | Cohort | tok/s | TTFT | Effort | Reasoning | Truncated | "
        "Peak memory |",
        "|---|---|---:|---:|---|---:|---:|---:|",
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
            f"{_fmt(summary.median_ttft_ms, ' ms', 0)} | {summary.effort_label} | "
            f"{summary.reasoning_share:.0%} | {summary.truncated_reasoning} | "
            f"{memory} |"
        )
    for summary in sorted(summaries.values(), key=lambda s: s.label):
        if summary.reasoned_while_disabled:
            lines += [
                "",
                f"**{summary.label} reasoned despite `disabled`** in "
                f"{summary.reasoned_while_disabled} of {summary.generations} "
                "generations: the provider reported reasoning tokens for a request that "
                "asked for none, so these figures describe what it did rather than what "
                "was configured.",
            ]

    priced = [s for s in summaries.values() if s.usd is not None]
    if priced:
        lines += [
            "",
            "### Quality per dollar",
            "",
            "Priced from each provider's own token counters and the per-candidate "
            "rates in `config/evaluation.yml`, so this column and the invoice are "
            "computed from the same numbers. Cost is reported beside quality and does "
            "not reorder the preference list: a cheaper model is chosen on measured "
            "evidence, never on price alone.",
            "",
            "Scaled to 1,000 generations because that is the order of a real "
            "regeneration pass — 1,135 published regions today — and a per-generation "
            "figure at these rates has four leading zeros. A local model has no row "
            "here: its cost is a machine and an afternoon, not a token rate, and a "
            "0.00 would read as free.",
            "",
            # The caveat this table cannot state for itself: the effort each row was
            # measured at, which moves this column more than any rate does.
            _effort_note(priced),
            "",
            "| Model | Cohort | Effort | Rubric | Prompt tok | Output tok | $/1k gens | "
            "Rubric per $ |",
            "|---|---|---|---:|---:|---:|---:|---:|",
        ]
        for summary in sorted(priced, key=lambda s: -(s.score_per_dollar or 0)):
            lines.append(
                f"| {summary.label} | {summary.cohort} | {summary.effort_label} | "
                f"{_fmt(summary.mean_score)} | "
                f"{summary.prompt_tokens:,} | {summary.generated_tokens:,} | "
                f"{_fmt(summary.usd_per_thousand, '', 2)} | "
                f"{_fmt(summary.score_per_dollar, '', 1)} |"
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
