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
from hip.analytics.compute import rebuild
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
from hip.geography.matching import build_observations
from hip.geography.regions import build_regions
from hip.landing.shapefile import land_shapefile
from hip.landing.tabular import land_csv, land_json
from hip.sources.base import SourceAdapter
from hip.sources.registry import (
    IMPLEMENTED,
    METRIC_SOURCES,
    UnknownSourceError,
    build_adapter,
)
from hip.sources.tiger import TigerAdapter, shapefile_member
from hip.transform.dbt_runner import (
    KEYED_MODELS,
    STAGING_SCHEMA,
    ZILLOW_MODELS,
    DbtError,
    run_dbt,
)
from hip.validate.gate import run_checks, write_report
from hip.warehouse.db import get_engine
from hip.warehouse.load import (
    MetricRecord,
    ReleaseProvenance,
    SourceRecord,
    _upsert_metrics,
    load_facts,
)
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


def _adapters(source: str | None) -> list[SourceAdapter]:
    """Resolve --source to adapters, defaulting to everything implemented."""
    scope = load_geography()
    names = [source] if source else list(IMPLEMENTED)
    try:
        return [build_adapter(name, scope) for name in names]
    except UnknownSourceError as exc:
        typer.secho(str(exc), fg=typer.colors.YELLOW, err=True)
        raise typer.Exit(code=1) from exc


@app.command()
def acquire(
    source: Annotated[
        str | None, typer.Option("--source", "-s", help="Source id; default all.")
    ] = None,
    vintage: Annotated[
        str | None, typer.Option("--vintage", help="Source vintage; defaults per source.")
    ] = None,
    force: Annotated[
        bool, typer.Option("--force", help="Re-download even if cached.")
    ] = False,
) -> None:
    """Download source releases to data/raw/, content-addressed and immutable."""
    settings = get_settings()
    total = 0
    for adapter in _adapters(source):
        for release in adapter.fetch_all(
            raw_dir=settings.raw_dir, vintage=vintage, force=force
        ):
            origin = "cached" if release.from_cache else "downloaded"
            typer.echo(
                f"{adapter.source_id:<14} {release.ref.key:<18} {origin:<10} "
                f"{release.size_bytes / 1e6:>8.1f} MB  {release.sha256[:12]}"
            )
            total += release.size_bytes
    typer.secho(f"{total / 1e6:.1f} MB in data/raw/", fg=typer.colors.GREEN)


