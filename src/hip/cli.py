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
    get_settings,
    load_geography,
    load_metrics,
    load_sources,
)
from hip.duck import duckdb_session
from hip.geography.crosswalk import build_crosswalk
from hip.geography.regions import build_regions
from hip.landing.shapefile import land_shapefile
from hip.sources.tiger import TigerAdapter, shapefile_member
from hip.warehouse.db import get_engine
from hip.warehouse.load import ReleaseProvenance, SourceRecord
from hip.warehouse.load import load_geography as load_warehouse_geography

app = typer.Typer(
    name="hip",
    help="Housing Intelligence Platform — public housing data to curated warehouse.",
    no_args_is_help=True,
    add_completion=False,
)

# Stages still to be implemented, and the milestone that delivers each. Implemented
# stages are removed from this map, so it doubles as the list of remaining work.
# Keep in step with ROADMAP.md.
_STAGE_MILESTONE = {
    "stage": 2,
    "validate": 2,
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
def acquire(
    source: Annotated[
        str, typer.Option("--source", "-s", help="Source id, e.g. census_tiger.")
    ] = "census_tiger",
    vintage: Annotated[
        str | None, typer.Option("--vintage", help="Source vintage; defaults per source.")
    ] = None,
    force: Annotated[
        bool, typer.Option("--force", help="Re-download even if cached.")
    ] = False,
) -> None:
    """Download source releases to data/raw/, content-addressed and immutable."""
    if source != TigerAdapter.source_id:
        typer.secho(
            f"Only '{TigerAdapter.source_id}' has an adapter so far; "
            f"'{source}' ships in Milestone 2. See ROADMAP.md.",
            fg=typer.colors.YELLOW,
            err=True,
        )
        raise typer.Exit(code=1)

    settings = get_settings()
    adapter = TigerAdapter(states=load_geography().states)
    total = 0
    for release in adapter.fetch_all(
        raw_dir=settings.raw_dir, vintage=vintage, force=force
    ):
        origin = "cached" if release.from_cache else "downloaded"
        typer.echo(
            f"{release.ref.key:<22} {origin:<10} "
            f"{release.size_bytes / 1e6:>8.1f} MB  {release.sha256[:12]}"
        )
        total += release.size_bytes
    typer.secho(f"{total / 1e6:.1f} MB in data/raw/{source}/", fg=typer.colors.GREEN)


@app.command()
def land(
    vintage: Annotated[str | None, typer.Option("--vintage")] = None,
    overwrite: Annotated[
        bool, typer.Option("--overwrite", help="Re-transcode even if Parquet exists.")
    ] = False,
) -> None:
    """Transcode raw downloads to typed Parquet under data/parquet/."""
    settings = get_settings()
    adapter = TigerAdapter(states=load_geography().states)
    for release in adapter.fetch_all(raw_dir=settings.raw_dir, vintage=vintage):
        table = land_shapefile(
            release,
            shapefile_member(release.ref),
            parquet_dir=settings.parquet_dir,
            overwrite=overwrite,
        )
        typer.echo(f"{release.ref.key:<22} {table.row_count:>8,} rows  {table.path}")


@app.command()
def geocode(
    vintage: Annotated[str | None, typer.Option("--vintage")] = None,
) -> None:
    """Resolve source geographies to region rows and build allocation crosswalks."""
    settings = get_settings()
    scope = load_geography()
    with duckdb_session(settings.duckdb_path, spatial=True) as con:
        counts = build_regions(
            con,
            parquet_dir=settings.parquet_dir,
            vintage=vintage or TigerAdapter.default_vintage,
            scope=scope,
        )
        crosswalk = build_crosswalk(con)

    for level in scope.levels:
        typer.echo(f"{level:<14} {counts.by_level.get(level, 0):>8,}")
    typer.echo(
        f"crosswalk      {crosswalk.rows:>8,} rows from {crosswalk.sources:,} ZIPs"
    )
    typer.secho(f"{counts.total:,} regions staged", fg=typer.colors.GREEN)


@app.command()
def stage() -> None:
    """Run dbt staging models over the Parquet tier in DuckDB."""
    _not_yet("stage")


@app.command()
def validate() -> None:
    """Gate stage: block the load if a release fails its checks."""
    _not_yet("validate")


@app.command()
def load(
    vintage: Annotated[str | None, typer.Option("--vintage")] = None,
) -> None:
    """Load the staged geography spine into PostgreSQL in one transaction."""
    settings = get_settings()
    scope = load_geography()
    configured = load_sources()
    adapter = TigerAdapter(states=scope.states)

    source = configured[TigerAdapter.source_id]
    provenance = [
        ReleaseProvenance(
            source_id=release.ref.source_id,
            layer=release.ref.key,
            vintage=release.ref.vintage,
            fetched_at=release.fetched_at,
            file_sha256=release.sha256,
            row_count=release.size_bytes,
        )
        for release in adapter.fetch_all(raw_dir=settings.raw_dir, vintage=vintage)
    ]

    result = load_warehouse_geography(
        get_engine(),
        settings.duckdb_path,
        sources=[
            SourceRecord(
                source_id=TigerAdapter.source_id,
                name=source.name,
                publisher=source.publisher,
                license=source.license,
                url=source.url,
                cadence=source.cadence,
            )
        ],
        releases=provenance,
    )

    for level, count in result.regions_by_level.items():
        typer.echo(f"{level:<14} {count:>8,}")
    typer.echo(f"crosswalk      {result.crosswalk_rows:>8,}")
    typer.secho(
        f"{result.total_regions:,} regions loaded from {result.releases} releases",
        fg=typer.colors.GREEN,
    )


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
