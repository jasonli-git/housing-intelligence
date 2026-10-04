"""Dated utility/company context, never an individual household cost quote."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep

router = APIRouter(tags=["regions"])


class InfrastructureRecord(BaseModel):
    source_id: str
    kind: str
    entity_id: str
    record_id: str
    payload: dict[str, Any]
    release_id: int
    vintage: str
    file_sha256: str
    fetched_at: datetime


class UtilityProvider(BaseModel):
    fuel: str
    provider: str
    approximate_share: float
    territory: InfrastructureRecord
    electricity: InfrastructureRecord | None = None


class Utilities(BaseModel):
    region_id: int
    providers: list[UtilityProvider]
    energy_context: InfrastructureRecord | None = None


RECORDS_SQL = text("""
    SELECT i.source_id, i.kind, i.entity_id, i.record_id, i.payload, i.release_id,
           sr.vintage, sr.file_sha256, sr.fetched_at
    FROM infrastructure_records i JOIN source_releases sr USING (release_id)
    WHERE i.entity_id = ANY(:entities)
    ORDER BY i.source_id, i.entity_id, i.record_id
""")


def records_for(session: SessionDep, entities: list[str]) -> list[InfrastructureRecord]:
    return [
        InfrastructureRecord(**dict(r))
        for r in session.execute(RECORDS_SQL, {"entities": entities}).mappings()
    ]


@router.get("/regions/{region_id}/utilities", response_model=Utilities)
def utilities(region_id: int, session: SessionDep) -> Utilities:
    region = (
        session.execute(
            text("""
        SELECT r.geoid, r.level::text AS level, c.geoid AS county_geoid
        FROM regions r LEFT JOIN regions c ON c.region_id =
            CASE WHEN r.level='county' THEN r.region_id
                 WHEN r.level='municipality' THEN r.parent_id END
        WHERE r.region_id=:id
    """),
            {"id": region_id},
        )
        .mappings()
        .first()
    )
    if region is None:
        raise HTTPException(404, "No such region")
    # ZIPs do not nest in one county: no unlabelled county energy fallback.
    entity = f"{region['level']}:{region['geoid']}"
    county = f"county:{region['county_geoid']}" if region["county_geoid"] else entity
    local = records_for(session, list({entity, county}))
    territories = [r for r in local if r.kind == "utility_area" and r.entity_id == entity]
    ids = list(
        {f"utility:{r.payload['eia_id']}" for r in territories if r.payload.get("eia_id")}
    )
    company = {r.record_id: r for r in records_for(session, ids)} if ids else {}
    energy = next(
        (r for r in local if r.kind == "energy_burden" and r.entity_id == county), None
    )
    if not territories and energy is None:
        raise HTTPException(404, "No utility context loaded for this region")
    return Utilities(
        region_id=region_id,
        providers=[
            UtilityProvider(
                fuel=str(r.payload["fuel"]),
                provider=str(r.payload["provider"]),
                approximate_share=float(r.payload["approximate_share"]),
                territory=r,
                electricity=company.get(str(r.payload.get("eia_id"))),
            )
            for r in territories
        ],
        energy_context=energy,
    )
