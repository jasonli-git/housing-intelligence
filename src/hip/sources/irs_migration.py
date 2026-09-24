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

**Newest pair by discovery** (Milestone 26). `countyinflow2223.csv` was published on
2026-03-19 and requested for the first time on 2026-09-23. From that pair SOI changed how
it matches returns across years, adding about 5% more returns than the prior method
(2022–2023 users guide), so a change spanning it is partly the method — which the packet's
caveat says.
"""

from __future__ import annotations

from datetime import date
from typing import ClassVar

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

BASE_URL = "https://www.irs.gov/pub/irs-soi"

# SOI publishes about two years behind. Five pairs is a decade of migration history.
PAIRS = 5


def year_pairs(newest: str) -> list[tuple[int, int]]:
    """The `PAIRS` consecutive pairs ending at `newest` (`"2223"`), newest first."""
    first = int(newest[:2])
    return [(y, y + 1) for y in range(first, first - PAIRS, -1)]


class MigrationAdapter(SourceAdapter):
    """County inflow and outflow of tax returns, a proxy for household moves."""

    source_id: ClassVar[str] = "irs_migration"
    # The floor: the newest pair known to exist when this was written.
    default_vintage: ClassVar[str] = "2122"
    landing_format: ClassVar[str] = "csv"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        if vintage:
            pairs = [(int(vintage[:2]), int(vintage[2:]))]
        else:
            pairs = year_pairs(self.newest or self.default_vintage)
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

    def discover(self, today: date) -> Discovery:
        """The newest pair whose inflow and outflow files both exist."""

        def exists(first: int) -> tuple[bool | None, str | None]:
            pair = f"{first % 100:02d}{(first + 1) % 100:02d}"
            found, modified = self._probe(f"{BASE_URL}/countyinflow{pair}.csv")
            if found:
                found, _ = self._probe(f"{BASE_URL}/countyoutflow{pair}.csv")
            return found, modified

        start = int((self.newest or self.default_vintage)[:2])
        first, published, reached = self._probe_forward(start, exists)
        return self._discovered(
            f"{first % 100:02d}{(first + 1) % 100:02d}",
            reached=reached,
            published=published,
        )
