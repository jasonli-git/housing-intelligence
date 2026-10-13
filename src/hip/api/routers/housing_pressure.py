"""Read-only, source-linked CHAS income cohorts. No ZIP interpolation."""

import math
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from hip.api.deps import SessionDep

router = APIRouter(tags=["regions"])
SOURCE_URL = "https://www.huduser.gov/portal/datasets/cp.html"


def ratio_margin(n: float, total: float, moe_n: float, moe_total: float) -> float | None:
    if total <= 0 or n > total:
        return None
    term = moe_n**2 - (n / total) ** 2 * moe_total**2
    return (
        math.sqrt(term if term >= 0 else moe_n**2 + (n / total) ** 2 * moe_total**2)
        / total
    )


@router.get("/regions/{region_id}/housing-pressure")
def housing_pressure(region_id: int, session: SessionDep) -> dict[str, Any]:
    region = (
        session.execute(
            text("SELECT level::text,geoid,state_code FROM regions WHERE region_id=:id"),
            {"id": region_id},
        )
        .mappings()
        .first()
    )
    if not region or region["level"] not in ("county", "municipality", "state"):
        raise HTTPException(404, "No income-group housing figures for this geography")
    if region["level"] == "state":
        members = (
            session.execute(
                text(
                    "SELECT geoid FROM regions WHERE level='county' AND state_code=:state"
                ),
                {"state": region["state_code"]},
            )
            .scalars()
            .all()
        )
        entities = [f"county:{geo}" for geo in members]
    else:
        entities = [f"{region['level']}:{region['geoid']}"]
    rows = (
        session.execute(
            text("""SELECT c.entity_id,c.payload,c.release_id,s.file_sha256,s.fetched_at
        FROM community_records c JOIN source_releases s USING(release_id)
        WHERE c.kind='housing_pressure' AND c.source_id='hud_chas_bulk'
          AND c.entity_id=ANY(:entities)
        ORDER BY c.entity_id,c.record_id"""),
            {"entities": entities},
        )
        .mappings()
        .all()
    )
    if (
        not entities
        or len(rows) != len(entities) * 10
        or {r["entity_id"] for r in rows} != set(entities)
    ):
        raise HTTPException(404, "Incomplete income-group coverage")
    if {r["payload"]["vintage"] for r in rows} != {"2018-2022"}:
        raise HTTPException(404, "No reviewed, common survey period")
    bands = []
    for tenure in ("renter", "owner"):
        for band in range(5):
            cells = [
                r["payload"]
                for r in rows
                if r["payload"]["tenure"] == tenure and r["payload"]["band"] == band
            ]
            if len(cells) != len(entities):
                raise HTTPException(404, "Incomplete income-group coverage")
            total = sum(float(c["total"]) for c in cells)
            estimate = {
                key: sum(float(c[key]) for c in cells)
                for key in ("burdened", "severe", "unknown")
            }
            # Largest zero-estimate margin once, as in the existing CHAS sum macro.
            margins = {
                key: math.sqrt(
                    sum(float(c[f"{key}_moe"]) ** 2 for c in cells if c[key] != 0)
                    + max(
                        (float(c[f"{key}_moe"]) for c in cells if c[key] == 0), default=0
                    )
                    ** 2
                )
                for key in ("total", "burdened", "severe", "unknown")
            }
            bands.append(
                {
                    "tenure": tenure,
                    "band": band,
                    "total": total,
                    **estimate,
                    "share": estimate["burdened"] / total
                    if total > 0 and estimate["burdened"] <= total
                    else None,
                    "margin": ratio_margin(
                        estimate["burdened"], total, margins["burdened"], margins["total"]
                    ),
                }
            )
    releases = {
        r["release_id"]: {
            "release_id": r["release_id"],
            "file_sha256": r["file_sha256"],
            "fetched_at": r["fetched_at"],
        }
        for r in rows
    }
    return {
        "region_id": region_id,
        "period": "2018–2022",
        "basis": "county_sum" if region["level"] == "state" else "direct",
        "areas": len(entities),
        "bands": bands,
        "releases": list(releases.values()),
        "source": "HUD CHAS, Table 8",
        "source_url": SOURCE_URL,
    }
