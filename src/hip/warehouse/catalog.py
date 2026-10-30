"""The Data Explorer's catalog (Milestone 59): how the warehouse is organized.

Assembled from what already describes the pipeline, so it cannot drift from it: the
source and metric registries, dbt's manifest and compiled SQL, DuckDB's staged tables and
Postgres's own catalog. Nothing here is written by hand.

Metadata and aggregates only. Postgres figures come from `pg_stats`'s null fraction and
distinct estimate, never its most-common values or histograms, and staged tables give only
their column names and row counts: the parcel and sales files carry addresses, and a
sample of them has no place on a public page (ARCHITECTURE #296).
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import duckdb
from sqlalchemy import Connection, text

from hip.config import Metric, Source

# PostGIS's and Alembic's own tables say nothing about housing.
_SYSTEM_TABLES = {"alembic_version", "spatial_ref_sys", "layer", "topology"}
_PARQUET_DIR = re.compile(r"""parquet(?:_dir"\) \}\})?/([a-z0-9_]+)/""")


def _compiled_sql(target: Path) -> dict[str, str]:
    """Each model's SQL after macros, where most Parquet paths are spelled out."""
    root = target / "compiled"
    return {path.stem: path.read_text() for path in root.rglob("models/**/*.sql")}


def _staged_tables(duckdb_path: Path) -> dict[str, dict[str, Any]]:
    """Column names, types and row counts of DuckDB's staged tables, read-only."""
    if not duckdb_path.exists():
        return {}
    con = duckdb.connect(str(duckdb_path), read_only=True)
    try:
        tables: dict[str, dict[str, Any]] = {
            name: {"rows": rows, "columns": []}
            for name, rows in con.execute(
                "SELECT table_name, estimated_size FROM duckdb_tables() "
                "WHERE schema_name = 'main_staging'"
            ).fetchall()
        }
        for table, column, kind in con.execute(
            "SELECT table_name, column_name, data_type FROM information_schema.columns "
            "WHERE table_schema = 'main_staging' ORDER BY table_name, ordinal_position"
        ).fetchall():
            if table in tables:
                tables[table]["columns"].append({"name": column, "type": kind.lower()})
        return tables
    finally:
        con.close()


def model_catalog(
    target: Path,
    duckdb_path: Path,
    *,
    sources: dict[str, Source],
    metrics: dict[str, Metric],
) -> list[dict[str, Any]]:
    """Every dbt model, with what feeds it and which metrics it names."""
    manifest_path = target / "manifest.json"
    if not manifest_path.exists():
        return []
    manifest = json.loads(manifest_path.read_text())
    nodes = manifest["nodes"].values()
    compiled = _compiled_sql(target)
    staged = _staged_tables(duckdb_path)

    tests: Counter[str] = Counter()
    for node in nodes:
        if node["resource_type"] == "test":
            for parent in node["depends_on"]["nodes"]:
                tests[parent.split(".")[-1]] += 1

    catalog = []
    for node in sorted(nodes, key=lambda n: n["name"]):
        if node["resource_type"] != "model":
            continue
        name = node["name"]
        sql = compiled.get(name, node["raw_code"])
        table = staged.get(name, {"rows": None, "columns": []})
        catalog.append(
            {
                "name": name,
                "description": node["description"],
                "rows": table["rows"],
                "columns": table["columns"],
                "tests": tests[name],
                "upstream": sorted(
                    dep.split(".")[-1]
                    for dep in node["depends_on"]["nodes"]
                    if dep.startswith("model.")
                ),
                "sources": sorted(set(_PARQUET_DIR.findall(sql)) & set(sources)),
                "metrics": sorted(m for m in metrics if f"'{m}'" in sql),
            }
        )
    return catalog


def table_catalog(conn: Connection) -> list[dict[str, Any]]:
    """The serving tables: columns, null rates, and the foreign keys that join them."""
    rows = {
        name: {"rows": max(int(count), 0), "bytes": size}
        for name, count, size in conn.execute(
            text(
                """
                SELECT c.relname, c.reltuples, pg_total_relation_size(c.oid)
                FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
                """
            )
        )
        if name not in _SYSTEM_TABLES
    }
    columns: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for table, column, kind, nullable, null_frac, distinct in conn.execute(
        text(
            """
            SELECT c.table_name, c.column_name, c.data_type, c.is_nullable = 'YES',
                   s.null_frac, s.n_distinct
            FROM information_schema.columns c
            LEFT JOIN pg_stats s ON s.schemaname = c.table_schema
              AND s.tablename = c.table_name AND s.attname = c.column_name
            WHERE c.table_schema = 'public'
            ORDER BY c.table_name, c.ordinal_position
            """
        )
    ):
        columns[table].append(
            {
                "name": column,
                "type": kind,
                "nullable": nullable,
                "null_share": None if null_frac is None else round(float(null_frac), 4),
                # Postgres writes a share of the rows as a negative number.
                "distinct": None
                if distinct is None
                else round(
                    float(distinct)
                    if distinct >= 0
                    else -float(distinct) * rows.get(table, {"rows": 0})["rows"]
                ),
            }
        )
    keys: dict[str, list[dict[str, str]]] = defaultdict(list)
    for table, column, parent in conn.execute(
        text(
            """
            SELECT c.conrelid::regclass::text, a.attname, c.confrelid::regclass::text
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
            WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
            ORDER BY 1, 2
            """
        )
    ):
        keys[table].append({"column": column, "references": parent})
    return [
        {"name": name, **rows[name], "columns": columns[name], "foreign_keys": keys[name]}
        for name in sorted(rows)
    ]


def metric_coverage(conn: Connection) -> dict[str, dict[str, Any]]:
    """How much of each metric the warehouse holds."""
    return {
        metric: {
            "observations": count,
            "places": places,
            "first": first.isoformat(),
            "last": last.isoformat(),
        }
        for metric, count, places, first, last in conn.execute(
            text(
                """
                SELECT metric_id, count(*), count(DISTINCT region_id),
                       min(period_end), max(period_end)
                FROM fact_metric_observation GROUP BY metric_id
                """
            )
        )
    }


def build_catalog(
    conn: Connection,
    *,
    target: Path,
    duckdb_path: Path,
    sources: dict[str, Source],
    metrics: dict[str, Metric],
) -> dict[str, Any]:
    """The whole catalog, as `GET /catalog` serves it."""
    coverage = metric_coverage(conn)
    return {
        "sources": [
            {
                "id": source_id,
                "name": source.name,
                "publisher": source.publisher,
                "cadence": source.cadence,
                "homepage": source.homepage or source.url,
            }
            for source_id, source in sources.items()
        ],
        "models": model_catalog(target, duckdb_path, sources=sources, metrics=metrics),
        "tables": table_catalog(conn),
        "metrics": [
            {
                "id": metric_id,
                "label": metric.label,
                "unit": metric.unit,
                "frequency": metric.frequency,
                "kind": metric.record_type,
                "description": metric.description,
                "source": metric.source_id,
                "inputs": metric.inputs,
                **coverage.get(
                    metric_id,
                    {"observations": 0, "places": 0, "first": None, "last": None},
                ),
            }
            for metric_id, metric in metrics.items()
        ],
    }
