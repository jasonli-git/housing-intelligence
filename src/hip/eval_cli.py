"""`hip eval` and `hip explain`.

A separate module from `cli.py` because the evaluation is the one part of the platform
with optional dependencies: `mlx-lm` is Apple-silicon only and `anthropic` lives in its
own group. Keeping these commands here means importing them lazily is a one-line change
if a checkout without those groups ever needs `hip acquire` to keep working — and the
imports inside each command below already ensure the failure is a clear message rather
than an ImportError at startup.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Annotated

import typer
from sqlalchemy.orm import Session

from hip.config import ConfigError, EvaluationConfig, get_settings, load_evaluation
from hip.warehouse.db import get_engine

if TYPE_CHECKING:
    from hip.eval.costs import Usage
    from hip.eval.types import Judgment, Scenario
    from hip.packets import Packet

app = typer.Typer(
    name="eval",
    help="Evaluate candidate models against standardized housing scenarios.",
    no_args_is_help=True,
    add_completion=False,
)


def _run_dir(run: str) -> object:
    from hip.eval.store import run_dir

    return run_dir(run)


# Every `hip eval` command names its run. Until 2026-09-10 each defaulted to `v1`, the
# oldest frozen run, so a bare command from README's list rewrote `v1`'s scenario set,
# appended new candidates to its generations, or billed a batch to judge them (#103).
_RUN_HELP = "Run name under data/eval/."


@app.command("scenarios")
def scenarios_command(
    run: Annotated[str, typer.Option("--run", help=_RUN_HELP)],
    window: Annotated[str, typer.Option("--window")] = "5y",
    level: Annotated[str, typer.Option("--level")] = "county",
    regions: Annotated[
        int, typer.Option("--regions", help="How many packets to sample.")
    ] = 3,
    payload_format: Annotated[
        str,
        typer.Option(
            "--format",
            help="Packet payload: markdown (what `hip explain` sends) | json.",
        ),
    ] = "markdown",
    replace: Annotated[
        bool,
        typer.Option(
            "--replace",
            help="Rebuild a run's scenario set. Refused once anything has been "
            "generated against it.",
        ),
    ] = False,
) -> None:
    """Build the scenario set and write it to data/eval/<run>/scenarios.jsonl.

    Markdown by default, because it is what `hip explain` gives a model: a benchmark on
    any other payload measures prose the site never publishes. `v2` was built on the
    JSON default this replaced (#103).
    """
    from hip.eval.scenarios import build_scenarios
    from hip.eval.store import SCENARIOS, run_dir, scenario_set_problem, write_records

    # Before the packets are built, so a refusal costs nothing.
    problem = scenario_set_problem(run, replace=replace)
    if problem:
        typer.secho(problem, fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)

    evaluation = load_evaluation()
    with Session(get_engine()) as session:
        scenarios = build_scenarios(
            session,
            evaluation,
            window=window,
            level=level,
            regions=regions,
            payload_format=payload_format,
        )

    if not scenarios:
        typer.secho(
            f"no {level} packets available for window '{window}' — run `hip pack`",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)

    path = run_dir(run) / SCENARIOS
    count = write_records(path, scenarios)
    tokens = sorted({s.payload_tokens for s in scenarios})
    typer.echo(
        f"{count} scenarios: {len({s.scenario_id for s in scenarios})} questions x "
        f"{len({s.region_id for s in scenarios})} regions, "
        f"payload ~{min(tokens):,}-{max(tokens):,} tokens ({payload_format})"
    )
    typer.secho(f"wrote {path}", fg=typer.colors.GREEN)


@app.command("run")
def run_command(
    run: Annotated[str, typer.Option("--run", help=_RUN_HELP)],
    mode: Annotated[
        str, typer.Option("--mode", help="deterministic | stability.")
    ] = "deterministic",
    repeats: Annotated[
        int, typer.Option("--repeats", help="Samples per scenario in stability mode.")
    ] = 3,
    model: Annotated[
        list[str] | None, typer.Option("--model", help="Limit to these model ids.")
    ] = None,
    resume: Annotated[
        bool, typer.Option("--resume/--restart", help="Skip generations already done.")
    ] = True,
) -> None:
    """Put every scenario through every model, appending as each answer lands."""
    from hip.eval.checks import check_generation
    from hip.eval.runner import ConfigurationChanged, ContextOverflow, run_evaluation
    from hip.eval.runners import RunnerUnavailable
    from hip.eval.store import (
        CHECKS,
        append_record,
        load_scenarios,
        run_dir,
    )
    from hip.eval.types import Generation

    evaluation = load_evaluation()
    scenarios = load_scenarios(run)
    if not scenarios:
        typer.secho(
            f"no scenarios for run '{run}' — run `hip eval scenarios` first",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)

    by_key = {s.key: s for s in scenarios}
    packets = _ground_truth(run, scenarios)
    checks_path = run_dir(run) / CHECKS
    counters = {"done": 0, "failed": 0, "checked": 0}

    # A full run is hours of inference, so it will sometimes be interrupted. Each
    # generation is checked the moment it lands rather than in a pass at the end: a
    # batch afterwards means an interrupted run keeps its expensive generations and
    # loses the free checks that make them scoreable.
    def record(generation: Generation) -> None:
        counters["done"] += 1
        if generation.error:
            counters["failed"] += 1
        else:
            scenario = by_key[generation.scenario_key]
            append_record(
                checks_path,
                check_generation(generation, scenario, packets[scenario.key]),
            )
            counters["checked"] += 1

        status = (
            typer.style("ERR", fg=typer.colors.RED)
            if generation.error
            else typer.style("ok ", fg=typer.colors.GREEN)
        )
        typer.echo(
            f"{status} {generation.model_id:<18} {generation.scenario_id:<16} "
            f"{generation.telemetry.generation_tokens:>5} tok  "
            f"{generation.telemetry.total_ms / 1000:>6.1f}s"
        )

    try:
        run_evaluation(
            evaluation,
            scenarios,
            run,
            mode=mode,
            repeats=repeats,
            models=model or None,
            resume=resume,
            on_generation=record,
        )
    except (RunnerUnavailable, ContextOverflow, ConfigurationChanged) as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc

    typer.secho(
        f"{counters['done']} generations ({counters['failed']} failed), "
        f"{counters['checked']} checks written",
        fg=typer.colors.GREEN if not counters["failed"] else typer.colors.YELLOW,
    )


def _ground_truth(run: str, scenarios: list[Scenario]) -> dict[str, Packet]:
    """Each scenario's packet, keyed like the scenario — or refuse the run.

    A scenario set built from Markdown before Milestone 13 kept no packet and cannot be
    parsed back into one, so the only thing left to check its answers against is the
    warehouse as it stands now, which is not what its models were shown. Refused rather
    than approximated: `checks.jsonl` is that run's record, and a check against other
    numbers would overwrite it with a fabrication rate nobody measured.
    """
    from hip.eval.checks import scenario_packet

    packets: dict[str, Packet] = {}
    for scenario in scenarios:
        packet = scenario_packet(scenario)
        if packet is None:
            typer.secho(
                f"run '{run}' was built before scenarios kept their packet "
                f"(Milestone 13), and its {scenario.payload_format} payloads cannot be "
                f"read back into one, so its answers could only be checked against "
                f"today's warehouse — not what its models were shown. Its checks.jsonl "
                f"is the record; start a new run for new answers.",
                fg=typer.colors.RED,
                err=True,
            )
            raise typer.Exit(code=1)
        packets[scenario.key] = packet
    return packets


@app.command("check")
def check_command(
    run: Annotated[str, typer.Option("--run", help=_RUN_HELP)],
) -> None:
    """Recompute deterministic checks for every generation in a run.

    `hip eval run` checks each answer as it lands, so this exists for the two cases
    that leaves: generations recorded before the checker existed or was changed, and a
    run interrupted in a way that lost its checks. Idempotent — it rewrites
    `checks.jsonl` from `generations.jsonl` and never touches the generations.

    Checks against the packet each scenario's model was shown — kept on the scenario
    since Milestone 13, or the payload itself for a JSON run — never against today's
    warehouse; a run with neither is refused (ARCHITECTURE #115).
    """
    from hip.eval.checks import check_generation
    from hip.eval.store import (
        CHECKS,
        load_generations,
        load_scenarios,
        run_dir,
        write_records,
    )

    scenarios = {s.key: s for s in load_scenarios(run)}
    generations = [g for g in load_generations(run) if not g.error]
    if not generations:
        typer.secho(
            f"run '{run}' has no generations to check",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)

    # Against the packets the models were shown, never today's warehouse. Until
    # Milestone 13 this rebuilt packets from the warehouse, so re-checking a finished run
    # after any load graded its answers against numbers its models never saw.
    packets = _ground_truth(run, list(scenarios.values()))
    results = [
        check_generation(
            generation,
            scenarios[generation.scenario_key],
            packets[generation.scenario_key],
        )
        for generation in generations
    ]

    path = run_dir(run) / CHECKS
    write_records(path, results)
    unsupported = sum(c.unsupported_count for c in results)
    total = sum(len(c.numbers) for c in results)
    typer.secho(
        f"{len(results)} checks written to {path}: "
        f"{unsupported}/{total} stated figures unsupported",
        fg=typer.colors.GREEN,
    )


@app.command("judge")
def judge_command(
    run: Annotated[str, typer.Option("--run", help=_RUN_HELP)],
    sync: Annotated[
        bool, typer.Option("--sync", help="Messages API instead of Batch (full price).")
    ] = False,
    limit: Annotated[
        int | None, typer.Option("--limit", help="Judge only the first N generations.")
    ] = None,
    yes: Annotated[
        bool, typer.Option("--yes", "-y", help="Skip the cost confirmation.")
    ] = False,
    batch_id: Annotated[
        str | None,
        typer.Option(
            "--batch-id",
            help="Collect an already-submitted batch instead of sending a new one.",
        ),
    ] = None,
) -> None:
    """Grade generations against the rubric. This is the only command that costs money."""
    from hip.eval.judge import collect_batch, judge_batch, judge_sync, measured_cost
    from hip.eval.store import (
        JUDGMENTS,
        load_generations,
        load_scenarios,
        run_dir,
        write_records,
    )

    evaluation = load_evaluation()
    if sync:
        evaluation.judge.mode = "sync"

    scenarios = {s.key: s for s in load_scenarios(run)}
    generations = [g for g in load_generations(run) if not g.error]
    if limit:
        generations = generations[:limit]
    if not generations:
        typer.secho(
            f"no generations to judge for run '{run}' — run `hip eval run` first",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)

    # Collecting a submitted batch costs nothing and re-sending it would pay twice.
    # Results keep for 29 days, so a poller that timed out is an inconvenience rather
    # than a loss — this is the recovery path the timeout message names.
    if batch_id:
        index = {f"g{i}": generation for i, generation in enumerate(generations)}
        judgments = collect_batch(batch_id, index, evaluation)
        path = run_dir(run) / JUDGMENTS
        write_records(path, judgments)
        scored = [j for j in judgments if not j.error]
        typer.secho(
            f"collected {len(scored)} of {len(judgments)} judgments from {batch_id} "
            f"into {path}",
            fg=typer.colors.GREEN if scored else typer.colors.YELLOW,
        )
        for judgment in [j for j in judgments if j.error][:5]:
            typer.secho(f"failed: {judgment.error}", err=True)
        _report_billed(judgments, evaluation)
        return

    scenarios = {sc.key: sc for sc in load_scenarios(run)}
    cost, _ = measured_cost(generations, scenarios, evaluation)
    typer.echo(
        f"judging {len(generations)} generations with {evaluation.judge.model} at "
        f"effort {evaluation.judge.effort} via {evaluation.judge.mode}: about ${cost:.2f}"
    )
    if not yes and not typer.confirm("proceed?", default=True):
        raise typer.Exit(code=1)

    judgments = (
        judge_sync(generations, scenarios, evaluation)
        if evaluation.judge.mode == "sync"
        else judge_batch(generations, scenarios, evaluation)
    )
    path = run_dir(run) / JUDGMENTS
    write_records(path, judgments)

    failed = [j for j in judgments if j.error]
    scored = [j for j in judgments if not j.error]
    if scored:
        mean = sum(j.weighted_score for j in scored) / len(scored)
        typer.echo(f"mean weighted score {mean:.2f}/4.00 across {len(scored)} judgments")
    for judgment in failed[:5]:
        typer.secho(f"failed: {judgment.generation_key}: {judgment.error}", err=True)
    typer.secho(
        f"wrote {path} ({len(scored)} scored, {len(failed)} failed)",
        fg=typer.colors.GREEN if not failed else typer.colors.YELLOW,
    )
    _report_billed(judgments, evaluation)


def _report_billed(judgments: list[Judgment], evaluation: EvaluationConfig) -> None:
    """Print what the verdicts were billed, from the usage each one recorded (#101).

    The quote before a run is an estimate; this is the figure the invoice will show, and
    until these fields existed nothing in the harness recorded it.
    """
    from hip.eval.judge import recorded_cost

    billed = recorded_cost(judgments, evaluation)
    if billed is None:
        return
    usd, tokens_in, tokens_out = billed
    typer.echo(
        f"billed {tokens_in:,} input and {tokens_out:,} output tokens: about ${usd:.2f} "
        f"at {evaluation.judge.mode} rates"
    )


@app.command("report")
def report_command(
    run: Annotated[str, typer.Option("--run", help=_RUN_HELP)],
    out: Annotated[
        str | None, typer.Option("--out", help="Write here instead of reports/.")
    ] = None,
) -> None:
    """Render the evaluation report from a run's artifacts."""
    from pathlib import Path

    from hip.eval.report import render_report
    from hip.eval.store import (
        load_checks,
        load_generations,
        load_judgments,
        load_scenarios,
    )

    evaluation = load_evaluation()
    scenarios = load_scenarios(run)
    generations = load_generations(run)
    if not generations:
        typer.secho(
            f"run '{run}' has no generations to report on", fg=typer.colors.RED, err=True
        )
        raise typer.Exit(code=1)

    text = render_report(
        evaluation,
        scenarios,
        generations,
        load_checks(run),
        load_judgments(run),
        run=run,
    )
    path = Path(out) if out else get_settings().reports_dir / "evaluation" / f"{run}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    typer.secho(f"wrote {path}", fg=typer.colors.GREEN)


@app.command("models")
def models_command(
    probe: Annotated[
        bool,
        typer.Option(
            "--probe",
            help="Call each hosted candidate once, sending its reasoning setting. Costs "
            "a fraction of a cent and catches a listed-but-uncallable pin or a refused "
            "setting, which a listing cannot.",
        ),
    ] = False,
) -> None:
    """List the configured candidates and whether each runtime can serve them.

    For a hosted cohort this verifies the pin rather than trusting it: the provider is
    asked what it actually serves, and a `-` marks a ref that is withdrawn or
    misspelled. Finding that here costs one request; finding it during a run costs 15
    identical 404s and a wasted judging batch.
    """
    from hip.eval.runners import RunnerUnavailable, build_runner
    from hip.eval.runners.hosted import HostedRunner
    from hip.eval.runners.ollama import OllamaRunner

    evaluation = load_evaluation()
    for cohort_name, cohort in evaluation.cohorts.items():
        runner = build_runner(cohort, cohort_name)
        up = runner.available()
        served: set[str] = set()
        detail = ""
        if up and isinstance(runner, OllamaRunner | HostedRunner):
            try:
                served = (
                    runner.installed_models()
                    if isinstance(runner, OllamaRunner)
                    else runner.served_models()
                )
            except RunnerUnavailable as exc:
                up = False
                detail = f" — {exc}"
        elif not up and cohort.runner == "hosted":
            detail = f" — {cohort.api_key_env} is not set"

        state = (
            typer.style("available", fg=typer.colors.GREEN)
            if up
            else typer.style("unavailable", fg=typer.colors.RED)
        )
        label = cohort.provider or cohort.runner
        typer.echo(f"\n{cohort_name} ({label}) — {state}{detail}")
        for candidate in cohort.models:
            mark = " "
            if served:
                mark = "+" if candidate.ref.split(":")[0] in served else "-"
            rates = (
                f"  ${candidate.input_usd_per_mtok:g}/${candidate.output_usd_per_mtok:g}"
                if candidate.billed_per_token
                else ""
            )
            # Shown only when set, because `default` is the absence of a setting: the
            # line for a candidate the harness sends no control for stays as it was.
            effort = (
                f"  reasoning: {candidate.reasoning_effort}"
                if candidate.reasoning_effort != "default"
                else ""
            )
            typer.echo(
                f"  {mark} {candidate.id:<24} {candidate.label:<34} "
                f"{candidate.quantization:<8} {candidate.ref}{rates}{effort}"
            )
            if probe and up and isinstance(runner, HostedRunner):
                failure = runner.probe(candidate)
                typer.secho(
                    f"      probe: {failure or 'OK'}",
                    fg=typer.colors.RED if failure else typer.colors.GREEN,
                )


@app.command("show")
def show_command(
    run: Annotated[str, typer.Option("--run", help=_RUN_HELP)],
    model: Annotated[str | None, typer.Option("--model")] = None,
    scenario: Annotated[str | None, typer.Option("--scenario")] = None,
) -> None:
    """Print answers from a run, for reading what the models actually said."""
    from hip.eval.store import load_generations

    for generation in load_generations(run):
        if model and generation.model_id != model:
            continue
        if scenario and generation.scenario_id != scenario:
            continue
        typer.secho(
            f"\n=== {generation.model_id} / {generation.scenario_id} / "
            f"region {generation.region_id} ===",
            fg=typer.colors.CYAN,
        )
        if generation.error:
            typer.secho(f"error: {generation.error}", fg=typer.colors.RED)
            continue
        typer.echo(generation.answer or "(empty)")
        if generation.reasoning:
            typer.secho(
                f"[{len(generation.reasoning)} chars of reasoning, not graded"
                + (", truncated" if generation.truncated_reasoning else "")
                + "]",
                fg=typer.colors.BRIGHT_BLACK,
            )


# `hip explain` exits 0 when every requested reading is current and every model its lists
# reached could be used, PARTIAL when some reading is current but a region's reading
# could not be written by any model on its list or a model could not be used at all, and
# 1 when none is. A scheduled refresh should deploy on any of them — a reading that was
# not rewritten stays up, and the site labels it stale — and alert on anything but 0
# (#102). Not 2: Click exits 2 on a usage error, and a typo in a cron line should not
# read as a partial run.
PARTIAL = 3


@dataclass
class _Outcome:
    """What one model came to in a run, for the closing summary."""

    written: int = 0
    # Prose the model wrote that a gate would not publish — an unbound figure, a survey
    # figure without its margin, a consumer reading out of shape. Counted apart from
    # `failed` because the model answered; the next model on the list was asked.
    refused: int = 0
    failed: int = 0
    # Readings written only after the model corrected a refused answer (#266), and the
    # refused attempts that asked for them — counted within `written` and apart from
    # `refused`, which is what passed the region to the next model.
    revised: int = 0
    # Why the model could not be used at all, when it could not.
    skipped: str | None = None

    def line(self, model_id: str) -> str:
        done = ", ".join(
            f"{count} {what}"
            for count, what in (
                (self.written, "written"),
                (self.revised, "of them after a revision"),
                (self.refused, "refused"),
                (self.failed, "failed"),
            )
            if count
        )
        if self.skipped:
            done = (f"{done}, then " if done else "") + f"skipped: {self.skipped}"
        return f"  {model_id:<24}{done or 'not needed'}"


@dataclass
class _Readings:
    """What one audience's readings came to across the run's regions."""

    written: int = 0
    current: int = 0
    # Stored prose re-cited against the current packet without a model call: its figures
    # had not moved, only their provenance, or it predated binding (Milestone 13).
    rebound: int = 0
    # `--dry-run` only: a region that would be generated for, counted instead of
    # written. Free re-citation still happens and lands in `rebound` above — a dry run
    # answers "would this spend money", not "would this touch the database at all".
    would_write: int = 0
    # Regions no model on the list could write for. Whatever was stored stays up, and
    # the site labels it stale if its figures moved.
    unwritten: int = 0
    # Regions a model other than the list's first wrote, because those before it could
    # not — named so a failing first choice is visible even when nothing is missing.
    by_fallback: int = 0

    def line(self, audience: str) -> str:
        done = ", ".join(
            f"{count} {what}"
            for count, what in (
                (self.written, "written"),
                (self.would_write, "would generate"),
                (self.rebound, "re-bound"),
                (self.current, "already current"),
                (self.unwritten, "not written by any model"),
            )
            if count
        )
        if self.by_fallback:
            done += f" ({self.by_fallback} by a fallback)"
        return f"  {audience:<24}{done or 'nothing to do'}"


@dataclass
class _Run:
    """Everything a run records, per audience and per model, and what it spent."""

    readings: dict[str, _Readings]
    models: dict[str, _Outcome]
    usage: list[Usage]


def _exit_code(run: _Run, *, dry_run: bool = False) -> int:
    """0, `PARTIAL` or 1, as defined beside `PARTIAL`.

    A dry run writes nothing, so its own question is different: whether anything *would*
    cost money. `PARTIAL` there means "stale and unregenerated", which is the signal a
    scheduler gates a paid step on (Milestone 27) — not "something went wrong". But a
    dry run that could assess no model at all — every one skipped, as when no judged
    run exists — has not found that nothing is stale; it has not looked. That is 1, not
    0, which "Regenerate Now" would otherwise report as "every reading is current".
    """
    readings = run.readings.values()
    if dry_run:
        if run.models and all(outcome.skipped for outcome in run.models.values()):
            return 1
        return PARTIAL if any(r.would_write for r in readings) else 0
    if not any(r.written or r.current or r.rebound for r in readings):
        return 1
    if any(r.unwritten for r in readings) or any(
        outcome.skipped for outcome in run.models.values()
    ):
        return PARTIAL
    return 0


def _cost_lines(run: _Run, evaluation: EvaluationConfig) -> list[str]:
    """What the run spent, per model, and how each was billed (Milestone 30).

    Refused and failed generations are counted: they were paid for. A provider with no
    discounted tier says it ran synchronously at list price — the roadmap's condition on
    batch pricing — and a local model says it is not billed per token.
    """
    by_model: dict[str, list[Usage]] = {}
    for usage in run.usage:
        by_model.setdefault(usage.model_id, []).append(usage)
    if not by_model:
        return []
    billed = [u.usd for u in run.usage if u.usd is not None]
    lines = [
        f"cost: ${sum(billed):.4f} for {len(run.usage)} generation(s) — an upper "
        f"bound, since prompt-cache discounts are not counted"
    ]
    for model_id, usages in by_model.items():
        cohort = evaluation.cohort_for(model_id)
        tiers: dict[str, int] = {}
        for usage in usages:
            tiers[usage.tier or "standard"] = tiers.get(usage.tier or "standard", 0) + 1
        if cohort.runner != "hosted":
            how = "local, not billed per token"
        elif cohort.generation_tier:
            how = ", ".join(f"{tier} ×{count}" for tier, count in sorted(tiers.items()))
        else:
            how = f"synchronous: {cohort.provider} offers no batch API or discounted tier"
            off_peak = sum(1 for u in usages if u.off_peak)
            if off_peak:
                how += f"; {off_peak} at its off-peak rate"
        spent = [u.usd for u in usages if u.usd is not None]
        price = f"${sum(spent):.4f}" if spent else "—"
        lines.append(
            f"  {model_id:<24}{len(usages):>3} call(s) "
            f"{sum(u.prompt_tokens for u in usages):>9,} in "
            f"{sum(u.generation_tokens for u in usages):>8,} out  {price:>9}  {how}"
        )
    return lines


def _summarize(
    run: _Run, evaluation: EvaluationConfig | None = None, *, dry_run: bool = False
) -> int:
    """Print what every audience and model came to, and return the exit code it means.

    One block at the end, because a skip announced as it happens scrolls away under a
    hundred lines of generation output, and the last lines are the ones a log is read by.
    """
    code = _exit_code(run, dry_run=dry_run)
    for audience, readings in run.readings.items():
        typer.secho(
            readings.line(audience),
            fg=typer.colors.YELLOW if readings.unwritten else None,
        )
    for model_id, outcome in run.models.items():
        if outcome.written or outcome.refused or outcome.failed or outcome.skipped:
            typer.secho(
                outcome.line(model_id),
                fg=typer.colors.YELLOW
                if outcome.skipped or outcome.failed or outcome.refused
                else None,
            )
    totals = run.readings.values()
    if dry_run:
        would_write = sum(r.would_write for r in totals)
        rebound = sum(r.rebound for r in totals)
        current = sum(r.current for r in totals)
        total = f"dry run: {would_write} reading(s) would be generated"
        if rebound:
            total += f", {rebound} would be re-bound for free"
        if current:
            total += f", {current} already current"
        total += " — nothing was called" if not would_write else " — nothing spent yet"
        typer.secho(total, fg=typer.colors.YELLOW if would_write else typer.colors.GREEN)
        return code
    if evaluation is not None:
        for line in _cost_lines(run, evaluation):
            typer.echo(line)
    written = sum(r.written for r in totals)
    total = f"{written} reading(s) written"
    rebound = sum(r.rebound for r in totals)
    current = sum(r.current for r in totals)
    unwritten = sum(r.unwritten for r in totals)
    skipped = sum(1 for outcome in run.models.values() if outcome.skipped)
    if rebound:
        total += f", {rebound} re-bound without regenerating"
    if current:
        total += f", {current} already current (--force to regenerate)"
    if unwritten:
        total += f", {unwritten} not written by any model on the list"
    if skipped:
        total += f", {skipped} model(s) could not be used"
    if code:
        total += " — partial" if code == PARTIAL else " — nothing current"
    colour = {0: typer.colors.GREEN, PARTIAL: typer.colors.YELLOW}.get(code)
    typer.secho(total, fg=colour or typer.colors.RED)
    return code


def explain_command(
    region: int | None,
    model_id: list[str] | None,
    window: str,
    level: str,
    payload_format: str,
    limit: int | None,
    force: bool = False,
    unbenchmarked: bool = False,
    audiences: list[str] | None = None,
    dry_run: bool = False,
) -> None:
    """Body of `hip explain`, registered on the root app in cli.py."""
    from hip.config import AUDIENCES
    from hip.packets import regions_for_level

    evaluation = load_evaluation()
    chosen = audiences or list(AUDIENCES)
    unknown = [a for a in chosen if a not in AUDIENCES]
    if unknown:
        typer.secho(
            f"unknown audience {', '.join(unknown)} ({' | '.join(AUDIENCES)})",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)

    # Each audience's list, or the models named on the command line tried in the order
    # given — the same fallthrough, over a list the caller chose.
    lists = {
        audience: list(model_id)
        if model_id
        else list(evaluation.generation.preference[audience])  # type: ignore[index]
        for audience in chosen
    }
    for audience, models in lists.items():
        typer.echo(f"{audience} reading: {' → '.join(models)}")
    if unbenchmarked:
        typer.secho(
            "  --unbenchmarked: the benchmark gate is off, so prose may come from a "
            "model the evaluation has not passed",
            fg=typer.colors.YELLOW,
        )

    every = list(dict.fromkeys(m for models in lists.values() for m in models))
    run = _Run(
        readings={audience: _Readings() for audience in chosen},
        models={m: _Outcome() for m in every},
        usage=[],
    )
    # One check per model, up front: the benchmark gate, then a probe per hosted model,
    # rather than learning about a routed pin from 21 paid failures that all say the
    # same thing. Not probed on a dry run: a probe is a real, billed call, and a dry
    # run's one promise is that it reaches no model.
    for candidate, why in _unusable(
        evaluation, every, require_benchmark=not unbenchmarked, probe=not dry_run
    ).items():
        run.models[candidate].skipped = why
    if all(outcome.skipped for outcome in run.models.values()):
        raise typer.Exit(code=_summarize(run, dry_run=dry_run))

    with Session(get_engine()) as session:
        region_ids = (
            [region]
            if region is not None
            else regions_for_level(session, level, window)[: limit or None]
        )
        if not region_ids:
            typer.secho(
                f"no {level} regions with analytics for window '{window}'",
                fg=typer.colors.RED,
                err=True,
            )
            raise typer.Exit(code=1)
        _explain_each(
            session,
            evaluation,
            run,
            lists,
            region_ids,
            window=window,
            payload_format=payload_format,
            force=force,
            dry_run=dry_run,
        )
        # A reading from a model no longer on its audience's list was regenerated above
        # if any model could write one; what could not be replaced is retired, so a
        # model that leaves a list stops being served (#213). Not on a dry run: a report
        # that answers "what would this cost" must not itself delete anything.
        if not dry_run:
            _prune(session, evaluation, lists, region_ids, window)

    code = _summarize(run, evaluation, dry_run=dry_run)
    if code:
        raise typer.Exit(code=code)


def _explain_each(
    session: Session,
    evaluation: EvaluationConfig,
    run: _Run,
    lists: dict[str, list[str]],
    region_ids: list[int],
    *,
    window: str,
    payload_format: str,
    force: bool,
    dry_run: bool = False,
) -> None:
    """Every region's reading for every audience, each from the first model on the
    audience's list that writes one fit to publish.

    Nothing here ends the command. A model that cannot be reached is marked and passed
    over for the rest of the run; a refusal or a failure passes one region to the next
    model; a region no model could write for is counted, and its stored reading stays.

    `dry_run` answers "what would this cost", so `explain_region` — the one call that
    reaches a model — is the one thing it never does. Free re-citation still happens and
    is still committed: it is not a regeneration, and skipping it would leave the
    provenance a real run *would* have fixed sitting stale for no reason.
    """
    from hip.eval import explain as readings_module
    from hip.eval.runners import RunnerUnavailable
    from hip.packets import PacketUnavailable, build_packet

    for region_id in region_ids:
        for audience, models in lists.items():
            tally = run.readings[audience]
            listed = set(models) | set(evaluation.generation.preference[audience])  # type: ignore[index]
            # Skip work whose stored prose still describes these numbers. Keyed on the
            # audience since migration 0019; and since Milestone 13, prose whose
            # figures have not moved is re-cited for free instead of rewritten.
            if not force:
                state = _stored_state(
                    session, region_id, window, audience, payload_format, listed
                )
                if state == "current":
                    tally.current += 1
                    continue
                if state == "rebound":
                    session.commit()
                    tally.rebound += 1
                    continue
            if dry_run:
                tally.would_write += 1
                continue
            try:
                packet = build_packet(session, region_id, window)
            except PacketUnavailable as exc:
                typer.secho(
                    f"skipped {region_id}: {exc}", fg=typer.colors.YELLOW, err=True
                )
                tally.unwritten += 1
                continue

            written = False
            for position, candidate in enumerate(models):
                outcome = run.models[candidate]
                if outcome.skipped:
                    continue
                try:
                    explanation = readings_module.explain_region(
                        session,
                        evaluation,
                        region_id,
                        candidate,
                        audience=audience,  # type: ignore[arg-type]
                        window=window,
                        payload_format=payload_format,
                        packet=packet,
                    )
                except RunnerUnavailable as exc:
                    _spent(run, exc)
                    # The runtime itself is missing — a local runtime not installed, a
                    # key not set — so every remaining region would fail the same way.
                    outcome.skipped = str(exc)
                    typer.secho(
                        f"  skipping {candidate}: {exc}", fg=typer.colors.YELLOW, err=True
                    )
                    continue
                except (
                    readings_module.UnboundFigures,
                    readings_module.ReadingRefused,
                ) as exc:
                    # The model answered and the answer was not publishable. The next
                    # model on the list is asked; whatever was stored stays until one
                    # writes.
                    typer.secho(
                        f"refused {audience}/{candidate}/{region_id}: {exc}",
                        fg=typer.colors.YELLOW,
                        err=True,
                    )
                    outcome.refused += 1
                    _spent(run, exc)
                    continue
                except (RuntimeError, ValueError) as exc:
                    typer.secho(
                        f"failed {audience}/{candidate}/{region_id}: {exc}",
                        fg=typer.colors.YELLOW,
                        err=True,
                    )
                    outcome.failed += 1
                    _spent(run, exc)
                    continue
                session.commit()
                outcome.written += 1
                tally.written += 1
                if position:
                    tally.by_fallback += 1
                earlier = getattr(explanation, "earlier", [])
                run.usage.extend(earlier)
                if earlier:
                    outcome.revised += 1
                if explanation.usage is not None:
                    run.usage.append(explanation.usage)
                written = True
                typer.echo(
                    f"{audience:<9}{explanation.model_id:<24}{explanation.region_id:>5}  "
                    f"{len(explanation.body):>5} chars  "
                    f"{len(explanation.binding.citations):>3} figures bound  "
                    f"{explanation.body.splitlines()[0][:40]}..."
                )
                break
            if not written:
                tally.unwritten += 1


def _spent(run: _Run, exc: BaseException) -> None:
    """Count what a generation that was not stored still cost."""
    run.usage.extend(getattr(exc, "earlier", []))
    usage = getattr(exc, "usage", None)
    if usage is not None:
        run.usage.append(usage)


def _prune(
    session: Session,
    evaluation: EvaluationConfig,
    lists: dict[str, list[str]],
    region_ids: list[int],
    window: str,
) -> None:
    """Remove readings from models neither on their audience's list nor asked for now.

    Requested models are kept as well as listed ones, so `--model X` cannot delete the
    reading it has just written for a model that is not on the list.
    """
    from hip.eval.explain import prune

    keep = {
        audience: set(evaluation.generation.preference[audience]) | set(models)  # type: ignore[index]
        for audience, models in lists.items()
    }
    removed = prune(session, region_ids, window, keep)
    session.commit()
    if not removed:
        return
    detail = ", ".join(f"{model} ({count})" for model, count in sorted(removed.items()))
    typer.secho(
        f"  retired {sum(removed.values())} reading(s) from models no longer on their "
        f"list: {detail}",
        fg=typer.colors.CYAN,
    )


def _stored_state(
    session: Session,
    region_id: int,
    window: str,
    audience: str,
    payload_format: str,
    listed: set[str],
) -> str:
    """`current`, `rebound` or `stale` for a region's stored reading for an audience.

    `rebound` means the stored prose was re-cited against the current packet in this
    call — it predated binding, its binder revision changed, or only provenance moved —
    and the row is updated but not committed. Anything that needs a model is `stale`:
    no stored row, a reading from a model that has left the audience's list, a packet
    that cannot be built, figures that changed, or prose that cannot pass re-binding.
    """
    from hip.eval.explain import freshness, rebind
    from hip.packets import PacketUnavailable, build_packet
    from hip.warehouse.models import RegionExplanation

    row = session.get(RegionExplanation, (region_id, window, audience))
    if row is None or row.model_id not in listed:
        return "stale"
    try:
        packet = build_packet(session, region_id, window)
    except PacketUnavailable:
        return "stale"
    state = freshness(row, packet)
    if state == "rebind":
        if (
            rebind(row, packet, payload_format=payload_format).complete
            and freshness(row, packet) == "current"
        ):
            return "rebound"
        return "stale"
    return state


def _unusable(
    evaluation: EvaluationConfig,
    models: list[str],
    *,
    require_benchmark: bool = True,
    probe: bool = True,
) -> dict[str, str]:
    """The listed or requested models that may not publish, each with the reason.

    First the benchmark gate — passed in the latest judged run, and configured as that
    run measured it (#102) — unless `--unbenchmarked` lifts it. Then one probe per hosted
    model. Without it a routed pin fails every region separately, paying for each call
    to learn the same fact. Local models are not probed: they run the weights on disk,
    so there is nothing a provider could substitute.
    """
    from hip.eval.runners import HostedRunner, RunnerUnavailable, build_runner
    from hip.eval.selection import benchmark_problem, benchmarked, latest_run

    run = latest_run() if require_benchmark else None
    eligible = benchmarked(evaluation, run) if run else {}
    unusable: dict[str, str] = {}

    def skip(model_id: str, why: str) -> None:
        unusable[model_id] = why
        typer.secho(f"  skipping {model_id}: {why}", fg=typer.colors.YELLOW, err=True)

    for model_id in models:
        try:
            cohort_name = evaluation.cohort_of(model_id)
        except ConfigError as exc:
            skip(model_id, str(exc))
            continue
        if require_benchmark:
            problem = benchmark_problem(evaluation, model_id, run, eligible)
            if problem:
                skip(model_id, problem)
                continue
        try:
            runner = build_runner(evaluation.cohorts[cohort_name], cohort_name)
        except RunnerUnavailable as exc:
            skip(model_id, str(exc))
            continue
        if probe and isinstance(runner, HostedRunner):
            failure = runner.probe(evaluation.model(model_id))
            if failure:
                skip(model_id, failure)
    return unusable


@app.command("readings")
def readings_command(
    name: Annotated[
        str,
        typer.Option(
            "--name",
            help="Report name: reports/evaluation/<name>.md, data/sidebyside/<name>/.",
        ),
    ],
    region: Annotated[
        list[int] | None,
        typer.Option("--region", help="Region ids; default Bergen, Mercer, Cumberland."),
    ] = None,
    model: Annotated[
        list[str] | None,
        typer.Option(
            "--model",
            help="Models; default the three hosted candidates and the local fallback.",
        ),
    ] = None,
    audience: Annotated[
        list[str] | None,
        typer.Option("--audience", help="consumer | analyst; default both."),
    ] = None,
    window: Annotated[str, typer.Option("--window")] = "5y",
    report_only: Annotated[
        bool,
        typer.Option(
            "--report-only",
            help="Re-render the report from the trials already kept, calling no model.",
        ),
    ] = False,
) -> None:
    """Both readings from several models on a few regions, set side by side to be read.

    The comparison the consumer reading's model is chosen from (ROADMAP, Milestone 30):
    every model gets the prompt, packet, service tier and gates `hip explain` would give
    it, and every reading is shown — a refused one with the rule it broke. Nothing is
    stored in the warehouse. Billed like the readings it compares: three hosted models
    on three counties, both formats, is 18 hosted calls.
    """
    from contextlib import ExitStack
    from datetime import date

    from hip.config import AUDIENCES
    from hip.eval.runners.ollama import serving
    from hip.eval.sidebyside import (
        DEFAULT_MODELS,
        DEFAULT_REGIONS,
        Trial,
        compare,
        render,
        write,
    )
    from hip.packets import build_packet

    evaluation = load_evaluation()
    settings = get_settings()
    models = list(model or DEFAULT_MODELS)
    chosen = [a for a in ("consumer", "analyst") if a in (audience or AUDIENCES)]
    report_path = settings.reports_dir / "evaluation" / f"{name}.md"
    if report_only:
        kept_path = settings.data_dir / "sidebyside" / name / "trials.jsonl"
        trials = [
            Trial.from_json(json.loads(line))
            for line in kept_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        write(render(trials, models, name=name, on=date.today()), report_path=report_path)
        typer.secho(
            f"re-rendered {len(trials)} readings to {report_path}", fg=typer.colors.GREEN
        )
        return
    for model_id in models:
        evaluation.model(model_id)  # a misspelt model fails before anything is billed

    # Each trial is kept as it completes, so a run stopped halfway — Gemma takes a
    # minute or more a reading — keeps what it paid for.
    data_dir = settings.data_dir / "sidebyside" / name
    data_dir.mkdir(parents=True, exist_ok=True)
    kept = (data_dir / "trials.jsonl").open("w", encoding="utf-8")

    def progress(result: Trial) -> None:
        kept.write(json.dumps(result.as_json(), ensure_ascii=False) + "\n")
        kept.flush()
        colour = None if result.status == "published" else typer.colors.YELLOW
        typer.secho(
            f"{result.region_label:<24}{result.audience:<9}{result.model_id:<24}"
            f"{result.status:<10}{result.seconds:>6.1f}s  {result.words:>4} words",
            fg=colour,
        )
        for reason in result.reasons:
            typer.secho(f"    {reason[:160]}", fg=typer.colors.BRIGHT_BLACK)

    with Session(get_engine()) as session:
        packets = [
            build_packet(session, region_id, window)
            for region_id in (region or DEFAULT_REGIONS)
        ]
    local = any(evaluation.cohort_for(m).runner == "ollama" for m in models)
    with ExitStack() as stack:
        stack.callback(kept.close)
        if local:
            logs = settings.data_dir.parent / "logs"
            logs.mkdir(exist_ok=True)
            typer.echo(stack.enter_context(serving(log_path=logs / "ollama.log")))
        trials = compare(
            packets,
            evaluation,
            models,
            audiences=chosen,  # type: ignore[arg-type]
            progress=progress,
        )

    write(render(trials, models, name=name, on=date.today()), report_path=report_path)
    billed = [t.usd for t in trials if t.usd is not None]
    typer.secho(
        f"{len(trials)} readings, {sum(t.status == 'published' for t in trials)} would "
        f"publish; ${sum(billed):.4f} billed; report at {report_path}",
        fg=typer.colors.GREEN,
    )


@app.command("cost")
def cost_command(
    run: Annotated[str, typer.Option("--run", help=_RUN_HELP)],
) -> None:
    """Estimate what judging this run costs, without spending anything.

    Priced from the run's own prompts rather than from a constant, because the judge
    prompt is dominated by the packet and packet size is a property of the run. The
    output side is not measured: it is the planning figure for the judge's effort, and it
    is printed beside the quote so it is not mistaken for one.
    """
    from hip.eval.judge import assumed_output_tokens, measured_cost
    from hip.eval.store import load_generations, load_scenarios

    evaluation = load_evaluation()
    generations = [g for g in load_generations(run) if not g.error]
    scenarios = {s.key: s for s in load_scenarios(run)}
    batch, mean_prompt = measured_cost(generations, scenarios, evaluation)
    evaluation.judge.mode = "sync"
    sync, _ = measured_cost(generations, scenarios, evaluation)
    typer.echo(
        json.dumps(
            {
                "run": run,
                "judgeable_generations": len(generations),
                "judge_model": evaluation.judge.model,
                "judge_effort": evaluation.judge.effort,
                "mean_judge_prompt_tokens": mean_prompt,
                "assumed_output_tokens_per_judgment": assumed_output_tokens(evaluation),
                "estimated_usd_batch": batch,
                "estimated_usd_sync": sync,
            },
            indent=2,
        )
    )