@app.command()
def land(
    source: Annotated[
        str | None, typer.Option("--source", "-s", help="Source id; default all.")
    ] = None,
    vintage: Annotated[str | None, typer.Option("--vintage")] = None,
    overwrite: Annotated[
        bool, typer.Option("--overwrite", help="Re-transcode even if Parquet exists.")
    ] = False,
) -> None:
    """Transcode raw downloads to typed Parquet under data/parquet/."""
    settings = get_settings()
    for adapter in _adapters(source):
        for release in adapter.fetch_all(raw_dir=settings.raw_dir, vintage=vintage):
            if adapter.landing_format == "shapefile":
                table = land_shapefile(
                    release,
                    shapefile_member(release.ref),
                    parquet_dir=settings.parquet_dir,
                    overwrite=overwrite,
                )
            elif adapter.landing_format == "json":
                table = land_json(
                    release,
                    type(adapter),
                    parquet_dir=settings.parquet_dir,
                    overwrite=overwrite,
                )
            else:
                table = land_csv(
                    release,
                    parquet_dir=settings.parquet_dir,
                    overwrite=overwrite,
                    csv_options=adapter.csv_read_options,
                )
            typer.echo(
                f"{adapter.source_id:<14} {release.ref.key:<18} "
                f"{table.row_count:>8,} rows  {table.path.name}"
            )


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

        # Observations can only be resolved once `hip stage` has produced the models.
        # A geography-only run is legitimate, so absence is a notice, not an error.
        staged = _staged_models()
        present = {
            row[0]
            for row in con.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
                [STAGING_SCHEMA],
            ).fetchall()
        }
        # Match whatever has actually been staged, rather than requiring every
        # metric source to have a model. A source whose dbt model does not exist yet
        # (its adapter landed before its staging model) must not silently stop the
        # sources that do have one from being resolved.
        staged_present = {m: mid for m, mid in staged.items() if m in present}
        matches = (
            build_observations(
                con,
                staged_models=staged_present,
                staging_schema=STAGING_SCHEMA,
                keyed_models=tuple(m for m in KEYED_MODELS if m in present),
            )
            if staged_present
            else None
        )
        if missing := sorted(set(staged) - set(staged_present)):
            typer.secho(
                f"no staging model yet for: {', '.join(missing)} — "
                f"their observations are not resolved",
                fg=typer.colors.YELLOW,
            )

    for level in scope.levels:
        typer.echo(f"{level:<14} {counts.by_level.get(level, 0):>8,}")
    typer.echo(
        f"crosswalk      {crosswalk.rows:>8,} rows from {crosswalk.sources:,} ZIPs"
    )
    typer.secho(f"{counts.total:,} regions staged", fg=typer.colors.GREEN)

    if matches is None:
        typer.secho(
            "no staged metric models found — run `hip stage` to resolve observations",
            fg=typer.colors.YELLOW,
        )
        return

    typer.echo("")
    for level in ("county", "municipality", "zip"):
        available = counts.by_level.get(level, 0)
        covered = matches.regions_covered.get(level, 0)
        share = f"{100 * covered / available:.0f}%" if available else "n/a"
        typer.echo(
            f"{level:<14} {matches.matched.get(level, 0):>9,} observations   "
            f"{covered:>4,}/{available:<4,} regions ({share})"
        )
    typer.secho(
        f"{matches.total_matched:,} observations resolved; "
        f"{matches.total_rejected:,} source geographies unresolved "
        f"(see `hip validate`)",
        fg=typer.colors.GREEN,
    )


def _zillow_metric_sources() -> tuple[str, ...]:
    """Sources needing name matching. Everything else publishes an exact identifier."""
    return ("zillow_zhvi", "zillow_zori")


def _staged_models() -> dict[str, str]:
    """dbt model name -> the metric_id its values represent, derived from config.

    Fails loudly rather than guessing when a source declares several metrics: that is
    true of ACS at Milestone 3 and will need a per-column mapping, not a default.
    """
    metrics = load_metrics()
    models: dict[str, str] = {}
    for source_id in _zillow_metric_sources():
        ids = [mid for mid, m in metrics.items() if m.source_id == source_id]
        if len(ids) != 1:
            raise typer.BadParameter(
                f"metrics.yml: source '{source_id}' maps to {len(ids)} metrics "
                f"({', '.join(ids) or 'none'}); staging needs exactly one."
            )
        models[f"stg_{source_id}"] = ids[0]
    return models


@app.command()
def stage(
    vintage: Annotated[str, typer.Option("--vintage")] = "current",
    select: Annotated[str | None, typer.Option("--select", help="dbt selector.")] = None,
    skip_tests: Annotated[bool, typer.Option("--skip-tests")] = False,
) -> None:
    """Run dbt staging models over the Parquet tier in DuckDB."""
    settings = get_settings()
    scope = load_geography()
    try:
        run_dbt("run", settings=settings, scope=scope, vintage=vintage, select=select)
        typer.secho("dbt run complete", fg=typer.colors.GREEN)
        if not skip_tests:
            run_dbt(
                "test", settings=settings, scope=scope, vintage=vintage, select=select
            )
            typer.secho("dbt tests passed", fg=typer.colors.GREEN)
    except DbtError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc

    with duckdb_session(settings.duckdb_path) as con:
        for model in ZILLOW_MODELS:
            rows = con.execute(
                f"SELECT layer, count(*) FROM {STAGING_SCHEMA}.{model} "
                f"GROUP BY 1 ORDER BY 1"
            ).fetchall()
            total = sum(int(n) for _, n in rows)
            detail = "  ".join(f"{layer}={n:,}" for layer, n in rows)
            typer.echo(f"{model:<18} {total:>9,} observations   {detail}")


