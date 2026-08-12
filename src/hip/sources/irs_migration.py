"""IRS SOI county-to-county migration flows.

Published as origin→destination pairs: one row per (destination county, origin county)
with the number of returns, exemptions, and aggregate AGI that moved. Files are named by
the two tax years compared — `countyinflow2122.csv` covers 2021→2022.

The warehouse stores only **net returns per county** (`net_migration_returns`), because
a flow needs two regions and `fact_metric_observation` has one. The full pair matrix
stays in the Parquet and DuckDB tiers, ready to promote to a `fact_migration_flow` table
when migration-driven demand analysis needs it — see the note in TODO.md.

Both directions are fetched: net is inflow minus outflow, and computing it from one file
alone is not possible.
"""

from __future__ import annotations

from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter

BASE_URL = "https://www.irs.gov/pub/irs-soi"

# SOI publishes about two years behind. Five pairs is a decade of migration history.
YEAR_PAIRS = ((21, 22), (20, 21), (19, 20), (18, 19), (17, 18))


class MigrationAdapter(SourceAdapter):
    """County inflow and outflow of tax returns, a proxy for household moves."""

    source_id: ClassVar[str] = "irs_migration"
    default_vintage: ClassVar[str] = "2122"
    landing_format: ClassVar[str] = "csv"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        pairs = [(int(vintage[:2]), int(vintage[2:]))] if vintage else list(YEAR_PAIRS)
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=direction,
                vintage=f"{y1:02d}{y2:02d}",
                url=f"{BASE_URL}/county{direction}{y1:02d}{y2:02d}.csv",
            )
            for y1, y2 in pairs
            for direction in ("inflow", "outflow")
        ]
