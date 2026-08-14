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
from typing import Annotated

import typer
from sqlalchemy.orm import Session

from hip.config import get_settings, load_evaluation
from hip.warehouse.db import get_engine

app = typer.Typer(
    name="eval",
    help="Evaluate local models against standardized housing scenarios.",
    no_args_is_help=True,
    add_completion=False,
)


def _run_dir(run: str) -> object:
    from hip.eval.store import run_dir

    return run_dir(run)


@app.command("scenarios")
def scenarios_command(
    run: Annotated[str, typer.Option("--run", help="Run name under data/eval/.")] = "v1",
    window: Annotated[str, typer.Option("--window")] = "5y",
    level: Annotated[str, typer.Option("--level")] = "county",
    regions: Annotated[
        int, typer.Option("--regions", help="How many packets to sample.")
    ] = 3,
    payload_format: Annotated[
        str, typer.Option("--format", help="Packet payload: json | markdown.")
    ] = "json",
) -> None:
    """Build the scenario set and write it to data/eval/<run>/scenarios.jsonl."""
    from hip.eval.scenarios import build_scenarios
    from hip.eval.store import SCENARIOS, run_dir, write_records

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
    run: Annotated[str, typer.Option("--run")] = "v1",
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
    from hip.eval.runner import ContextOverflow, run_evaluation
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

    from hip.packets import Packet, build_packet

    by_key = {s.key: s for s in scenarios}
    checks_path = run_dir(run) / CHECKS
    counters = {"done": 0, "failed": 0, "checked": 0}

    # A full run is hours of inference, so it will sometimes be interrupted. Each
    # generation is checked the moment it lands rather than in a pass at the end: a
    # batch afterwards means an interrupted run keeps its expensive generations and
    # loses the free checks that make them scoreable.
    with Session(get_engine()) as session:
        packets: dict[int, Packet] = {}

        def packet_for(region_id: int, window: str) -> Packet:
            if region_id not in packets:
                packets[region_id] = build_packet(session, region_id, window)
            return packets[region_id]

        def record(generation: Generation) -> None:
            counters["done"] += 1
            if generation.error:
                counters["failed"] += 1
            else:
                scenario = by_key[generation.scenario_key]
                append_record(
                    checks_path,
                    check_generation(
                        generation,
                        scenario,
                        packet_for(scenario.region_id, scenario.window),
                    ),
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
        except (RunnerUnavailable, ContextOverflow) as exc:
            typer.secho(str(exc), fg=typer.colors.RED, err=True)
            raise typer.Exit(code=1) from exc

    typer.secho(
        f"{counters['done']} generations ({counters['failed']} failed), "
        f"{counters['checked']} checks written",
        fg=typer.colors.GREEN if not counters["failed"] else typer.colors.YELLOW,
    )


@app.command("check")
def check_command(
    run: Annotated[str, typer.Option("--run")] = "v1",
) -> None:
    """Recompute deterministic checks for every generation in a run.

    `hip eval run` checks each answer as it lands, so this exists for the two cases
    that leaves: generations recorded before the checker existed or was changed, and a
    run interrupted in a way that lost its checks. Idempotent — it rewrites
    `checks.jsonl` from `generations.jsonl` and never touches the generations.
    """
    from hip.eval.checks import check_generation
    from hip.eval.store import (
        CHECKS,
        load_generations,
        load_scenarios,
        run_dir,
        write_records,
    )
    from hip.packets import Packet, build_packet

    scenarios = {s.key: s for s in load_scenarios(run)}
    generations = [g for g in load_generations(run) if not g.error]
    if not generations:
        typer.secho(
            f"run '{run}' has no generations to check",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)

    results = []
    with Session(get_engine()) as session:
        packets: dict[int, Packet] = {}
        for generation in generations:
            scenario = scenarios[generation.scenario_key]
            if scenario.region_id not in packets:
                packets[scenario.region_id] = build_packet(
                    session, scenario.region_id, scenario.window
                )
            results.append(
                check_generation(generation, scenario, packets[scenario.region_id])
            )

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
    run: Annotated[str, typer.Option("--run")] = "v1",
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
    from hip.eval.judge import collect_batch, estimated_cost, judge_batch, judge_sync
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
        return

    cost = estimated_cost(len(generations), evaluation)
    typer.echo(
        f"judging {len(generations)} generations with {evaluation.judge.model} "
        f"via {evaluation.judge.mode}: about ${cost:.2f}"
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


@app.command("report")
def report_command(
    run: Annotated[str, typer.Option("--run")] = "v1",
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
def models_command() -> None:
    """List the configured candidates and whether each runtime can serve them."""
    from hip.eval.runners import RunnerUnavailable, build_runner
    from hip.eval.runners.ollama import OllamaRunner

    evaluation = load_evaluation()
    for cohort_name, cohort in evaluation.cohorts.items():
        runner = build_runner(cohort)
        up = runner.available()
        installed: set[str] = set()
        if isinstance(runner, OllamaRunner) and up:
            try:
                installed = runner.installed_models()
            except RunnerUnavailable:
                up = False
        state = (
            typer.style("available", fg=typer.colors.GREEN)
            if up
            else typer.style("unavailable", fg=typer.colors.RED)
        )
        typer.echo(f"\n{cohort_name} ({cohort.runner}) — {state}")
        for candidate in cohort.models:
            mark = " "
            if cohort.runner == "ollama" and up:
                mark = "+" if candidate.ref.split(":")[0] in installed else "-"
            typer.echo(
                f"  {mark} {candidate.id:<20} {candidate.label:<24} "
                f"{candidate.quantization:<8} {candidate.ref}"
            )


@app.command("show")
def show_command(
    run: Annotated[str, typer.Option("--run")] = "v1",
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


def explain_command(
    region: int | None,
    model_id: str | None,
    window: str,
    level: str,
    payload_format: str,
    limit: int | None,
) -> None:
    """Body of `hip explain`, registered on the root app in cli.py."""
    from hip.eval.explain import explain_region
    from hip.eval.report import select_winner, summarize
    from hip.eval.runners import RunnerUnavailable
    from hip.eval.store import (
        load_checks,
        load_generations,
        load_judgments,
        runs,
    )
    from hip.packets import regions_for_level

    evaluation = load_evaluation()

    # Default to whichever model the most recent evaluation selected. Naming a model on
    # the command line stays possible, but the point of the milestone is that this
    # choice comes from measurement rather than from a default someone typed once.
    if model_id is None:
        available = list(runs())
        if not available:
            typer.secho(
                "no evaluation run found, so no model has been selected. Run the "
                "evaluation, or name a model with --model.",
                fg=typer.colors.RED,
                err=True,
            )
            raise typer.Exit(code=1)
        latest = available[-1]
        winner = select_winner(
            summarize(
                evaluation,
                load_generations(latest),
                load_checks(latest),
                load_judgments(latest),
            )
        )
        if winner is None:
            typer.secho(
                f"run '{latest}' selected no model — every candidate either failed, "
                f"was unjudged, or exceeded the hallucination bar. Name one with "
                f"--model to override.",
                fg=typer.colors.RED,
                err=True,
            )
            raise typer.Exit(code=1)
        model_id = winner.model_id
        typer.echo(f"using {model_id}, selected by run '{latest}'")

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

        written = 0
        for region_id in region_ids:
            try:
                explanation = explain_region(
                    session,
                    evaluation,
                    region_id,
                    model_id,
                    window=window,
                    payload_format=payload_format,
                )
            except RunnerUnavailable as exc:
                typer.secho(str(exc), fg=typer.colors.RED, err=True)
                raise typer.Exit(code=1) from exc
            except (RuntimeError, ValueError) as exc:
                typer.secho(f"skipped: {exc}", fg=typer.colors.YELLOW, err=True)
                continue
            session.commit()
            written += 1
            typer.echo(
                f"{explanation.region_id:>5}  {len(explanation.body):>5} chars  "
                f"{explanation.body.splitlines()[0][:70]}..."
            )

    typer.secho(f"{written} explanations written by {model_id}", fg=typer.colors.GREEN)


@app.command("cost")
def cost_command(
    run: Annotated[str, typer.Option("--run")] = "v1",
) -> None:
    """Estimate what judging this run costs, without spending anything."""
    from hip.eval.judge import estimated_cost
    from hip.eval.store import load_generations

    evaluation = load_evaluation()
    generations = [g for g in load_generations(run) if not g.error]
    batch = estimated_cost(len(generations), evaluation)
    evaluation.judge.mode = "sync"
    typer.echo(
        json.dumps(
            {
                "run": run,
                "judgeable_generations": len(generations),
                "judge_model": evaluation.judge.model,
                "estimated_usd_batch": batch,
                "estimated_usd_sync": estimated_cost(len(generations), evaluation),
            },
            indent=2,
        )
    )
