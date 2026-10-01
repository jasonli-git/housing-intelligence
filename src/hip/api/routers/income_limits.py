"""HUD's income limits for a region's county, every band and size (Milestone 35).

HUD sets the limits per county (per HUD area, which in New Jersey is a county or a group
of them), so a town reads its county's and says so. A ZIP code nests in nothing; it reads
the county holding most of its residential addresses, by HUD's own crosswalk weights
(ARCHITECTURE #285).

Positions, never eligibility: the endpoint gives the lines, and the page says where an
income sits against them. Whether a household qualifies for a program turns on rules
this data does not hold.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep

router = APIRouter(tags=["regions"])

# HUD's own names for the three bands, by percent of area median income.
BAND_NAMES = {30: "extremely low income", 50: "very low income", 80: "low income"}


class IncomeBand(BaseModel):
    band: int
    hud_name: str
    # Index 0 is a household of one, index 7 a household of eight.
    limits: list[float]


class IncomeLimits(BaseModel):
    region_id: int
    county_id: int
    county_name: str
    # How the county was reached: the region itself, its parent, or a ZIP's crosswalk.
    via: str
    fiscal_year: int
    # HUD's area median family income, for a family of four.
    median_income: float | None
    bands: list[IncomeBand]
    source: str = "HUD User, Income Limits"


_COUNTY_SQL = text(
    """
    SELECT r.level::text AS level,
           CASE r.level
               WHEN 'county' THEN r.region_id
               WHEN 'municipality' THEN r.parent_id
               WHEN 'zip' THEN (
                   SELECT x.to_region_id FROM region_crosswalk x
                   JOIN regions c ON c.region_id = x.to_region_id AND c.level = 'county'
                   WHERE x.from_region_id = r.region_id
                   ORDER BY x.weight DESC, x.to_region_id LIMIT 1
               )
           END AS county_id
    FROM regions r WHERE r.region_id = :region_id
    """
)

_LINES_SQL = text(
    """
    SELECT i.fiscal_year, i.band, i.household_size, i.income_limit, i.median_income,
           c.name AS county_name
    FROM income_limits i JOIN regions c ON c.region_id = i.region_id
    WHERE i.region_id = :county_id
      AND i.fiscal_year = (
          SELECT max(fiscal_year) FROM income_limits WHERE region_id = :county_id
      )
    ORDER BY i.band, i.household_size
    """
)


@router.get(
    "/regions/{region_id}/income-limits",
    response_model=IncomeLimits,
    summary="HUD's income limits for the region's county, every band and size",
)
def income_limits(region_id: int, session: SessionDep) -> IncomeLimits:
    """The newest fiscal year's lines. 404 for a region with no county: the state, or a
    ZIP the crosswalk does not place."""
    found = session.execute(_COUNTY_SQL, {"region_id": region_id}).mappings().first()
    if found is None:
        raise HTTPException(status_code=404, detail=f"No region {region_id}")
    if found["county_id"] is None:
        raise HTTPException(
            status_code=404, detail=f"Region {region_id} has no county to read limits for"
        )
    county_id = int(found["county_id"])
    rows = session.execute(_LINES_SQL, {"county_id": county_id}).mappings().all()
    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No income limits loaded for county {county_id}"
        )
    bands: dict[int, list[float]] = {}
    for row in rows:
        bands.setdefault(int(row["band"]), []).append(float(row["income_limit"]))
    via = {"county": "self", "municipality": "parent", "zip": "crosswalk"}[
        str(found["level"])
    ]
    return IncomeLimits(
        region_id=region_id,
        county_id=county_id,
        county_name=str(rows[0]["county_name"]),
        via=via,
        fiscal_year=int(rows[0]["fiscal_year"]),
        median_income=rows[0]["median_income"],
        bands=[
            IncomeBand(band=band, hud_name=BAND_NAMES[band], limits=limits)
            for band, limits in sorted(bands.items())
        ],
    )
