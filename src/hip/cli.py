"""``hip`` command line entry point.

One command per pipeline stage, in the order they run (see the Pipeline section of
ARCHITECTURE.md). Every write path to the warehouse is here and nowhere else — the API
never triggers a stage (ARCHITECTURE #6).

All eight stages are implemented as of Milestone 6. Until then each unimplemented stage
exited non-zero naming the milestone that would deliver it, so a stub could never be
mistaken for a successful run; `_STAGE_MILESTONE` is the now-empty record of that, and
a test fails if it and the command list disagree.
"""

from __future__ import annotations

import logging
import sys
from typing import Annotated

import typer
from sqlalchemy.orm import Session

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
from hip.geography.crosswalk import apply_hud_weights, build_crosswalk
from hip.geography.matching import build_observations
from hip.geography.regions import build_regions
from hip.landing.shapefile import land_shapefile
from hip.landing.tabular import land_csv, land_json, land_ndjson
from hip.packets import (
    SCHEMA_PATH,
    Packet,
    PacketUnavailable,
    build_packet,
    regions_for_level,
    render_markdown,
    schema_text,
)
from hip.sources.base import SourceAdapter
from hip.sources.registry import (
    IMPLEMENTED,
    METRIC_SOURCES,
    UnknownSourceError,
    build_adapter,
)
from hip.sources.tiger import TigerAdapter, shapefile_member
from hip.transform.dbt_runner import (
    CROSSWALK_MODEL,
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
    load_region_identifiers,
)
from hip.warehouse.load import load_geography as load_warehouse_geography

app = typer.Typer(
    name="hip",
    help="Housing Intelligence Platform — public housing data to curated warehouse.",
    no_args_is_help=True,
    add_completion=False,
)

# Stages still to be implemented, and the milestone that delivers each. Implemented
# stages are removed from this map, so it doubles as the list of remaining work — empty
# since Milestone 6, when `pack` landed and the pipeline became complete.
_STAGE_MILESTONE: dict[str, int] = {}


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
    # Adapters report long-running progress through `logging` rather than printing,
    # because a source module writing to stdout would couple the pipeline to a
    # particular front end. Without a handler the NJ parcel fetch is silent for half
    # an hour, so the entry point installs one.
    logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stderr)
    # httpx logs every request at INFO. For a source that issues 1,741 of them that is
    # 1,741 lines of URL between us and the progress we actually wanted.
    logging.getLogger("httpx").setLevel(logging.WARNING)


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
            elif adapter.landing_format == "ndjson":
                table = land_ndjson(
                    release, parquet_dir=settings.parquet_dir, overwrite=overwrite
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
        hud_rows, crosswalk_total = (
            apply_hud_weights(con, staging_schema=STAGING_SCHEMA)
            if CROSSWALK_MODEL
            in {
                r[0]
                for r in con.execute(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = ?",
                    [STAGING_SCHEMA],
                ).fetchall()
            }
            else (0, crosswalk.rows)
        )

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
        f"crosswalk      {crosswalk_total:>8,} rows from {crosswalk.sources:,} ZIPs"
    )
    if hud_rows:
        typer.echo(
            f"  of which      {hud_rows:>8,} use HUD residential-address weights, "
            f"{crosswalk_total - hud_rows:,} area"
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
    path = write_report(report, settings.reports_dir / "validation")

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

    # NJ municipal codes, if a source has staged them. Delivers the column
    # region_identifiers has held open since Milestone 1 (ARCHITECTURE #21).
    identifiers = load_region_identifiers(get_engine(), settings.duckdb_path)
    if identifiers:
        typer.echo(f"identifiers   {identifiers:>8,} nj_cd_code")

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
    typer.echo(f"{'change rankings':<20} {result.rankings:>9,}")
    typer.echo(f"{'value rankings':<20} {result.value_rankings:>9,}")
    typer.secho("analytics rebuilt", fg=typer.colors.GREEN)


@app.command()
def pack(
    region: Annotated[
        int | None, typer.Option("--region", "-r", help="One region id; default all.")
    ] = None,
    level: Annotated[
        str, typer.Option("--level", help="Level to pack when --region is absent.")
    ] = "county",
    window: Annotated[str, typer.Option("--window", help="Change window label.")] = "5y",
    report: Annotated[
        bool, typer.Option("--report", help="Also write a Markdown report per region.")
    ] = False,
) -> None:
    """Emit analysis packets as JSON under data/packets/<window>/.

    Each packet is re-parsed from the exact bytes about to be written before the file
    is created, so a packet on disk has always satisfied the model that generated
    `schemas/packet-v1.json`. The published schema file itself is exercised against
    real packets in `tests/test_packets.py`, which keeps `jsonschema` out of the
    runtime dependencies.
    """
    settings = get_settings()
    out_dir = settings.packets_dir / window
    report_dir = settings.reports_dir / "regions" / window
    out_dir.mkdir(parents=True, exist_ok=True)
    if report:
        report_dir.mkdir(parents=True, exist_ok=True)

    with Session(get_engine()) as session:
        region_ids = (
            [region] if region is not None else regions_for_level(session, level, window)
        )
        if not region_ids:
            typer.secho(
                f"no {level} regions have analytics for window '{window}' — "
                f"run `hip analyze`",
                fg=typer.colors.YELLOW,
                err=True,
            )
            raise typer.Exit(code=1)

        # Per-region lines are useful for a county run and noise for 564 municipalities.
        verbose = len(region_ids) <= 30
        written = 0
        skipped: list[str] = []
        for region_id in region_ids:
            try:
                packet = build_packet(session, region_id, window)
            except PacketUnavailable as exc:
                # An explicit --region that cannot be packed is an error; one bad
                # region in a bulk run is a gap to report, not a reason to stop.
                if region is not None:
                    typer.secho(str(exc), fg=typer.colors.RED, err=True)
                    raise typer.Exit(code=1) from exc
                skipped.append(str(exc))
                continue

            payload = packet.model_dump_json(indent=2) + "\n"
            Packet.model_validate_json(payload)
            (out_dir / f"{region_id}.json").write_text(payload)
            if report:
                (report_dir / f"{packet.region.geoid}.md").write_text(
                    render_markdown(packet)
                )
            written += 1
            if verbose:
                typer.echo(
                    f"{packet.region.label:<28} {len(packet.metrics):>3} metrics  "
                    f"{len(packet.sources):>2} sources  "
                    f"{len(packet.caveats):>2} caveats  {len(payload) / 1024:>5.1f} KB"
                )

    for problem in skipped:
        typer.secho(f"skipped: {problem}", fg=typer.colors.YELLOW, err=True)
    typer.secho(
        f"{written:,} packets written to {out_dir}"
        + (f"; {written:,} reports to {report_dir}" if report else ""),
        fg=typer.colors.GREEN,
    )


@app.command()
def schema(
    write: Annotated[
        bool, typer.Option("--write", help="Update schemas/packet-v1.json in place.")
    ] = False,
) -> None:
    """Print the published analysis-packet JSON Schema (ARCHITECTURE #12)."""
    text = schema_text()
    if not write:
        typer.echo(text, nl=False)
        return
    SCHEMA_PATH.parent.mkdir(parents=True, exist_ok=True)
    SCHEMA_PATH.write_text(text)
    typer.secho(f"wrote {SCHEMA_PATH}", fg=typer.colors.GREEN)


if __name__ == "__main__":  # pragma: no cover
    app()
