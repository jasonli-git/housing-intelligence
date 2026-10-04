"""Housing need, reported delivery and places to apply are different answers."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep

router = APIRouter(tags=["regions"])


class HousingRecord(BaseModel):
    source_id: str
    kind: str
    record_id: str
    region_id: int
    place: str
    payload: dict[str, Any]
    snapshot: date
    release_id: int
    fetched_at: datetime
    source_url: str


class AffordableHousing(BaseModel):
    region_id: int
    level: str
    records: list[HousingRecord]
    overview: bool = False
    stats: dict[str, float | int | None] = {}
    county_inventory_region_id: int | None = None
    # The inventory is never combined across programmes: the same building may appear
    # in DCA, LIHTC and HUD, and even twice in LIHTC after a resyndication.
    limitations: list[str] = [
        "DCA fourth-round need is non-binding, not final court-approved obligations.",
        "Municipal project reports span rounds; not fourth-round compliance.",
        "Inventories overlap. No combined total, vacancies or eligibility is inferred.",
        "HUD assisted properties have county geography only here; "
        "mailing cities are not municipalities.",
        "LIHTC is a dated bulk inventory, not verified current availability. "
        "Unknown and out-of-coverage service years are labelled separately.",
        "LIHTC towns require a verified Census place-to-municipality relationship; "
        "unresolved records remain at county or state level.",
        "No longer monitored for LIHTC compliance does not establish whether "
        "a property remains affordable. Blank monitoring status is unknown.",
        "Disabled-resident targeting does not establish physical accessibility.",
        "Contract/control dates may be extended; expiry does not predict lost homes.",
        "NHPD is not held: public redistribution needs a signed data licence.",
    ]


@router.get("/regions/{region_id}/affordable-housing", response_model=AffordableHousing)
def affordable_housing(
    region_id: int, session: SessionDep, overview: bool = False
) -> AffordableHousing:
    region = (
        session.execute(
            text(
                "SELECT region_id, geoid, level::text AS level, parent_id FROM regions "
                "WHERE region_id = :id"
            ),
            {"id": region_id},
        )
        .mappings()
        .first()
    )
    if not region or region["level"] not in ("state", "county", "municipality"):
        raise HTTPException(404, "No directly located affordable-housing inventory")
    # Town records aggregate into their county and state by exact GEOID. No allocation
    # to ZCTAs and no name/ZIP-based guess at the municipality of a mailed address.
    width = {"state": 2, "county": 5, "municipality": 10}[region["level"]]
    rows = (
        session.execute(
            text("""
        SELECT a.*, r.name_lsad AS place, sr.fetched_at,
               coalesce(nullif(s.homepage, ''), s.url) AS source_url
        FROM affordable_housing_records a
        JOIN regions r ON r.region_id = a.region_id
        JOIN source_releases sr ON sr.release_id = a.release_id
        JOIN sources s ON s.source_id = a.source_id
        WHERE left(r.geoid, :width) = :geoid
        ORDER BY a.source_id, a.kind, a.record_id
    """),
            {"width": width, "geoid": region["geoid"]},
        )
        .mappings()
        .all()
    )
    if not rows:
        raise HTTPException(404, "Affordable-housing data has not been loaded here")
    records = [HousingRecord(**dict(r)) for r in rows]
    needs = [r for r in records if r.kind == "need"]
    projects = [r for r in records if r.kind == "municipal_project"]
    funds = [r for r in records if r.kind == "trust_fund"]
    reported_funds = [r for r in funds if r.payload.get("reported")]

    def total(group: list[HousingRecord], field: str) -> float | None:
        values = [r.payload[field] for r in group if r.payload.get(field) is not None]
        return sum(values) if values else None

    stats: dict[str, float | int | None] = {
        "present_need": total(needs, "present_need"),
        "prospective_need": total(needs, "prospective_need"),
        "completed_units": total(
            [r for r in projects if r.payload.get("completed_for_summary") is True],
            "units",
        ),
        "trust_balance": total(reported_funds, "balance"),
        "projects": len(projects),
        "project_towns": len({r.region_id for r in projects}),
        "listed_towns": len(needs),
        "unknown_completion": len(
            [r for r in projects if r.payload.get("completed") is None]
        ),
        "funds_reported": len(reported_funds),
        "funds_listed": len(funds),
    }
    if overview:
        # One example/provenance row per layer, not 10,000 properties in first paint.
        records = list({(r.source_id, r.kind): r for r in records}.values())
    return AffordableHousing(
        region_id=region_id,
        level=region["level"],
        county_inventory_region_id=region["parent_id"]
        if region["level"] == "municipality"
        else None,
        records=records,
        overview=overview,
        stats=stats,
    )