@app.command()
def validate() -> None:
    """Gate stage: block the load if a release fails its checks."""
    settings = get_settings()
    with duckdb_session(settings.duckdb_path) as con:
        report = run_checks(con)
    path = write_report(report, settings.data_dir.parent / "reports" / "validation")

    for check in report.checks:
        mark = "ok  " if check.passed else "FAIL"
        colour = typer.colors.GREEN if check.passed else typer.colors.RED
        typer.secho(
            f"{mark} {check.name:<34} {check.count:>9,}  {check.detail}", fg=colour
        )
    typer.echo(f"\nreport: {path}")

    if not report.passed:
        typer.secho(
            f"{len(report.failures())} check(s) failed — load blocked",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)
    typer.secho(
        f"{report.observations:,} observations cleared to load", fg=typer.colors.GREEN
    )


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

    # Facts, if any have been staged. A geography-only load stays valid.
    with duckdb_session(settings.duckdb_path) as con:
        staged = {
            row[0]
            for row in con.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'main'"
            ).fetchall()
        }
    if "stg_metric_observation" not in staged:
        return

    metric_config = load_metrics()
    metric_sources = {m.source_id for m in metric_config.values()}
    fact_provenance: list[ReleaseProvenance] = []
    fact_sources: list[SourceRecord] = []
    for source_id in METRIC_SOURCES:
        definition = configured[source_id]
        fact_sources.append(
            SourceRecord(
                source_id=source_id,
                name=definition.name,
                publisher=definition.publisher,
                license=definition.license,
                url=definition.url,
                cadence=definition.cadence,
            )
        )
        metric_adapter: SourceAdapter = build_adapter(source_id, scope)
        fact_provenance += [
            ReleaseProvenance(
                source_id=release.ref.source_id,
                layer=release.ref.layer,
                vintage=release.ref.vintage,
                fetched_at=release.fetched_at,
                file_sha256=release.sha256,
                row_count=release.size_bytes,
            )
            for release in metric_adapter.fetch_all(raw_dir=settings.raw_dir)
        ]

    facts = load_facts(
        get_engine(),
        settings.duckdb_path,
        metrics=[
            MetricRecord(metric_id=mid, **m.model_dump())
            for mid, m in metric_config.items()
            if m.source_id in metric_sources & set(METRIC_SOURCES)
        ],
        sources=fact_sources,
        releases=fact_provenance,
    )
    typer.echo("")
    for metric_id, count in sorted(facts.by_metric.items()):
        typer.echo(f"{metric_id:<14} {count:>9,} observations")
    typer.secho(
        f"{facts.observations:,} observations loaded; "
        f"{facts.rejects} unresolved geographies recorded",
        fg=typer.colors.GREEN,
    )


@app.command()
def analyze() -> None:
    """Rebuild derived change metrics, affordability ratios, and rankings."""
    metric_config = load_metrics()
    engine = get_engine()

    # Derived metrics must exist in `metrics` before facts can reference them.
    with engine.begin() as conn:
        _upsert_metrics(
            conn,
            [
                MetricRecord(metric_id=mid, **m.model_dump())
                for mid, m in metric_config.items()
                if m.source_id == "hip_derived"
            ],
        )

    result = rebuild(engine)

    for metric_id, count in sorted(result.derived_observations.items()):
        typer.echo(f"{metric_id:<20} {count:>9,} observations")
    typer.echo(f"{'change rows':<20} {result.changes:>9,}")
    typer.echo(f"{'ranking rows':<20} {result.rankings:>9,}")
    typer.secho("analytics rebuilt", fg=typer.colors.GREEN)


@app.command()
def pack() -> None:
    """Emit analysis packets as JSON under data/packets/."""
    _not_yet("pack")


if __name__ == "__main__":  # pragma: no cover
    app()
