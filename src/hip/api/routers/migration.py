"""Who moves in and out of a region's county (Milestone 50, ARCHITECTURE #332-#333).

The IRS publishes migration by county only, so a town reads its county's and a ZIP code
the county holding most of its addresses — the resolution HUD's income limits use, and
the page says whose figures they are. One file holds the county's six years of moves in,
out and staying, with their incomes, and the ten counties sending the most arrivals and
receiving the most leavers in the newest year.

A description of who moved, never a cause: the section does not say migration raised
prices.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep
from hip.api.routers.income_limits import COUNTY_SQL

router = APIRouter(tags=["regions"])

# The figures a year carries, by the field they fill.
FIELDS = {
    "irs_inflow_returns": "inflow_returns",
    "irs_outflow_returns": "outflow_returns",
    "net_migration_returns": "net_returns",
    "irs_net_migration_per_1000": "net_per_1000",
    "irs_inflow_agi_per_return": "inflow_income",
    "irs_outflow_agi_per_return": "outflow_income",
    "irs_nonmigrant_agi_per_return": "stayer_income",
    "irs_arrival_income_ratio": "arrival_income_ratio",
}


class MigrationYear(BaseModel):
    # The year the moves landed in: the IRS pair 2022-2023 is 2023.
    year: int
    inflow_returns: float | None = None
    outflow_returns: float | None = None
    net_returns: float | None = None
    net_per_1000: float | None = None
    inflow_income: float | None = None
    outflow_income: float | None = None
    stayer_income: float | None = None
    arrival_income_ratio: float | None = None


class MigrationFlow(BaseModel):
    rank: int
    name: str
    # The county's region, where it is in New Jersey; None elsewhere.
    region_id: int | None
    returns: int
    people: int
    income_per_return: float | None
    share: float


class Migration(BaseModel):
    region_id: int
    county_id: int
    county_name: str
    # How the county was reached: the region itself, its parent, or a ZIP's crosswalk.
    via: str
    years: list[MigrationYear]
    # The newest year's origins and destinations; empty where none was published.
    flows_year: int | None
    arrivals: list[MigrationFlow]
    departures: list[MigrationFlow]
    fetched_at: datetime | None
    source: str = "IRS Statistics of Income, county-to-county migration data"


_YEARS = text(
    """
    SELECT o.metric_id, extract(year FROM o.period_end)::int AS year, o.value,
           sr.fetched_at
    FROM fact_metric_observation o JOIN source_releases sr USING (release_id)
    WHERE o.region_id = :county_id AND o.metric_id = ANY(:metrics)
    ORDER BY year
    """
)

_FLOWS = text(
    """
    SELECT f.direction, f.rank, f.other_name, f.other_region_id, f.returns, f.people,
           f.agi_per_return, f.share, f.year
    FROM migration_flows f
    WHERE f.region_id = :county_id
    ORDER BY f.direction, f.rank
    """
)


@router.get(
    "/regions/{region_id}/migration",
    response_model=Migration,
    summary="Moves in and out of the region's county, with movers' incomes",
)
def migration(region_id: int, session: SessionDep) -> Migration:
    """404 for a region with no county — the state, the nation, or a ZIP the crosswalk
    does not place — or a county with no migration figures."""
    found = session.execute(COUNTY_SQL, {"region_id": region_id}).mappings().first()
    if found is None:
        raise HTTPException(status_code=404, detail=f"No region {region_id}")
    if found["county_id"] is None:
        raise HTTPException(
            status_code=404, detail=f"Region {region_id} has no county to read"
        )
    county_id = int(found["county_id"])
    rows = session.execute(
        _YEARS, {"county_id": county_id, "metrics": list(FIELDS)}
    ).mappings()
    years: dict[int, MigrationYear] = {}
    fetched: datetime | None = None
    for row in rows:
        year = years.setdefault(int(row["year"]), MigrationYear(year=int(row["year"])))
        setattr(year, FIELDS[row["metric_id"]], float(row["value"]))
        fetched = max(fetched, row["fetched_at"]) if fetched else row["fetched_at"]
    if not years:
        raise HTTPException(
            status_code=404, detail=f"No migration figures for county {county_id}"
        )
    name = session.execute(
        text("SELECT name FROM regions WHERE region_id = :id"), {"id": county_id}
    ).scalar_one()
    flows: dict[str, list[MigrationFlow]] = {"in": [], "out": []}
    flows_year: int | None = None
    for row in session.execute(_FLOWS, {"county_id": county_id}).mappings():
        flows_year = int(row["year"])
        flows[row["direction"]].append(
            MigrationFlow(
                rank=int(row["rank"]),
                name=row["other_name"],
                region_id=row["other_region_id"],
                returns=int(row["returns"]),
                people=int(row["people"]),
                income_per_return=row["agi_per_return"],
                share=float(row["share"]),
            )
        )
    via = {"county": "self", "municipality": "parent", "zip": "crosswalk"}[
        str(found["level"])
    ]
    return Migration(
        region_id=region_id,
        county_id=county_id,
        county_name=str(name),
        via=via,
        years=[years[y] for y in sorted(years)],
        flows_year=flows_year,
        arrivals=flows["in"],
        departures=flows["out"],
        fetched_at=fetched,
    )
