"""The community water systems serving a town or ZIP code (Milestone 40, #304).

Each system whose retail area holds at least 1% of the place's homes, or 50 of them,
with its health-based violations over five calendar years from EPA's SDWIS. A list of
records, never a score: a violation is a period the water broke a rule, and the page
links each system's own record for what happened and what was done.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep

router = APIRouter(tags=["regions"])


class WaterSystem(BaseModel):
    pwsid: str
    name: str
    homes: float
    share_of_homes: float
    violations: int
    latest_violation: date | None
    latest_violation_what: str | None
    violation_kinds: str | None


class WaterSystems(BaseModel):
    region_id: int
    first_year: int
    last_year: int
    systems: list[WaterSystem]
    source: str = "EPA SDWIS; NJDEP purveyor service areas"


_SQL = text(
    """
    SELECT pwsid, name, homes, share_of_homes, violations, first_year, last_year,
           latest_violation, latest_violation_what, violation_kinds
    FROM water_systems WHERE region_id = :region_id
    ORDER BY homes DESC, pwsid
    """
)


@router.get(
    "/regions/{region_id}/water-systems",
    response_model=WaterSystems,
    summary="Community water systems serving the region, with recent violations",
)
def water_systems(region_id: int, session: SessionDep) -> WaterSystems:
    """404 for a region with no listed system: a county or the state, which are not
    listed, or a town whose homes are all on private wells."""
    rows = session.execute(_SQL, {"region_id": region_id}).mappings().all()
    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No water systems listed for region {region_id}"
        )
    return WaterSystems(
        region_id=region_id,
        first_year=int(rows[0]["first_year"]),
        last_year=int(rows[0]["last_year"]),
        systems=[
            WaterSystem(
                pwsid=r["pwsid"],
                name=r["name"],
                homes=float(r["homes"]),
                share_of_homes=float(r["share_of_homes"]),
                violations=int(r["violations"]),
                latest_violation=r["latest_violation"],
                latest_violation_what=r["latest_violation_what"],
                violation_kinds=r["violation_kinds"],
            )
            for r in rows
        ],
    )
