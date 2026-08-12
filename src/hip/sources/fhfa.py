"""FHFA House Price Index.

`hpi_master.csv` is FHFA's combined file: every index flavor, frequency, and geography
level in one 17MB CSV. Only the state-level purchase-only seasonally-adjusted quarterly
series is used, filtered downstream in dbt rather than here, because landing stays dumb
(ARCHITECTURE, Pipeline).

**County-level HPI is not loaded.** FHFA publishes it only in the separate annual
"developmental" datasets, and the documented paths for those return 404 as of
2026-08-11. State level is what `hpi_master.csv` actually offers, and it is the one
source in the warehouse that lands at `state` level.
"""

from __future__ import annotations

from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter

MASTER_URL = "https://www.fhfa.gov/hpi/download/monthly/hpi_master.csv"


class HpiAdapter(SourceAdapter):
    """Repeat-sales index of conforming mortgage transactions."""

    source_id: ClassVar[str] = "fhfa_hpi"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "csv"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="master",
                vintage=vintage or self.default_vintage,
                url=MASTER_URL,
            )
        ]
