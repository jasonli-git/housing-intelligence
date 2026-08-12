"""Run the dbt project against the DuckDB transform tier.

dbt is invoked through its Python entry point rather than a subprocess so failures come
back as structured results instead of parsed stdout. It lives in its own dependency
group (ARCHITECTURE #19), so the import is deferred: a missing dbt should say so, not
raise ImportError from module import.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from hip.config import REPO_ROOT, GeographyScope, Settings

DBT_DIR = REPO_ROOT / "dbt"

# dbt-duckdb prefixes the configured `+schema` with the target schema, so models
# configured as `staging` land in `main_staging`. Downstream SQL must qualify them.
STAGING_SCHEMA = "main_staging"

# The staged models the rest of the pipeline reads.
ZILLOW_MODELS = ("stg_zillow_zhvi", "stg_zillow_zori")

# Models that already carry an exact (geoid, level); they need no name matching and are
# unioned straight into the observation table.
KEYED_MODELS = (
    "stg_census_acs",
    "stg_fhfa_hpi",
    "stg_census_permits",
    "stg_irs_migration",
    "stg_fred",
    "stg_bls",
    "stg_hud_income_limits",
)

# Not a metric model: it feeds region_crosswalk, not fact_metric_observation.
CROSSWALK_MODEL = "stg_hud_crosswalk"


class DbtError(Exception):
    """dbt is missing, or a dbt invocation failed."""


@dataclass(frozen=True)
class DbtResult:
    command: str
    success: bool
    messages: list[str]


def _runner() -> Any:
    try:
        from dbt.cli.main import dbtRunner
    except ImportError as exc:  # pragma: no cover - depends on install profile
        raise DbtError(
            "dbt is not installed. It lives in the 'dbt' dependency group: "
            "run `uv sync --group dbt`, or `make setup`."
        ) from exc
    return dbtRunner()


def dbt_vars(
    settings: Settings, scope: GeographyScope, vintage: str
) -> dict[str, object]:
    """Everything the models need that is not knowable from the dbt project alone."""
    from hip.config import fips_for

    return {
        "parquet_dir": str(settings.parquet_dir),
        # Rendered straight into an IN (...) clause, so they must arrive pre-quoted.
        "states": ", ".join(f"'{s}'" for s in scope.states),
        "state_fips": ", ".join(f"'{fips_for(s)}'" for s in scope.states),
        # Sources that identify states by postal code need a mapping to the FIPS code
        # `regions` keys on. FHFA is the only one today.
        "state_fips_pairs": [[s, fips_for(s)] for s in scope.states],
        "zillow_vintage": vintage,
    }


def run_dbt(
    command: str,
    *,
    settings: Settings,
    scope: GeographyScope,
    vintage: str,
    select: str | None = None,
    duckdb_path: Path | None = None,
) -> DbtResult:
    """Run one dbt command. Raises DbtError on failure, with dbt's own messages."""
    import os

    # dbt-duckdb resolves a relative profile path against the working directory, and
    # hip commands can be run from anywhere.
    os.environ.setdefault("HIP_DUCKDB_PATH", str(duckdb_path or settings.duckdb_path))

    args = [
        command,
        "--project-dir",
        str(DBT_DIR),
        "--profiles-dir",
        str(DBT_DIR),
        "--target",
        "duckdb",
        "--vars",
        str(dbt_vars(settings, scope, vintage)),
    ]
    if select:
        args += ["--select", select]

    result = _runner().invoke(args)

    # dbt's RunResult objects repr to several kilobytes of node metadata each. Only the
    # node name and its message are useful, and dumping the rest buries the actual error.
    failures = [
        f"{getattr(node.node, 'name', '?')}: {node.message}"
        for node in getattr(result.result, "results", [])
        if str(getattr(node, "status", "")).endswith(("error", "fail"))
    ]

    if not result.success:
        detail = "; ".join(failures) or str(result.exception) or "see dbt output above"
        raise DbtError(f"dbt {command} failed — {detail}")
    return DbtResult(command=command, success=True, messages=failures)
