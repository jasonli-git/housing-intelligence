"""``hip`` command line entry point.

One command per pipeline stage, in the order they run (see the Pipeline section of
ARCHITECTURE.md). Every write path to the warehouse is here and nowhere else — the API
never triggers a stage (ARCHITECTURE #6).

Stage commands are not implemented yet. They exit non-zero and name the milestone that
delivers them, so a stub can never be mistaken for a successful run.
"""

from __future__ import annotations

from typing import Annotated

import typer

from hip import __version__
from hip.config import (
    ConfigError,
    check_config,
    load_geography,
    load_metrics,
    load_sources,
)

app = typer.Typer(
    name="hip",
    help="Housing Intelligence Platform — public housing data to curated warehouse.",
    no_args_is_help=True,
    add_completion=False,
)

# Stage name -> milestone that implements it. Keep in step with ROADMAP.md.
_STAGE_MILESTONE = {
    "acquire": 2,
    "land": 2,
    "stage": 2,
    "geocode": 1,
    "validate": 2,
    "load": 2,
    "analyze": 4,
    "pack": 6,
}


def _not_yet(stage: str) -> None:
    milestone = _STAGE_MILESTONE[stage]
    typer.secho(
        f"`hip {stage}` is not implemented yet — it ships in Milestone {milestone}. "
        f"See ROADMAP.md.",
        fg=typer.colors.YELLOW,
        err=True,
    )
    raise typer.Exit(code=1)


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(__version__)
        raise typer.Exit()


@app.callback()
def main(
    version: Annotated[
        bool,
        typer.Option(
            "--version", callback=_version_callback, is_eager=True, help="Show version."
        ),
    ] = False,
) -> None:
    """Housing Intelligence Platform CLI."""


@app.command("check-config")
def check_config_command() -> None:
    """Validate config/*.yml and cross-check them against each other."""
    try:
        sources = load_sources()
        metrics = load_metrics()
        geography = load_geography()
        problems = check_config()
    except ConfigError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc

    typer.echo(
        f"{len(sources)} sources, {len(metrics)} metrics, "
        f"states={','.join(geography.states)}, "
        f"levels={','.join(geography.levels)}"
    )
    if problems:
        typer.secho(f"{len(problems)} problem(s):", fg=typer.colors.YELLOW, err=True)
        for problem in problems:
            typer.secho(f"  - {problem}", fg=typer.colors.YELLOW, err=True)
        raise typer.Exit(code=1)
    typer.secho("config OK", fg=typer.colors.GREEN)


@app.command()
def acquire() -> None:
    """Download source releases to data/raw/, content-addressed and immutable."""
    _not_yet("acquire")


@app.command()
def land() -> None:
    """Transcode raw downloads to typed Parquet under data/parquet/."""
    _not_yet("land")


@app.command()
def stage() -> None:
    """Run dbt staging models over the Parquet tier in DuckDB."""
    _not_yet("stage")


@app.command()
def geocode() -> None:
    """Resolve source geographies to region_id via GEOID match, then crosswalk."""
    _not_yet("geocode")


@app.command()
def validate() -> None:
    """Gate stage: block the load if a release fails its checks."""
    _not_yet("validate")


@app.command()
def load() -> None:
    """Load validated releases into PostgreSQL, one transaction per release."""
    _not_yet("load")


@app.command()
def analyze() -> None:
    """Rebuild derived change metrics and rankings."""
    _not_yet("analyze")


@app.command()
def pack() -> None:
    """Emit analysis packets as JSON under data/packets/."""
    _not_yet("pack")


if __name__ == "__main__":  # pragma: no cover
    app()
