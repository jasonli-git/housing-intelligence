"""Validated, atomically replaced ancillary components, isolated from ranked facts."""

import json
import math
import re
from collections.abc import Sequence
from pathlib import Path

from sqlalchemy import Engine, text

from hip.duck import duckdb_session
from hip.sources.fcc import SPEEDS, vintage_dates
from hip.warehouse.load import ReleaseProvenance, _release_ids

SOURCES = (
    "nj_school_performance",
    "nj_school_boundaries",
    "nj_crime",
    "cdc_places",
    "fcc_bdc",
    "nces_ccd_lea",
)
KINDS = {
    "nj_school_performance": "school_performance",
    "nj_school_boundaries": "school_area",
    "nj_crime": "crime_agency",
    "cdc_places": "health_estimate",
    "fcc_bdc": "broadband_summary",
    "nces_ccd_lea": "district_status",
}


def validate_payload(kind: str, payload: dict[str, object]) -> None:
    def percentage(value: object) -> None:
        if value is not None and (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
            or not 0 <= value <= 100
        ):
            raise ValueError("community: invalid percentage")

    if kind == "broadband_summary":
        units = payload.get("total_units")
        shares = payload.get("shares")
        if (
            isinstance(units, bool)
            or not isinstance(units, int)
            or units <= 0
            or payload.get("biz_res") != "R"
            or payload.get("area_data_type") != "Total"
            or payload.get("technology") not in {"All Wired", "Fiber", "Cable"}
            or not isinstance(shares, dict)
            or set(shares) != set(SPEEDS)
        ):
            raise ValueError("community: invalid broadband basis or denominator")
        for value in shares.values():
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
                or not 0 <= value <= 1
            ):
                raise ValueError("community: invalid broadband share")
        values = [shares[k] for k in SPEEDS]
        if any(b > a + 1e-9 for a, b in zip(values, values[1:], strict=False)):
            raise ValueError("community: invalid broadband tier ordering")
        vintage_dates(f"{payload.get('as_of')}_{payload.get('revision')}")
    elif kind == "health_estimate":
        for field in ("value", "low", "high"):
            percentage(payload.get(field))
        if payload.get("confidence") != 95:
            raise ValueError("community: health interval is not 95%")
        value, low, high = (payload.get(k) for k in ("value", "low", "high"))
        if value is not None and (
            low is None
            or high is None
            or not float(str(low)) <= float(str(value)) <= float(str(high))
        ):
            raise ValueError("community: invalid health interval")
    elif kind == "school_performance":
        indicators = payload.get("indicators")
        if not isinstance(indicators, list):
            raise ValueError("community: missing school indicators")
        for indicator in indicators:
            if not isinstance(indicator, dict):
                raise ValueError("community: invalid school indicator")
            percentage(indicator.get("value"))
    elif kind == "school_area":
        percentage(float(str(payload["approximate_share"])) * 100)
        if payload.get("district_type") not in ("unified", "elementary", "secondary"):
            raise ValueError("community: invalid district type")
    elif kind == "crime_agency":
        months = payload.get("months_reported")
        if (
            isinstance(months, bool)
            or not isinstance(months, int)
            or not 0 <= months <= 12
            or payload.get("complete") != (months == 12)
        ):
            raise ValueError("community: invalid reporting coverage")
        counts = payload.get("counts")
        if (
            not isinstance(counts, dict)
            or not counts
            or any(
                isinstance(n, bool) or not isinstance(n, int) or n < 0
                for n in counts.values()
            )
            or sum(counts.values()) != payload.get("reported_offenses")
        ):
            raise ValueError("community: invalid offense counts")
    elif kind == "district_status":
        schools = payload.get("operational_schools")
        if isinstance(schools, bool) or not isinstance(schools, int) or schools < 0:
            raise ValueError("community: invalid district status")
        successor = payload.get("successor")
        if successor is not None and (
            payload.get("status") != "Closed"
            or not isinstance(successor, dict)
            or not re.fullmatch(r"\d{2}-\d{4}", str(successor.get("district_id")))
        ):
            raise ValueError("community: invalid district successor")
    else:
        raise ValueError("community: unknown component kind")


def load_community(
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
                f"release_layer, release_vintage, file_sha256 FROM main_staging.{table}"
            )
            rows = [
                dict(zip([c[0] for c in result.description], r, strict=True))
                for r in result.fetchall()
            ]
            if not rows:
                raise ValueError(f"{source}: empty community inventory")
            seen = set()
            for row in rows:
                key = (row["kind"], row["entity_id"], row["record_id"])
                if (
                    row["source_id"] != source
                    or row["kind"] != KINDS[source]
                    or not all(key)
                    or key in seen
                ):
                    raise ValueError(f"{source}: invalid or duplicate community key")
                seen.add(key)
                validate_payload(str(row["kind"]), json.loads(str(row["payload"])))
            inventories.append((source, rows))
    count = 0
    hashes = {(r.source_id, r.layer, r.vintage): r.file_sha256 for r in releases}
    with engine.begin() as conn:
        ids = _release_ids(conn, releases)
        for source, rows in inventories:
            for row in rows:
                key = (source, str(row["release_layer"]), str(row["release_vintage"]))
                if key not in ids:
                    raise ValueError(f"{source}: missing exact release")
                if hashes[key] != row["file_sha256"]:
                    raise ValueError(
                        f"{source}: staged bytes do not match cached release; "
                        "land and stage again"
                    )
                row["release_id"] = ids[key]
        for source, rows in inventories:
            conn.execute(
                text("DELETE FROM community_records WHERE source_id=:source"),
                {"source": source},
            )
            conn.execute(
                text("""INSERT INTO community_records
                (source_id,kind,entity_id,record_id,payload,snapshot,release_id)
                VALUES (:source_id,:kind,:entity_id,:record_id,
                        CAST(:payload AS jsonb),:snapshot,:release_id)"""),
                rows,
            )
            count += len(rows)
    return count
