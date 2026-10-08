"""Load dated ancillary inventories with exact-file provenance and atomic replacement."""

import json
import math
from collections.abc import Sequence
from pathlib import Path

from sqlalchemy import Engine, text

from hip.duck import duckdb_session
from hip.warehouse.load import ReleaseProvenance, _release_ids

SOURCES = (
    "eia861",
    "doe_lead",
    "njdep_lead_lines",
    "epa_ucmr5",
    "njdep_utility_areas",
    "nj_bpu_reliability",
    "nj_bpu_reports",
)


def _check_numbers(value: object) -> None:
    if isinstance(value, dict):
        for child in value.values():
            _check_numbers(child)
    elif isinstance(value, list):
        for child in value:
            _check_numbers(child)
    elif (
        isinstance(value, (float, int))
        and not isinstance(value, bool)
        and not math.isfinite(value)
    ):
        raise ValueError("infrastructure: non-finite number")


def _validate_payload(kind: str, payload: dict[str, object]) -> None:
    _check_numbers(payload)
    fields = {
        "lead_inventory": (
            "lead",
            "galvanized",
            "lead_connectors",
            "unknown",
            "non_lead",
        ),
        "pfas_samples": (
            "samples",
            "detections",
            "maximum_ng_l",
            "minimum_reporting_limit_ng_l",
            "maximum_reporting_limit_ng_l",
        ),
        "energy_burden": ("annual_energy", "mean_annual_income", "burden"),
        "utility_area": ("approximate_share",),
        "electric_utility": ("saidi_all", "saifi_all", "saidi_normal", "saifi_normal"),
        "regulatory_reliability": ("caidi_minutes", "saifi"),
    }.get(kind, ())
    for field in fields:
        value = payload.get(field)
        if value is not None and (not isinstance(value, (int, float)) or value < 0):
            raise ValueError(f"infrastructure: invalid {field}")
    if kind == "utility_area" and float(str(payload["approximate_share"])) > 1.000001:
        raise ValueError("infrastructure: invalid territory share")
    if kind == "pfas_samples" and (
        float(str(payload["detections"])) > float(str(payload["samples"]))
    ):
        raise ValueError("infrastructure: detections exceed results")
    if kind == "electric_utility":
        sales = payload.get("sales", [])
        if not isinstance(sales, list):
            raise ValueError("infrastructure: invalid electricity sales")
        for sale in sales:
            if not isinstance(sale, dict):
                raise ValueError("infrastructure: invalid electricity sale")
            for field in ("revenue_thousand", "mwh", "customers"):
                value = sale.get(field)
                if value is not None and (
                    not isinstance(value, (int, float)) or value < 0
                ):
                    raise ValueError(f"infrastructure: invalid electricity {field}")
    if kind == "regulatory_reliability":
        for field in ("caidi_minutes", "saifi", "year"):
            value = payload.get(field)
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or value <= 0
            ):
                raise ValueError(f"infrastructure: invalid regulatory {field}")


def load_infrastructure(
    engine: Engine, duckdb_path: Path, *, releases: Sequence[ReleaseProvenance]
) -> int:
    inventories = []
    with duckdb_session(duckdb_path) as duck:
        tables = {
            r[0]
            for r in duck.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='main_staging'"
            ).fetchall()
        }
        for source in SOURCES:
            table = f"stg_{source}_records"
            if table not in tables:
                continue
            result = duck.execute(
                "SELECT source_id, kind, entity_id, record_id, payload, snapshot, "
                f"release_layer, release_vintage FROM main_staging.{table}"
            )
            columns = [c[0] for c in result.description]
            rows = [dict(zip(columns, r, strict=True)) for r in result.fetchall()]
            if not rows:
                raise ValueError(f"{source}: empty infrastructure inventory")
            seen = set()
            for row in rows:
                key = (row["kind"], row["entity_id"], row["record_id"])
                if row["source_id"] != source or not all(key) or key in seen:
                    raise ValueError(f"{source}: invalid or duplicate infrastructure key")
                seen.add(key)
                _validate_payload(str(row["kind"]), json.loads(str(row["payload"])))
            inventories.append((source, rows))
    count = 0
    with engine.begin() as conn:
        ids = _release_ids(conn, releases)
        # Resolve every file before any replacement. A missing model leaves its old
        # inventory intact; a broken model/file cannot erase the previous good copy.
        for source, rows in inventories:
            for row in rows:
                key = (source, str(row["release_layer"]), str(row["release_vintage"]))
                if key not in ids:
                    raise ValueError(f"{source}: missing exact release")
                row["release_id"] = ids[key]
        for source, rows in inventories:
            conn.execute(
                text("DELETE FROM infrastructure_records WHERE source_id=:source"),
                {"source": source},
            )
            conn.execute(
                text("""INSERT INTO infrastructure_records
                (source_id, kind, entity_id, record_id, payload, snapshot, release_id)
                VALUES (:source_id, :kind, :entity_id, :record_id,
                        CAST(:payload AS jsonb), :snapshot, :release_id)"""),
                rows,
            )
            count += len(rows)
    return count
